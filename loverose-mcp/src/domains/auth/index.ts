import type { RegisterDomainTools } from "../types.js";

/**
 * Domaine AUTH
 * ------------
 * Source existante à réutiliser : src/components/Auth.tsx, src/components/Onboarding.tsx,
 * table `profiles`, mécanisme Supabase Auth déjà en place.
 *
 * Outils prévus (non implémentés à cette étape) :
 *   - whoami                 → résout le contexte appelant (core/auth/context.ts) et
 *                              retourne les infos de base du profil courant.
 *   - check_onboarding_state → indique si le profil a terminé l'onboarding.
 *
 * Aucune règle d'inscription/connexion ne sera dupliquée ici : la création
 * de compte reste gérée par le flux Supabase Auth existant côté app.
 */
export const registerAuthTools: RegisterDomainTools = ({ server, admin, config }) => {
  // Tools à enregistrer ici (server.tool(...)) — étape suivante.
};
