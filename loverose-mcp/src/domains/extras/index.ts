import { z } from "zod";
import type { RegisterDomainTools } from "../types.js";
import { mcpOk, mcpFail, withMcpErrorHandling } from "../../core/mcpResult.js";
import { accessTokenSchema, asUser } from "../../core/tooling.js";
import { createLogger } from "../../core/logger.js";

/**
 * Domaine EXTRAS (transverse)
 * ---------------------------
 *   - get_app_config      : platform_settings (prix/feature flags publics)
 *   - send_contact_message : proxy vers functions/api/contact.ts (Turnstile
 *                           vérifié côté serveur Cloudflare, jamais contourné)
 *   - suggest_bio / suggest_opening_line / moderate_photo : couche IA Gemini
 *     (clé GEMINI_API_KEY optionnelle — même capacité déclarée dans
 *     metadata.json : MAJOR_CAPABILITY_SERVER_SIDE_GEMINI_API). Appels REST
 *     directs, aucune dépendance supplémentaire.
 */

const logger = createLogger("domain:extras");

async function geminiGenerate(prompt: string, apiKey?: string, model = "gemini-2.0-flash"): Promise<string> {
  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY absente du serveur MCP — ajoutez-la dans loverose-mcp/.env pour activer les outils IA (même clé que le site)."
    );
  }
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
    }
  );
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Gemini a répondu ${res.status} : ${detail.slice(0, 300)}`);
  }
  const payload: any = await res.json();
  const text = payload?.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join("") ?? "";
  if (!text) throw new Error("Réponse Gemini vide");
  return text.trim();
}

export const registerExtrasTools: RegisterDomainTools = ({ server, admin, config }) => {
  // -------------------------------------------------------------------
  // get_app_config
  // -------------------------------------------------------------------
  server.tool(
    "get_app_config",
    "Configuration publique de la plateforme (table platform_settings) : prix, fonctionnalités activées, paramètres globaux.",
    { accessToken: accessTokenSchema },
    withMcpErrorHandling(async (args: { accessToken: string }) => {
      const { db } = await asUser(admin, config, args.accessToken);
      const settings = await db.from("platform_settings").select("*");
      if (settings.error) return mcpFail(`Lecture de la configuration impossible : ${settings.error.message}`, { code: settings.error.code });
      return mcpOk({ platform_settings: settings.data });
    })
  );

  // -------------------------------------------------------------------
  // send_contact_message — proxy functions/api/contact.ts
  // -------------------------------------------------------------------
  server.tool(
    "send_contact_message",
    "Envoie un message au support LoveRose (proxy vers l'API contact du site ; la vérification Turnstile reste appliquée côté serveur Cloudflare).",
    {
      accessToken: accessTokenSchema,
      name: z.string().min(2).max(120),
      email: z.string().email(),
      message: z.string().min(10).max(3000),
      turnstile_token: z.string().optional().describe("Jeton Turnstile si exigé par le site (le client MCP ne peut pas le générer lui-même)"),
    },
    withMcpErrorHandling(async (args: { accessToken: string; name: string; email: string; message: string; turnstile_token?: string }) => {
      await asUser(admin, config, args.accessToken);
      try {
        const res = await fetch(`${config.appUrl}/api/contact`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: args.name,
            email: args.email,
            message: args.message,
            ...(args.turnstile_token ? { token: args.turnstile_token } : {}),
          }),
        });
        const payload: any = await res.json().catch(() => null);
        if (!res.ok) {
          return mcpFail(`Envoi refusé (${res.status}) : ${payload?.error ?? "réponse invalide"}`, { status: res.status });
        }
        return mcpOk({ sent: true, response: payload });
      } catch (err: any) {
        return mcpFail(`Site injoignable (${config.appUrl}) : ${err?.message ?? err}`);
      }
    })
  );

  // -------------------------------------------------------------------
  // suggest_bio — IA Gemini
  // -------------------------------------------------------------------
  server.tool(
    "suggest_bio",
    "Génère des suggestions de bio de profil LoveRose (IA Gemini, même clé que le site) adaptées au marché africain francophone, à partir de quelques infos.",
    {
      accessToken: accessTokenSchema,
      age: z.number().int().min(18).max(99),
      location: z.string().max(120),
      interests: z.array(z.string()).max(15).default([]),
      intent: z.string().max(120).optional().describe("Intention relationnelle (ex: amitié sérieuse, mariage...)"),
    },
    withMcpErrorHandling(async (args: { accessToken: string; age: number; location: string; interests: string[]; intent?: string }) => {
      await asUser(admin, config, args.accessToken);
      const prompt =
        `Tu es assistant de rédaction pour LoveRose, une app de rencontre populaire en Afrique francophone. ` +
        `Propose 3 variantes de bio (max 300 caractères chacune, ton chaleureux et authentique, français simple) pour : ` +
        `${args.age} ans, à ${args.location}, centres d'intérêt : ${args.interests.join(", ") || "non précisés"}, ` +
        `intention : ${args.intent ?? "non précisée"}. Pas de mentions de montants d'argent ni de contacts.`;
      const text = await geminiGenerate(prompt, config.geminiApiKey, config.geminiModel);
      logger.info("bio suggested");
      return mcpOk({ suggestions: text });
    })
  );

  // -------------------------------------------------------------------
  // suggest_opening_line — IA Gemini
  // -------------------------------------------------------------------
  server.tool(
    "suggest_opening_line",
    "Propose des phrases d'accroche personnalisées pour premier message dans un match (IA Gemini), à partir du profil de l'autre membre. " +
      "Respecte la règle des messages gratuits (10 mots max, sans chiffres).",
    {
      accessToken: accessTokenSchema,
      match_id: z.string().uuid().describe("Identifiant du match"),
    },
    withMcpErrorHandling(async (args: { accessToken: string; match_id: string }) => {
      const { uid, db } = await asUser(admin, config, args.accessToken);
      const match = (await db.from("matches").select("id, users").eq("id", args.match_id).contains("users", [uid]).maybeSingle()).data;
      if (!match) return mcpFail("Match introuvable", { code: "not_found" });
      const otherUid = ((match as any).users as string[])?.find((u: string) => u !== uid);
      const other = otherUid ? (await db.from("profiles").select("full_name, age, location, bio, interests, relationship_intents").eq("uid", otherUid).maybeSingle()).data : null;
      const me = (await db.from("profiles").select("full_name, gender, bio").eq("uid", uid).maybeSingle()).data;
      const prompt =
        `Tu es coach en conversation pour LoveRose (app de rencontre, Afrique francophone). ` +
        `Propose 3 phrases d'accroche pour un premier message, MAXIMUM 10 mots chacune, SANS AUCUN chiffre ` +
        `(contraintes techniques des messages gratuits). Profil cible : ${JSON.stringify(other)}. ` +
        `Mon profil : ${JSON.stringify(me)}. Ton respectueux et original, en français.`;
      const text = await geminiGenerate(prompt, config.geminiApiKey, config.geminiModel);
      return mcpOk({ suggestions: text });
    })
  );

  // -------------------------------------------------------------------
  // moderate_photo — IA Gemini (pré-analyse avant upload)
  // -------------------------------------------------------------------
  server.tool(
    "moderate_photo",
    "Pré-analyse une photo avant upload (IA Gemini) : détecte contenu inapproprié, présence de mineurs, textes/contacts visibles — " +
      "aide au respect des règles communautaires LoveRose. L'image est fournie en base64.",
    {
      accessToken: accessTokenSchema,
      image_base64: z.string().min(32).describe("Image en base64 (data:URL acceptée)"),
    },
    withMcpErrorHandling(async (args: { accessToken: string; image_base64: string }) => {
      await asUser(admin, config, args.accessToken);
      const apiKey = config.geminiApiKey;
      if (!apiKey) {
        return mcpFail("GEMINI_API_KEY absente du serveur MCP — modération IA indisponible", { code: "no_api_key" });
      }
      const match = /^data:([^;]+);base64,(.+)$/s.exec(args.image_base64.trim());
      const mimeType = match ? match[1] : "image/jpeg";
      const base64 = match ? match[2] : args.image_base64.trim();

      const model = config.geminiModel || "gemini-2.0-flash";
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  { text: "Analyse cette photo pour une app de rencontre. Réponds en JSON strict : {\"safe\": true|false, \"reasons\": [\"...\"], \"notes\": \"...\" }. safe=false si nuditude explicite, mineur apparent, violence, ou coordonnées de contact visibles (téléphone/email/réseaux sociaux)." },
                  { inline_data: { mime_type: mimeType, data: base64 } },
                ],
              },
            ],
          }),
        }
      );
      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        return mcpFail(`Gemini a répondu ${res.status} : ${detail.slice(0, 300)}`, { status: res.status });
      }
      const payload: any = await res.json();
      const text: string = payload?.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join("") ?? "";
      let parsed: any = null;
      try {
        parsed = JSON.parse(text.replace(/```json|```/g, "").trim());
      } catch {
        parsed = { raw: text };
      }
      return mcpOk({ moderation: parsed });
    })
  );
};
