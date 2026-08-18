import { z } from "zod";
import type { RegisterDomainTools } from "../types.js";
import { mcpOk, mcpFail, withMcpErrorHandling } from "../../core/mcpResult.js";
import { accessTokenSchema, asUser, unwrap } from "../../core/tooling.js";
import { createLogger } from "../../core/logger.js";

/**
 * Domaine SETTINGS
 * ----------------
 * Réutilise src/components/Settings.tsx :
 *   - préférences et champs profil (même upsert profiles)
 *   - blocked_users (liste / déblocage — le blocage est dans discover)
 *   - suppression de compte (AdminPanel.tsx supprime la ligne profiles ;
 *     ici on supprime aussi l'utilisateur Auth via l'API admin, après
 *     confirmation explicite).
 *   - géoloc/présence : RPC update_my_location / update_my_presence
 */

const logger = createLogger("domain:settings");

export const registerSettingsTools: RegisterDomainTools = ({ server, admin, config }) => {
  // -------------------------------------------------------------------
  // get_my_settings
  // -------------------------------------------------------------------
  server.tool(
    "get_my_settings",
    "Récupère les paramètres du membre : champs profil modifiables (Settings.tsx), solde de crédits, statut premium et boost actif.",
    { accessToken: accessTokenSchema },
    withMcpErrorHandling(async (args: { accessToken: string }) => {
      const { uid, db } = await asUser(admin, config, args.accessToken);
      const profile = unwrap(await db.from("profiles").select("*").eq("uid", uid).maybeSingle(), "Lecture du profil impossible");
      if (!profile) return mcpFail("Aucun profil — complétez l'onboarding", { code: "not_found" });
      const [credits, sub, boost] = await Promise.all([
        db.from("user_credits").select("balance").eq("user_id", uid).maybeSingle(),
        db.from("subscriptions").select("end_date").eq("user_id", uid).gt("end_date", new Date().toISOString()).order("end_date", { ascending: false }).limit(1).maybeSingle(),
        db.from("profile_boosts").select("ends_at").eq("user_id", uid).gt("ends_at", new Date().toISOString()).order("ends_at", { ascending: false }).limit(1).maybeSingle(),
      ]);
      return mcpOk({
        profile,
        credits_balance: credits.data?.balance ?? 0,
        premium_until: (sub.data as any)?.end_date ?? null,
        boosted_until: (boost.data as any)?.ends_at ?? null,
      });
    })
  );

  // -------------------------------------------------------------------
  // update_my_settings — whitelist Settings.tsx
  // -------------------------------------------------------------------
  server.tool(
    "update_my_settings",
    "Met à jour les paramètres/préférences du membre (mêmes champs que l'écran Réglages) : bio, ville, préférences de recherche, nom affiché, téléphone...",
    {
      accessToken: accessTokenSchema,
      updates: z
        .object({
          full_name: z.string().min(1).max(80).optional(),
          username: z.string().min(2).max(40).optional(),
          bio: z.string().max(500).optional(),
          location: z.string().max(120).optional(),
          age: z.number().int().min(18).max(99).optional(),
          gender: z.string().max(30).optional(),
          preferences: z.array(z.string()).max(10).optional(),
          relationship_intents: z.array(z.string()).max(10).optional(),
          phone_country_code: z.string().max(8).optional(),
          phone_number: z.string().max(30).optional(),
        })
        .describe("Champs à mettre à jour (tous optionnels)"),
    },
    withMcpErrorHandling(async (args: { accessToken: string; updates: Record<string, unknown> }) => {
      const { uid, db } = await asUser(admin, config, args.accessToken);
      if (!args.updates || Object.keys(args.updates).length === 0) {
        return mcpFail("Aucun champ fourni dans updates", { code: "validation_error" });
      }
      const data = unwrap(
        await db.from("profiles").update({ ...args.updates, updated_at: new Date().toISOString() }).eq("uid", uid).select().single(),
        "Mise à jour impossible"
      );
      return mcpOk({ profile: data });
    })
  );

  // -------------------------------------------------------------------
  // update_location
  // -------------------------------------------------------------------
  server.tool(
    "update_location",
    "Change la localisation affichée du membre (profiles.location — ex: « Douala, Cameroun »), comme le champ ville des réglages/onboarding. " +
      "Appelle aussi la RPC update_my_presence pour rafraîchir la présence serveur.",
    {
      accessToken: accessTokenSchema,
      location: z.string().min(2).max(120).describe("Nouvelle localisation (ville, pays)"),
    },
    withMcpErrorHandling(async (args: { accessToken: string; location: string }) => {
      const { uid, db } = await asUser(admin, config, args.accessToken);
      unwrap(
        await db.from("profiles").update({ location: args.location.trim(), updated_at: new Date().toISOString() }).eq("uid", uid).select().single(),
        "Mise à jour de la localisation impossible"
      );
      // Best-effort — présence (RPC existante, utilisée par la app via presence.ts)
      try {
        await db.rpc("update_my_presence");
      } catch {
        /* présence optionnelle */
      }
      return mcpOk({ location: args.location.trim() });
    })
  );

  // -------------------------------------------------------------------
  // list_blocked_users
  // -------------------------------------------------------------------
  server.tool(
    "list_blocked_users",
    "Liste les membres bloqués par le membre connecté (blocked_users blocker_id = uid) avec leurs profils.",
    { accessToken: accessTokenSchema },
    withMcpErrorHandling(async (args: { accessToken: string }) => {
      const { uid, db } = await asUser(admin, config, args.accessToken);
      const blocked = await db.from("blocked_users").select("blocked_id, created_at").eq("blocker_id", uid).order("created_at", { ascending: false });
      if (blocked.error) return mcpFail(`Lecture des blocages impossible : ${blocked.error.message}`, { code: blocked.error.code });
      const ids = ((blocked.data as any[]) ?? []).map((b) => b.blocked_id);
      const profiles = ids.length ? (await db.from("profiles").select("uid, username, full_name, avatar_url").in("uid", ids)).data ?? [] : [];
      const byUid: Record<string, any> = {};
      (profiles as any[]).forEach((p) => (byUid[p.uid] = p));
      return mcpOk({
        count: ids.length,
        blocked: ((blocked.data as any[]) ?? []).map((b) => ({ ...b, profile: byUid[b.blocked_id] ?? null })),
      });
    })
  );

  // -------------------------------------------------------------------
  // change_password
  // -------------------------------------------------------------------
  server.tool(
    "change_password",
    "Change le mot de passe du compte (supabase.auth.updateUser avec le JWT du membre) — comme le formulaire de réinitialisation.",
    {
      accessToken: accessTokenSchema,
      new_password: z.string().min(6).max(72).describe("Nouveau mot de passe (6 caractères minimum)"),
    },
    withMcpErrorHandling(async (args: { accessToken: string; new_password: string }) => {
      const { db } = await asUser(admin, config, args.accessToken);
      const res = await db.auth.updateUser({ password: args.new_password });
      if (res.error) return mcpFail(`Changement de mot de passe impossible : ${res.error.message}`, { code: res.error.name });
      return mcpOk({ password_changed: true });
    })
  );

  // -------------------------------------------------------------------
  // delete_my_account — double confirmation par mot de passe
  // -------------------------------------------------------------------
  server.tool(
    "delete_my_account",
    "Supprime DÉFINITIVEMENT le compte LoveRose du membre : ligne profiles + utilisateur Supabase Auth (API admin). " +
      "Action irréversible — exige la confirmation littérale « SUPPRIMER » et le mot de passe courant.",
    {
      accessToken: accessTokenSchema,
      confirmation: z.literal("SUPPRIMER").describe("Tapez exactement SUPPRIMER pour confirmer"),
      password: z.string().min(1).describe("Mot de passe courant (vérification)"),
    },
    withMcpErrorHandling(async (args: { accessToken: string; confirmation: "SUPPRIMER"; password: string }) => {
      const { uid, db } = await asUser(admin, config, args.accessToken);

      // Vérifie le mot de passe en re-authentifiant (jamais stocké)
      const email = (await admin.auth.getUser(args.accessToken)).data?.user?.email;
      if (email) {
        const check = await db.auth.signInWithPassword({ email, password: args.password });
        if (check.error) return mcpFail("Mot de passe incorrect — suppression refusée", { code: "unauthorized" });
      }

      const deleted = unwrap(await db.from("profiles").delete().eq("uid", uid).select(), "Suppression du profil impossible");
      if (!deleted || deleted.length === 0) {
        return mcpFail("Profil introuvable ou déjà supprimé", { code: "not_found" });
      }
      const authDelete = await admin.auth.admin.deleteUser(uid);
      logger.warn("account deleted via MCP", { uid, authOk: !authDelete.error });
      return mcpOk({
        deleted: true,
        uid,
        auth_user_deleted: !authDelete.error,
        note: "Compte supprimé (profiles + Auth). Les données liées restent couvertes par les règles RGPD existantes du projet.",
      });
    })
  );
};
