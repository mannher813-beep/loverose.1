import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { loadConfig } from "./config/env.js";
import { createSupabaseAdminClient } from "./core/supabaseClient.js";
import { createLogger } from "./core/logger.js";

import { registerAuthTools } from "./domains/auth/index.js";
import { registerProfileTools } from "./domains/profile/index.js";
import { registerDiscoverTools } from "./domains/discover/index.js";
import { registerChatTools } from "./domains/chat/index.js";
import { registerPaymentsTools } from "./domains/payments/index.js";
import { registerCreatorTools } from "./domains/creator/index.js";
import { registerNotificationsTools } from "./domains/notifications/index.js";
import { registerSettingsTools } from "./domains/settings/index.js";

import type { DomainDeps } from "./domains/types.js";

/**
 * Serveur MCP LoveRose — point d'entrée.
 *
 * Ce serveur est un processus Node.js totalement indépendant de
 * l'application React (src/, functions/). Il ne modifie ni ne remplace
 * rien de l'existant : c'est une nouvelle couche d'accès qui réutilise
 * les mêmes tables Supabase, les mêmes RPC et les mêmes Edge Functions
 * que le site/l'application actuels.
 *
 * À cette étape, seule l'architecture est en place : aucun outil MCP
 * n'est encore enregistré (voir les fichiers domains/*\/index.ts, qui
 * exportent des fonctions register*Tools volontairement vides).
 */

const logger = createLogger("bootstrap");

async function main() {
  const config = loadConfig();
  const admin = createSupabaseAdminClient(config);

  const server = new McpServer({
    name: "loverose-mcp",
    version: "0.1.0",
  });

  const deps: DomainDeps = { server, admin, config };

  // Enregistrement de chaque domaine métier. Chaque fonction est, pour
  // l'instant, un squelette sans outil (voir domains/*).
  registerAuthTools(deps);
  registerProfileTools(deps);
  registerDiscoverTools(deps);
  registerChatTools(deps);
  registerPaymentsTools(deps);
  registerCreatorTools(deps);
  registerNotificationsTools(deps);
  registerSettingsTools(deps);

  if (config.transport === "stdio") {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    logger.info("Serveur MCP LoveRose démarré (stdio)");
  } else {
    // Le transport HTTP (StreamableHTTPServerTransport) sera branché ici
    // lorsque le serveur devra être accessible à distance (ex: Claude Tag,
    // connecteur MCP côté claude.ai). Non nécessaire pour l'usage local.
    throw new Error(
      "Transport HTTP pas encore câblé — utiliser MCP_TRANSPORT=stdio pour l'instant."
    );
  }
}

main().catch((err) => {
  logger.error("Échec du démarrage du serveur MCP", { error: String(err?.message ?? err) });
  process.exit(1);
});
