import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AppConfig } from "../config/env.js";
import { createUserClient } from "./supabaseClient.js";
import { resolveCallerContext, UnauthorizedError } from "./auth/context.js";
import { ForbiddenError } from "./errors.js";

/**
 * Helpers partagés par tous les domaines d'outils MCP.
 *
 * Convention centrale : chaque outil qui agit "au nom" d'un membre LoveRose
 * reçoit son `accessToken` (JWT Supabase). Le contexte appelant est validé
 * via `resolveCallerContext` (JWT + profiles.role), puis un client Supabase
 * porteur de CE JWT est construit : la RLS s'applique donc exactement comme
 * dans l'app React — aucune règle de sécurité n'est réimplémentée ici.
 */

export const accessTokenSchema = z
  .string()
  .min(1, "accessToken requis")
  .describe(
    "JWT access token Supabase du membre LoveRose (obtenu via les outils login/register/refreshSession). " +
      "Toutes les règles de sécurité (RLS) de l'app s'appliquent avec ce token."
  );

export const limitSchema = z
  .number()
  .int()
  .min(1)
  .max(100)
  .default(20)
  .describe("Nombre maximal de résultats (1-100)");

export const offsetSchema = z
  .number()
  .int()
  .min(0)
  .default(0)
  .describe("Décalage de pagination");

export interface UserCaller {
  /** uid Supabase de l'utilisateur authentifié */
  uid: string;
  /** profiles.role de l'utilisateur (ex: "admin", "creator", null) */
  role: string | null;
  /**
   * Client Supabase porteur du JWT utilisateur — RLS s'applique.
   * Typé `any` volontairement : le projet n'a pas de types générés
   * (supabase gen types) et supabase-js non-typé infère `never`.
   */
  db: SupabaseClient<any>;
}

/**
 * Valide le JWT fourni et construit le contexte utilisateur (uid, role,
 * client RLS). À appeler au début de chaque outil utilisateur.
 */
export async function asUser(
  admin: SupabaseClient,
  config: AppConfig,
  accessToken: string
): Promise<UserCaller> {
  const ctx = await resolveCallerContext(admin, config, { userAccessToken: accessToken });
  if (ctx.mode !== "user") {
    throw new UnauthorizedError("Un accessToken utilisateur est requis pour cet outil");
  }
  return { uid: ctx.uid, role: ctx.role, db: createUserClient(config, accessToken) };
}

/**
 * Comme `asUser`, mais exige en plus `profiles.role = "admin"` — même garde
 * que celle utilisée par `AdminPanel.tsx` côté app.
 */
export async function asAdminUser(
  admin: SupabaseClient,
  config: AppConfig,
  accessToken: string
): Promise<UserCaller & { role: "admin" }> {
  const caller = await asUser(admin, config, accessToken);
  if (caller.role !== "admin") {
    throw new ForbiddenError("Cet outil est réservé aux administrateurs LoveRose (profiles.role = admin)");
  }
  return caller as UserCaller & { role: "admin" };
}

/** Extrait data ou lève une erreur lisible (au lieu de data === null silencieux). */
export function unwrap<T = any>(result: any, context: string): T {
  if (result?.error) {
    const err = result.error as { message?: string; code?: string };
    throw new Error(`${context} : ${err.message ?? "erreur inconnue"}${err.code ? ` (${err.code})` : ""}`);
  }
  return (result?.data ?? null) as T;
}

/** Décode une image "data:..." (base64) ou base64 brute en Buffer + mime type. */
export function decodeImageInput(input: string, fallbackMime = "image/jpeg"): { buffer: Buffer; contentType: string } {
  const match = /^data:([^;]+);base64,(.+)$/s.exec(input.trim());
  if (match) {
    return { buffer: Buffer.from(match[2], "base64"), contentType: match[1] };
  }
  return { buffer: Buffer.from(input, "base64"), contentType: fallbackMime };
}

/** Génère un nom de fichier storage unique, même pattern que PublishListing.tsx. */
export function storageFileName(extension: string): string {
  const rand = Math.random().toString(36).slice(2, 8);
  return `${Date.now()}-${rand}${extension}`;
}
