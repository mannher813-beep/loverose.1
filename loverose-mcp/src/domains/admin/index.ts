import { z } from "zod";
import type { RegisterDomainTools } from "../types.js";
import { mcpOk, mcpFail, withMcpErrorHandling } from "../../core/mcpResult.js";
import { accessTokenSchema, asAdminUser, unwrap, limitSchema } from "../../core/tooling.js";
import { createLogger } from "../../core/logger.js";

/**
 * Domaine ADMIN (garde : profiles.role = "admin", comme AdminPanel.tsx)
 * ---------------------------------------------------------------------
 * Réutilise les mêmes tables/RPC que src/components/AdminPanel.tsx :
 *   - reports                          (modération signalements)
 *   - profiles.is_hidden_from_feed / verification_status
 *   - verification_requests            (badge vérifié + documents KYC storage)
 *   - creator_verification_requests / payout_requests
 *   - RPC admin_send_notification({ content, target_uid })
 *   - table admin_announcements (messages ciblés avec CTA optionnel)
 */

const logger = createLogger("domain:admin");

export const registerAdminTools: RegisterDomainTools = ({ server, admin, config }) => {
  // -------------------------------------------------------------------
  // admin_list_reports
  // -------------------------------------------------------------------
  server.tool(
    "admin_list_reports",
    "[Admin] Liste les signalements (table reports) avec les profils signalés et signalants — comme l'onglet modération d'AdminPanel.",
    {
      accessToken: accessTokenSchema,
      status: z.string().max(30).optional().describe("Filtrer par statut (ex: pending, resolved)"),
      limit: limitSchema,
    },
    withMcpErrorHandling(async (args: { accessToken: string; status?: string; limit: number }) => {
      const { db } = await asAdminUser(admin, config, args.accessToken);
      let query = db.from("reports").select("*").order("created_at", { ascending: false }).limit(args.limit);
      if (args.status) query = query.eq("status", args.status);
      const reports = await query;
      if (reports.error) return mcpFail(`Lecture des signalements impossible : ${reports.error.message}`, { code: reports.error.code });
      const rows = (reports.data as any[]) ?? [];
      const uids = Array.from(new Set(rows.flatMap((r) => [r.reporter_id, r.reported_id]).filter(Boolean)));
      const profiles = uids.length ? (await db.from("profiles").select("uid, username, full_name, avatar_url, verification_status").in("uid", uids)).data ?? [] : [];
      const byUid: Record<string, any> = {};
      (profiles as any[]).forEach((p) => (byUid[p.uid] = p));
      return mcpOk({
        count: rows.length,
        reports: rows.map((r) => ({
          ...r,
          reporter: byUid[r.reporter_id] ?? null,
          reported: byUid[r.reported_id] ?? null,
        })),
      });
    })
  );

  // -------------------------------------------------------------------
  // admin_update_report_status — update AdminPanel.tsx
  // -------------------------------------------------------------------
  server.tool(
    "admin_update_report_status",
    "[Admin] Met à jour le statut d'un signalement (update reports : status, reviewed_at, reviewed_by) — même update qu'AdminPanel.tsx.",
    {
      accessToken: accessTokenSchema,
      report_id: z.string().uuid(),
      status: z.enum(["pending", "reviewing", "resolved", "dismissed"]),
    },
    withMcpErrorHandling(async (args: { accessToken: string; report_id: string; status: string }) => {
      const { uid, db } = await asAdminUser(admin, config, args.accessToken);
      const data = unwrap(
        await db
          .from("reports")
          .update({ status: args.status, reviewed_at: new Date().toISOString(), reviewed_by: uid })
          .eq("id", args.report_id)
          .select()
          .single(),
        "Mise à jour du signalement impossible"
      );
      return mcpOk({ report: data });
    })
  );

  // -------------------------------------------------------------------
  // admin_set_profile_verification / hide — updates AdminPanel.tsx
  // -------------------------------------------------------------------
  server.tool(
    "admin_set_profile_verification",
    "[Admin] Change le statut de vérification d'un profil (profiles.verification_status : none / pending / verified...) — même update qu'AdminPanel.tsx.",
    {
      accessToken: accessTokenSchema,
      target_uid: z.string().uuid(),
      status: z.enum(["none", "pending", "verified", "rejected"]),
    },
    withMcpErrorHandling(async (args: { accessToken: string; target_uid: string; status: string }) => {
      const { db } = await asAdminUser(admin, config, args.accessToken);
      const data = unwrap(
        await db.from("profiles").update({ verification_status: args.status }).eq("uid", args.target_uid).select().single(),
        "Mise à jour impossible"
      );
      return mcpOk({ profile: data });
    })
  );

  server.tool(
    "admin_hide_profile",
    "[Admin] Masque/affiche un profil du fil public (profiles.is_hidden_from_feed) — même update qu'AdminPanel.tsx.",
    {
      accessToken: accessTokenSchema,
      target_uid: z.string().uuid(),
      hidden: z.boolean(),
    },
    withMcpErrorHandling(async (args: { accessToken: string; target_uid: string; hidden: boolean }) => {
      const { db } = await asAdminUser(admin, config, args.accessToken);
      const data = unwrap(
        await db.from("profiles").update({ is_hidden_from_feed: args.hidden }).eq("uid", args.target_uid).select().single(),
        "Mise à jour impossible"
      );
      return mcpOk({ profile: data });
    })
  );

  // -------------------------------------------------------------------
  // admin_list_verifications + documents KYC signés
  // -------------------------------------------------------------------
  server.tool(
    "admin_list_verifications",
    "[Admin] Liste les demandes de vérification (verification_requests) avec les profils demandeurs ; retourne aussi des URLs signées (24h) pour consulter les documents KYC du bucket loverose.",
    {
      accessToken: accessTokenSchema,
      payment_status: z.string().max(30).optional().describe("Filtrer par paiement (paid/unpaid)"),
      limit: limitSchema,
    },
    withMcpErrorHandling(async (args: { accessToken: string; payment_status?: string; limit: number }) => {
      const { db } = await asAdminUser(admin, config, args.accessToken);
      let query = db.from("verification_requests").select("*").order("created_at", { ascending: false }).limit(args.limit);
      if (args.payment_status) query = query.eq("payment_status", args.payment_status);
      const reqs = await query;
      if (reqs.error) return mcpFail(`Lecture des demandes impossible : ${reqs.error.message}`, { code: reqs.error.code });

      const rows = (reqs.data as any[]) ?? [];
      const uids = Array.from(new Set(rows.map((r) => r.user_id).filter(Boolean)));
      const profiles = uids.length ? (await db.from("profiles").select("uid, username, full_name, avatar_url, verification_status").in("uid", uids)).data ?? [] : [];
      const byUid: Record<string, any> = {};
      (profiles as any[]).forEach((p) => (byUid[p.uid] = p));

      const enriched = await Promise.all(
        rows.map(async (r) => {
          const docs: string[] = Array.isArray(r.documents) ? r.documents : [];
          const signed = await Promise.all(
            docs.map(async (path) => {
              const s = await admin.storage.from("loverose").createSignedUrl(path, 86400);
              return s.data?.signedUrl ?? null;
            })
          );
          return { ...r, profile: byUid[r.user_id] ?? null, document_urls: signed.filter(Boolean) };
        })
      );
      return mcpOk({ count: enriched.length, verification_requests: enriched });
    })
  );

  // -------------------------------------------------------------------
  // admin_review_creator_verification
  // -------------------------------------------------------------------
  server.tool(
    "admin_review_creator_verification",
    "[Admin] Met à jour le statut d'une demande de vérification créateur (creator_verification_requests) — même écran qu'AdminPanel.tsx.",
    {
      accessToken: accessTokenSchema,
      request_id: z.string().uuid(),
      status: z.enum(["pending", "approved", "rejected"]),
    },
    withMcpErrorHandling(async (args: { accessToken: string; request_id: string; status: string }) => {
      const { db } = await asAdminUser(admin, config, args.accessToken);
      const data = unwrap(
        await db.from("creator_verification_requests").update({ status: args.status }).eq("id", args.request_id).select().single(),
        "Mise à jour impossible"
      );
      return mcpOk({ request: data });
    })
  );

  // -------------------------------------------------------------------
  // admin_update_payout_status
  // -------------------------------------------------------------------
  server.tool(
    "admin_update_payout_status",
    "[Admin] Met à jour une demande de retrait créateur (payout_requests : status / processed) — comme le back-office AdminPanel.",
    {
      accessToken: accessTokenSchema,
      payout_id: z.string().uuid(),
      status: z.enum(["pending", "processing", "paid", "rejected"]),
    },
    withMcpErrorHandling(async (args: { accessToken: string; payout_id: string; status: string }) => {
      const { db } = await asAdminUser(admin, config, args.accessToken);
      const data = unwrap(
        await db.from("payout_requests").update({ status: args.status }).eq("id", args.payout_id).select().single(),
        "Mise à jour impossible"
      );
      return mcpOk({ payout: data });
    })
  );

  // -------------------------------------------------------------------
  // admin_send_notification — RPC exacte AdminPanel.tsx
  // -------------------------------------------------------------------
  server.tool(
    "admin_send_notification",
    "[Admin] Envoie une notification à un membre (RPC admin_send_notification : content + target_uid) — même RPC que le bouton avertissement d'AdminPanel.",
    {
      accessToken: accessTokenSchema,
      target_uid: z.string().uuid().describe("uid du destinataire"),
      content: z.string().min(1).max(500).describe("Contenu du message"),
    },
    withMcpErrorHandling(async (args: { accessToken: string; target_uid: string; content: string }) => {
      const { db } = await asAdminUser(admin, config, args.accessToken);
      const rpc = await db.rpc("admin_send_notification", { content: args.content, target_uid: args.target_uid });
      if (rpc.error) return mcpFail(`RPC refusée : ${rpc.error.message}`, { code: rpc.error.code });
      return mcpOk({ sent: true, to: args.target_uid });
    })
  );

  // -------------------------------------------------------------------
  // admin_create_announcement — table admin_announcements exacte
  // -------------------------------------------------------------------
  server.tool(
    "admin_create_announcement",
    "[Admin] Publie une annonce à tout ou partie des membres (table admin_announcements : message, ciblage genre, CTA optionnel) — même insert que le panneau d'annonces.",
    {
      accessToken: accessTokenSchema,
      message: z.string().min(1).max(500).describe("Texte de l'annonce"),
      target_gender: z.string().max(30).nullable().default(null).describe("Ciblage (null = tous)"),
      cta_enabled: z.boolean().default(false),
      cta_label: z.string().max(60).optional(),
      cta_type: z.enum(["route", "url", "paid"]).optional(),
      cta_route: z.string().max(60).optional().describe("Route interne si cta_type=route (discover, dashboard, profile, settings, notifications, likes)"),
      cta_url: z.string().url().optional().describe("URL externe si cta_type=url"),
      price_amount: z.number().int().min(0).optional().describe("Prix FCFA si cta_type=paid"),
      paid_plan_name: z.string().max(80).optional().describe("Nom du plan si cta_type=paid"),
      success_redirect_url: z.string().url().optional(),
    },
    withMcpErrorHandling(async (args: {
      accessToken: string; message: string; target_gender: string | null; cta_enabled: boolean;
      cta_label?: string; cta_type?: "route" | "url" | "paid"; cta_route?: string; cta_url?: string;
      price_amount?: number; paid_plan_name?: string; success_redirect_url?: string;
    }) => {
      const { db } = await asAdminUser(admin, config, args.accessToken);
      const payload: Record<string, unknown> = {
        message: args.message.trim(),
        target_gender: args.target_gender,
        cta_enabled: args.cta_enabled,
        cta_label: args.cta_enabled && args.cta_label ? args.cta_label.trim() : null,
        cta_type: args.cta_enabled && args.cta_type ? args.cta_type : null,
        cta_route: args.cta_enabled && args.cta_type === "route" ? args.cta_route ?? null : null,
        cta_url: args.cta_enabled && args.cta_type === "url" ? args.cta_url ?? null : null,
        is_paid: args.cta_enabled && args.cta_type === "paid",
        price_amount: args.cta_enabled && args.cta_type === "paid" ? args.price_amount ?? null : null,
        paid_plan_name: args.cta_enabled && args.cta_type === "paid" ? args.paid_plan_name?.trim() ?? null : null,
        success_redirect_url: args.cta_enabled && args.cta_type === "paid" ? args.success_redirect_url ?? null : null,
      };
      const data = unwrap(await db.from("admin_announcements").insert(payload).select().single(), "Publication de l'annonce impossible");
      logger.info("announcement created", { admin: true });
      return mcpOk({ announcement: data });
    })
  );

  // -------------------------------------------------------------------
  // admin_delete_profile — comme deleteUser AdminPanel.tsx
  // -------------------------------------------------------------------
  server.tool(
    "admin_delete_profile",
    "[Admin] Supprime le profil d'un membre (ligne profiles, comme deleteUser d'AdminPanel.tsx) sans toucher son compte Auth. " +
      "Action sensible : exige la confirmation littérale « SUPPRIMER ».",
    {
      accessToken: accessTokenSchema,
      target_uid: z.string().uuid(),
      confirmation: z.literal("SUPPRIMER"),
    },
    withMcpErrorHandling(async (args: { accessToken: string; target_uid: string; confirmation: "SUPPRIMER" }) => {
      const { db } = await asAdminUser(admin, config, args.accessToken);
      const deleted = unwrap(await db.from("profiles").delete().eq("uid", args.target_uid).select(), "Suppression impossible");
      if (!deleted || deleted.length === 0) return mcpFail("Profil introuvable", { code: "not_found" });
      logger.warn("profile deleted by admin via MCP", { target: args.target_uid });
      return mcpOk({ deleted: args.target_uid });
    })
  );
};
