# LoveRose MCP Server — architecture (v0.1, sans outils)

Ce dossier contient **uniquement l'architecture** d'un serveur MCP (Model
Context Protocol) pour LoveRose, tel que demandé. **Aucun outil n'est encore
implémenté** — seulement la structure, les conventions et les points
d'extension.

## Ce que ce projet N'EST PAS

- Ce n'est **pas** une modification du site/de l'app existants
  (`loverose.1-main/src`, `loverose.1-main/functions`) : rien n'y a été touché.
- Ce n'est **pas** une réimplémentation de la logique métier : ce serveur est
  conçu pour **appeler** les mêmes tables Supabase, les mêmes fonctions RPC
  Postgres et les mêmes Edge Functions déjà en production.

## Pourquoi un projet séparé et indépendant

- Le SDK MCP officiel (`@modelcontextprotocol/sdk`) tourne dans un processus
  Node.js autonome (transport stdio ou HTTP), pas dans le navigateur / React.
- Séparer complètement ce dossier du repo `loverose.1-main` garantit que le
  site et l'app PWA continuent de fonctionner à l'identique, quoi qu'il
  arrive côté MCP.

## Structure

```
loverose-mcp/
├── package.json           # dépendances : @modelcontextprotocol/sdk, @supabase/supabase-js, zod
├── tsconfig.json
├── .env.example
└── src/
    ├── index.ts            # point d'entrée : instancie McpServer, câble le transport,
    │                       # enregistre chaque domaine (sans outil pour l'instant)
    ├── config/
    │   └── env.ts          # chargement + validation des variables d'environnement
    ├── core/
    │   ├── supabaseClient.ts   # client Supabase service_role, même pattern que
    │   │                       # functions/_shared/supabaseAdmin.ts
    │   ├── errors.ts           # erreurs partagées (format cohérent entre outils)
    │   ├── logger.ts           # logger structuré minimal
    │   └── auth/
    │       └── context.ts      # résolution du contexte appelant (JWT utilisateur
    │                            # ou jeton de service), même logique que le
    │                            # `jwtRole()` déjà utilisé dans les Edge Functions
    ├── domains/
    │   ├── types.ts         # signature commune `register*Tools(deps)`
    │   ├── auth/            # ✅ IMPLÉMENTÉ — register, login, logout, refreshSession,
    │   │                    #    verifyPhoneOTP, verifyEmail, resendOTP, resetPassword
    │   ├── profile/         # → ProfileSettings.tsx, ProfileDetailModal.tsx, PublicProfile.tsx
    │   ├── discover/        # → Discover.tsx, WhoLikedMe.tsx, likes/matches/blocked_users
    │   ├── chat/            # → Chat.tsx, matches/messages/notifications
    │   ├── payments/        # → functions/api/payments/*, Edge Functions MoneyFusion
    │   ├── creator/         # → CreatorDashboard.tsx, Creators.tsx, creator_*
    │   ├── notifications/   # → Notifications.tsx, push.ts, send-push
    │   └── settings/        # → Settings.tsx, platform_settings, blocked_users
    └── shared/
        └── tables.ts        # cartographie domaine → tables/RPC/Edge Functions existantes
```

Chaque `domains/<domaine>/index.ts` exporte une fonction
`register<Domaine>Tools(deps)` **vide pour l'instant** (juste un
commentaire listant les futurs outils et les sources à réutiliser). Rien
n'appelle encore `server.tool(...)`.

## Stratégie de réutilisation de la logique métier

Constat après analyse du repo `loverose.1-main` :

| Élément                          | Où vit la logique aujourd'hui                          | Ce que le MCP devra faire |
|-----------------------------------|----------------------------------------------------------|----------------------------|
| Règles de matching, crédits, quotas | Composants React (`Discover.tsx`, `Chat.tsx`, ...) via `supabase-js` | Réinterroger **les mêmes tables** (`likes`, `matches`, `messages`, `user_credits`, ...) avec les mêmes filtres, pas les réécrire à la main |
| Statut premium, retraits créateur, géoloc | Fonctions RPC Postgres (`is_user_premium`, `request_payout`, `update_my_location`, `update_my_presence`) | Appeler ces RPC directement — ne jamais recalculer ces règles côté MCP |
| Paiement MoneyFusion, push, recompression d'images | Edge Functions Supabase déployées (`moneyfusion-create-payment`, `send-push`, `recompress-images`, ...) | Le domaine `payments`/`notifications` doit **appeler** ces fonctions, pas réimplémenter l'intégration |
| Contact, Turnstile | Cloudflare Pages Functions (`functions/api/contact.ts`, `verify-turnstile.ts`) | Idem : proxy, pas de duplication |

Voir `src/shared/tables.ts` pour la cartographie complète domaine → tables/RPC/Edge Functions.

## Stratégie d'authentification (mécanisme prêt, pas encore branché à un outil)

Chaque outil MCP agira "au nom" d'un compte LoveRose. Pour ne pas dupliquer
les règles de sécurité déjà en place :

1. Le client MCP fournit le **JWT Supabase** de l'utilisateur (le même token
   émis par `supabase.auth` côté app).
2. Le serveur valide ce JWT via `admin.auth.getUser(jwt)` — identique au
   pattern déjà utilisé dans `send-reengagement-campaign` (`jwtRole()`).
3. Les outils lisent ensuite `profiles.role` pour les autorisations
   (admin, creator...), sans réimplémenter cette logique.

Un second mode "service" (jeton de confiance `MCP_TRUSTED_SERVICE_TOKEN`) est
prévu pour de futurs outils strictement serveur-à-serveur — jamais pour
authentifier un utilisateur final.

Voir `src/core/auth/context.ts`.

## Domaine Auth (implémenté)

8 outils, tous des appels directs à Supabase Auth (aucune règle réimplémentée) :

| Outil | Méthode Supabase Auth | Client utilisé |
|---|---|---|
| `register` | `auth.signUp` | anon |
| `login` | `auth.signInWithPassword` | anon |
| `logout` | `auth.admin.signOut(accessToken, scope)` | admin (service_role) |
| `refreshSession` | `auth.refreshSession` | anon |
| `verifyPhoneOTP` | `auth.verifyOtp` (type `sms`/`phone_change`) | anon |
| `verifyEmail` | `auth.verifyOtp` (type `signup`/`email`/`email_change`) | anon |
| `resendOTP` | `auth.resend` | anon |
| `resetPassword` | `auth.resetPasswordForEmail` | anon |

Un nouveau client "anon" (`core/supabaseClient.ts` → `createSupabaseAnonClient`)
a été ajouté : les flux d'authentification grand public doivent utiliser
exactement les mêmes privilèges que `src/lib/supabase.ts` côté app, jamais le
client `service_role`. Seul `logout` utilise le client admin, car révoquer la
session d'un token donné passe par l'API d'administration GoTrue.

Nécessite la variable `SUPABASE_ANON_KEY` (voir `.env.example`), en plus de
`SUPABASE_SERVICE_ROLE_KEY` déjà requise.

**Gestion des erreurs** (`core/mcpResult.ts`) : chaque outil est enveloppé par
`withMcpErrorHandling`, qui garantit qu'aucune exception ne s'échappe jamais
d'un handler. Toute erreur Supabase Auth (identifiants invalides, OTP expiré,
compte déjà existant, etc.) ou exception inattendue est renvoyée au client
MCP sous la forme `{ content: [...], isError: true }` avec un message et,
quand disponible, un `code`/`status` — jamais une erreur de protocole brute.

Volontairement hors périmètre de ce domaine : la connexion Google
(`signInWithOAuth`, flux de redirection navigateur non pertinent en MCP) et
la vérification Turnstile (couche anti-bot Cloudflare séparée de Supabase
Auth, gérée par `functions/api/verify-turnstile.ts`).

## Lancer le squelette (aucun outil ne répondra encore, mais le serveur démarre)

```bash
cd loverose-mcp
npm install
cp .env.example .env   # renseigner SUPABASE_SERVICE_ROLE_KEY
npm run dev
```

## Prochaine étape (hors périmètre de cette livraison)

Implémenter les premiers outils dans `domains/*/index.ts` en respectant les
sources listées plus haut, domaine par domaine — en commençant probablement
par `profile` et `discover` (lecture seule, faible risque), avant `payments`
et `settings` (actions sensibles).
