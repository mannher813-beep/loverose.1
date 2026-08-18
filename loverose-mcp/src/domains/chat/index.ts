import { z } from "zod";
import type { RegisterDomainTools } from "../types.js";
import { mcpOk, mcpFail, withMcpErrorHandling } from "../../core/mcpResult.js";
import { accessTokenSchema, asUser, unwrap } from "../../core/tooling.js";
import { createLogger } from "../../core/logger.js";

/**
 * Domaine CHAT
 * ------------
 * Réutilise src/components/Chat.tsx :
 *   - matches  : { id, users: [uid1, uid2] }
 *   - messages : { match_id, sender_id, contenu, created_at }
 *
 * Règles de quota REPRODUITES à l'identique côté MCP (validation client de
 * l'app) : les 3 premiers messages envoyés dans un match sont gratuits mais
 * limités à 10 mots SANS aucun chiffre. Au-delà, l'insertion est acceptée et
 * c'est le TRIGGER PostgreSQL déjà en production qui débite les crédits —
 * ce domaine ne réimplémente jamais ce débit.
 */

const logger = createLogger("domain:chat");

const FREE_MESSAGES_PER_MATCH = 3;
const FREE_MESSAGE_MAX_WORDS = 10;

export const registerChatTools: RegisterDomainTools = ({ server, admin, config }) => {
  // -------------------------------------------------------------------
  // list_conversations — matches + dernier message (comme Chat.tsx)
  // -------------------------------------------------------------------
  server.tool(
    "list_conversations",
    "Liste les conversations du membre (ses matchs) avec pour chacune le dernier message échangé et le profil de l'autre membre.",
    { accessToken: accessTokenSchema },
    withMcpErrorHandling(async (args: { accessToken: string }) => {
      const { uid, db } = await asUser(admin, config, args.accessToken);
      const matches = await db
        .from("matches")
        .select("*")
        .contains("users", [uid])
        .order("created_at", { ascending: false });
      if (matches.error) return mcpFail(`Lecture des matchs impossible : ${matches.error.message}`, { code: matches.error.code });

      const rows = (matches.data as any[]) ?? [];
      const otherUids = rows.map((m) => (m.users as string[])?.find((u) => u !== uid)).filter(Boolean) as string[];
      const profiles = otherUids.length
        ? (await db.from("profiles").select("uid, username, full_name, avatar_url, age, location").in("uid", otherUids)).data ?? []
        : [];
      const byUid: Record<string, any> = {};
      (profiles as any[]).forEach((p) => (byUid[p.uid] = p));

      const conversations = await Promise.all(
        rows.map(async (m) => {
          const otherUid = (m.users as string[])?.find((u) => u !== uid) ?? "";
          const last = await db
            .from("messages")
            .select("*")
            .eq("match_id", m.id)
            .order("created_at", { ascending: false })
            .limit(1);
          const lastMsg = (last.data as any[])?.[0] ?? null;
          return {
            match_id: m.id,
            match_created_at: m.created_at,
            other: byUid[otherUid] ?? null,
            last_message: lastMsg,
          };
        })
      );
      return mcpOk({ count: conversations.length, conversations });
    })
  );

  // -------------------------------------------------------------------
  // get_messages
  // -------------------------------------------------------------------
  server.tool(
    "get_messages",
    "Récupère l'historique des messages d'une conversation (match) — messages.order created_at asc, comme Chat.tsx. Inclut le quota de messages gratuits restants.",
    {
      accessToken: accessTokenSchema,
      match_id: z.string().uuid().describe("Identifiant du match"),
      limit: z.number().int().min(1).max(200).default(50),
      offset: z.number().int().min(0).default(0),
    },
    withMcpErrorHandling(async (args: { accessToken: string; match_id: string; limit: number; offset: number }) => {
      const { uid, db } = await asUser(admin, config, args.accessToken);
      // Vérifie que le membre fait bien partie du match (comme l'app, la RLS s'applique)
      const match = await db.from("matches").select("id, users").eq("id", args.match_id).contains("users", [uid]).maybeSingle();
      if (match.error || !match.data) {
        return mcpFail("Conversation introuvable ou non autorisée", { code: "not_found" });
      }
      const messages = await db
        .from("messages")
        .select("*")
        .eq("match_id", args.match_id)
        .order("created_at", { ascending: true })
        .range(args.offset, args.offset + args.limit - 1);
      if (messages.error) return mcpFail(`Lecture des messages impossible : ${messages.error.message}`, { code: messages.error.code });

      const list = (messages.data as any[]) ?? [];
      const sentByMe = list.filter((m) => m.sender_id === uid).length;
      return mcpOk({
        match_id: args.match_id,
        count: list.length,
        messages: list,
        quota: {
          free_messages_total: FREE_MESSAGES_PER_MATCH,
          sent_by_me: sentByMe,
          free_remaining: Math.max(0, FREE_MESSAGES_PER_MATCH - sentByMe),
        },
      });
    })
  );

  // -------------------------------------------------------------------
  // send_message — mêmes règles que Chat.tsx (3 gratuits, 10 mots, 0 chiffre)
  // -------------------------------------------------------------------
  server.tool(
    "send_message",
    "Envoie un message dans une conversation (match). Les 3 premiers messages par match sont gratuits mais limités à 10 mots sans chiffre " +
      "(règles identiques à l'app) ; au-delà, le trigger PostgreSQL existant débite automatiquement 1 crédit par message.",
    {
      accessToken: accessTokenSchema,
      match_id: z.string().uuid().describe("Identifiant du match"),
      contenu: z.string().min(1).max(2000).describe("Contenu du message"),
    },
    withMcpErrorHandling(async (args: { accessToken: string; match_id: string; contenu: string }) => {
      const { uid, db } = await asUser(admin, config, args.accessToken);
      const match = await db.from("matches").select("id, users").eq("id", args.match_id).contains("users", [uid]).maybeSingle();
      if (match.error || !match.data) {
        return mcpFail("Conversation introuvable ou non autorisée", { code: "not_found" });
      }

      // Blocage éventuel entre les deux membres (Chat.tsx masque ces conversations)
      const otherUid = ((match.data as any).users as string[])?.find((u) => u !== uid) ?? "";
      if (otherUid) {
        const blocked = await db
          .from("blocked_users")
          .select("blocker_id")
          .or(`and(blocker_id.eq.${uid},blocked_id.eq.${otherUid}),and(blocker_id.eq.${otherUid},blocked_id.eq.${uid})`)
          .maybeSingle();
        if (blocked.data) return mcpFail("Envoi impossible : un blocage existe entre ces deux comptes", { code: "blocked" });
      }

      const existing = await db.from("messages").select("sender_id").eq("match_id", args.match_id);
      if (existing.error) return mcpFail(`Lecture de la conversation impossible : ${existing.error.message}`, { code: existing.error.code });
      const sentByMe = (((existing.data as any[]) ?? []).filter((m) => m.sender_id === uid)).length;
      const isFree = sentByMe < FREE_MESSAGES_PER_MATCH;

      const text = args.contenu.trim();
      if (isFree) {
        const words = text.split(/\s+/);
        if (words.length > FREE_MESSAGE_MAX_WORDS) {
          return mcpFail(
            `Les messages gratuits sont limités à ${FREE_MESSAGE_MAX_WORDS} mots maximum (${words.length} mots fournis). ` +
              `Vous avez encore ${FREE_MESSAGES_PER_MATCH - sentByMe} message(s) gratuit(s).`,
            { code: "free_message_limit" }
          );
        }
        if (/[0-9]/.test(text)) {
          return mcpFail("Les messages gratuits ne doivent pas contenir de chiffres (protection anti-arnaques, comme dans l'app).", {
            code: "free_message_digits",
          });
        }
      }

      const inserted = unwrap(
        await db.from("messages").insert([{ match_id: args.match_id, sender_id: uid, contenu: text }]).select().single(),
        "Envoi impossible (le trigger PostgreSQL peut refuser : crédits insuffisants, contenu invalide...)"
      );
      logger.info("message sent", { uid, match_id: args.match_id, free: isFree });
      return mcpOk({
        message: inserted,
        was_free: isFree,
        credits_note: isFree
          ? `${FREE_MESSAGES_PER_MATCH - sentByMe - 1} message(s) gratuit(s) restant(s) dans ce match.`
          : "1 crédit débité par le trigger PostgreSQL existant.",
      });
    })
  );

  // -------------------------------------------------------------------
  // get_message_quota
  // -------------------------------------------------------------------
  server.tool(
    "get_message_quota",
    "Indique où en est le membre dans le quota de messages gratuits d'une conversation (3 premiers gratuits) et son solde de crédits.",
    {
      accessToken: accessTokenSchema,
      match_id: z.string().uuid().describe("Identifiant du match"),
    },
    withMcpErrorHandling(async (args: { accessToken: string; match_id: string }) => {
      const { uid, db } = await asUser(admin, config, args.accessToken);
      const existing = await db.from("messages").select("sender_id").eq("match_id", args.match_id);
      const sentByMe = (((existing.data as any[]) ?? []).filter((m) => m.sender_id === uid)).length;
      const credits = await db.from("user_credits").select("balance").eq("user_id", uid).maybeSingle();
      return mcpOk({
        match_id: args.match_id,
        sent_by_me: sentByMe,
        free_remaining: Math.max(0, FREE_MESSAGES_PER_MATCH - sentByMe),
        credits_balance: credits.data?.balance ?? 0,
      });
    })
  );
};
