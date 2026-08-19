import { McpAgent } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createClient } from "@supabase/supabase-js";

// Réutilisation INTÉGRALE de la base de code du serveur MCP Node (../src) :
// mêmes 11 domaines, mêmes 93 outils, mêmes règles. Le Worker n'apporte que
// le transport (McpAgent / Durable Object) et l'accès aux variables Cloudflare.
import { registerAuthTools } from "../../src/domains/auth/index.js";
import { registerProfileTools } from "../../src/domains/profile/index.js";
import { registerDiscoverTools } from "../../src/domains/discover/index.js";
import { registerChatTools } from "../../src/domains/chat/index.js";
import { registerFeedTools } from "../../src/domains/feed/index.js";
import { registerPaymentsTools } from "../../src/domains/payments/index.js";
import { registerCreatorTools } from "../../src/domains/creator/index.js";
import { registerNotificationsTools } from "../../src/domains/notifications/index.js";
import { registerSettingsTools } from "../../src/domains/settings/index.js";
import { registerAdminTools } from "../../src/domains/admin/index.js";
import { registerExtrasTools } from "../../src/domains/extras/index.js";

import type { DomainDeps } from "../../src/domains/types.js";
import type { AppConfig } from "../../src/config/env.js";

export interface Env {
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  APP_URL?: string;
  GEMINI_API_KEY?: string;
  GEMINI_MODEL?: string;
  MCP_TOKEN_SECRET?: string;
}

/**
 * Agent MCP LoveRose — Durable Object SQLite (plan gratuit compatible).
 * Chaque appel d'outil porte le JWT utilisateur → la RLS Supabase s'applique
 * exactement comme sur le site. Aucun état sensible n'est stocké dans le DO.
 */
export class LoveRoseMCP extends McpAgent<Env> {
  server = new McpServer({ name: "loverose-mcp", version: "0.4.0" });

  async init() {
    const config: AppConfig = {
      supabaseUrl: this.env.SUPABASE_URL,
      supabaseAnonKey: this.env.SUPABASE_ANON_KEY,
      supabaseServiceRoleKey: this.env.SUPABASE_SERVICE_ROLE_KEY,
      appUrl: this.env.APP_URL || "https://loverose.pages.dev",
      transport: "http",
      httpPort: 0,
      geminiApiKey: this.env.GEMINI_API_KEY,
      geminiModel: this.env.GEMINI_MODEL || "gemini-2.0-flash",
      mcpTokenSecret: this.env.MCP_TOKEN_SECRET,
    };
    const admin = createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const anon = createClient(config.supabaseUrl, config.supabaseAnonKey, {
      auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
    });

    // NB : le cast neutralise une différence de RÉSOLUTION de types entre la
    // copie du SDK résolue depuis ../src (loverose-mcp/node_modules) et celle
    // du worker — les deux sont la même version 1.23.0 au runtime.
    const deps = { server: this.server, admin, anon, config } as unknown as DomainDeps;
    registerAuthTools(deps);
    registerProfileTools(deps);
    registerDiscoverTools(deps);
    registerChatTools(deps);
    registerFeedTools(deps);
    registerPaymentsTools(deps);
    registerCreatorTools(deps);
    registerNotificationsTools(deps);
    registerSettingsTools(deps);
    registerAdminTools(deps);
    registerExtrasTools(deps);
  }
}

const INFO_HTML = `<!doctype html><html lang="fr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>LoveRose MCP</title><style>
body{font-family:system-ui,sans-serif;background:#0f172a;color:#e2e8f0;display:grid;place-items:center;min-height:100vh;margin:0}
.card{background:#1e293b;border-radius:16px;padding:32px 40px;max-width:540px;box-shadow:0 10px 30px rgba(0,0,0,.4)}
h1{margin:0 0 8px;font-size:22px}p{color:#94a3b8;line-height:1.5}
code{background:#0f172a;padding:2px 8px;border-radius:6px;color:#f472b6}</style></head><body><div class="card">
<h1>🌹 LoveRose MCP — Cloudflare Worker</h1>
<p>Serveur MCP (Model Context Protocol) — <b>93 outils</b> pour utiliser LoveRose sans ouvrir le site : profils, découverte, chat, feed avec photos, paiements, créateurs, admin.</p>
<p>Endpoint MCP&nbsp;: <code>POST /mcp</code><br>Santé&nbsp;: <code>GET /health</code></p>
<p style="font-size:13px">À connecter comme connecteur dans ChatGPT ou Claude (claude.ai), ou en local via Claude Desktop / Cursor / VS Code.</p>
</div></body></html>`;

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/mcp" || url.pathname === "/mcp/") {
      return LoveRoseMCP.serve("/mcp", { binding: "MCP_OBJECT" as any }).fetch(request, env, ctx);
    }
    if (url.pathname === "/health") {
      return Response.json({ ok: true, server: "loverose-mcp-worker", version: "0.4.0", tools: 93 });
    }
    if (url.pathname === "/") {
      return new Response(INFO_HTML, { headers: { "content-type": "text/html;charset=utf-8" } });
    }
    return new Response("Not found", { status: 404 });
  },
};
