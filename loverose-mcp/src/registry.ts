import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { registerAuthTools } from "./domains/auth/index.js";
import { registerProfileTools } from "./domains/profile/index.js";
import { registerDiscoverTools } from "./domains/discover/index.js";
import { registerChatTools } from "./domains/chat/index.js";
import { registerFeedTools } from "./domains/feed/index.js";
import { registerPaymentsTools } from "./domains/payments/index.js";
import { registerCreatorTools } from "./domains/creator/index.js";
import { registerNotificationsTools } from "./domains/notifications/index.js";
import { registerSettingsTools } from "./domains/settings/index.js";
import { registerAdminTools } from "./domains/admin/index.js";
import { registerExtrasTools } from "./domains/extras/index.js";

import type { DomainDeps, RegisterDomainTools } from "./domains/types.js";

/**
 * Registre central des outils MCP LoveRose.
 *
 * Point unique où l'on décide QUELS domaines sont exposés — partagé par les
 * deux hôtes (serveur Node `src/index.ts` et Worker Cloudflare
 * `worker/src/index.ts`) pour qu'ils ne puissent pas diverger.
 *
 * Les outils de back-office (`admin_*`) ne sont PAS exposés par défaut :
 * ils sont inutilisables sans `profiles.role = "admin"` et n'encombrent donc
 * que la fenêtre de contexte des connecteurs grand public (ChatGPT, Claude).
 * Activez-les explicitement avec `MCP_ENABLE_ADMIN_TOOLS=true` sur une
 * instance interne.
 */

/** Domaines toujours exposés — le parcours membre complet. */
const MEMBER_DOMAINS: RegisterDomainTools[] = [
  registerAuthTools,
  registerProfileTools,
  registerDiscoverTools,
  registerChatTools,
  registerFeedTools,
  registerPaymentsTools,
  registerCreatorTools,
  registerNotificationsTools,
  registerSettingsTools,
  registerExtrasTools,
];

/** Domaines réservés au back-office, derrière `MCP_ENABLE_ADMIN_TOOLS`. */
const ADMIN_DOMAINS: RegisterDomainTools[] = [registerAdminTools];

export interface RegisterOptions {
  /** Expose aussi les outils `admin_*` (défaut : false). */
  includeAdmin?: boolean;
}

/**
 * Enregistre les domaines retenus sur le serveur et retourne le nombre exact
 * d'outils exposés.
 *
 * Le comptage instrumente `server.tool` le temps de l'enregistrement plutôt
 * que de maintenir un total en dur : impossible qu'il se désynchronise quand
 * un outil est ajouté ou retiré.
 */
export function registerAllTools(deps: DomainDeps, options: RegisterOptions = {}): number {
  const domains = options.includeAdmin ? [...MEMBER_DOMAINS, ...ADMIN_DOMAINS] : MEMBER_DOMAINS;

  const server = deps.server;
  const originalTool = server.tool.bind(server) as McpServer["tool"];
  let count = 0;
  // Cast : on réexpose la signature surchargée du SDK à l'identique, en
  // n'ajoutant qu'un compteur — le typage nominal des overloads ne survit
  // pas à un wrapper variadique.
  server.tool = ((...args: Parameters<McpServer["tool"]>) => {
    count += 1;
    return (originalTool as (...a: unknown[]) => unknown)(...args);
  }) as McpServer["tool"];

  try {
    for (const register of domains) register(deps);
  } finally {
    server.tool = originalTool;
  }

  return count;
}
