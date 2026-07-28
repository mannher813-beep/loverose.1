import type { RegisterDomainTools } from "../types.js";

/**
 * Domaine CREATOR
 * ---------------
 * Source existante à réutiliser : src/components/CreatorDashboard.tsx,
 * src/components/Creators.tsx, src/components/CreatorOnboarding.tsx,
 * src/components/PublicCreatorPage.tsx, RPC `request_payout`, tables
 * `creator_pages`, `creator_dashboard_stats`, `creator_earnings`,
 * `creator_payout_methods`, `creator_tips`, `creator_verification_requests`,
 * `creator_wallet`, `payout_requests`, `page_followers`, `page_subscriptions`,
 * `posts`, `post_comments`, `post_likes`, `post_shares`, `post_unlocks`.
 *
 * Outils prévus (non implémentés à cette étape) :
 *   - get_creator_dashboard
 *   - create_post / get_posts
 *   - request_payout            (réutilise la RPC request_payout existante)
 *   - get_creator_earnings
 */
export const registerCreatorTools: RegisterDomainTools = ({ server, admin, config }) => {
  // Tools à enregistrer ici (server.tool(...)) — étape suivante.
};
