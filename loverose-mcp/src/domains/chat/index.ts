import type { RegisterDomainTools } from "../types.js";

/**
 * Domaine CHAT
 * ------------
 * Source existante à réutiliser : src/components/Chat.tsx, tables `matches`,
 * `messages`, `notifications`, quota de messages gratuits déjà géré côté app.
 *
 * Outils prévus (non implémentés à cette étape) :
 *   - list_conversations
 *   - get_messages(match_id)
 *   - send_message(match_id, contenu)   (mêmes règles de quota/crédits que Chat.tsx)
 *   - mark_conversation_read
 */
export const registerChatTools: RegisterDomainTools = ({ server, admin, config }) => {
  // Tools à enregistrer ici (server.tool(...)) — étape suivante.
};
