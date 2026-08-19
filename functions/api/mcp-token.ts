import { getSupabaseAdmin, json, type Env } from "../_shared/supabaseAdmin";
import { encryptToken } from "../_shared/mcpToken";
import { createClient } from "@supabase/supabase-js";

/**
 * POST /api/mcp-token
 *
 * Génère un lien de connexion MCP pré-authentifié.
 *
 * 1. Vérifie les identifiants (email + mot de passe) via Supabase Auth
 *    (admin.auth.getUser après signInWithPassword côté admin — même
 *    pattern que les Edge Functions existantes).
 * 2. Chiffrage AES-256-GCM des tokens (access + refresh) avec le secret
 *    partagé MCP_TOKEN_SECRET — le mot de passe n'est JAMAIS stocké.
 * 3. Renvoie { tokenLink, expiresAt } — le lien est à coller dans le
 *    chatbot via l'outil `authenticateWithLink`.
 *
 * Sécurité :
 *   - Le mot de passe transite une seule fois (navigateur → Supabase Auth),
 *     jamais stocké ni transmis au serveur MCP.
 *   - Le token est valable 10 minutes et auto-expire (AES-GCM IV aléatoire
 *     + expiration intégrée au payload chiffré).
 *   - MCP_TOKEN_SECRET doit être identique entre Pages Functions et le
 *     serveur MCP (Node ou Cloudflare Worker).
 */

const TOKEN_TTL_MS = 10 * 60 * 1000; // 10 minutes

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const body = await request.json<{ email?: string; password?: string }>();
    const { email, password } = body;

    if (!email || !password) {
      return json({ success: false, error: "email et password requis." }, 400);
    }

    const secret = env.MCP_TOKEN_SECRET;
    if (!secret) {
      return json({ success: false, error: "Service de token non configuré (MCP_TOKEN_SECRET manquant)." }, 500);
    }

    const supabaseAdmin = getSupabaseAdmin(env);
    if (!supabaseAdmin) {
      return json({ success: false, error: "Service momentanément indisponible." }, 500);
    }

    // Vérification des identifiants via l'API Auth admin.
    // On utilise signInWithPassword sur un client "anon" (service_role n'a
    // pas cette méthode) — pattern identique au domaine auth du MCP.
    const supabaseUrl = env.VITE_SUPABASE_URL;
    const anonKey = env.VITE_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !anonKey) {
      return json({ success: false, error: "Configuration Supabase incomplète." }, 500);
    }

    // signInWithPassword avec le client anon (comme le site React)
    const anonClient = createClient(supabaseUrl, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: authData, error: authError } = await anonClient.auth.signInWithPassword({
      email,
      password,
    });

    if (authError || !authData.session) {
      return json(
        { success: false, error: authError?.message || "Identifiants incorrects." },
        401
      );
    }

    // Chiffrer les tokens avec AES-256-GCM
    const encrypted = await encryptToken(
      {
        at: authData.session.access_token,
        rt: authData.session.refresh_token,
        exp: Date.now() + TOKEN_TTL_MS,
      },
      secret
    );

    // Construire le lien à coller dans le chatbot
    const mcpBase = env.MCP_URL || "https://loverose-mcp.mannher813.workers.dev";
    const mcpAuthUrl = `${mcpBase}/mcp/auth?token=${encodeURIComponent(encrypted)}`;

    return json({
      success: true,
      tokenLink: mcpAuthUrl,
      token: encrypted, // aussi le token brut pour usage avancé
      expiresAt: new Date(Date.now() + TOKEN_TTL_MS).toISOString(),
      expiresIn: "10 minutes",
    });
  } catch (err: any) {
    console.error("POST /api/mcp-token error:", err);
    return json({ success: false, error: "Erreur interne du serveur." }, 500);
  }
};
