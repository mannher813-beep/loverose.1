import type { Env } from "./_shared/supabaseAdmin";

/**
 * Page publique d'aide : « Utiliser LoveRose depuis ChatGPT / Claude ».
 * Servie sur https://loverose.pages.dev/mcp
 *
 * L'URL du serveur MCP provient de la variable d'environnement Pages
 * `MCP_URL` (Dashboard Cloudflare → Pages → Settings → Environment
 * variables). Exemple de valeur :
 *   https://loverose-mcp.votre-sous-domaine.workers.dev/mcp
 */

const PAGE_CSS = `
  :root { color-scheme: light; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0f172a; color: #e2e8f0; line-height: 1.6; }
  .wrap { max-width: 760px; margin: 0 auto; padding: 24px 16px 64px; }
  header { text-align: center; padding: 40px 0 24px; }
  h1 { font-size: clamp(24px, 5vw, 34px); font-weight: 800; margin-bottom: 8px; }
  h1 span { color: #f43f5e; }
  .sub { color: #94a3b8; max-width: 520px; margin: 0 auto; }
  .badge { display: inline-block; margin-top: 12px; padding: 4px 14px; border-radius: 999px; background: rgba(244,63,94,.15); color: #fb7185; font-size: 13px; font-weight: 600; }
  section { background: #1e293b; border: 1px solid #334155; border-radius: 16px; padding: 22px; margin-top: 18px; }
  h2 { font-size: 18px; margin-bottom: 12px; display: flex; align-items: center; gap: 8px; }
  .step-num { background: #f43f5e; color: #fff; width: 26px; height: 26px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-size: 14px; flex: none; }
  ol, ul { padding-left: 22px; color: #cbd5e1; }
  li { margin: 6px 0; }
  b { color: #fff; }
  .url-box { display: flex; gap: 8px; align-items: stretch; margin: 14px 0 6px; }
  .url { flex: 1; background: #0f172a; border: 1px solid #475569; border-radius: 10px; padding: 12px; font-family: ui-monospace, monospace; font-size: 13px; color: #f9a8d4; word-break: break-all; }
  button { background: #f43f5e; color: #fff; border: 0; border-radius: 10px; padding: 0 18px; font-weight: 700; cursor: pointer; font-size: 14px; }
  button:active { transform: scale(.97); }
  .hint { font-size: 12.5px; color: #64748b; }
  .grid { display: grid; grid-template-columns: 1fr; gap: 14px; }
  @media (min-width: 640px) { .grid { grid-template-columns: 1fr 1fr; } }
  .card { background: #0f172a; border: 1px solid #334155; border-radius: 12px; padding: 16px; }
  .card h3 { font-size: 15px; margin-bottom: 8px; }
  .chat { background: #0f172a; border-radius: 12px; padding: 14px; font-size: 14.5px; color: #e2e8f0; }
  .chat p { margin: 8px 0; padding: 9px 13px; border-radius: 12px; max-width: 85%; }
  .chat .me { background: #f43f5e; margin-left: auto; color: #fff; border-bottom-right-radius: 4px; }
  .chat .bot { background: #334155; margin-right: auto; border-bottom-left-radius: 4px; }
  .warn { border-left: 3px solid #f59e0b; padding-left: 14px; color: #cbd5e1; font-size: 14px; }
  footer { text-align: center; color: #475569; font-size: 13px; margin-top: 28px; }
  a { color: #fb7185; }
`;

function page(mcpUrl: string | null): string {
  const configured = !!mcpUrl;
  const url = mcpUrl || "https://loverose-mcp.votre-sous-domaine.workers.dev/mcp";
  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>LoveRose × votre chatbot — connexion MCP</title>
<meta name="description" content="Connectez LoveRose à ChatGPT ou Claude et utilisez l'application sans ouvrir le site : profils, matchs, messages, photos, paiements.">
<style>${PAGE_CSS}</style>
</head>
<body>
<div class="wrap">
  <header>
    <h1>🌹 LoveRose <span>×</span> votre chatbot</h1>
    <p class="sub">Utilisez LoveRose directement dans ChatGPT ou Claude : profils, matchs, messages, photos, paiements — sans ouvrir le site.</p>
    <span class="badge">Connecteur MCP officiel — 92 outils</span>
  </header>

  <section>
    <h2><span class="step-num">1</span> Ajoutez le connecteur (une seule fois)</h2>
    <p>Copiez ce lien et collez-le dans votre chatbot :</p>
    <div class="url-box">
      <div class="url" id="mcp-url">${url}</div>
      <button onclick="navigator.clipboard.writeText(document.getElementById('mcp-url').innerText).then(this.innerText='✓ Copié')" aria-label="Copier le lien">Copier</button>
    </div>
    ${configured ? "" : `<p class="hint">⚠️ Lien de démonstration — l'équipe LoveRose finalise le déploiement du serveur.</p>`}
    <div class="grid" style="margin-top:16px">
      <div class="card">
        <h3>💬 Dans ChatGPT</h3>
        <ol>
          <li><b>Paramètres</b> → <b>Connecteurs</b></li>
          <li>Activez le <b>mode développeur</b> si l'option n'apparaît pas</li>
          <li><b>Créer</b> → collez le lien → <b>Installer</b></li>
          <li>Activez le connecteur <b>LoveRose</b></li>
        </ol>
      </div>
      <div class="card">
        <h3>🌸 Dans Claude (claude.ai)</h3>
        <ol>
          <li><b>Paramètres</b> → <b>Connecteurs</b></li>
          <li><b>Ajouter un connecteur personnalisé</b></li>
          <li>Collez le lien → <b>Créer</b></li>
          <li>Activez-le dans vos conversations (icône 🛠️)</li>
        </ol>
      </div>
    </div>
    <p class="hint" style="margin-top:12px">📱 Sur ordinateur, vous pouvez aussi brancher Claude Desktop, Cursor ou VS Code en local — <a href="https://github.com/mannher813-beep/loverose.1" target="_blank" rel="noopener">voir le guide complet</a>.</p>
  </section>

  <section>
    <h2><span class="step-num">2</span> Connectez-vous dans la conversation</h2>
    <div class="chat">
      <p class="me">Connecte-moi à LoveRose. Mon email : mon@email.com, mon mot de passe : ••••••••</p>
      <p class="bot">✅ Connecté ! Bonjour Awa 🌹 — 3 nouvelles notifications, 2 nouveaux likes. Que voulez-vous faire ?</p>
    </div>
    <p class="hint" style="margin-top:10px">Vos identifiants servent uniquement à ouvrir votre session LoveRose, comme sur le site. Rien n'est stocké dans le chat.</p>
  </section>

  <section>
    <h2><span class="step-num">3</span> Parlez, LoveRose obéit</h2>
    <ul>
      <li>« <b>Montre-moi des profils près de Douala</b> » → suggestions compatibles</li>
      <li>« <b>Like ce profil</b> », « <b>mes matchs ?</b> », « <b>mes messages avec Awa</b> »</li>
      <li>« <b>Le feed avec les photos</b> » → les images s'affichent dans le chat</li>
      <li>« <b>Like et commente ce post</b> », « <b>partage-le</b> »</li>
      <li>« <b>Mon solde de crédits ?</b> », « <b>recharge 500 F</b> » → lien de paiement MoneyFusion sécurisé</li>
      <li>« <b>Déconnecte-moi</b> » → session fermée</li>
    </ul>
  </section>

  <section>
    <h2>🔒 Sécurité</h2>
    <div class="warn">
      Même sécurité que le site : chaque action passe par votre session LoveRose (Supabase, RLS).
      Les <b>paiements</b> se font uniquement sur la page officielle <b>MoneyFusion</b> via un lien fourni par le chatbot —
      n'entrez jamais de code de paiement directement dans le chat. L'équipe LoveRose ne vous demandera <b>jamais</b> votre mot de passe par message.
    </div>
  </section>

  <footer>
    LoveRose — <a href="https://loverose.pages.dev">loverose.pages.dev</a> · Le site reste disponible à tout moment 💕
  </footer>
</div>
</body>
</html>`;
}

export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  return new Response(page(env.MCP_URL ?? null), {
    headers: {
      "Content-Type": "text/html;charset=utf-8",
      "Cache-Control": "public, max-age=300",
    },
  });
};
