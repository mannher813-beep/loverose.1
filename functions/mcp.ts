import type { Env } from "./_shared/supabaseAdmin";

/**
 * Page publique d'aide : « Utiliser LoveRose depuis ChatGPT / Claude ».
 * Servie sur https://loverose.pages.dev/mcp
 *
 * L'URL du serveur MCP provient de la variable d'environnement Pages
 * `MCP_URL` (Dashboard Cloudflare → Pages → Settings → Environment
 * variables). Exemple de valeur :
 *   https://loverose-mcp.mannher813.workers.dev/mcp
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
  .actions { display: flex; gap: 10px; flex-wrap: wrap; margin: 4px 0 6px; }
  .btn-open { display: inline-flex; align-items: center; gap: 6px; background: #334155; color: #fff; border: 1px solid #475569; border-radius: 10px; padding: 10px 16px; font-weight: 700; font-size: 13.5px; text-decoration: none; }
  .btn-open:active { transform: scale(.97); }
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

  /* --- Secure login form --- */
  .login-section { margin-top: 18px; }
  .toggle-btn { display: inline-flex; align-items: center; gap: 8px; background: #334155; color: #fff; border: 1px solid #475569; border-radius: 12px; padding: 12px 20px; font-size: 14px; font-weight: 700; cursor: pointer; width: 100%; text-align: left; }
  .toggle-btn:hover { background: #3b4c63; }
  .toggle-btn .arrow { transition: transform .2s; font-size: 12px; }
  .toggle-btn.open .arrow { transform: rotate(90deg); }
  .login-form-wrap { overflow: hidden; max-height: 0; transition: max-height .35s ease; }
  .login-form-wrap.open { max-height: 600px; }
  .login-form { margin-top: 14px; display: flex; flex-direction: column; gap: 12px; }
  .input-group { display: flex; flex-direction: column; gap: 4px; }
  .input-group label { font-size: 13px; color: #94a3b8; font-weight: 600; }
  .input-group input { background: #0f172a; border: 1px solid #334155; border-radius: 10px; padding: 12px 14px; color: #e2e8f0; font-size: 14px; outline: none; }
  .input-group input:focus { border-color: #f43f5e; }
  .login-btn { background: #f43f5e; color: #fff; border: 0; border-radius: 12px; padding: 14px; font-size: 15px; font-weight: 700; cursor: pointer; }
  .login-btn:active { transform: scale(.98); }
  .login-btn:disabled { opacity: .6; cursor: wait; }
  .login-error { background: rgba(239,68,68,.12); border: 1px solid rgba(239,68,68,.3); color: #fca5a5; padding: 10px 14px; border-radius: 10px; font-size: 13px; display: none; }
  .login-success { background: rgba(16,185,129,.12); border: 1px solid rgba(16,185,129,.3); color: #6ee7b7; padding: 14px; border-radius: 10px; font-size: 13px; display: none; }
  .login-success .link-box { background: #0f172a; border: 1px solid #334155; border-radius: 8px; padding: 10px; font-family: ui-monospace, monospace; font-size: 11px; color: #f9a8d4; word-break: break-all; margin: 10px 0; max-height: 80px; overflow-y: auto; }
  .login-success .copy-link-btn { display: block; width: 100%; background: #10b981; color: #fff; border: 0; border-radius: 10px; padding: 10px; font-size: 13px; font-weight: 700; cursor: pointer; margin-top: 6px; }
  .secure-badge { display: inline-flex; align-items: center; gap: 6px; background: rgba(16,185,129,.1); color: #34d399; padding: 4px 12px; border-radius: 999px; font-size: 12px; font-weight: 600; margin-top: 8px; }
  .divider { display: flex; align-items: center; gap: 12px; color: #475569; font-size: 12px; margin: 8px 0; }
  .divider::before, .divider::after { content: ''; flex: 1; height: 1px; background: #334155; }
`;

function page(mcpUrl: string | null): string {
  const configured = !!mcpUrl;
  const url = mcpUrl || "https://loverose-mcp.mannher813.workers.dev/mcp";
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
    <span class="badge">Connecteur MCP officiel — 93 outils</span>
  </header>

  <section>
    <h2><span class="step-num">1</span> Ajoutez le connecteur (une seule fois)</h2>
    <p>Copiez ce lien et collez-le dans votre chatbot :</p>
    <div class="url-box">
      <div class="url" id="mcp-url">${url}</div>
      <button onclick="navigator.clipboard.writeText(document.getElementById('mcp-url').innerText).then(this.innerText='✓ Copié')" aria-label="Copier le lien">Copier</button>
    </div>
    <div class="actions">
      <a class="btn-open" href="https://claude.ai/settings/connectors" target="_blank" rel="noopener">🌸 Ouvrir Claude</a>
      <a class="btn-open" href="https://chatgpt.com" target="_blank" rel="noopener">💬 Ouvrir ChatGPT</a>
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
    <p class="hint" style="margin-top:12px">📱 Sur ordinateur, vous pouvez aussi brancher Claude Desktop, Cursor ou VS Code en local.</p>
  </section>

  <section>
    <h2><span class="step-num">2</span> Connectez-vous</h2>

    <div class="grid" style="gap:18px">
      <!-- Option A : Connexion sécurisée (par lien) -->
      <div class="card" style="border-color: #10b98140">
        <h3 style="display:flex;align-items:center;gap:8px">
          🔒 Connexion sécurisée
          <span class="secure-badge">🛡️ Recommandé</span>
        </h3>
        <p style="color:#94a3b8;font-size:13px;margin:8px 0 12px">
          Connectez-vous ci-dessous — <b>votre mot de passe ne transite jamais dans le chat</b>.
          Un lien chiffré est généré automatiquement.
        </p>

        <button class="toggle-btn" id="login-toggle" onclick="toggleLogin()">
          <span class="arrow">▶</span> Ouvrir le formulaire de connexion
        </button>

        <div class="login-form-wrap" id="login-form-wrap">
          <form class="login-form" id="login-form" onsubmit="return handleLogin(event)">
            <div class="input-group">
              <label for="lr-email">Adresse e-mail LoveRose</label>
              <input type="email" id="lr-email" placeholder="votre@email.com" required autocomplete="email">
            </div>
            <div class="input-group">
              <label for="lr-password">Mot de passe</label>
              <input type="password" id="lr-password" placeholder="••••••••" required autocomplete="current-password">
            </div>
            <button type="submit" class="login-btn" id="login-btn">🔐 Générer mon lien de connexion</button>
          </form>

          <div class="login-error" id="login-error"></div>

          <div class="login-success" id="login-success">
            <p><b>✅ Connecté !</b> Votre lien est prêt (valable 10 minutes) :</p>
            <div class="link-box" id="generated-link"></div>
            <button class="copy-link-btn" id="copy-link-btn" onclick="copyGeneratedLink()">📋 Copier le lien</button>
            <p style="color:#94a3b8;font-size:12px;margin-top:10px">
              Collez ce lien dans votre chatbot en disant : <em>« Connecte-moi avec ce lien : [coller] »</em>
            </p>
          </div>
        </div>
      </div>

      <!-- Option B : Classique (mot de passe dans le chat) -->
      <div class="card">
        <h3>💬 Connexion classique</h3>
        <p style="color:#94a3b8;font-size:13px;margin:8px 0 12px">
          Entrez vos identifiants directement dans la conversation :
        </p>
        <div class="chat" style="font-size:13px">
          <p class="me">Connecte-moi à LoveRose. Mon email : mon@email.com, mon mot de passe : ••••••••</p>
          <p class="bot">✅ Connecté ! Bonjour Awa 🌹 — 3 nouvelles notifications. Que voulez-vous faire ?</p>
        </div>
      </div>
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
      <li>« <b>Mon solde de crédits ?</b> » → vérifiez ce qu'il vous reste pour messager ou booster votre profil</li>
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

<script>
function toggleLogin() {
  var btn = document.getElementById('login-toggle');
  var wrap = document.getElementById('login-form-wrap');
  btn.classList.toggle('open');
  wrap.classList.toggle('open');
}

async function handleLogin(e) {
  e.preventDefault();
  var email = document.getElementById('lr-email').value.trim();
  var password = document.getElementById('lr-password').value;
  var btn = document.getElementById('login-btn');
  var errDiv = document.getElementById('login-error');
  var successDiv = document.getElementById('login-success');

  errDiv.style.display = 'none';
  successDiv.style.display = 'none';
  btn.disabled = true;
  btn.textContent = '⏳ Connexion en cours...';

  try {
    var res = await fetch('/api/mcp-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email, password: password })
    });
    var data = await res.json();

    if (!data.success) {
      errDiv.textContent = '❌ ' + (data.error || 'Identifiants incorrects');
      errDiv.style.display = 'block';
      return false;
    }

    document.getElementById('generated-link').textContent = data.tokenLink;
    successDiv.style.display = 'block';
    btn.textContent = '✅ Lien généré !';
  } catch (err) {
    errDiv.textContent = '❌ Erreur réseau — réessayez';
    errDiv.style.display = 'block';
  } finally {
    setTimeout(function() {
      btn.disabled = false;
      btn.textContent = '🔐 Générer mon lien de connexion';
    }, 3000);
  }
  return false;
}

function copyGeneratedLink() {
  var link = document.getElementById('generated-link').textContent;
  var btn = document.getElementById('copy-link-btn');
  navigator.clipboard.writeText(link).then(function() {
    btn.textContent = '✅ Copié !';
    setTimeout(function() { btn.textContent = '📋 Copier le lien'; }, 2000);
  });
}
</script>
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
