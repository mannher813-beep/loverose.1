import type { RegisterDomainTools } from "../types.js";

/**
 * Domaine SETTINGS
 * ----------------
 * Source existante à réutiliser : src/components/Settings.tsx, tables
 * `profiles` (préférences, langue, distance max), `platform_settings`,
 * `blocked_users`.
 *
 * Outils prévus (non implémentés à cette étape) :
 *   - get_my_settings
 *   - update_my_settings        (langue, distance max, notifications, opt-out email)
 *   - list_blocked_users / unblock_user
 *   - delete_my_account         (réutilise le flux de suppression existant)
 */
export const registerSettingsTools: RegisterDomainTools = ({ server, admin, config }) => {
  // Tools à enregistrer ici (server.tool(...)) — étape suivante.
};
