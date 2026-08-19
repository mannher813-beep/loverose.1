/**
 * Chiffrement / déchiffrement des tokens MCP pré-authentifiés.
 *
 * ⚠️ Ce fichier a une copie jumelle dans `functions/_shared/mcpToken.ts`
 * (Pages Functions). Les deux doivent rester **identiques** pour que le
 * chiffrement côté site et le déchiffrement côté serveur MCP soient
 * compatibles.
 *
 * Schéma : AES-256-GCM avec dérivation de clé PBKDF2 à partir d'un
 * secret partagé (MCP_TOKEN_SECRET) et d'un salt fixe.
 *
 * Format du token encodé : v1.<iv_b64url>.<ct_b64url>.<salt_b64url>
 *   - iv       : 12 octets aléatoires (nonce AES-GCM)
 *   - ct       : payload JSON chiffré + tag GCM (16 octets)
 *   - salt     : 16 octets aléatoires (PBKDF2 salt)
 *
 * Le payload JSON chiffré contient :
 *   { at: string, rt: string, exp: number }
 *
 * Inutilisable après `exp` (epoch ms) — l'expiration est INTÉGRÉE au
 * payload chiffré, donc non modifiable sans connaître la clé.
 *
 * Compatibilité : Web Crypto API (Cloudflare Workers / Pages Functions
 * et Node ≥ 18) — aucune dépendance native.
 */

// --- helpers base64url (sans padding) ---

function bufferToBase64url(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  // standard base64 → base64url
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64urlToBuffer(b64url: string): ArrayBuffer {
  // restore standard base64
  let b64 = b64url.replace(/-/g, "+").replace(/_/g, "/");
  const pad = (4 - (b64.length % 4)) % 4;
  b64 += "=".repeat(pad);
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

// --- PBKDF2 key derivation ---

const PBKDF2_SALT = "loverose-mcp-token-v1";
const PBKDF2_ITERATIONS = 100_000;

async function deriveKey(secret: string, saltB64url: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    "PBKDF2",
    false,
    ["deriveKey"]
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: enc.encode(saltB64url), iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

// --- encrypt / decrypt ---

export interface McpTokenPayload {
  at: string; // access_token
  rt: string; // refresh_token
  exp: number; // expiration (epoch ms)
}

export async function encryptToken(payload: McpTokenPayload, secret: string): Promise<string> {
  // 16 bytes random salt
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const saltB64 = bufferToBase64url(salt.buffer);

  const key = await deriveKey(secret, saltB64);

  // 12 bytes random IV (nonce AES-GCM)
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = new TextEncoder().encode(JSON.stringify(payload));

  const cipherBuf = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plaintext);

  return `v1.${bufferToBase64url(iv.buffer)}.${bufferToBase64url(cipherBuf)}.${saltB64}`;
}

export async function decryptToken(token: string, secret: string): Promise<McpTokenPayload> {
  const parts = token.split(".");
  if (parts.length !== 4 || parts[0] !== "v1") {
    throw new Error("Format de token invalide");
  }

  const [, ivB64, ctB64, saltB64] = parts;
  const key = await deriveKey(secret, saltB64);
  const iv = new Uint8Array(base64urlToBuffer(ivB64));
  const cipherBuf = base64urlToBuffer(ctB64);

  let plainBuf: ArrayBuffer;
  try {
    plainBuf = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, cipherBuf);
  } catch {
    throw new Error("Token invalide ou clé incorrecte");
  }

  const payload: McpTokenPayload = JSON.parse(new TextDecoder().decode(plainBuf));

  if (payload.exp < Date.now()) {
    throw new Error("Token expiré (valable 10 minutes)");
  }

  return payload;
}
