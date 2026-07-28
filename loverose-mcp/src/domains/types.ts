import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AppConfig } from "../config/env.js";

/**
 * Contexte partagé injecté dans chaque domaine lors de l'enregistrement de
 * ses outils. Chaque fichier `domains/<domaine>/index.ts` exporte une
 * fonction `register<Domaine>Tools(deps)` respectant cette signature.
 *
 * Aucun outil n'est encore enregistré (`server.tool(...)`) dans cette étape
 * — uniquement la structure d'accueil.
 */
export interface DomainDeps {
  server: McpServer;
  /** Client service_role — contourne RLS, réservé aux opérations back-office. */
  admin: SupabaseClient;
  /** Client anon — mêmes privilèges que l'app React (`src/lib/supabase.ts`). */
  anon: SupabaseClient;
  config: AppConfig;
}

export type RegisterDomainTools = (deps: DomainDeps) => void;
