import type { RegisterDomainTools } from "../types.js";

/**
 * Domaine NOTIFICATIONS
 * ---------------------
 * Source existante à réutiliser : src/components/Notifications.tsx,
 * src/lib/push.ts, tables `notifications`, `push_subscriptions`,
 * Edge Function `send-push`.
 *
 * Outils prévus (non implémentés à cette étape) :
 *   - list_notifications
 *   - mark_notification_read
 *   - register_push_subscription  (même schéma que push.ts, proxy vers send-push
 *                                   quand un envoi est nécessaire)
 */
export const registerNotificationsTools: RegisterDomainTools = ({ server, admin, config }) => {
  // Tools à enregistrer ici (server.tool(...)) — étape suivante.
};
