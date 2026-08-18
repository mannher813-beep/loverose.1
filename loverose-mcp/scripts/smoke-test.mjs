/**
 * Test de fumée : démarre le serveur MCP (stdio) et vérifie que tous les
 * outils s'enregistrent correctement via le protocole MCP.
 * Usage : node scripts/smoke-test.mjs
 */
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

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
console.log(`Outils enregistrés : ${tools.length}\n`);

const byDomain = {};
for (const t of tools) {
  const domain = t.name.startsWith("admin_") ? "admin" : t.name;
  const group = t.name.split("_")[0] === "admin" ? "admin" : null;
  const key = group ?? (["get", "buy", "subscribe", "tip", "send", "list", "mark", "register", "complete", "update", "upload", "delete", "request", "boost", "like", "superlike", "pass", "undo", "unmatch", "block", "unblock", "report", "follow", "unfollow", "review", "share", "add", "create", "unlock", "suggest", "moderate", "refresh", "verify", "resend", "reset", "change", "start"].includes(t.name.split("_")[0]) ? t.name.split("_").slice(0, 2).join("_") : t.name);
  byDomain[key] = (byDomain[key] ?? 0) + 1;
}
console.log(tools.map((t) => t.name).sort().join("\n"));
console.log(`\nTotal : ${tools.length} outils`);

await client.close();
process.exit(0);
