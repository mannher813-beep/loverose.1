import "dotenv/config";

/**
 * Configuration centrale du serveur MCP LoveRose.
 *
 * Ce module ne fait QUE lire et valider les variables d'environnement.
 * Il ne contient aucune logique métier — il est le pendant, côté serveur MCP,
 * de `functions/_shared/supabaseAdmin.ts` (Cloudflare Pages Functions) et des
 * `Deno.env.get(...)` utilisés dans les Edge Functions Supabase existantes.
 */

export type McpTransportMode = "stdio" | "http";

export interface AppConfig {
  supabaseUrl: string;
  supabaseServiceRoleKey: string;
  appUrl: string;
  transport: McpTransportMode;
  httpPort: number;
  trustedServiceToken?: string;
}

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `[loverose-mcp] Variable d'environnement manquante: ${name}. ` +
        `Voir .env.example à la racine du serveur MCP.`
    );
  }
  return value;
}

function optional(name: string): string | undefined {
  const value = process.env[name];
  return value && value.length > 0 ? value : undefined;
}

export function loadConfig(): AppConfig {
  const transport = (process.env.MCP_TRANSPORT || "stdio") as McpTransportMode;
  if (transport !== "stdio" && transport !== "http") {
    throw new Error(`[loverose-mcp] MCP_TRANSPORT invalide: "${transport}" (attendu "stdio" ou "http")`);
  }

  return {
    supabaseUrl: required("SUPABASE_URL"),
    supabaseServiceRoleKey: required("SUPABASE_SERVICE_ROLE_KEY"),
    appUrl: process.env.APP_URL || "https://loverose.pages.dev",
    transport,
    httpPort: Number(process.env.MCP_HTTP_PORT || 8787),
    trustedServiceToken: optional("MCP_TRUSTED_SERVICE_TOKEN"),
  };
}
