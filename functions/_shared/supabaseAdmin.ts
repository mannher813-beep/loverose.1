import { createClient } from "@supabase/supabase-js";

// Cloudflare Pages Functions env bindings (set in Cloudflare dashboard:
// Settings -> Environment variables). Note: no `process.env` on Cloudflare.
export interface Env {
  VITE_SUPABASE_URL: string;
  VITE_SUPABASE_ANON_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  GEMINI_API_KEY?: string;
  APP_URL?: string;
  MONEY_FUSION_API_URL?: string;
  MONEY_FUSION_API_KEY?: string;
  MONEY_FUSION_MERCHANT_ID?: string;
  USE_LIVE_PAYMENT?: string;
  VITE_TURNSTILE_SITE_KEY?: string;
  TURNSTILE_SECRET?: string;
  /** URL publique du serveur MCP (affichée sur la page /mcp). Ex: https://loverose-mcp.xxx.workers.dev/mcp */
  MCP_URL?: string;
}

export function getSupabaseAdmin(env: Env) {
  const url = env.VITE_SUPABASE_URL || "";
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!url || !serviceKey) return null;
  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
