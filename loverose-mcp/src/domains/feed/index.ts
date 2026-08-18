import { z } from "zod";
import type { RegisterDomainTools } from "../types.js";
import {
  mcpOk,
  mcpFail,
  withMcpErrorHandling,
  mcpOkWithImages,
  type McpImage,
} from "../../core/mcpResult.js";
import { accessTokenSchema, asUser, unwrap, limitSchema, offsetSchema } from "../../core/tooling.js";
import { createLogger } from "../../core/logger.js";

/**
 * Domaine FEED (publications & interactions)
 * ------------------------------------------
 * Réutilise src/components/Feed.tsx, PublishListing.tsx, PublicProfile.tsx :
 *   - posts          : { id, author_id, contenu, medias[], media_types[], likes_count,
 *                       comments_count, shares_count, listing_* (annonces payantes) }
 *   - post_likes     : { post_id, user_id }
 *   - post_comments  : { post_id, user_id, text }
 *   - post_shares    : { post_id, user_id }
 *   - post_unlocks   : { post_id, user_id } (annonces payantes débloquées)
 *   - post_reviews   : { post_id, reviewer_id, seller_id, rating, comment }
 *   - profile_followers : { follower_id, ... }
 *
 * Les médias des posts sont des URLs Storage publiques (bucket loverose).
 * get_post_media peut renvoyer les images en base64 (type "image" MCP) pour
 * un affichage direct par le client.
 */

const logger = createLogger("domain:feed");

async function fetchAsImages(urls: string[], max: number): Promise<McpImage[]> {
  const images: McpImage[] = [];
  for (const url of urls.slice(0, max)) {
    try {
      const res = await fetch(url);
      if (!res.ok) continue;
      const contentType = res.headers.get("content-type")?.split(";")[0] ?? "image/jpeg";
      if (!contentType.startsWith("image/")) continue;
      const buf = Buffer.from(await res.arrayBuffer());
      images.push({ data: buf.toString("base64"), mimeType: contentType });
    } catch {
      /* best-effort : une image inaccessible n'empêche pas la réponse */
    }
  }
  return images;
}

export const registerFeedTools: RegisterDomainTools = ({ server, admin, config }) => {
  // -------------------------------------------------------------------
  // get_feed_posts
  // -------------------------------------------------------------------
  server.tool(
    "get_feed_posts",
    "Charge le fil d'actualité LoveRose (table posts, ordre antéchronologique) avec les profils auteurs et les interactions du membre " +
      "(déjà liké / partagé / débloqué) — même chargement que Feed.tsx.",
    {
      accessToken: accessTokenSchema,
      limit: limitSchema,
      offset: offsetSchema,
      author_uid: z.string().uuid().optional().describe("Filtrer sur un seul auteur (profil public d'un membre)"),
      listings_only: z.boolean().default(false).describe("Uniquement les annonces (listings)"),
    },
    withMcpErrorHandling(async (args: { accessToken: string; limit: number; offset: number; author_uid?: string; listings_only: boolean }) => {
      const { uid, db } = await asUser(admin, config, args.accessToken);
      let query = db.from("posts").select("*").order("created_at", { ascending: false }).range(args.offset, args.offset + args.limit - 1);
      if (args.author_uid) query = query.eq("author_id", args.author_uid);
      if (args.listings_only) query = query.not("listing_price", "is", null);
      const posts = await query;
      if (posts.error) return mcpFail(`Lecture du fil impossible : ${posts.error.message}`, { code: posts.error.code });

      const rows = (posts.data as any[]) ?? [];
      const authorIds = Array.from(new Set(rows.map((p) => p.author_id).filter(Boolean)));
      const authors = authorIds.length
        ? (await db.from("profiles").select("uid, username, full_name, avatar_url, verification_status").in("uid", authorIds)).data ?? []
        : [];
      const byUid: Record<string, any> = {};
      (authors as any[]).forEach((p) => (byUid[p.uid] = p));

      const postIds = rows.map((p) => p.id);
      const [myLikes, myUnlocks, myFollows] = await Promise.all([
        postIds.length ? db.from("post_likes").select("post_id").eq("user_id", uid) : { data: [], error: null },
        postIds.length ? db.from("post_unlocks").select("post_id").eq("user_id", uid) : { data: [], error: null },
        db.from("profile_followers").select("follower_id, followed_id"),
      ]);
      const likedSet = new Set(((myLikes.data as any[]) ?? []).map((l: any) => l.post_id));
      const unlockedSet = new Set(((myUnlocks.data as any[]) ?? []).map((l: any) => l.post_id));
      const followSet = new Set(((myFollows.data as any[]) ?? []).map((f: any) => f.followed_id));

      return mcpOk({
        count: rows.length,
        posts: rows.map((p) => ({
          ...p,
          author: byUid[p.author_id] ?? null,
          my_like: likedSet.has(p.id),
          my_unlock: unlockedSet.has(p.id),
          i_follow_author: followSet.has(p.author_id),
        })),
      });
    })
  );

  // -------------------------------------------------------------------
  // get_post — détail d'un post
  // -------------------------------------------------------------------
  server.tool(
    "get_post",
    "Récupère un post unique (détail complet, auteur, compteurs, statut de déblocage pour les annonces payantes).",
    {
      accessToken: accessTokenSchema,
      post_id: z.string().uuid().describe("Identifiant du post"),
    },
    withMcpErrorHandling(async (args: { accessToken: string; post_id: string }) => {
      const { uid, db } = await asUser(admin, config, args.accessToken);
      const post = unwrap(await db.from("posts").select("*").eq("id", args.post_id).maybeSingle(), "Lecture du post impossible");
      if (!post) return mcpFail("Post introuvable", { code: "not_found" });
      const author = (await db.from("profiles").select("uid, username, full_name, avatar_url").eq("uid", post.author_id).maybeSingle()).data ?? null;
      const unlock = (await db.from("post_unlocks").select("post_id").eq("post_id", args.post_id).eq("user_id", uid).maybeSingle()).data;
      return mcpOk({ post, author, my_unlock: !!unlock });
    })
  );

  // -------------------------------------------------------------------
  // get_post_media — photos affichables (base64 inline ou URLs)
  // -------------------------------------------------------------------
  server.tool(
    "get_post_media",
    "Récupère les photos d'un post, affichables directement par le client MCP (images base64) ou sous forme d'URLs. " +
      "Pour une annonce payante non débloquée, refuse de servir les médias et indique le prix — même garde que Feed.tsx.",
    {
      accessToken: accessTokenSchema,
      post_id: z.string().uuid().describe("Identifiant du post"),
      embed_images: z.boolean().default(true).describe("true = renvoyer les images en base64 (affichage inline), false = URLs uniquement"),
      max_images: z.number().int().min(1).max(10).default(4),
    },
    withMcpErrorHandling(async (args: { accessToken: string; post_id: string; embed_images: boolean; max_images: number }) => {
      const { uid, db } = await asUser(admin, config, args.accessToken);
      const post = unwrap(await db.from("posts").select("*").eq("id", args.post_id).maybeSingle(), "Lecture du post impossible");
      if (!post) return mcpFail("Post introuvable", { code: "not_found" });

      const isPaidListing = !post.is_free_listing && !!post.listing_price;
      if (isPaidListing) {
        const unlock = await db.from("post_unlocks").select("post_id").eq("post_id", args.post_id).eq("user_id", uid).maybeSingle();
        if (!unlock.data) {
          return mcpFail(
            `Annonce payante verrouillée (${post.listing_price} FCFA). Débloquez-la avec l'outil unlock_post (crée un paiement MoneyFusion), puis le webhook enregistrera le déblocage.`,
            { code: "post_locked" }
          );
        }
      }

      const medias: string[] = Array.isArray(post.medias) ? post.medias : [];
      const urls = medias.filter((u) => typeof u === "string");
      if (!args.embed_images) return mcpOk({ post_id: args.post_id, media_urls: urls });

      const images = await fetchAsImages(urls, args.max_images);
      return mcpOkWithImages(
        { post_id: args.post_id, media_urls: urls, images_embedded: images.length },
        images
      );
    })
  );

  // -------------------------------------------------------------------
  // create_post / PublishListing.tsx
  // -------------------------------------------------------------------
  server.tool(
    "create_post",
    "Publie un post (ou une annonce) : texte + médias (URLs obtenues via upload_photo), prix éventuel pour une annonce payante — " +
      "même insert que PublishListing.tsx.",
    {
      accessToken: accessTokenSchema,
      contenu: z.string().min(1).max(5000).describe("Texte de la publication"),
      media_urls: z.array(z.string().url()).max(10).default([]).describe("URLs des médias (upload_photo target=post)"),
      listing_price: z.number().int().min(0).max(100000000).optional().describe("Prix en FCFA si annonce payante (listing)"),
      listing_category: z.string().max(60).optional().describe("Catégorie de l'annonce (ex: mode, électronique)"),
      listing_location: z.string().max(120).optional().describe("Ville de l'annonce"),
      listing_condition: z.string().max(40).optional().describe("État (neuf, bon état...)"),
      listing_negotiable: z.boolean().default(false),
      listing_quantity: z.number().int().min(1).max(10000).optional(),
      whatsapp_link: z.string().max(200).optional().describe("Lien WhatsApp pour contacter le vendeur"),
    },
    withMcpErrorHandling(async (args: {
      accessToken: string; contenu: string; media_urls: string[]; listing_price?: number;
      listing_category?: string; listing_location?: string; listing_condition?: string;
      listing_negotiable: boolean; listing_quantity?: number; whatsapp_link?: string;
    }) => {
      const { uid, db } = await asUser(admin, config, args.accessToken);
      const isListing = args.listing_price != null && args.listing_price > 0;
      const row: Record<string, unknown> = {
        author_id: uid,
        contenu: args.contenu.trim(),
        medias: args.media_urls,
        media_types: args.media_urls.map(() => "image"),
      };
      if (isListing) {
        row.listing_price = args.listing_price;
        row.is_free_listing = false;
        row.listing_category = args.listing_category ?? null;
        row.listing_location = args.listing_location ?? null;
        row.listing_condition = args.listing_condition ?? null;
        row.listing_negotiable = args.listing_negotiable;
        row.listing_quantity = args.listing_quantity ?? 1;
        row.whatsapp_link = args.whatsapp_link ?? null;
      }
      const post = unwrap(await db.from("posts").insert([row]).select().single(), "Publication impossible");
      logger.info("post created", { uid, post_id: post.id, listing: isListing });
      return mcpOk({ post });
    })
  );

  // -------------------------------------------------------------------
  // delete_my_post
  // -------------------------------------------------------------------
  server.tool(
    "delete_my_post",
    "Supprime l'un de SES posts (RLS : seul l'auteur peut supprimer).",
    {
      accessToken: accessTokenSchema,
      post_id: z.string().uuid(),
    },
    withMcpErrorHandling(async (args: { accessToken: string; post_id: string }) => {
      const { uid, db } = await asUser(admin, config, args.accessToken);
      const deleted = unwrap(
        await db.from("posts").delete().eq("id", args.post_id).eq("author_id", uid).select(),
        "Suppression impossible"
      );
      if (!deleted || deleted.length === 0) return mcpFail("Post introuvable ou vous n'en êtes pas l'auteur", { code: "not_found" });
      return mcpOk({ deleted: args.post_id });
    })
  );

  // -------------------------------------------------------------------
  // like_post / unlike_post — toggle comme Feed.tsx
  // -------------------------------------------------------------------
  server.tool(
    "like_post",
    "Like un post (insert post_likes ; les compteurs likes_count sont maintenus côté base, comme Feed.tsx).",
    {
      accessToken: accessTokenSchema,
      post_id: z.string().uuid(),
    },
    withMcpErrorHandling(async (args: { accessToken: string; post_id: string }) => {
      const { uid, db } = await asUser(admin, config, args.accessToken);
      const existing = await db.from("post_likes").select("post_id").eq("post_id", args.post_id).eq("user_id", uid).maybeSingle();
      if (existing.data) return mcpOk({ already_liked: true, post_id: args.post_id });
      unwrap(await db.from("post_likes").insert([{ post_id: args.post_id, user_id: uid }]), "Like impossible");
      return mcpOk({ liked: args.post_id });
    })
  );

  server.tool(
    "unlike_post",
    "Retire son like d'un post (suppression post_likes).",
    {
      accessToken: accessTokenSchema,
      post_id: z.string().uuid(),
    },
    withMcpErrorHandling(async (args: { accessToken: string; post_id: string }) => {
      const { uid, db } = await asUser(admin, config, args.accessToken);
      const deleted = unwrap(
        await db.from("post_likes").delete().eq("post_id", args.post_id).eq("user_id", uid).select(),
        "Unlike impossible"
      );
      return mcpOk({ unliked: args.post_id, existed: !!deleted && deleted.length > 0 });
    })
  );

  // -------------------------------------------------------------------
  // get_post_comments / add_post_comment — Feed.tsx
  // -------------------------------------------------------------------
  server.tool(
    "get_post_comments",
    "Liste les commentaires d'un post avec les profils publics des auteurs.",
    {
      accessToken: accessTokenSchema,
      post_id: z.string().uuid(),
      limit: limitSchema,
    },
    withMcpErrorHandling(async (args: { accessToken: string; post_id: string; limit: number }) => {
      const { db } = await asUser(admin, config, args.accessToken);
      const comments = await db
        .from("post_comments")
        .select("*")
        .eq("post_id", args.post_id)
        .order("created_at", { ascending: true })
        .limit(args.limit);
      if (comments.error) return mcpFail(`Lecture des commentaires impossible : ${comments.error.message}`, { code: comments.error.code });
      const ids = Array.from(new Set(((comments.data as any[]) ?? []).map((c) => c.user_id)));
      const profiles = ids.length ? (await db.from("profiles").select("uid, username, full_name, avatar_url").in("uid", ids)).data ?? [] : [];
      const byUid: Record<string, any> = {};
      (profiles as any[]).forEach((p) => (byUid[p.uid] = p));
      return mcpOk({
        count: (comments.data as any[])?.length ?? 0,
        comments: ((comments.data as any[]) ?? []).map((c) => ({ ...c, author: byUid[c.user_id] ?? null })),
      });
    })
  );

  server.tool(
    "add_post_comment",
    "Ajoute un commentaire à un post (insert post_comments : post_id, user_id, text) — même insert que Feed.tsx.",
    {
      accessToken: accessTokenSchema,
      post_id: z.string().uuid(),
      text: z.string().min(1).max(1000).describe("Contenu du commentaire"),
    },
    withMcpErrorHandling(async (args: { accessToken: string; post_id: string; text: string }) => {
      const { uid, db } = await asUser(admin, config, args.accessToken);
      const comment = unwrap(
        await db.from("post_comments").insert({ post_id: args.post_id, user_id: uid, text: args.text.trim() }).select().single(),
        "Commentaire impossible"
      );
      return mcpOk({ comment });
    })
  );

  // -------------------------------------------------------------------
  // share_post — Feed.tsx (insert post_shares)
  // -------------------------------------------------------------------
  server.tool(
    "share_post",
    "Enregistre un partage de post (insert post_shares) et renvoie le lien de partage prêt à copier — comme le bouton Partager de Feed.tsx.",
    {
      accessToken: accessTokenSchema,
      post_id: z.string().uuid(),
    },
    withMcpErrorHandling(async (args: { accessToken: string; post_id: string }) => {
      const { uid, db } = await asUser(admin, config, args.accessToken);
      const existing = await db.from("post_shares").select("post_id").eq("post_id", args.post_id).eq("user_id", uid).maybeSingle();
      if (!existing.data) {
        unwrap(await db.from("post_shares").insert({ post_id: args.post_id, user_id: uid }), "Partage impossible");
      }
      return mcpOk({
        shared: args.post_id,
        share_link: `${config.appUrl}/?post=${args.post_id}`,
        note: "Copiez ce lien pour partager la publication.",
      });
    })
  );

  // -------------------------------------------------------------------
  // review_post — ProfileDetailModal.tsx (avis vendeur)
  // -------------------------------------------------------------------
  server.tool(
    "review_post",
    "Laisse un avis (étoiles + commentaire) sur une annonce/son vendeur (insert post_reviews) — même insert que ProfileDetailModal.tsx.",
    {
      accessToken: accessTokenSchema,
      post_id: z.string().uuid().describe("Annonce concernée"),
      rating: z.number().int().min(1).max(5).describe("Note de 1 à 5 étoiles"),
      comment: z.string().max(500).optional(),
    },
    withMcpErrorHandling(async (args: { accessToken: string; post_id: string; rating: number; comment?: string }) => {
      const { uid, db } = await asUser(admin, config, args.accessToken);
      const post = unwrap(await db.from("posts").select("id, author_id").eq("id", args.post_id).maybeSingle(), "Lecture du post impossible");
      if (!post) return mcpFail("Post introuvable", { code: "not_found" });
      const review = unwrap(
        await db
          .from("post_reviews")
          .insert({
            post_id: args.post_id,
            reviewer_id: uid,
            seller_id: post.author_id,
            rating: args.rating,
            comment: args.comment?.trim() || null,
          })
          .select()
          .single(),
        "Avis impossible"
      );
      return mcpOk({ review });
    })
  );

  // -------------------------------------------------------------------
  // unlock_post — annonce payante : initie le paiement (proxy app)
  // -------------------------------------------------------------------
  server.tool(
    "unlock_post",
    "Débloque une annonce payante : initie le paiement MoneyFusion du prix de l'annonce (proxy vers l'API de paiement du site, " +
      "AUCUNE réimplémentation) et renvoie le lien de paiement. Le webhook existant enregistre le déblocage (post_unlocks) à confirmation.",
    {
      accessToken: accessTokenSchema,
      post_id: z.string().uuid().describe("Identifiant de l'annonce à débloquer"),
    },
    withMcpErrorHandling(async (args: { accessToken: string; post_id: string }) => {
      const { uid, db } = await asUser(admin, config, args.accessToken);
      const post = unwrap(await db.from("posts").select("*").eq("id", args.post_id).maybeSingle(), "Lecture du post impossible");
      if (!post) return mcpFail("Post introuvable", { code: "not_found" });
      if (post.is_free_listing || !post.listing_price) {
        return mcpOk({ post_id: args.post_id, already_free: true, note: "Cette annonce n'est pas payante — les médias sont accessibles via get_post_media." });
      }
      const already = await db.from("post_unlocks").select("post_id").eq("post_id", args.post_id).eq("user_id", uid).maybeSingle();
      if (already.data) return mcpOk({ post_id: args.post_id, already_unlocked: true });

      // Proxy vers l'API de paiement du site (mêmes paramètres que Feed.tsx)
      const res = await fetch(`${config.appUrl}/api/payments/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${args.accessToken}` },
        body: JSON.stringify({
          plan_id: `unlock_post:${args.post_id}`,
          plan_name: `Déblocage annonce ${args.post_id}`,
          amount: post.listing_price,
          related_post_id: args.post_id,
          full_name: `Membre LoveRose (${uid.slice(0, 8)})`,
        }),
      });
      const payload: any = await res.json().catch(() => null);
      if (!res.ok) {
        return mcpFail(`Paiement impossible (${res.status}) : ${payload?.error ?? "réponse invalide"}`, { status: res.status });
      }
      return mcpOk({
        post_id: args.post_id,
        price_fcfa: post.listing_price,
        checkout_url: payload?.url ?? payload?.checkout_url ?? payload?.payment_url ?? null,
        reference: payload?.reference ?? payload?.tokenPay ?? null,
        next_step: "Ouvrez le lien pour payer sur MoneyFusion. Après confirmation du webhook, appelez get_post_media pour voir les médias.",
      });
    })
  );

  // -------------------------------------------------------------------
  // follow_profile / unfollow_profile — profile_followers
  // -------------------------------------------------------------------
  const followTool = (name: "follow_profile" | "unfollow_profile", follow: boolean) => {
    server.tool(
      name,
      follow ? "S'abonne aux publications d'un membre (insert profile_followers)." : "Se désabonne d'un membre.",
      {
        accessToken: accessTokenSchema,
        target_uid: z.string().uuid().describe("uid du membre à suivre / ne plus suivre"),
      },
      withMcpErrorHandling(async (args: { accessToken: string; target_uid: string }) => {
        const { uid, db } = await asUser(admin, config, args.accessToken);
        if (follow) {
          unwrap(
            await db.from("profile_followers").insert([{ follower_id: uid, followed_id: args.target_uid }]),
            "Abonnement impossible"
          );
        } else {
          unwrap(
            await db.from("profile_followers").delete().eq("follower_id", uid).eq("followed_id", args.target_uid),
            "Désabonnement impossible"
          );
        }
        return mcpOk({ [follow ? "followed" : "unfollowed"]: args.target_uid });
      })
    );
  };
  followTool("follow_profile", true);
  followTool("unfollow_profile", false);
};
