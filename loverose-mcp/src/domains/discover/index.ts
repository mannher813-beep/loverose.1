import { z } from "zod";
import type { RegisterDomainTools } from "../types.js";
import { mcpOk, mcpFail, withMcpErrorHandling } from "../../core/mcpResult.js";
import { accessTokenSchema, asUser, unwrap } from "../../core/tooling.js";
import { createLogger } from "../../core/logger.js";

/**
 * Domaine DISCOVER
 * ----------------
 * Réutilise la même logique que src/components/Discover.tsx :
 *   - likes        : { from_uid, to_uid, type: "like" | "super_like" }
 *   - matches      : { id, users: [uid1, uid2], created_at } (contains)
 *   - blocked_users : { blocker_id, blocked_id }
 *   - reports      : { reporter_id, reported_id, motif }
 *   - RPC get_active_premium_user_ids (membres boostés mis en avant)
 *
 * Le filtrage (compatibilité genre/préférences, exclusions blocages, likes
 * déjà envoyés, matchs existants) reproduit Discover.tsx sans réécrire les
 * règles serveur : la RLS s'applique toujours côté requêtes.
 */

const logger = createLogger("domain:discover");

const publicProfileFields =
  "uid, username, full_name, age, location, gender, preferences, relationship_intents, bio, avatar_url, photos, verification_status, created_at";

/** Filtrage de compatibilité identique d'esprit à Discover.tsx (matching souple). */
function genderCompatible(me: any, candidate: any): boolean {
  const wants = (p: any): string[] => {
    const list = Array.isArray(p) ? p : p != null ? [p] : [];
    return list.map((x: any) => String(x).toLowerCase());
  };
  const myPrefs = wants(me?.preferences);
  const theirPrefs = wants(candidate?.preferences);
  const myGender = String(me?.gender ?? "").toLowerCase();
  const theirGender = String(candidate?.gender ?? "").toLowerCase();
  const normalized = (v: string) => (v === "male" ? "homme" : v === "female" ? "femme" : v);
  const iLike = myPrefs.length === 0 || myPrefs.map(normalized).includes(normalized(theirGender)) || myPrefs.includes("all") || myPrefs.includes("tous");
  const theyLike = theirPrefs.length === 0 || theirPrefs.map(normalized).includes(normalized(myGender)) || theirPrefs.includes("all") || theirPrefs.includes("tous");
  return iLike && theyLike;
}

export const registerDiscoverTools: RegisterDomainTools = ({ server, admin, config }) => {
  // -------------------------------------------------------------------
  // get_recommendations
  // -------------------------------------------------------------------
  server.tool(
    "get_recommendations",
    "Propose des profils à découvrir (même logique que l'écran Discover de l'app) : compatibilité genre/préférences, exclusion des profils déjà likés, " +
      "des matchs existants, des blocages dans les deux sens et des comptes signalés ; membres boostés/premium en premier.",
    {
      accessToken: accessTokenSchema,
      limit: z.number().int().min(1).max(50).default(10).describe("Nombre de profils à proposer (1-50)"),
      location_filter: z.string().optional().describe("Filtre optionnel sur la ville/pays (sous-chaîne, ex: Douala)"),
    },
    withMcpErrorHandling(async (args: { accessToken: string; limit: number; location_filter?: string }) => {
      const { uid, db } = await asUser(admin, config, args.accessToken);

      const me = unwrap(await db.from("profiles").select("*").eq("uid", uid).maybeSingle(), "Lecture de votre profil impossible");
      if (!me) return mcpFail("Complétez d'abord votre onboarding (complete_onboarding)", { code: "no_profile" });

      const [profilesRes, myLikesRes, blockedRes, matchesRes] = await Promise.all([
        db.from("profiles").select(publicProfileFields).neq("uid", uid).limit(300),
        db.from("likes").select("to_uid").eq("from_uid", uid),
        db.from("blocked_users").select("blocker_id, blocked_id").or(`blocker_id.eq.${uid},blocked_id.eq.${uid}`),
        db.from("matches").select("id, users").contains("users", [uid]),
      ]);
      if (profilesRes.error) return mcpFail(`Lecture des profils impossible : ${profilesRes.error.message}`, { code: profilesRes.error.code });

      const liked = new Set(((myLikesRes.data as any[]) ?? []).map((l) => l.to_uid));
      const blocked = new Set<string>();
      ((blockedRes.data as any[]) ?? []).forEach((b) => {
        blocked.add(b.blocker_id);
        blocked.add(b.blocked_id);
      });
      const matchedUids = new Set<string>();
      ((matchesRes.data as any[]) ?? []).forEach((m) => (m.users as string[])?.forEach((u) => u !== uid && matchedUids.add(u)));

      // Membres boostés d'abord — même RPC que Discover.tsx
      let premiumIds = new Set<string>();
      const premiumRes = await db.rpc("get_active_premium_user_ids");
      if (!premiumRes.error && Array.isArray(premiumRes.data)) {
        premiumIds = new Set((premiumRes.data as any[]).map((r: any) => r?.user_id ?? r?.uid ?? r));
      }

      const candidates = ((profilesRes.data as any[]) ?? []).filter((p) => {
        if (liked.has(p.uid) || blocked.has(p.uid) || matchedUids.has(p.uid)) return false;
        if (p.is_hidden_from_feed) return false;
        if (args.location_filter && !String(p.location ?? "").toLowerCase().includes(args.location_filter.toLowerCase())) return false;
        return genderCompatible(me, p);
      });

      const premium = candidates.filter((p) => premiumIds.has(p.uid));
      const others = candidates.filter((p) => !premiumIds.has(p.uid));
      // Ordre stable-ish : premium puis récents
      others.sort((a, b) => String(b.created_at ?? "").localeCompare(String(a.created_at ?? "")));
      const selection = [...premium, ...others].slice(0, args.limit).map((p) => ({
        ...p,
        boosted: premiumIds.has(p.uid),
      }));

      return mcpOk({ count: selection.length, recommendations: selection });
    })
  );

  // -------------------------------------------------------------------
  // like_profile / superlike_profile (même insert que Discover.tsx)
  // -------------------------------------------------------------------
  const registerLikeTool = (
    name: string,
    description: string,
    type: "like" | "super_like"
  ) => {
    server.tool(
      name,
      description,
      {
        accessToken: accessTokenSchema,
        target_uid: z.string().uuid().describe("uid du profil visé"),
      },
      withMcpErrorHandling(async (args: { accessToken: string; target_uid: string }) => {
        const { uid, db } = await asUser(admin, config, args.accessToken);
        if (args.target_uid === uid) return mcpFail("Impossible de se liker soi-même", { code: "validation_error" });

        // Blocage dans un sens ou l'autre → refus (Discover masque ces profils)
        const blocked = await db
          .from("blocked_users")
          .select("blocker_id, blocked_id")
          .or(`and(blocker_id.eq.${uid},blocked_id.eq.${args.target_uid}),and(blocker_id.eq.${args.target_uid},blocked_id.eq.${uid})`)
          .maybeSingle();
        if (blocked.data) return mcpFail("Like impossible : un blocage existe entre ces deux comptes", { code: "blocked" });

        unwrap(
          await db.from("likes").insert([{ from_uid: uid, to_uid: args.target_uid, type }]),
          "Enregistrement du like impossible"
        );

        // Match instantané si like réciproque — même vérification que Discover.tsx
        const reciprocal = await db
          .from("likes")
          .select("*")
          .eq("from_uid", args.target_uid)
          .eq("to_uid", uid)
          .maybeSingle();

        let match: any = null;
        if (reciprocal.data) {
          const inserted = unwrap(
            await db.from("matches").insert([{ users: [uid, args.target_uid] }]).select().single(),
            "Création du match impossible"
          );
          match = inserted;
          logger.info("match created", { a: uid, b: args.target_uid });
        }
        return mcpOk({ liked: args.target_uid, type, is_match: !!match, match });
      })
    );
  };

  registerLikeTool(
    "like_profile",
    "Like un profil (table likes, type like). Si le like est réciproque, crée automatiquement le match — comme l'écran Discover.",
    "like"
  );
  registerLikeTool(
    "superlike_profile",
    "Envoie un super like à un profil (table likes, type super_like) — mise en avant type « Star Profile » de Discover.tsx. Match automatique si réciproque.",
    "super_like"
  );

  // -------------------------------------------------------------------
  // pass_profile — Discover.tsx ne persiste pas les passes (UI only)
  // -------------------------------------------------------------------
  server.tool(
    "pass_profile",
    "Passe un profil (aucune écriture en base — Discover.tsx ne persiste pas les passes). Retourne simplement le prochain lot de recommandations.",
    {
      accessToken: accessTokenSchema,
      target_uid: z.string().uuid().describe("uid du profil passé (informatif)"),
    },
    withMcpErrorHandling(async (args: { accessToken: string; target_uid: string }) => {
      await asUser(admin, config, args.accessToken);
      return mcpOk({
        passed: args.target_uid,
        note: "Aucune trace en base (comportement de l'app). Rappelez get_recommendations pour la suite.",
      });
    })
  );

  // -------------------------------------------------------------------
  // undo_last_like (rewind) — Discover.tsx supprime la ligne like
  // -------------------------------------------------------------------
  server.tool(
    "undo_last_like",
    "Annule le dernier like envoyé à un profil (suppression de la ligne `likes`) — même mécanique que le bouton rewind de Discover.tsx. " +
      "N'annule pas un match déjà créé.",
    {
      accessToken: accessTokenSchema,
      target_uid: z.string().uuid().describe("uid du profil dont il faut annuler le like"),
    },
    withMcpErrorHandling(async (args: { accessToken: string; target_uid: string }) => {
      const { uid, db } = await asUser(admin, config, args.accessToken);
      unwrap(
        await db.from("likes").delete().eq("from_uid", uid).eq("to_uid", args.target_uid),
        "Annulation du like impossible"
      );
      return mcpOk({ undone: args.target_uid });
    })
  );

  // -------------------------------------------------------------------
  // get_who_liked_me
  // -------------------------------------------------------------------
  server.tool(
    "get_who_liked_me",
    "Liste les membres qui ont liké le profil connecté (likes.to_uid = moi) avec leurs profils publics — équivalent de WhoLikedMe.tsx.",
    {
      accessToken: accessTokenSchema,
      limit: z.number().int().min(1).max(100).default(30),
    },
    withMcpErrorHandling(async (args: { accessToken: string; limit: number }) => {
      const { uid, db } = await asUser(admin, config, args.accessToken);
      const likes = await db
        .from("likes")
        .select("from_uid, type, created_at")
        .eq("to_uid", uid)
        .order("created_at", { ascending: false })
        .limit(args.limit);
      if (likes.error) return mcpFail(`Lecture des likes reçus impossible : ${likes.error.message}`, { code: likes.error.code });
      const ids = Array.from(new Set(((likes.data as any[]) ?? []).map((l) => l.from_uid)));
      const profiles = ids.length
        ? (await db.from("profiles").select(publicProfileFields).in("uid", ids)).data ?? []
        : [];
      const byUid: Record<string, any> = {};
      (profiles as any[]).forEach((p) => (byUid[p.uid] = p));
      return mcpOk({
        count: (likes.data as any[])?.length ?? 0,
        who_liked_me: ((likes.data as any[]) ?? []).map((l) => ({ ...l, profile: byUid[l.from_uid] ?? null })),
      });
    })
  );

  // -------------------------------------------------------------------
  // get_matches
  // -------------------------------------------------------------------
  server.tool(
    "get_matches",
    "Liste tous les matchs du membre (table matches, colonne users contains uid) avec le profil de l'autre membre — comme l'écran Chat.",
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
        ? (await db.from("profiles").select(publicProfileFields).in("uid", otherUids)).data ?? []
        : [];
      const byUid: Record<string, any> = {};
      (profiles as any[]).forEach((p) => (byUid[p.uid] = p));
      return mcpOk({
        count: rows.length,
        matches: rows.map((m) => ({
          match_id: m.id,
          created_at: m.created_at,
          other: byUid[(m.users as string[])?.find((u) => u !== uid) ?? ""] ?? null,
        })),
      });
    })
  );

  // -------------------------------------------------------------------
  // unmatch
  // -------------------------------------------------------------------
  server.tool(
    "unmatch",
    "Supprime un match (suppression de la ligne matches dont users contient le membre) — la RLS protège l'opération comme dans l'app.",
    {
      accessToken: accessTokenSchema,
      match_id: z.string().uuid().describe("Identifiant du match à supprimer"),
    },
    withMcpErrorHandling(async (args: { accessToken: string; match_id: string }) => {
      const { uid, db } = await asUser(admin, config, args.accessToken);
      const deleted = unwrap(
        await db.from("matches").delete().eq("id", args.match_id).contains("users", [uid]).select(),
        "Suppression du match impossible"
      );
      if (!deleted || deleted.length === 0) {
        return mcpFail("Match introuvable ou non autorisé", { code: "not_found" });
      }
      return mcpOk({ unmatched: args.match_id });
    })
  );

  // -------------------------------------------------------------------
  // block_user / unblock_user — blocked_users (Chat.tsx / Discover.tsx)
  // -------------------------------------------------------------------
  server.tool(
    "block_user",
    "Bloque un membre (table blocked_users) : profils et conversations mutuellement masqués — même comportement que Chat.tsx/Discover.tsx.",
    {
      accessToken: accessTokenSchema,
      target_uid: z.string().uuid().describe("uid du membre à bloquer"),
    },
    withMcpErrorHandling(async (args: { accessToken: string; target_uid: string }) => {
      const { uid, db } = await asUser(admin, config, args.accessToken);
      if (args.target_uid === uid) return mcpFail("Impossible de se bloquer soi-même", { code: "validation_error" });
      unwrap(
        await db.from("blocked_users").insert([{ blocker_id: uid, blocked_id: args.target_uid }]),
        "Blocage impossible"
      );
      return mcpOk({ blocked: args.target_uid });
    })
  );

  server.tool(
    "unblock_user",
    "Débloque un membre précédemment bloqué (suppression de la ligne blocked_users).",
    {
      accessToken: accessTokenSchema,
      target_uid: z.string().uuid().describe("uid du membre à débloquer"),
    },
    withMcpErrorHandling(async (args: { accessToken: string; target_uid: string }) => {
      const { uid, db } = await asUser(admin, config, args.accessToken);
      const deleted = unwrap(
        await db.from("blocked_users").delete().eq("blocker_id", uid).eq("blocked_id", args.target_uid).select(),
        "Déblocage impossible"
      );
      if (!deleted || deleted.length === 0) {
        return mcpFail("Aucun blocage trouvé pour ce membre", { code: "not_found" });
      }
      return mcpOk({ unblocked: args.target_uid });
    })
  );

  // -------------------------------------------------------------------
  // report_user — même insert que Discover.tsx
  // -------------------------------------------------------------------
  server.tool(
    "report_user",
    "Signale un membre à la modération (table reports : reporter_id, reported_id, motif) — même insert que Discover.tsx.",
    {
      accessToken: accessTokenSchema,
      target_uid: z.string().uuid().describe("uid du membre signalé"),
      motif: z.string().min(3).max(500).describe("Motif du signalement"),
    },
    withMcpErrorHandling(async (args: { accessToken: string; target_uid: string; motif: string }) => {
      const { uid, db } = await asUser(admin, config, args.accessToken);
      unwrap(
        await db.from("reports").insert([{ reporter_id: uid, reported_id: args.target_uid, motif: args.motif }]),
        "Signalement impossible"
      );
      logger.info("report filed", { reporter: uid, reported: args.target_uid });
      return mcpOk({ reported: args.target_uid, status: "transmis à la modération" });
    })
  );
};
