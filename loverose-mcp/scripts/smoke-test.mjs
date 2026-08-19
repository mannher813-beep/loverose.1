/**
 * Test de fumée : démarre le serveur MCP (stdio) et vérifie que la surface
 * d'outils exposée est bien celle attendue.
 *
 * Vérifie en particulier que les outils de back-office `admin_*` ne sont PAS
 * exposés par défaut (ils exigent MCP_ENABLE_ADMIN_TOOLS=true).
 *
 * Usage : node scripts/smoke-test.mjs
 *         MCP_ENABLE_ADMIN_TOOLS=true node scripts/smoke-test.mjs
 */
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const adminEnabled = ["1", "true", "yes", "on"].includes(
  String(process.env.MCP_ENABLE_ADMIN_TOOLS ?? "").toLowerCase()
);

const transport = new StdioClientTransport({
  command: process.execPath,
  args: ["dist/index.js"],
  env: {
    ...process.env,
    SUPABASE_URL: process.env.SUPABASE_URL || "https://dummy.supabase.co",
    SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || "dummy-anon",
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || "dummy-service",
    MCP_TRANSPORT: "stdio",
  },
});

const client = new Client({ name: "smoke-test", version: "0.0.1" });
await client.connect(transport);

const { tools } = await client.listTools();
const names = tools.map((t) => t.name).sort();
const adminTools = names.filter((n) => n.startsWith("admin_"));

console.log(names.join("\n"));
console.log(`\nOutils exposés : ${tools.length}`);
console.log(`Outils admin_* : ${adminTools.length} (attendu : ${adminEnabled ? "10" : "0"})`);

let failed = false;

if (!adminEnabled && adminTools.length > 0) {
  console.error(`\n❌ ${adminTools.length} outils admin_* exposés alors que MCP_ENABLE_ADMIN_TOOLS est désactivé :`);
  console.error(adminTools.map((n) => `   - ${n}`).join("\n"));
  failed = true;
}

if (adminEnabled && adminTools.length === 0) {
  console.error("\n❌ MCP_ENABLE_ADMIN_TOOLS est actif mais aucun outil admin_* n'est exposé.");
  failed = true;
}

const duplicates = names.filter((n, i) => names[i - 1] === n);
if (duplicates.length > 0) {
  console.error(`\n❌ Noms d'outils dupliqués : ${[...new Set(duplicates)].join(", ")}`);
  failed = true;
}

if (failed) {
  await client.close();
  process.exit(1);
}

console.log("\n✅ Surface d'outils conforme.");
await client.close();
process.exit(0);
