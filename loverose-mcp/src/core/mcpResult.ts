/**
 * Formatage cohérent des résultats d'outils MCP.
 *
 * Toutes les erreurs (erreurs Supabase Auth incluses) doivent être renvoyées
 * au client MCP sous une forme structurée et lisible — jamais une exception
 * non interceptée qui remonterait comme une erreur de protocole générique.
 *
 * Convention utilisée par tous les domaines :
 *   - succès  → { content: [{ type: "text", text: JSON.stringify(data) }] }
 *   - échec   → idem, mais avec `isError: true` et un payload
 *               `{ error: string, code?: string, status?: number }`
 */

export interface McpToolTextResult {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
}

export function mcpOk(data: unknown): McpToolTextResult {
  return {
    content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
  };
}

export function mcpFail(message: string, extra?: { code?: string; status?: number }): McpToolTextResult {
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify({ error: message, ...extra }, null, 2),
      },
    ],
    isError: true,
  };
}

/**
 * Convertit une erreur Supabase (`AuthError`, `PostgrestError`, ou une
 * exception JS classique) en résultat d'outil MCP en erreur, sans jamais
 * laisser une exception se propager en dehors du handler d'un outil.
 */
export function mcpFailFromSupabaseError(error: unknown): McpToolTextResult {
  if (error && typeof error === "object") {
    const anyErr = error as { message?: string; code?: string; status?: number; name?: string };
    return mcpFail(anyErr.message || "Supabase error", {
      code: anyErr.code || anyErr.name,
      status: anyErr.status,
    });
  }
  return mcpFail(String(error));
}

/**
 * Enveloppe un handler d'outil pour garantir qu'AUCUNE exception ne
 * s'échappe : toute erreur inattendue (réseau, bug, etc.) est convertie en
 * résultat MCP `isError: true` plutôt que de faire planter l'appel.
 */
export function withMcpErrorHandling<Args extends unknown[]>(
  handler: (...args: Args) => Promise<McpToolTextResult>
) {
  return async (...args: Args): Promise<McpToolTextResult> => {
    try {
      return await handler(...args);
    } catch (err) {
      return mcpFailFromSupabaseError(err);
    }
  };
}
