import type { RegisterDomainTools } from "../types.js";

/**
 * Domaine DISCOVER
 * ----------------
 * Source existante à réutiliser : src/components/Discover.tsx,
 * src/components/WhoLikedMe.tsx, tables `profiles`, `likes`, `matches`,
 * `blocked_users`, `reports`.
 *
 * Outils prévus (non implémentés à cette étape) :
 *   - get_recommendations   (même logique de scoring/filtrage que Discover.tsx
 *                            et que send-reengagement-campaign : compatibilité
 *                            genre/préférences, distance, exclusions blocage/
 *                            signalement/déjà-matché)
 *   - like_profile / pass_profile
 *   - get_who_liked_me
 *   - get_matches
 *   - block_user / report_user
 */
export const registerDiscoverTools: RegisterDomainTools = ({ server, admin, config }) => {
  // Tools à enregistrer ici (server.tool(...)) — étape suivante.
};
