# Faire tourner le serveur MCP LoveRose sur Android avec Termux

Termux transforme un téléphone Android en terminal Linux complet : Node.js y
tourne très bien, et le serveur MCP LoveRose n'utilise **que des dépendances
JavaScript pures** (express, supabase-js, zod, SDK MCP) — aucune compilation
native, donc installation immédiate.

## 1. Installation de Termux

⚠️ Installer Termux depuis **F-Droid** (https://f-droid.org/packages/com.termux/)
ou GitHub (termux/termux-app releases) — la version du Play Store est obsolète.

```bash
pkg update && pkg upgrade -y
pkg install nodejs-lts git nano
node -v   # doit afficher v18+ (idéalement v20/v22)
```

## 2. Récupérer le projet et installer

```bash
git clone https://github.com/mannher813-beep/loverose.1.git
cd loverose.1/loverose-mcp
npm install
```

## 3. Configurer les clés

```bash
cp .env.example .env
nano .env
```

Renseigner :
```
SUPABASE_URL=https://iqoceeaqwfdqiucrsicm.supabase.co
SUPABASE_ANON_KEY=...        # VITE_SUPABASE_ANON_KEY du site
SUPABASE_SERVICE_ROLE_KEY=...
APP_URL=https://loverose.pages.dev
MCP_TRANSPORT=http
MCP_HTTP_PORT=8787
# GEMINI_API_KEY=...         (optionnel, outils IA)
```

## 4. Lancer le serveur

```bash
npm run build
termux-wake-lock             # empêche Android d'endormir le processus
node dist/index.js
# → Serveur MCP LoveRose démarré (HTTP) — http://0.0.0.0:8787/mcp — 82 outils
```

Test dans un autre onglet Termux (swipe gauche ou `termux-new-session`) :
```bash
curl http://localhost:8787/health
```

## 5. Le rendre accessible depuis ChatGPT / Claude (tunnel HTTPS)

Les connecteurs des chatbots exigent une URL **HTTPS publique**. Depuis
Termux, deux options :

### Option A — cloudflared (gratuit, sans compte)
```bash
pkg install cloudflared
cloudflared tunnel --url http://localhost:8787
# → affiche https://xxx.trycloudflare.com
```
Le lien MCP à coller dans le chatbot : `https://xxx.trycloudflare.com/mcp`

### Option B — ngrok
```bash
pkg install ngrok            # ou binaire ARM64 depuis ngrok.com
ngrok config add-authtoken VOTRE_TOKEN   (gratuit sur ngrok.com)
ngrok http 8787
```

Puis : ChatGPT → Paramètres → Connecteurs → Créer → coller `https://…/mcp`.
Idem côté Claude (claude.ai) → Connecteurs personnalisés.

## 6. Utiliser LoveRose depuis le téléphone

Une fois le connecteur ajouté dans l'app **ChatGPT** ou **Claude** (Android) :

> « Connecte-moi à LoveRose. Mon email : …, mon mot de passe : … »

et tout fonctionne : profils, likes, messages, photos du feed, paiements.

## ⚠️ Limites à connaître (héberger depuis un téléphone)

| Limite | Détail |
|---|---|
| **Le téléphone doit rester allumé** | `termux-wake-lock` + désactiver l'optimisation batterie pour Termux ; dès que le téléphone s'éteint, le lien MCP tombe |
| **Tunnel gratuit temporaire** | L'URL trycloudflare change à chaque redémarrage → re-configurer le connecteur |
| **Données/batterie** | Le serveur consomme peu, mais un hébergement 24/7 sur téléphone n'est pas prévu pour |

## 💡 Recommandation

Termux est **parfait pour tester et développer** (et même pour déployer).
Pour un service **permanent** destiné aux utilisateurs, déployez le Worker
Cloudflare une fois (voir README §« Déployer sur Cloudflare Workers ») :

```bash
# Possible aussi depuis Termux :
cd loverose-mcp/worker
npm install
npx wrangler login                    # copier l'URL OAuth vers le navigateur
npx wrangler secret put SUPABASE_ANON_KEY
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
npx wrangler deploy
```
(`wrangler dev` local ne marche pas sous Termux — workerd n'a pas de binaire
Android — mais `wrangler deploy` fonctionne.)

Après ça, le téléphone ne sert qu'à discuter : plus besoin de Termux du tout.
