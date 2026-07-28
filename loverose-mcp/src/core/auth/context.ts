import type { SupabaseClient } from "@supabase/supabase-js";
import type { AppConfig } from "../../config/env.js";

/**
 * Stratégie d'authentification des appels MCP.
 *
 * Chaque outil exposé par le serveur MCP agit "au nom" d'un compte LoveRose
 * existant (Profile). Pour ne dupliquer AUCUNE règle de sécurité déjà en
 * place côté Supabase (RLS, rôles, `is_admin()`, etc.), on réutilise
 * exactement le même mécanisme que les Edge Functions existantes :
 *
 *   1. Le client MCP (ex: Claude) fournit le JWT Supabase de l'utilisateur
 *      LoveRose (le même token que celui émis par `supabase.auth`), comme
 *      paramètre d'entrée de l'outil.
 *   2. Le serveur MCP valide ce JWT via `admin.auth.getUser(jwt)` — identique
 *      au pattern utilisé dans `send-reengagement-campaign` et les autres
 *      Edge Functions.
 *   3. Les tools lisent ensuite `profiles.role` pour les vérifications
 *      d'autorisation (admin, creator, etc.), sans réimplémenter la logique
 *      métier existante.
 *
 * Un second mode ("service") est prévu pour les futurs outils strictement
 * serveur-à-serveur (ex: tâches de maintenance), authentifiés par un jeton
 * de confiance distinct (MCP_TRUSTED_SERVICE_TOKEN) — jamais par un JWT
 * utilisateur détourné.
 *
 * Aucun outil n'est implémenté ici : ce module ne fournit que le mécanisme
 * de résolution de contexte que les domaines (auth/profile/discover/...)
 * utiliseront plus tard.
 */

export type CallerContext =
  | { mode: "user"; uid: string; role: string | null }
  | { mode: "service" };

export interface ResolveCallerParams {
  /** JWT Supabase de l'utilisateur LoveRose effectuant l'appel (mode "user"). */
  userAccessToken?: string;
  /** Jeton de confiance serveur-à-serveur (mode "service"). */
  serviceToken?: string;
}

export class UnauthorizedError extends Error {
  constructor(message = "Unauthorized") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

/**
 * Résout le contexte d'appel MCP à partir des identifiants fournis.
 * (Squelette — la validation complète sera branchée avec les premiers outils.)
 */
export async function resolveCallerContext(
  admin: SupabaseClient,
  config: AppConfig,
  params: ResolveCallerParams
): Promise<CallerContext> {
  if (params.serviceToken && config.trustedServiceToken && params.serviceToken === config.trustedServiceToken) {
    return { mode: "service" };
  }

  if (!params.userAccessToken) {
    throw new UnauthorizedError("Missing user access token");
  }

  const { data, error } = await admin.auth.getUser(params.userAccessToken);
  if (error || !data?.user) {
    throw new UnauthorizedError("Invalid or expired session");
  }

  const { data: profile } = await admin
    .from("profiles")
    .select("role")
    .eq("uid", data.user.id)
    .single();

  return { mode: "user", uid: data.user.id, role: profile?.role ?? null };
}
