import type { RegisterDomainTools } from "../types.js";

/**
 * Domaine PROFILE
 * ---------------
 * Source existante à réutiliser : src/components/ProfileSettings.tsx,
 * src/components/ProfileDetailModal.tsx, src/components/PublicProfile.tsx,
 * tables `profiles`, `verification_requests`, `profile_boosts`, `profile_views`.
 *
 * Outils prévus (non implémentés à cette étape) :
 *   - get_my_profile
 *   - update_my_profile        (mêmes champs/validations que ProfileSettings.tsx)
 *   - get_public_profile(uid)
 *   - request_verification     (réutilise verification_requests + flux existant)
 *   - boost_profile            (réutilise profile_boosts + crédits)
 */
export const registerProfileTools: RegisterDomainTools = ({ server, admin, config }) => {
  // Tools à enregistrer ici (server.tool(...)) — étape suivante.
};
