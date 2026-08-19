import type { Env } from "../_shared/supabaseAdmin";

/**
 * GET /mcp/auth?token=<token>
 *
 * Page affichée après la connexion pré-authentifiée.
 * Montre le lien à coller dans ChatGPT/Claude avec un bouton "Copier".
 *
 * Le token est passé en query string (AES-256-GCM chiffré, 10 min TTL).
 * Le navigateur ne déchiffre RIEN — il affiche le lien complet tel quel.
 */

const PAGE_CSS = `
  :root { color-scheme: light; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0f172a; color: #e2e8f0; line-height: 1.6; min-height: 100vh; display: grid; place-items: center; }
  .card { background: #1e293b; border-radius: 20px; padding: 32px; max-width: 560px; width: 100%; margin: 16px; box-shadow: 0 10px 40px rgba(0,0,0,.4); text-align: center; }
  .icon { font-size: 48px; margin-bottom: 12px; }
  h1 { font-size: 22px; font-weight: 800; margin-bottom: 6px; }
  h1 span { color: #f43f5e; }
  .sub { color: #94a3b8; font-size: 14px; margin-bottom: 20px; }
  .link-box { background: #0f172a; border: 1px solid #334155; border-radius: 12px; padding: 14px; font-family: ui-monospace, monospace; font-size: 12px; color: #f9a8d4; word-break: break-all; text-align: left; margin: 14px 0; max-height: 120px; overflow-y: auto; }
  .copy-btn { display: block; width: 100%; background: #f43f5e; color: #fff; border: 0; border-radius: 12px; padding: 14px; font-size: 15px; font-weight: 700; cursor: pointer; margin-top: 10px; }
  .copy-btn:active { transform: scale(.98); }
  .copy-btn.copied { background: #10b981; }
  .expire { display: inline-block; background: rgba(245,158,11,.15); color: #fbbf24; padding: 4px 12px; border-radius: 999px; font-size: 12px; font-weight: 600; margin-bottom: 16px; }
  .steps { text-align: left; background: #0f172a; border: 1px solid #334155; border-radius: 12px; padding: 18px; margin-top: 18px; }
  .steps h3 { font-size: 14px; color: #f43f5e; margin-bottom: 10px; }
  .steps ol { padding-left: 20px; color: #cbd5e1; font-size: 14px; }
  .steps li { margin: 6px 0; }
  .steps b { color: #fff; }
  .back { display: inline-block; margin-top: 16px; color: #64748b; font-size: 13px; text-decoration: none; }
  .back:hover { color: #94a3b8; }
  .error { background: #1e293b; color: #fca5a5; }
  .error .icon { filter: grayscale(1) brightness(1.5); }
`;

function page(token: string | null): string {
  if (!token) {
    return `<!doctype html>
<html lang="fr"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Lien MCP — erreur</title><style>${PAGE_CSS}</style>
</head><body>
<div class="card error">
  <div class="icon">⚠️</div>
  <h1>Token manquant</h1>
  <p class="sub">Aucun token reçu. Veuillez vous connecter depuis la page MCP.</p>
  <a class="back" href="/mcp">← Retour à la page MCP</a>
</div>
</body></html>`;
  }

  // Le lien complet que l'utilisateur va coller dans ChatGPT
  const mcpBase = "https://loverose-mcp.mannher813.workers.dev";
  const tokenLink = `${mcpBase}/mcp/auth?token=${encodeURIComponent(token)}`;

  return `<!doctype html>
<html lang="fr"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Lien de connexion MCP LoveRose</title><style>${PAGE_CSS}</style>
</head><body>
<div class="card">
  <div class="icon">✅</div>
  <h1>Connexion <span>réussie</span></h1>
  <p class="sub">Votre session est prête. Copiez le lien ci-dessous et collez-le dans votre chatbot.</p>
  <div class="expire">⏱️ Valable 10 minutes</div>

  <div class="link-box" id="token-link">${tokenLink}</div>
  <button class="copy-btn" id="copy-btn" onclick="copyLink()">📋 Copier le lien</button>

  <div class="steps">
    <h3>Comment l'utiliser :</h3>
    <ol>
      <li>Copiez le lien ci-dessus</li>
      <li>Dans <b>ChatGPT</b> ou <b>Claude</b>, écrivez :</li>
      <li style="margin-top:8px"><em>« Connecte-moi avec ce lien : <b>[collez ici]</b> »</em></li>
      <li style="margin-top:6px">L'IA appelle <code>authenticateWithLink</code> — votre session est active !</li>
    </ol>
  </div>

  <a class="back" href="/mcp">← Retour au guide MCP</a>
</div>

<script>
function copyLink() {
  const link = document.getElementById('token-link').innerText;
  const btn = document.getElementById('copy-btn');
  navigator.clipboard.writeText(link).then(() => {
    btn.innerText = '✅ Lien copié !';
    btn.classList.add('copied');
    setTimeout(() => {
      btn.innerText = '📋 Copier le lien';
      btn.classList.remove('copied');
    }, 2500);
  });
}
</script>
</body></html>`;
}

export const onRequestGet: PagesFunction<Env> = async ({ request }) => {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  return new Response(page(token), {
    headers: { "Content-Type": "text/html;charset=utf-8", "Cache-Control": "no-store" },
  });
};
