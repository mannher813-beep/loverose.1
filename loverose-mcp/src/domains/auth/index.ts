import { z } from "zod";
import type { RegisterDomainTools } from "../types.js";
import { mcpOk, mcpFail, mcpFailFromSupabaseError, withMcpErrorHandling } from "../../core/mcpResult.js";
import { createLogger } from "../../core/logger.js";
import { decryptToken } from "../../core/mcpToken.js";

/**
 * Domaine AUTH
 * ------------
 * Réutilise directement Supabase Auth déjà en place pour LoveRose — les
 * mêmes appels que `src/lib/supabase.ts` / `src/components/Auth.tsx` /
 * `src/components/Onboarding.tsx`, mais depuis un serveur MCP indépendant :
 *
 *   - register, login          → mêmes méthodes que Auth.tsx (`signUp`,
 *                                 `signInWithPassword`), client "anon".
 *   - logout                   → invalide la session ciblée côté GoTrue via
 *                                 le client admin (`auth.admin.signOut`),
 *                                 utile pour un client MCP qui n'a pas de
 *                                 session navigateur persistante à révoquer
 *                                 lui-même.
 *   - refreshSession            → `auth.refreshSession` (même mécanisme que
 *                                 l'auto-refresh déjà utilisé par le client
 *                                 Supabase de l'app).
 *   - verifyPhoneOTP            → `auth.verifyOtp` (type sms / phone_change) ;
 *                                 le numéro est déjà géré côté app via
 *                                 `auth.updateUser({ phone })` (Onboarding.tsx).
 *   - verifyEmail               → `auth.verifyOtp` (type signup / email /
 *                                 email_change), alternative "code" au lien
 *                                 de confirmation `emailRedirectTo` déjà
 *                                 utilisé par Auth.tsx — utile pour un client
 *                                 MCP qui ne peut pas ouvrir de lien e-mail.
 *   - resendOTP                 → `auth.resend`.
 *   - resetPassword             → `auth.resetPasswordForEmail`.
 *
 * Volontairement HORS PÉRIMÈTRE de ce domaine (non dupliqué ici) :
 *   - La connexion Google (`signInWithOAuth`) : flux redirection navigateur,
 *     non pertinent pour un outil MCP texte.
 *   - La vérification Turnstile (anti-bot) : couche Cloudflare séparée de
 *     Supabase Auth, appartient à `functions/api/verify-turnstile.ts`, pas
 *     à ce domaine.
 *   - Toute logique de profil (table `profiles`) : domaine Profile, pas Auth.
 */

const logger = createLogger("domain:auth");

const emailRedirectPath = (appUrl: string) => appUrl; // même valeur que `${window.location.origin}` dans Auth.tsx

export const registerAuthTools: RegisterDomainTools = ({ server, admin, anon, config }) => {
  // ---------------------------------------------------------------------
  // register — équivalent de Auth.tsx en mode "signup" (signUp email/mdp)
  // ---------------------------------------------------------------------
  server.tool(
    "register",
    "Crée un nouveau compte LoveRose par e-mail et mot de passe (Supabase Auth signUp). " +
      "Un e-mail de confirmation est envoyé si la confirmation e-mail est activée sur le projet.",
    {
      email: z.string().email("Adresse e-mail invalide"),
      password: z.string().min(6, "Le mot de passe doit contenir au moins 6 caractères"),
    },
    withMcpErrorHandling(async ({ email, password }: { email: string; password: string }) => {
      const { data, error } = await anon.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: emailRedirectPath(config.appUrl) },
      });
      if (error) {
        logger.warn("register failed", { email, message: error.message });
        return mcpFailFromSupabaseError(error);
      }
      return mcpOk({
        user: data.user,
        session: data.session,
        emailConfirmationRequired: !data.session,
      });
    })
  );

  // ---------------------------------------------------------------------
  // login — équivalent de Auth.tsx en mode "login" (signInWithPassword)
  // ---------------------------------------------------------------------
  server.tool(
    "login",
    "Connecte un membre LoveRose existant par e-mail et mot de passe (Supabase Auth signInWithPassword).",
    {
      email: z.string().email("Adresse e-mail invalide"),
      password: z.string().min(1, "Mot de passe requis"),
    },
    withMcpErrorHandling(async ({ email, password }: { email: string; password: string }) => {
      const { data, error } = await anon.auth.signInWithPassword({ email, password });
      if (error) {
        logger.warn("login failed", { email, message: error.message });
        return mcpFailFromSupabaseError(error);
      }
      return mcpOk({ user: data.user, session: data.session });
    })
  );

  // ---------------------------------------------------------------------
  // authenticateWithLink — connexion pré-authentifiée via lien chiffré
  // ---------------------------------------------------------------------
  //
  // Flux sécurisé (le mot de passe ne transite JAMAIS dans le chat) :
  //   1. L'utilisateur se connecte sur https://loverose.pages.dev/mcp
  //      → le formulaire appelle Supabase Auth côté navigateur/Pages Function
  //      → les tokens sont chiffrés (AES-256-GCM) et intégrés dans un lien
  //   2. L'utilisateur colle le lien dans ChatGPT/Claude
  //   3. L'IA appelle cet outil avec le lien complet
  //   4. Le serveur MCP déchiffre le token avec MCP_TOKEN_SECRET,
  //      vérifie l'expiration (10 min), et renvoie la session
  //
  server.tool(
    "authenticateWithLink",
    "Connecte un membre LoveRose via un lien de connexion pré-authentifié généré sur loverose.pages.dev/mcp. " +
      "Le lien contient une session chiffrée (AES-256-GCM) — le mot de passe n'est jamais transmis dans le chat. " +
      "Le lien est valable 10 minutes.",
    {
      link: z
        .string()
        .min(1, "Lien de connexion requis")
        .describe(
          "Lien complet copié depuis https://loverose.pages.dev/mcp (contient le token chiffré). " +
            "Format : https://…/mcp/auth?token=v1.… ou le token brut v1.…"
        ),
    },
    withMcpErrorHandling(async ({ link }: { link: string }) => {
      const tokenSecret = config.mcpTokenSecret;
      if (!tokenSecret) {
        return mcpFail(
          "Le mode de connexion par lien n'est pas activé sur ce serveur (MCP_TOKEN_SECRET manquant). " +
            "Utilisez l'outil `login` avec email/mot de passe à la place."
        );
      }

      // Extraire le token du lien (supporte lien complet ou token brut)
      let rawToken = link.trim();
      try {
        const url = new URL(rawToken);
        const fromQuery = url.searchParams.get("token");
        if (fromQuery) rawToken = fromQuery;
      } catch {
        // pas une URL — on utilise tel quel (token brut v1.…)
      }

      // Déchiffrer et valider
      let payload: { at: string; rt: string; exp: number };
      try {
        payload = await decryptToken(rawToken, tokenSecret);
      } catch (err: any) {
        logger.warn("authenticateWithLink: token invalide", { message: err.message });
        return mcpFail(`Lien invalide ou expiré : ${err.message}`);
      }

      // Valider le JWT via Supabase Auth (comme un login normal)
      const { data, error } = await admin.auth.getUser(payload.at);
      if (error || !data?.user) {
        logger.warn("authenticateWithLink: JWT invalide après déchiffrement", { message: error?.message });
        return mcpFail("Session invalide — le lien a peut-être déjà été utilisé. Générez un nouveau lien.");
      }

      return mcpOk({
        user: data.user,
        session: {
          access_token: payload.at,
          refresh_token: payload.rt,
        },
        authenticatedVia: "pre-auth link",
        message: "Session active. Vous pouvez maintenant utiliser tous les outils LoveRose.",
      });
    })
  );

  // ---------------------------------------------------------------------
  // logout — révoque une session ciblée côté GoTrue (auth.admin.signOut)
  // ---------------------------------------------------------------------
  server.tool(
    "logout",
    "Déconnecte un membre LoveRose en invalidant sa session (access token) côté serveur Supabase Auth.",
    {
      accessToken: z.string().min(1, "accessToken requis"),
      scope: z
        .enum(["global", "local", "others"])
        .default("global")
        .describe(
          "global = toutes les sessions de l'utilisateur, local = uniquement cette session, others = toutes sauf celle-ci"
        ),
    },
    withMcpErrorHandling(async ({ accessToken, scope }: { accessToken: string; scope: "global" | "local" | "others" }) => {
      const { error } = await admin.auth.admin.signOut(accessToken, scope);
      if (error) {
        logger.warn("logout failed", { message: error.message });
        return mcpFailFromSupabaseError(error);
      }
      return mcpOk({ signedOut: true, scope });
    })
  );

  // ---------------------------------------------------------------------
  // refreshSession — auth.refreshSession, même mécanisme que l'auto-refresh
  // ---------------------------------------------------------------------
  server.tool(
    "refreshSession",
    "Renouvelle une session Supabase Auth à partir d'un refresh token, sans repasser par le mot de passe.",
    {
      refreshToken: z.string().min(1, "refreshToken requis"),
    },
    withMcpErrorHandling(async ({ refreshToken }: { refreshToken: string }) => {
      const { data, error } = await anon.auth.refreshSession({ refresh_token: refreshToken });
      if (error) {
        logger.warn("refreshSession failed", { message: error.message });
        return mcpFailFromSupabaseError(error);
      }
      return mcpOk({ user: data.user, session: data.session });
    })
  );

  // ---------------------------------------------------------------------
  // verifyPhoneOTP — auth.verifyOtp (sms / phone_change)
  // ---------------------------------------------------------------------
  server.tool(
    "verifyPhoneOTP",
    "Vérifie le code OTP envoyé par SMS pour confirmer un numéro de téléphone (Supabase Auth verifyOtp).",
    {
      phone: z.string().min(6, "Numéro de téléphone requis (format international E.164, ex: +237699887766)"),
      token: z.string().min(4, "Code OTP requis"),
      type: z
        .enum(["sms", "phone_change"])
        .default("sms")
        .describe("sms = vérification à l'inscription, phone_change = confirmation d'un changement de numéro"),
    },
    withMcpErrorHandling(async ({ phone, token, type }: { phone: string; token: string; type: "sms" | "phone_change" }) => {
      const { data, error } = await anon.auth.verifyOtp({ phone, token, type });
      if (error) {
        logger.warn("verifyPhoneOTP failed", { phone, message: error.message });
        return mcpFailFromSupabaseError(error);
      }
      return mcpOk({ user: data.user, session: data.session });
    })
  );

  // ---------------------------------------------------------------------
  // verifyEmail — auth.verifyOtp (signup / email / email_change)
  // ---------------------------------------------------------------------
  server.tool(
    "verifyEmail",
    "Vérifie le code OTP envoyé par e-mail pour confirmer une adresse e-mail (alternative au lien de confirmation).",
    {
      email: z.string().email("Adresse e-mail invalide"),
      token: z.string().min(4, "Code OTP requis"),
      type: z
        .enum(["signup", "email", "email_change"])
        .default("signup")
        .describe("signup = confirmation d'inscription, email_change = confirmation d'un changement d'adresse"),
    },
    withMcpErrorHandling(async ({ email, token, type }: { email: string; token: string; type: "signup" | "email" | "email_change" }) => {
      const { data, error } = await anon.auth.verifyOtp({ email, token, type });
      if (error) {
        logger.warn("verifyEmail failed", { email, message: error.message });
        return mcpFailFromSupabaseError(error);
      }
      return mcpOk({ user: data.user, session: data.session });
    })
  );

  // ---------------------------------------------------------------------
  // resendOTP — auth.resend
  // ---------------------------------------------------------------------
  server.tool(
    "resendOTP",
    "Renvoie un code/lien de confirmation (inscription e-mail, changement e-mail, SMS ou changement de téléphone).",
    {
      type: z.enum(["signup", "email_change", "sms", "phone_change"]),
      email: z.string().email().optional().describe("Requis si type = signup ou email_change"),
      phone: z.string().optional().describe("Requis si type = sms ou phone_change"),
    },
    withMcpErrorHandling(async ({ type, email, phone }: { type: "signup" | "email_change" | "sms" | "phone_change"; email?: string; phone?: string }) => {
      if (type === "signup" || type === "email_change") {
        if (!email) return mcpFail(`Le paramètre "email" est requis pour type="${type}"`);
        const { data, error } = await anon.auth.resend({
          type,
          email,
          options: { emailRedirectTo: emailRedirectPath(config.appUrl) },
        });
        if (error) {
          logger.warn("resendOTP failed", { type, message: error.message });
          return mcpFailFromSupabaseError(error);
        }
        return mcpOk({ resent: true, data });
      }

      // type is "sms" | "phone_change" here
      if (!phone) return mcpFail(`Le paramètre "phone" est requis pour type="${type}"`);
      const { data, error } = await anon.auth.resend({ type, phone });
      if (error) {
        logger.warn("resendOTP failed", { type, message: error.message });
        return mcpFailFromSupabaseError(error);
      }
      return mcpOk({ resent: true, data });
    })
  );

  // ---------------------------------------------------------------------
  // resetPassword — auth.resetPasswordForEmail
  // ---------------------------------------------------------------------
  server.tool(
    "resetPassword",
    "Déclenche l'envoi d'un e-mail de réinitialisation de mot de passe (Supabase Auth resetPasswordForEmail).",
    {
      email: z.string().email("Adresse e-mail invalide"),
    },
    withMcpErrorHandling(async ({ email }: { email: string }) => {
      const { data, error } = await anon.auth.resetPasswordForEmail(email, {
        redirectTo: emailRedirectPath(config.appUrl),
      });
      if (error) {
        logger.warn("resetPassword failed", { email, message: error.message });
        return mcpFailFromSupabaseError(error);
      }
      return mcpOk({ emailSent: true, data });
    })
  );
};
