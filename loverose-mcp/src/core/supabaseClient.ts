import { createClient, SupabaseClient } from "@supabase/supabase-js";
import type { AppConfig } from "../config/env.js";

/**
 * Client Supabase "admin" (service_role) partagé par tous les domaines.
 *
 * IMPORTANT — reprend volontairement le même pattern que:
 *  - functions/_shared/supabaseAdmin.ts (Cloudflare Pages Functions)
 *  - le client `admin` des Edge Functions Supabase existantes
 *    (ex: send-reengagement-campaign)
 *
 * Ce client contourne RLS. Chaque outil MCP est donc responsable de
 * restreindre explicitement ses requêtes à l'utilisateur autorisé pour
 * l'appel en cours (voir core/auth/context.ts) — exactement comme les
 * Edge Functions existantes le font déjà après validation du JWT appelant.
 */
export function createSupabaseAdminClient(config: AppConfig): SupabaseClient {
  return createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/**
 * Client Supabase "anon" — exactement la même clé que `VITE_SUPABASE_ANON_KEY`
 * utilisée par `src/lib/supabase.ts` côté app React.
 *
 * Le domaine Auth doit passer par CE client (pas le client admin) pour tous
 * les appels `supabase.auth.*` grand public (signUp, signInWithPassword,
 * verifyOtp, resend, resetPasswordForEmail, refreshSession) : c'est
 * exactement le comportement de Supabase Auth déjà en place côté app, ni
 * plus ni moins de privilèges.
 *
 * `persistSession: false` et `autoRefreshToken: false` car ce client est
 * partagé par tous les appels MCP (serveur sans état, sans session
 * navigateur) : chaque outil doit toujours passer ses tokens explicitement
 * plutôt que de compter sur une session interne au client.
 */
export function createSupabaseAnonClient(config: AppConfig): SupabaseClient {
  return createClient(config.supabaseUrl, config.supabaseAnonKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
}

/**
 * Client Supabase "au nom de l'utilisateur" — client fraîchement créé pour
 * CHAQUE appel d'outil MCP, portant le JWT Supabase fourni par le client MCP
 * dans l'en-tête Authorization de chaque requête PostgREST.
 *
 * C'est le pendant serveur de `src/lib/supabase.ts` côté navigateur : la
 * RLS (Row Level Security) s'applique EXACTEMENT comme si l'utilisateur
 * utilisait l'app React. Aucun outil n'a besoin de réimplémenter les règles
 * de sécurité — elles sont celles déjà en production.
 *
 * Le JWT est validé en amont par `resolveCallerContext` (core/auth/context.ts)
 * avant que ce client ne soit construit.
 */
export function createUserClient(config: AppConfig, accessToken: string): SupabaseClient {
  return createClient(config.supabaseUrl, config.supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
}
