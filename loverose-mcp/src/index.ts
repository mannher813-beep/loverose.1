import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import express from "express";

import { loadConfig } from "./config/env.js";
import { createSupabaseAdminClient, createSupabaseAnonClient } from "./core/supabaseClient.js";
import { createLogger } from "./core/logger.js";

import { registerAllTools } from "./registry.js";

import type { DomainDeps } from "./domains/types.js";
import type { AppConfig } from "./config/env.js";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Serveur MCP LoveRose — point d'entrée.
 *
 * Deux transports :
 *   - stdio (MCP_TRANSPORT=stdio, défaut) : clients locaux (Claude Desktop,
 *     Claude Code, Cursor, VS Code...). `node dist/index.js`
 *   - http  (MCP_TRANSPORT=http)           : endpoint Streamable HTTP /mcp
 *     pour les connecteurs distants (claude.ai, ChatGPT connectors...) —
 *     à exposer derrière HTTPS (tunnel Cloudflare/ngrok ou hébergement).
 *
 * Mode HTTP « stateless » : chaque requête POST /mcp instancie un serveur +
 * transport frais (pattern recommandé par le SDK MCP pour le sans-session).
 *
 * Domaines exposés : auth, profile, discover, chat, feed, payments, creator,
 * notifications, settings, extras. Les outils de back-office `admin_*` sont
 * masqués par défaut (MCP_ENABLE_ADMIN_TOOLS=true pour les activer) — voir
 * `src/registry.ts`.
 */

const VERSION = "0.3.0";
const logger = createLogger("bootstrap");

interface SharedClients {
  admin: SupabaseClient;
  anon: SupabaseClient;
}

/** Fabrique un McpServer complet — appelée par les 2 transports. */
function buildServer(config: AppConfig, clients: SharedClients): McpServer {
  const server = new McpServer({ name: "loverose-mcp", version: VERSION });
  const deps: DomainDeps = { server, admin: clients.admin, anon: clients.anon, config };
  registerAllTools(deps, { includeAdmin: config.enableAdminTools });
  return server;
}

/**
 * Nombre d'outils réellement exposés — calculé une fois au démarrage sur un
 * serveur jetable, pour les logs et l'endpoint /health.
 */
function countTools(config: AppConfig, clients: SharedClients): number {
  const probe = new McpServer({ name: "loverose-mcp-probe", version: VERSION });
  return registerAllTools(
    { server: probe, admin: clients.admin, anon: clients.anon, config },
    { includeAdmin: config.enableAdminTools }
  );
}

async function runStdio(config: AppConfig, clients: SharedClients, toolCount: number) {
  const server = buildServer(config, clients);
  const transport = new StdioServerTransport();
  await server.connect(transport);
  logger.info(`Serveur MCP LoveRose démarré (stdio) — ${toolCount} outils`);
}

async function runHttp(config: AppConfig, clients: SharedClients, toolCount: number) {
  const app = express();
  // NB : PAS de express.json() global — StreamableHTTPServerTransport lit
  // lui-même le corps de la requête (un middleware JSON consommerait le
  // flux et casserait le protocole MCP avec "Parse error: Invalid JSON").
  // Les payloads volumineux (images base64) transitent sans limite express.

  // Endpoint MCP Streamable HTTP (stateless, sans session)
  app.post("/mcp", async (req, res) => {
    const server = buildServer(config, clients);
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    res.on("close", () => {
      transport.close().catch(() => undefined);
    });
    try {
      await server.connect(transport);
      await transport.handleRequest(req, res);
    } catch (err: any) {
      logger.error("Erreur requête /mcp", { error: String(err?.message ?? err) });
      if (!res.headersSent) {
        res.status(500).json({ jsonrpc: "2.0", error: { code: -32603, message: "Internal error" }, id: null });
      }
    }
  });

  // Stateless : pas de flux SSE GET ni de session à terminer
  app.get("/mcp", (_req, res) => {
    res.setHeader("Allow", "POST");
    res.status(405).json({ error: "MCP streamable HTTP : utilisez POST (stateless, sans session)" });
  });
  app.delete("/mcp", (_req, res) => {
    res.setHeader("Allow", "POST");
    res.status(405).json({ error: "Sessions non persistées (stateless)" });
  });

  app.get("/health", (_req, res) => {
    res.json({ ok: true, server: "loverose-mcp", version: VERSION, tools: toolCount });
  });

  // Page d'information (racine)
  app.get("/", (_req, res) => {
    res.type("html").send(
      `<!doctype html><html lang="fr"><head><meta charset="utf-8">` +
        `<meta name="viewport" content="width=device-width,initial-scale=1">` +
        `<title>LoveRose MCP</title><style>` +
        `body{font-family:system-ui,sans-serif;background:#0f172a;color:#e2e8f0;display:grid;place-items:center;min-height:100vh;margin:0}` +
        `.card{background:#1e293b;border-radius:16px;padding:32px 40px;max-width:520px;box-shadow:0 10px 30px rgba(0,0,0,.4)}` +
        `h1{margin:0 0 8px;font-size:22px}p{color:#94a3b8;line-height:1.5}` +
        `code{background:#0f172a;padding:2px 8px;border-radius:6px;color:#f472b6}` +
        `</style></head><body><div class="card">` +
        `<h1>🌹 LoveRose MCP Server</h1>` +
        `<p>Serveur MCP (Model Context Protocol) — <b>${toolCount} outils</b> pour utiliser LoveRose sans ouvrir le site : profils, découverte, chat, feed avec photos, paiements, créateurs.</p>` +
        `<p>Endpoint MCP&nbsp;: <code>POST /mcp</code><br>Santé&nbsp;: <code>GET /health</code></p>` +
        `<p style="font-size:13px">À connecter dans Claude Desktop, Claude Code, Cursor, VS Code (stdio local) ou en connecteur distant (claude.ai, ChatGPT) via cette URL HTTPS.</p>` +
        `</div></body></html>`
    );
  });

  app.listen(config.httpPort, "0.0.0.0", () => {
    logger.info(`Serveur MCP LoveRose démarré (HTTP) — http://0.0.0.0:${config.httpPort}/mcp — ${toolCount} outils`, { port: config.httpPort });
  });
}

async function main() {
  const config = loadConfig();
  const clients: SharedClients = {
    admin: createSupabaseAdminClient(config),
    anon: createSupabaseAnonClient(config),
  };

  const toolCount = countTools(config, clients);
  if (config.enableAdminTools) {
    logger.info("Outils de back-office admin_* activés (MCP_ENABLE_ADMIN_TOOLS)");
  }

  if (config.transport === "stdio") {
    await runStdio(config, clients, toolCount);
  } else {
    await runHttp(config, clients, toolCount);
  }
}

main().catch((err) => {
  logger.error("Échec du démarrage du serveur MCP", { error: String(err?.message ?? err) });
  process.exit(1);
});
