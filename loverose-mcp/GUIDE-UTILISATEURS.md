# Utiliser LoveRose depuis ChatGPT, Claude ou votre chatbot préféré

> **Guide à partager avec vos utilisateurs** — il ne leur faut que le lien du
> serveur MCP LoveRose et leurs identifiants LoveRose habituels.

## C'est quoi ?

LoveRose est connecté à votre chatbot via **MCP** (Model Context Protocol) :
92 outils (profils, découverte, chat, photos, paiements, créateurs…) que
l'IA utilise **à votre place**. Vous n'ouvrez plus le site — vous parlez.

## Étape 1 — Ajouter le connecteur (une seule fois)

**Lien du serveur MCP LoveRose :**
```
https://VOTRE-DOMAINE-MCP/mcp
```
*(remplacer par l'URL réelle une fois le serveur déployé — voir README)*

### Dans ChatGPT
1. Paramètres → **Connecteurs** (activez le *mode développeur* si l'option n'apparaît pas)
2. **Créer / Add connector** → collez l'URL ci-dessus
3. Le connecteur **LoveRose** apparaît : activez-le

### Dans Claude (claude.ai)
1. Paramètres → **Connecteurs**
2. **Ajouter un connecteur personnalisé** → collez l'URL ci-dessus
3. Activez-le dans vos conversations (icône 🛠️)

### Dans les applications locales (Claude Desktop, Cursor, VS Code…)
Voir le README du projet (`loverose-mcp/README.md`) — configuration stdio locale.

## Étape 2 — Se connecter dans la conversation

Écrivez simplement :

> Connecte-moi à LoveRose. Mon email : `mon@email.com`, mon mot de passe : `********`

L'IA appelle l'outil `login` et garde votre session. **Vos identifiants ne sont
stockés nulle part** : ils servent uniquement à ouvrir votre session LoveRose
exactement comme sur le site (même sécurité Supabase).

## Étape 3 — Profiter

| Vous dites | L'IA fait |
|---|---|
| « Montre-moi des profils près de Douala » | `get_recommendations` |
| « Like ce profil » / « Matchs ? » | `like_profile` / `get_matches` |
| « Mes messages avec Awa » | `list_conversations` + `get_messages` |
| « Réponds : bonjour Awa 😊 » | `send_message` |
| « Le feed, avec les photos » | `get_feed_posts` + `get_post_media` (photos affichées) |
| « Like et commente ce post » | `like_post` + `add_post_comment` |
| « Mon solde de crédits » / « Recharge 500 F » | `get_credit_balance` / `buy_credits` → lien de paiement sécurisé |
| « Mes notifications » | `list_notifications` |

## ⚠️ Bonnes réflexes

- **Paiements** : l'IA vous montre un **lien MoneyFusion officiel** — payez là-bas,
  jamais « dans le chat ».
- **Actions sensibles** (supprimer le compte, déblocage payant) : l'IA doit
  toujours vous demander confirmation avant d'agir.
- **Déconnexion** : dites « déconnecte-moi de LoveRose » → `logout`.
- Un problème ? Le site https://loverose.pages.dev reste toujours disponible.
