import type { RegisterDomainTools } from "../types.js";

/**
 * Domaine PAYMENTS
 * ----------------
 * Source existante à réutiliser :
 *   - functions/api/payments/create.ts, verify.ts, webhook.ts (Cloudflare Pages Functions)
 *   - Edge Functions Supabase : moneyfusion-create-payment, moneyfusion-webhook
 *   - tables `payments`, `subscriptions`, `user_credits`, `credit_transactions`,
 *     `platform_settings`, `mobile_money_operators`
 *   - RPC `is_user_premium`
 *
 * Outils prévus (non implémentés à cette étape) :
 *   - get_credit_balance
 *   - get_subscription_status   (réutilise la RPC is_user_premium)
 *   - create_payment            (proxy vers la Edge Function moneyfusion-create-payment,
 *                                 AUCUNE réimplémentation de l'intégration MoneyFusion)
 *   - get_payment_status(reference)
 *
 * Important : ce domaine ne doit jamais recréer la logique d'intégration
 * MoneyFusion — il appelle les Edge Functions/Cloudflare Functions existantes.
 */
export const registerPaymentsTools: RegisterDomainTools = ({ server, admin, config }) => {
  // Tools à enregistrer ici (server.tool(...)) — étape suivante.
};
