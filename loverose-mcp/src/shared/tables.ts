/**
 * Cartographie domaine -> tables/RPC Supabase existantes.
 *
 * Cette liste a été extraite du code actuel (src/, functions/) pour servir
 * de référence lors de l'implémentation des outils : chaque domaine doit
 * interroger EXACTEMENT ces tables/RPC, sans en recréer la logique.
 * Rien ici n'est exécuté — c'est une carte de référence pour les prochaines
 * étapes.
 */

export const DOMAIN_TABLES = {
  auth: ["profiles"],
  profile: [
    "profiles",
    "verification_requests",
    "profile_boosts",
    "profile_views",
    "pwa_install_events",
  ],
  discover: ["profiles", "likes", "matches", "blocked_users", "reports"],
  chat: ["matches", "messages", "notifications"],
  payments: [
    "payments",
    "subscriptions",
    "user_credits",
    "credit_transactions",
    "platform_settings",
    "mobile_money_operators",
  ],
  creator: [
    "creator_pages",
    "creator_dashboard_stats",
    "creator_earnings",
    "creator_payout_methods",
    "creator_tips",
    "creator_verification_requests",
    "creator_wallet",
    "payout_requests",
    "page_followers",
    "page_subscriptions",
    "posts",
    "post_comments",
    "post_likes",
    "post_shares",
    "post_unlocks",
  ],
  notifications: ["notifications", "push_subscriptions"],
  settings: ["profiles", "platform_settings", "blocked_users"],
  misc: ["ad_clicks", "ad_impressions", "avatars", "contact_messages", "referrals"],
} as const;

/**
 * Fonctions RPC Postgres déjà utilisées par le front-end et qui DOIVENT être
 * réutilisées telles quelles par les futurs outils MCP correspondants,
 * plutôt que réimplémentées (ex: calcul de statut premium, geoloc, etc.).
 */
export const EXISTING_RPCS = {
  isUserPremium: "is_user_premium",
  requestPayout: "request_payout",
  updateMyLocation: "update_my_location",
  updateMyPresence: "update_my_presence",
} as const;

/**
 * Edge Functions Supabase déjà déployées (projet iqoceeaqwfdqiucrsicm) que
 * certains outils MCP (notamment Payments/Notifications) devront appeler
 * directement plutôt que de dupliquer leur logique.
 */
export const EXISTING_EDGE_FUNCTIONS = {
  moneyFusionCreatePayment: "moneyfusion-create-payment",
  moneyFusionWebhook: "moneyfusion-webhook",
  sendPush: "send-push",
  recompressImages: "recompress-images",
  sendReengagementCampaign: "send-reengagement-campaign",
} as const;
