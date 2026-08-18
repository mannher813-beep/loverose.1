import { z } from "zod";
import type { RegisterDomainTools } from "../types.js";
import { mcpOk, mcpFail, withMcpErrorHandling } from "../../core/mcpResult.js";
import { accessTokenSchema, asUser, unwrap, limitSchema } from "../../core/tooling.js";
import { createLogger } from "../../core/logger.js";

/**
 * Domaine CREATOR
 * ---------------
 * Réutilise CreatorOnboarding.tsx, CreatorDashboard.tsx, Creators.tsx et
 * PublicCreatorPage.tsx :
 *   - creator_pages            (pagePayload de CreatorOnboarding.tsx)
 *   - creator_wallet / creator_earnings / payout_requests
 *   - RPC set_payout_method({ target_page_id, operator, phone, country_iso, full_name_input, pin })
 *   - RPC request_payout({ target_page_id, amount, pin })
 *   - page_subscriptions / page_followers
 * Les paiements (abonnements, pourboires) passent par le proxy du domaine
 * payments → jamais réimplémentés ici.
 */

const logger = createLogger("domain:creator");

export const registerCreatorTools: RegisterDomainTools = ({ server, admin, config }) => {
  // -------------------------------------------------------------------
  // start_creator_onboarding — pagePayload CreatorOnboarding.tsx
  // -------------------------------------------------------------------
  server.tool(
    "start_creator_onboarding",
    "Crée une page créateur (table creator_pages, même payload que CreatorOnboarding.tsx) : nom, slug, bio, description, catégorie, localisation, prix d'abonnement.",
    {
      accessToken: accessTokenSchema,
      page_name: z.string().min(2).max(80).describe("Nom public de la page"),
      bio: z.string().max(150).default("").describe("Accroche courte (150 max)"),
      description: z.string().max(2000).default(""),
      category: z.string().min(2).max(60).describe("Catégorie de créateur"),
      location: z.string().max(120).default("Afrique Francophone"),
      language: z.string().max(8).default("fr"),
      interests: z.array(z.string()).max(20).default([]).describe("Centres d'intérêt (tags)"),
      subscription_price: z.number().int().min(0).max(1000000).default(0).describe("Prix d'abonnement mensuel en FCFA"),
      tips_enabled: z.boolean().default(true).describe("Activer les pourboires"),
      avatar_url: z.string().url().optional().describe("Logo de la page (upload_photo)"),
      cover_url: z.string().url().optional().describe("Image de couverture"),
    },
    withMcpErrorHandling(async (args: {
      accessToken: string; page_name: string; bio: string; description: string; category: string;
      location: string; language: string; interests: string[]; subscription_price: number;
      tips_enabled: boolean; avatar_url?: string; cover_url?: string;
    }) => {
      const { uid, db } = await asUser(admin, config, args.accessToken);
      const slug =
        args.page_name
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/(^-|-$)/g, "")
          .slice(0, 60) || `creator-${Date.now()}`;
      const pagePayload = {
        owner_id: uid,
        page_name: args.page_name.trim(),
        slug,
        bio: args.bio.substring(0, 150),
        description: args.description,
        avatar_url: args.avatar_url ?? `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(args.page_name)}`,
        cover_url: args.cover_url ?? null,
        category: args.category,
        location: args.location,
        language: args.language,
        interests: args.interests,
        subscription_price: args.subscription_price,
        tips_enabled: args.tips_enabled,
        status: "active",
        activation_paid: true,
      };
      const page = unwrap(await db.from("creator_pages").insert([pagePayload]).select().single(), "Création de la page créateur impossible");
      logger.info("creator page created", { uid, page_id: page.id });
      return mcpOk({ page });
    })
  );

  // -------------------------------------------------------------------
  // get_my_creator_page
  // -------------------------------------------------------------------
  server.tool(
    "get_my_creator_page",
    "Récupère la page créateur du membre connecté (creator_pages où owner_id = uid).",
    { accessToken: accessTokenSchema },
    withMcpErrorHandling(async (args: { accessToken: string }) => {
      const { uid, db } = await asUser(admin, config, args.accessToken);
      const page = unwrap(
        await db.from("creator_pages").select("*").eq("owner_id", uid).maybeSingle(),
        "Lecture de la page créateur impossible"
      );
      if (!page) return mcpFail("Aucune page créateur — créez-la avec start_creator_onboarding", { code: "not_found" });
      return mcpOk({ page });
    })
  );

  // -------------------------------------------------------------------
  // get_creator_dashboard — stats comme Dashboard.tsx/CreatorDashboard.tsx
  // -------------------------------------------------------------------
  server.tool(
    "get_creator_dashboard",
    "Tableau de bord du créateur connecté : wallet (creator_wallet), gains (creator_earnings), demandes de retrait (payout_requests) et stats publications.",
    { accessToken: accessTokenSchema },
    withMcpErrorHandling(async (args: { accessToken: string }) => {
      const { uid, db } = await asUser(admin, config, args.accessToken);
      const page = (await db.from("creator_pages").select("id").eq("owner_id", uid).maybeSingle()).data;
      if (!page) return mcpFail("Aucune page créateur — créez-la avec start_creator_onboarding", { code: "not_found" });

      const [walletRes, earningsRes, payoutsRes, statsRes, postsRes] = await Promise.all([
        db.from("creator_wallet").select("*").eq("page_id", page.id).maybeSingle(),
        db.from("creator_earnings").select("*").eq("page_id", page.id).order("created_at", { ascending: false }).limit(50),
        db.from("payout_requests").select("*").eq("page_id", page.id).order("created_at", { ascending: false }).limit(20),
        db.from("creator_dashboard_stats").select("*").eq("page_id", page.id).maybeSingle(),
        db.from("posts").select("id, likes_count, comments_count, shares_count, created_at").eq("author_id", uid).order("created_at", { ascending: false }).limit(100),
      ]);
      const posts = (postsRes.data as any[]) ?? [];
      return mcpOk({
        page_id: page.id,
        wallet: walletRes.data ?? { balance: 0, total_earned: 0, pending_payout: 0, currency: "XOF" },
        stats: statsRes.data ?? null,
        earnings: earningsRes.data ?? [],
        payout_requests: payoutsRes.data ?? [],
        posts_summary: {
          count: posts.length,
          total_likes: posts.reduce((s, p) => s + (p.likes_count ?? 0), 0),
          total_comments: posts.reduce((s, p) => s + (p.comments_count ?? 0), 0),
          total_shares: posts.reduce((s, p) => s + (p.shares_count ?? 0), 0),
        },
      });
    })
  );

  // -------------------------------------------------------------------
  // add_payout_method — RPC set_payout_method (CreatorDashboard.tsx)
  // -------------------------------------------------------------------
  server.tool(
    "add_payout_method",
    "Définit le moyen de retrait du créateur (RPC set_payout_method : opérateur Mobile Money, téléphone, pays, nom complet, code PIN) — même RPC que CreatorDashboard.tsx.",
    {
      accessToken: accessTokenSchema,
      operator: z.string().min(2).max(60).default("orange_cm").describe("Opérateur (ex: orange_cm, mtn_cm, wave_sn...)"),
      phone: z.string().min(6).max(30).describe("Numéro Mobile Money"),
      country_iso: z.string().min(2).max(3).describe("Code pays (ex: CM)"),
      full_name: z.string().min(2).max(120).describe("Nom complet du bénéficiaire"),
      pin: z.string().min(4).max(8).describe("Code PIN de retrait choisi par le créateur"),
    },
    withMcpErrorHandling(async (args: { accessToken: string; operator: string; phone: string; country_iso: string; full_name: string; pin: string }) => {
      const { uid, db } = await asUser(admin, config, args.accessToken);
      const page = (await db.from("creator_pages").select("id").eq("owner_id", uid).maybeSingle()).data;
      if (!page) return mcpFail("Aucune page créateur", { code: "not_found" });
      const rpc = await db.rpc("set_payout_method", {
        target_page_id: page.id,
        operator: args.operator,
        phone: args.phone,
        country_iso: args.country_iso,
        full_name_input: args.full_name,
        pin: args.pin,
      });
      if (rpc.error) return mcpFail(`RPC set_payout_method refusée : ${rpc.error.message}`, { code: rpc.error.code });
      return mcpOk({ payout_method_saved: true });
    })
  );

  // -------------------------------------------------------------------
  // request_payout — RPC request_payout (CreatorDashboard.tsx)
  // -------------------------------------------------------------------
  server.tool(
    "request_payout",
    "Demande un retrait vers le moyen de paiement configuré (RPC request_payout : montant + PIN) — la RPC existante gère soldes/plafonds, jamais recalculés ici.",
    {
      accessToken: accessTokenSchema,
      amount: z.number().int().min(100).max(10000000).describe("Montant à retirer en FCFA"),
      pin: z.string().min(4).max(8).describe("Code PIN défini via add_payout_method"),
    },
    withMcpErrorHandling(async (args: { accessToken: string; amount: number; pin: string }) => {
      const { uid, db } = await asUser(admin, config, args.accessToken);
      const page = (await db.from("creator_pages").select("id").eq("owner_id", uid).maybeSingle()).data;
      if (!page) return mcpFail("Aucune page créateur", { code: "not_found" });
      const rpc = await db.rpc("request_payout", { target_page_id: page.id, amount: args.amount, pin: args.pin });
      if (rpc.error) return mcpFail(`RPC request_payout refusée : ${rpc.error.message}`, { code: rpc.error.code });
      logger.info("payout requested", { uid, amount: args.amount });
      return mcpOk({ requested: args.amount, result: rpc.data ?? { ok: true }, note: "Traitement sous 24h comme dans l'app." });
    })
  );

  // -------------------------------------------------------------------
  // list_payouts
  // -------------------------------------------------------------------
  server.tool(
    "list_payouts",
    "Historique des demandes de retrait du créateur (payout_requests).",
    { accessToken: accessTokenSchema },
    withMcpErrorHandling(async (args: { accessToken: string }) => {
      const { uid, db } = await asUser(admin, config, args.accessToken);
      const page = (await db.from("creator_pages").select("id").eq("owner_id", uid).maybeSingle()).data;
      if (!page) return mcpFail("Aucune page créateur", { code: "not_found" });
      const payouts = await db.from("payout_requests").select("*").eq("page_id", page.id).order("created_at", { ascending: false });
      if (payouts.error) return mcpFail(`Lecture des retraits impossible : ${payouts.error.message}`, { code: payouts.error.code });
      return mcpOk({ payouts: payouts.data });
    })
  );

  // -------------------------------------------------------------------
  // list_creators — annuaire public (Creators.tsx)
  // -------------------------------------------------------------------
  server.tool(
    "list_creators",
    "Annuaire des pages créateurs (creator_pages actives) — filtrable par catégorie/localisation, comme l'écran Créateurs.",
    {
      accessToken: accessTokenSchema,
      category: z.string().max(60).optional(),
      search: z.string().max(80).optional().describe("Recherche texte dans le nom de la page"),
      limit: limitSchema,
    },
    withMcpErrorHandling(async (args: { accessToken: string; category?: string; search?: string; limit: number }) => {
      const { db } = await asUser(admin, config, args.accessToken);
      let query = db.from("creator_pages").select("*").eq("status", "active").limit(args.limit);
      if (args.category) query = query.eq("category", args.category);
      if (args.search) query = query.ilike("page_name", `%${args.search}%`);
      const pages = await query;
      if (pages.error) return mcpFail(`Lecture des créateurs impossible : ${pages.error.message}`, { code: pages.error.code });
      return mcpOk({ count: (pages.data as any[])?.length ?? 0, creators: pages.data });
    })
  );

  // -------------------------------------------------------------------
  // get_creator_page — page publique par slug
  // -------------------------------------------------------------------
  server.tool(
    "get_creator_page",
    "Page publique d'un créateur (par slug ou id) avec ses publications, son statut d'abonnement pour le membre et le nombre d'abonnés — comme PublicCreatorPage.tsx.",
    {
      accessToken: accessTokenSchema,
      slug: z.string().optional().describe("Slug de la page (URL /page/{slug})"),
      page_id: z.string().uuid().optional().describe("Ou identifiant direct"),
      include_posts: z.boolean().default(true),
    },
    withMcpErrorHandling(async (args: { accessToken: string; slug?: string; page_id?: string; include_posts: boolean }) => {
      const { uid, db } = await asUser(admin, config, args.accessToken);
      if (!args.slug && !args.page_id) return mcpFail("Fournir slug ou page_id", { code: "validation_error" });
      let q = db.from("creator_pages").select("*");
      q = args.slug ? q.eq("slug", args.slug) : q.eq("id", args.page_id!);
      const page = (await q.maybeSingle()).data;
      if (!page) return mcpFail("Page créateur introuvable", { code: "not_found" });

      const [posts, sub, followers] = await Promise.all([
        args.include_posts
          ? db.from("posts").select("*").eq("author_id", page.owner_id).order("created_at", { ascending: false }).limit(20)
          : Promise.resolve({ data: [], error: null }),
        db.from("page_subscriptions").select("id, ends_at").eq("page_id", page.id).eq("user_id", uid).eq("status", "active").gt("ends_at", new Date().toISOString()).maybeSingle(),
        db.from("page_followers").select("id", { count: "exact", head: true }).eq("page_id", page.id),
      ]);
      return mcpOk({
        page,
        posts: posts.data ?? [],
        my_subscription: sub.data ?? null,
        followers_count: followers.count ?? 0,
      });
    })
  );

  // -------------------------------------------------------------------
  // subscribe_to_page — paiement proxy (le webhook crée l'abonnement)
  // -------------------------------------------------------------------
  server.tool(
    "subscribe_to_page",
    "Initie l'abonnement à une page créateur (paiement du prix d'abonnement via le proxy MoneyFusion du site) ; le webhook existant crée la ligne page_subscriptions.",
    {
      accessToken: accessTokenSchema,
      page_id: z.string().uuid(),
    },
    withMcpErrorHandling(async (args: { accessToken: string; page_id: string }) => {
      const { db } = await asUser(admin, config, args.accessToken);
      const page = unwrap(await db.from("creator_pages").select("id, page_name, subscription_price").eq("id", args.page_id).maybeSingle(), "Lecture de la page impossible");
      if (!page) return mcpFail("Page créateur introuvable", { code: "not_found" });
      if (!page.subscription_price || page.subscription_price <= 0) {
        return mcpOk({ page_id: args.page_id, free_page: true, note: "Page sans abonnement payant — abonnez-vous aux notifications via follow_profile." });
      }
      const res = await fetch(`${config.appUrl}/api/payments/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${args.accessToken}` },
        body: JSON.stringify({
          plan_id: `page_sub:${args.page_id}`,
          plan_name: `Abonnement ${page.page_name}`,
          amount: page.subscription_price,
          related_page_id: args.page_id,
        }),
      });
      const payload: any = await res.json().catch(() => null);
      if (!res.ok) return mcpFail(`Paiement impossible (${res.status}) : ${payload?.error ?? "réponse invalide"}`, { status: res.status });
      return mcpOk({
        page_id: args.page_id,
        amount_fcfa: page.subscription_price,
        checkout_url: payload?.url ?? payload?.checkout_url ?? null,
        reference: payload?.reference ?? payload?.tokenPay ?? null,
      });
    })
  );

  // -------------------------------------------------------------------
  // tip_creator — pourboire via proxy paiement
  // -------------------------------------------------------------------
  server.tool(
    "tip_creator",
    "Envoie un pourboire à un créateur (paiement MoneyFusion via le proxy du site ; le webhook l'enregistre dans creator_tips/creator_earnings).",
    {
      accessToken: accessTokenSchema,
      page_id: z.string().uuid(),
      amount: z.number().int().min(100).max(1000000).describe("Montant du pourboire en FCFA"),
    },
    withMcpErrorHandling(async (args: { accessToken: string; page_id: string; amount: number }) => {
      const { db } = await asUser(admin, config, args.accessToken);
      const page = unwrap(await db.from("creator_pages").select("id, page_name, tips_enabled").eq("id", args.page_id).maybeSingle(), "Lecture de la page impossible");
      if (!page) return mcpFail("Page créateur introuvable", { code: "not_found" });
      if (!page.tips_enabled) return mcpFail("Les pourboires sont désactivés sur cette page", { code: "tips_disabled" });
      const res = await fetch(`${config.appUrl}/api/payments/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${args.accessToken}` },
        body: JSON.stringify({
          plan_id: `tip:${args.page_id}`,
          plan_name: `Pourboire ${page.page_name}`,
          amount: args.amount,
          related_page_id: args.page_id,
        }),
      });
      const payload: any = await res.json().catch(() => null);
      if (!res.ok) return mcpFail(`Paiement impossible (${res.status}) : ${payload?.error ?? "réponse invalide"}`, { status: res.status });
      return mcpOk({
        page_id: args.page_id,
        amount_fcfa: args.amount,
        checkout_url: payload?.url ?? payload?.checkout_url ?? null,
        reference: payload?.reference ?? payload?.tokenPay ?? null,
      });
    })
  );

  // -------------------------------------------------------------------
  // get_referral_stats — parrainage (Creators.tsx : referral_code)
  // -------------------------------------------------------------------
  server.tool(
    "get_referral_stats",
    "Code de parrainage du créateur et statistiques (referral_code / referrals_count de creator_pages) + lien de parrainage prêt à partager.",
    { accessToken: accessTokenSchema },
    withMcpErrorHandling(async (args: { accessToken: string }) => {
      const { uid, db } = await asUser(admin, config, args.accessToken);
      const page = unwrap(
        await db.from("creator_pages").select("slug, referral_code, referrals_count").eq("owner_id", uid).maybeSingle(),
        "Lecture de la page impossible"
      );
      if (!page) return mcpFail("Le parrainage nécessite une page créateur (start_creator_onboarding)", { code: "not_found" });
      return mcpOk({
        referral_code: page.referral_code ?? null,
        referrals_count: page.referrals_count ?? 0,
        referral_link: `${config.appUrl}/page/${page.slug}?ref=${page.referral_code ?? ""}`,
      });
    })
  );
};
