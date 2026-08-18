import { z } from "zod";
import type { RegisterDomainTools } from "../types.js";
import { mcpOk, mcpFail, withMcpErrorHandling } from "../../core/mcpResult.js";
import { accessTokenSchema, asUser, unwrap, limitSchema } from "../../core/tooling.js";
import { createLogger } from "../../core/logger.js";

/**
 * Domaine PAYMENTS
 * ----------------
 * STRATÉGIE (conforme au README) : ce domaine NE RÉIMPLÉMENTE JAMAIS
 * l'intégration MoneyFusion. Il proxifie l'API de paiement déjà déployée
 * (functions/api/payments/create.ts côté Cloudflare Pages + Edge Functions
 * Supabase moneyfusion-create-payment / moneyfusion-webhook).
 *
 * Tables réutilisées telles quelles : payments, subscriptions, user_credits,
 * credit_transactions, platform_settings, mobile_money_operators, et la RPC
 * is_user_premium (Shop.tsx).
 */

const logger = createLogger("domain:payments");

/** Pack crédits affiché dans Shop.tsx (source de vérité des prix). */
const KNOWN_PLANS: Record<string, { name: string; amount: number; credits?: number; description: string }> = {
  pack_bronze: {
    name: "Pack 10 Crédits",
    amount: 500,
    credits: 10,
    description: "10 messages supplémentaires ou 1 boost de profil d'une heure.",
  },
  premium_mensuel: { name: "Premium Mensuel", amount: 2000, description: "Statut premium 1 mois (is_user_premium)." },
  premium_annuel: { name: "Premium Annuel", amount: 15000, description: "Statut premium 12 mois (is_user_premium)." },
  verification_badge: { name: "Badge Vérifié", amount: 500, description: "Frais de dossier pour la demande de vérification de profil." },
};

/** Proxy POST vers l'API de paiement du site — AUCUNE réimplémentation MoneyFusion. */
async function createSitePayment(
  appUrl: string,
  accessToken: string,
  body: Record<string, unknown>
): Promise<{ ok: true; data: any } | { ok: false; status: number; message: string }> {
  try {
    const res = await fetch(`${appUrl}/api/payments/create`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify(body),
    });
    const payload: any = await res.json().catch(() => null);
    if (!res.ok) {
      return { ok: false, status: res.status, message: payload?.error ?? payload?.message ?? `HTTP ${res.status}` };
    }
    return { ok: true, data: payload };
  } catch (err: any) {
    return { ok: false, status: 0, message: `Site injoignable (${appUrl}) : ${err?.message ?? err}` };
  }
}

const extractCheckout = (payload: any) => ({
  checkout_url: payload?.url ?? payload?.checkout_url ?? payload?.payment_url ?? payload?.link ?? null,
  reference: payload?.reference ?? payload?.tokenPay ?? payload?.token ?? null,
});

export const registerPaymentsTools: RegisterDomainTools = ({ server, admin, config }) => {
  // -------------------------------------------------------------------
  // list_plans — prix affichés par Shop.tsx + platform_settings
  // -------------------------------------------------------------------
  server.tool(
    "list_plans",
    "Liste les packs crédits / abonnements premium disponibles avec leurs prix FCFA (source : Shop.tsx + table platform_settings si disponible).",
    { accessToken: accessTokenSchema },
    withMcpErrorHandling(async (args: { accessToken: string }) => {
      const { db } = await asUser(admin, config, args.accessToken);
      let settings: any = null;
      try {
        const s = await db.from("platform_settings").select("*").limit(1).maybeSingle();
        settings = s.data ?? null;
      } catch {
        /* best-effort */
      }
      return mcpOk({ plans: KNOWN_PLANS, platform_settings: settings });
    })
  );

  // -------------------------------------------------------------------
  // get_credit_balance
  // -------------------------------------------------------------------
  server.tool(
    "get_credit_balance",
    "Solde de crédits du membre (table user_credits.balance) — comme le compteur de Shop.tsx.",
    { accessToken: accessTokenSchema },
    withMcpErrorHandling(async (args: { accessToken: string }) => {
      const { uid, db } = await asUser(admin, config, args.accessToken);
      const credits = unwrap(
        await db.from("user_credits").select("balance").eq("user_id", uid).maybeSingle(),
        "Lecture des crédits impossible"
      );
      return mcpOk({ balance: credits?.balance ?? 0 });
    })
  );

  // -------------------------------------------------------------------
  // get_credit_history — credit_transactions
  // -------------------------------------------------------------------
  server.tool(
    "get_credit_history",
    "Historique des mouvements de crédits du membre (table credit_transactions).",
    {
      accessToken: accessTokenSchema,
      limit: limitSchema,
    },
    withMcpErrorHandling(async (args: { accessToken: string; limit: number }) => {
      const { uid, db } = await asUser(admin, config, args.accessToken);
      const tx = await db
        .from("credit_transactions")
        .select("*")
        .eq("user_id", uid)
        .order("created_at", { ascending: false })
        .limit(args.limit);
      if (tx.error) return mcpFail(`Lecture de l'historique impossible : ${tx.error.message}`, { code: tx.error.code });
      return mcpOk({ count: (tx.data as any[])?.length ?? 0, transactions: tx.data });
    })
  );

  // -------------------------------------------------------------------
  // get_subscription_status — RPC is_user_premium (Shop.tsx)
  // -------------------------------------------------------------------
  server.tool(
    "get_subscription_status",
    "Statut premium du membre via la RPC existante is_user_premium (jamais recalculée côté MCP) + abonnement en cours (subscriptions.end_date).",
    { accessToken: accessTokenSchema },
    withMcpErrorHandling(async (args: { accessToken: string }) => {
      const { uid, db } = await asUser(admin, config, args.accessToken);
      const premium = await db.rpc("is_user_premium", { check_user_id: uid });
      if (premium.error) return mcpFail(`RPC is_user_premium indisponible : ${premium.error.message}`, { code: premium.error.code });
      const sub = await db
        .from("subscriptions")
        .select("*")
        .eq("user_id", uid)
        .order("end_date", { ascending: false })
        .limit(1)
        .maybeSingle();
      return mcpOk({ is_premium: !!premium.data, subscription: sub.data ?? null });
    })
  );

  // -------------------------------------------------------------------
  // buy_credits — proxy paiement (pack_bronze par défaut)
  // -------------------------------------------------------------------
  server.tool(
    "buy_credits",
    "Initie l'achat d'un pack de crédits (par défaut pack_bronze : 10 crédits / 500 FCFA) : renvoie le lien de paiement MoneyFusion à ouvrir. " +
      "Proxy vers l'API de paiement du site — l'intégration MoneyFusion n'est JAMAIS réimplémentée ici. Vérifiez ensuite avec get_payment_status.",
    {
      accessToken: accessTokenSchema,
      plan_id: z.string().default("pack_bronze").describe("Identifiant du pack (voir list_plans, ex: pack_bronze)"),
      amount_fcfa: z.number().int().min(100).max(10000000).optional().describe("Montant explicite (sinon prix du plan)"),
      phone_number: z.string().max(30).optional().describe("Téléphone Mobile Money pour le paiement"),
      full_name: z.string().max(120).optional().describe("Nom du payeur"),
    },
    withMcpErrorHandling(async (args: { accessToken: string; plan_id: string; amount_fcfa?: number; phone_number?: string; full_name?: string }) => {
      await asUser(admin, config, args.accessToken);
      const plan = KNOWN_PLANS[args.plan_id];
      const amount = args.amount_fcfa ?? plan?.amount;
      if (!amount) return mcpFail("Plan inconnu et aucun montant fourni — appelez list_plans", { code: "unknown_plan" });

      const result = await createSitePayment(config.appUrl, args.accessToken, {
        plan_id: args.plan_id,
        plan_name: plan?.name ?? args.plan_id,
        amount,
        ...(args.phone_number ? { phone_number: args.phone_number } : {}),
        ...(args.full_name ? { full_name: args.full_name } : {}),
      });
      if (!result.ok) {
        return mcpFail(`Création du paiement impossible : ${result.message}`, { status: result.status });
      }
      logger.info("payment initiated", { plan: args.plan_id, amount });
      return mcpOk({
        plan: args.plan_id,
        amount_fcfa: amount,
        ...extractCheckout(result.data),
        next_step: "Ouvrez le lien pour payer sur MoneyFusion, puis appelez get_payment_status avec la référence.",
      });
    })
  );

  // -------------------------------------------------------------------
  // subscribe_premium — proxy paiement abonnement
  // -------------------------------------------------------------------
  server.tool(
    "subscribe_premium",
    "Initie un abonnement premium (mensuel 2000 FCFA / annuel 15000 FCFA) : renvoie le lien MoneyFusion. Le webhook existant crée la subscription.",
    {
      accessToken: accessTokenSchema,
      plan_id: z.enum(["premium_mensuel", "premium_annuel"]),
      phone_number: z.string().max(30).optional(),
      full_name: z.string().max(120).optional(),
    },
    withMcpErrorHandling(async (args: { accessToken: string; plan_id: "premium_mensuel" | "premium_annuel"; phone_number?: string; full_name?: string }) => {
      await asUser(admin, config, args.accessToken);
      const plan = KNOWN_PLANS[args.plan_id];
      const result = await createSitePayment(config.appUrl, args.accessToken, {
        plan_id: args.plan_id,
        plan_name: plan.name,
        amount: plan.amount,
        ...(args.phone_number ? { phone_number: args.phone_number } : {}),
        ...(args.full_name ? { full_name: args.full_name } : {}),
      });
      if (!result.ok) {
        return mcpFail(`Création du paiement impossible : ${result.message}`, { status: result.status });
      }
      return mcpOk({
        plan: args.plan_id,
        amount_fcfa: plan.amount,
        ...extractCheckout(result.data),
        next_step: "Payez via le lien MoneyFusion ; le webhook active la subscription (vérifiable via get_subscription_status).",
      });
    })
  );

  // -------------------------------------------------------------------
  // get_payment_status — payments par référence
  // -------------------------------------------------------------------
  server.tool(
    "get_payment_status",
    "Statut d'un paiement (table payments, colonne reference) après un achat : pending / confirmé par le webhook moneyfusion-webhook.",
    {
      accessToken: accessTokenSchema,
      reference: z.string().min(4).describe("Référence (tokenPay) retournée à la création du paiement"),
    },
    withMcpErrorHandling(async (args: { accessToken: string; reference: string }) => {
      const { uid, db } = await asUser(admin, config, args.accessToken);
      let payment = await db.from("payments").select("*").eq("reference", args.reference).maybeSingle();
      if ((payment.error || !payment.data) && uid) {
        // Certaines lignes sont filtrées par RLS pour l'utilisateur : retombe sur
        // le client admin en restant strictement borné à CETTE référence ET à
        // l'utilisateur appelant (user_id), comme les Edge Functions le font.
        const scoped = await admin.from("payments").select("*").eq("reference", args.reference).eq("user_id", uid).maybeSingle();
        if (scoped.data) payment = scoped as any;
      }
      if (!payment.data) return mcpFail("Paiement introuvable pour cette référence", { code: "not_found" });
      return mcpOk({ payment: payment.data });
    })
  );

  // -------------------------------------------------------------------
  // list_payment_operators — mobile_money_operators
  // -------------------------------------------------------------------
  server.tool(
    "list_payment_operators",
    "Opérateurs Mobile Money acceptés selon le pays (table mobile_money_operators) — utile pour préciser l'opérateur avant un paiement.",
    {
      accessToken: accessTokenSchema,
      country: z.string().max(60).optional().describe("Filtrer par pays (ex: Cameroun)"),
    },
    withMcpErrorHandling(async (args: { accessToken: string; country?: string }) => {
      const { db } = await asUser(admin, config, args.accessToken);
      let query = db.from("mobile_money_operators").select("*");
      if (args.country) query = query.ilike("country", `%${args.country}%`);
      const ops = await query.limit(50);
      if (ops.error) return mcpFail(`Lecture des opérateurs impossible : ${ops.error.message}`, { code: ops.error.code });
      return mcpOk({ operators: ops.data });
    })
  );
};
