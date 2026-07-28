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
