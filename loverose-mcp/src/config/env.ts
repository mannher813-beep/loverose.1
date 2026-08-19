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
  supabaseAnonKey: string;
  supabaseServiceRoleKey: string;
  appUrl: string;
  transport: McpTransportMode;
  httpPort: number;
  trustedServiceToken?: string;
  /**
   * Expose les outils de back-office `admin_*` (défaut : false).
   * Ils exigent `profiles.role = "admin"` et n'ont aucune utilité pour un
   * connecteur grand public — les masquer allège la liste d'outils envoyée
   * au modèle à chaque conversation.
   */
  enableAdminTools: boolean;
  /** Optionnel : active les outils IA du domaine extras (suggest_bio, etc.) */
  geminiApiKey?: string;
  geminiModel?: string;
}

/** Lit un booléen d'environnement ("1", "true", "yes" — insensible à la casse). */
function boolean(name: string, fallback = false): boolean {
  const value = process.env[name];
  if (value === undefined || value.length === 0) return fallback;
  return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
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
    supabaseAnonKey: required("SUPABASE_ANON_KEY"),
    supabaseServiceRoleKey: required("SUPABASE_SERVICE_ROLE_KEY"),
    appUrl: process.env.APP_URL || "https://loverose.pages.dev",
    transport,
    httpPort: Number(process.env.MCP_HTTP_PORT || 8787),
    trustedServiceToken: optional("MCP_TRUSTED_SERVICE_TOKEN"),
    enableAdminTools: boolean("MCP_ENABLE_ADMIN_TOOLS", false),
    geminiApiKey: optional("GEMINI_API_KEY"),
    geminiModel: process.env.GEMINI_MODEL || "gemini-2.0-flash",
  };
}
