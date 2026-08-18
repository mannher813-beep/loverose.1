# LoveRose MCP Server — 92 outils (v0.2)

Serveur MCP (Model Context Protocol) pour LoveRose : **couche d'accès complète**
à l'application, indépendante de l'interface React. Objectif : un membre (ou un
admin) peut utiliser LoveRose **sans ouvrir le site** — inscription, découverte,
chat, feed avec photos, paiements MoneyFusion, création de contenu, modération.

Le serveur ne réimplémente AUCUNE règle métier : il interroge les mêmes tables
Supabase, appelle les mêmes RPC Postgres et proxifie les mêmes APIs que le
site/l'app PWA. La sécurité (RLS) s'applique via le JWT utilisateur fourni à
chaque outil.

## Démarrage

```bash
cd loverose-mcp
npm install
cp .env.example .env   # SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
npm run build
npm start              # stdio — à brancher dans Claude Desktop / client MCP

# test : node scripts/smoke-test.mjs  (liste les 92 outils via le protocole)
```

Deux transports (`MCP_TRANSPORT` dans .env) :

| Mode | Commande | Usage |
|---|---|---|
| `stdio` (défaut) | `node dist/index.js` | Clients **locaux** : Claude Desktop, Claude Code, Cursor, VS Code |
| `http` | `MCP_TRANSPORT=http node dist/index.js` (port `MCP_HTTP_PORT`, défaut 8787) | **Connecteurs distants** : claude.ai, ChatGPT, n'importe quel client via `POST /mcp` (Streamable HTTP, stateless) |

Vérification rapide du mode HTTP :

```bash
curl -X POST http://localhost:8787/mcp \
  -H "Content-Type: application/json" -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

## Connecter le MCP aux chatbots

### 🖥️ Claude Desktop (le plus simple — stdio local)

1. Ouvrir le fichier de config :
   - macOS : `~/Library/Application Support/Claude/claude_desktop_config.json`
   - Windows : `%APPDATA%\Claude\claude_desktop_config.json`
2. Ajouter :

```json
{
  "mcpServers": {
    "loverose": {
      "command": "node",
      "args": ["/chemin/absolu/vers/loverose-mcp/dist/index.js"],
      "env": {
        "SUPABASE_URL": "https://iqoceeaqwfdqiucrsicm.supabase.co",
        "SUPABASE_ANON_KEY": "votre-anon-key",
        "SUPABASE_SERVICE_ROLE_KEY": "votre-service-role-key",
        "APP_URL": "https://loverose.pages.dev"
      }
    }
  }
}
```

3. Relancer Claude Desktop → l'icône outils 🛠️ affiche les 92 outils LoveRose.
4. Dans la conversation : *« Connecte-toi à LoveRose : mon email est X, mon mot de passe Y »* → l'agent appelle `login`, garde le token, puis tout le reste.

### 💻 Claude Code (CLI)

```bash
claude mcp add loverose \
  -e SUPABASE_URL=https://iqoceeaqwfdqiucrsicm.supabase.co \
  -e SUPABASE_ANON_KEY=xxx -e SUPABASE_SERVICE_ROLE_KEY=xxx \
  -- node /chemin/vers/loverose-mcp/dist/index.js
```

### 🖱️ Cursor — `.cursor/mcp.json` (à la racine du projet)

```json
{
  "mcpServers": {
    "loverose": {
      "command": "node",
      "args": ["/chemin/vers/loverose-mcp/dist/index.js"],
      "env": { "SUPABASE_URL": "...", "SUPABASE_ANON_KEY": "...", "SUPABASE_SERVICE_ROLE_KEY": "..." }
    }
  }
}
```

### 🧩 VS Code (Copilot Chat, mode agent) — `.vscode/mcp.json`

```json
{
  "servers": {
    "loverose": {
      "type": "stdio",
      "command": "node",
      "args": ["/chemin/vers/loverose-mcp/dist/index.js"],
      "env": { "SUPABASE_URL": "...", "SUPABASE_ANON_KEY": "...", "SUPABASE_SERVICE_ROLE_KEY": "..." }
    }
  }
}
```

### 🌐 Claude.ai et ChatGPT (web) — connecteurs distants

Ces interfaces **n'acceptent pas stdio local** : il faut une URL **HTTPS publique** servie par le mode `http`.

1. Lancer le serveur en mode HTTP (sur votre machine ou un serveur) :
   ```bash
   MCP_TRANSPORT=http node dist/index.js
   ```
2. L'exposer en HTTPS, au choix :
   - **Cloudflare Tunnel (gratuit, recommandé)** : `cloudflared tunnel --url http://localhost:8787` → vous obtenez `https://xxx.trycloudflare.com`
   - **ngrok** : `ngrok http 8787`
   - Ou déployer `dist/` sur un hébergeur Node (Render, Railway, Fly.io, VPS...)
3. Brancher le connecteur :
   - **claude.ai** : Paramètres → Connecteurs → *Ajouter un connecteur* → URL `https://votre-tunnel/mcp`
   - **ChatGPT** : Paramètres → Connecteurs (activer le mode développeur si nécessaire) → *Créer* → URL `https://votre-tunnel/mcp`
4. Dans la conversation : *« Utilise LoveRose : connecte-moi »* → l'agent appelle `login` puis les outils.

⚠️ **Sécurité avant d'exposer publiquement** : chaque outil exige le JWT du membre (RLS appliquée), mais un endpoint public permet à quiconque de *tenter* login/register comme sur le site. Pour la production : gardez `SUPABASE_SERVICE_ROLE_KEY` uniquement côté serveur (jamais dans le client MCP distant), préférez un tunnel nommé Cloudflare avec restriction d'accès, et/ou ajoutez une authentification devant l'endpoint.

### 🔌 Autres clients compatibles MCP

Tout client supportant stdio ou Streamable HTTP : LibreChat, Warp, Cline (VS Code), Goose, n8n, l'Inspecteur MCP officiel (`npx @modelcontextprotocol/inspector node dist/index.js`).

## Authentification des outils

1. Le client appelle `login` (ou `register`) → obtient un JWT Supabase.
2. Ce `accessToken` est passé à chaque outil utilisateur.
3. Le serveur valide le JWT (`admin.auth.getUser`) puis exécute les requêtes
   avec un client porteur de CE JWT → **RLS de production appliquée**.
4. Les outils `admin_*` exigent en plus `profiles.role = "admin"`.

## Inventaire des 92 outils

### AUTH (8) — Supabase Auth via client anon
`register` · `login` · `logout` · `refreshSession` · `verifyPhoneOTP` ·
`verifyEmail` · `resendOTP` · `resetPassword`

### PROFILE (10) — Onboarding.tsx, ProfileSettings.tsx, Settings.tsx
`complete_onboarding` · `get_my_profile` · `update_my_profile` ·
`get_public_profile` · `upload_photo` (base64→Storage `loverose`) ·
`delete_photo` · `request_verification` (badge, 500 FCFA) ·
`get_verification_status` · `boost_profile` (10 crédits, 1h) · `get_profile_views`

### DISCOVER (10) — Discover.tsx, WhoLikedMe.tsx
`get_recommendations` (compatibilité genre/préférences, exclusions blocages/
likes/matchs, boostés d'abord via RPC `get_active_premium_user_ids`) ·
`like_profile` · `superlike_profile` · `pass_profile` (no-op, comme l'app) ·
`undo_last_like` · `get_who_liked_me` · `get_matches` · `unmatch` ·
`block_user` · `unblock_user` · `report_user`

### CHAT (4) — Chat.tsx (règles de quota identiques)
`list_conversations` · `get_messages` · `send_message` (3 premiers gratuits,
10 mots max sans chiffres ; au-delà le trigger PostgreSQL débite 1 crédit) ·
`get_message_quota`

### FEED (14) — Feed.tsx, PublishListing.tsx (photos/likes/commentaires/partages)
`get_feed_posts` · `get_post` · `get_post_media` (**images base64 affichables
par le client MCP**, annonces payantes verrouillées jusqu'à déblocage) ·
`create_post` (posts + annonces payantes) · `delete_my_post` · `like_post` ·
`unlike_post` · `get_post_comments` · `add_post_comment` · `share_post` ·
`review_post` (avis vendeur) · `unlock_post` (initie paiement) ·
`follow_profile` · `unfollow_profile`

### PAYMENTS (8) — proxy vers l'API du site, JAMAIS de réimplémentation MoneyFusion
`list_plans` · `get_credit_balance` · `get_credit_history` ·
`get_subscription_status` (RPC `is_user_premium`) · `buy_credits` ·
`subscribe_premium` · `get_payment_status` · `list_payment_operators`

→ Les outils de paiement renvoient un **lien checkout MoneyFusion** ; le
webhook existant (`moneyfusion-webhook`) crédite/valide comme pour le site.

### CREATOR (11) — CreatorOnboarding/Dashboard/Creators/PublicCreatorPage
`start_creator_onboarding` · `get_my_creator_page` · `get_creator_dashboard` ·
`add_payout_method` (RPC `set_payout_method`) · `request_payout` (RPC
`request_payout`) · `list_payouts` · `list_creators` · `get_creator_page` ·
`subscribe_to_page` · `tip_creator` · `get_referral_stats`

### NOTIFICATIONS (5) — Notifications.tsx, lib/push.ts
`list_notifications` · `get_unread_count` · `mark_notification_read` ·
`mark_all_notifications_read` · `register_push_subscription`

### SETTINGS (6) — Settings.tsx
`get_my_settings` · `update_my_settings` · `update_location` ·
`list_blocked_users` · `change_password` · `delete_my_account` (double
confirmation : « SUPPRIMER » + mot de passe)

### ADMIN (10) — garde profiles.role = "admin" (AdminPanel.tsx)
`admin_list_reports` · `admin_update_report_status` ·
`admin_set_profile_verification` · `admin_hide_profile` ·
`admin_list_verifications` (avec URLs signées des documents KYC) ·
`admin_review_creator_verification` · `admin_update_payout_status` ·
`admin_send_notification` (RPC existante) · `admin_create_announcement`
(table admin_announcements, CTA inclus) · `admin_delete_profile`

### EXTRAS (6) — transverse + IA Gemini (GEMINI_API_KEY optionnelle)
`get_app_config` (platform_settings) · `send_contact_message` (proxy
functions/api/contact.ts, Turnstile inchangé) · `suggest_bio` ·
`suggest_opening_line` (respecte les règles des messages gratuits) ·
`moderate_photo` · — soit 5 outils + `get_app_config`.

## Limites connues (propres au protocole MCP)

- **Pas de boutons cliquables** : les paiements/likes se font par appel
  d'outil confirmé par l'utilisateur ; le paiement ouvre un lien MoneyFusion.
- **Pas de push temps réel** : l'agent « poll » `get_unread_count` /
  `list_notifications`.
- **Realtime Supabase** (websocket) : non applicable en MCP → pagination via
  `limit`/`offset`.

## Structure

```
loverose-mcp/
├── src/
│   ├── index.ts               # entrée : McpServer + enregistrement des 11 domaines
│   ├── config/env.ts          # variables d'environnement
│   ├── core/
│   │   ├── supabaseClient.ts  # clients admin / anon / par-utilisateur (JWT → RLS)
│   │   ├── auth/context.ts    # validation JWT + rôle (pattern Edge Functions)
│   │   ├── mcpResult.ts       # résultats texte + IMAGES base64, gestion d'erreurs
│   │   ├── tooling.ts         # helpers partagés (asUser, asAdminUser, unwrap…)
│   │   ├── errors.ts · logger.ts
│   └── domains/
│       ├── auth/ profile/ discover/ chat/ feed/ payments/
│       ├── creator/ notifications/ settings/ admin/ extras/
│       └── types.ts · shared/tables.ts (cartographie tables/RPC/Edge Functions)
├── scripts/smoke-test.mjs     # vérifie les 92 outils via le protocole MCP
└── dist/                      # build tsc
```

## Ce que ce projet N'EST PAS

- Pas une modification du site/app existants (`src/`, `functions/`) : rien n'y
  a été touché.
- Pas une réimplémentation de la logique métier : mêmes tables, mêmes RPC
  (`is_user_premium`, `request_payout`, `set_payout_method`,
  `admin_send_notification`, `get_active_premium_user_ids`…), mêmes Edge
  Functions et APIs de paiement.
