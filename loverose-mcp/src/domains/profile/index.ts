import { z } from "zod";
import type { RegisterDomainTools } from "../types.js";
import {
  mcpOk,
  mcpFail,
  withMcpErrorHandling,
} from "../../core/mcpResult.js";
import {
  accessTokenSchema,
  asUser,
  unwrap,
  decodeImageInput,
  storageFileName,
} from "../../core/tooling.js";
import { createLogger } from "../../core/logger.js";

/**
 * Domaine PROFILE
 * ---------------
 * Réutilise exactement les mêmes tables/buckets que :
 *   - src/components/Onboarding.tsx        (upsert profiles, avatars/, gallery/)
 *   - src/components/ProfileSettings.tsx   (update profiles, photos)
 *   - src/components/Settings.tsx          (verification_requests, bucket loverose)
 *   - src/components/ProfileDetailModal.tsx / PublicProfile.tsx (profils publics)
 *
 * Tous les accès passent par le client porteur du JWT utilisateur → la RLS
 * de production s'applique, exactement comme dans l'app React.
 */

const logger = createLogger("domain:profile");

/** Champs modifiables — whitelist identique aux formulaires de l'app. */
const profileUpdateSchema = z
  .object({
    username: z.string().min(2).max(40).optional(),
    full_name: z.string().min(1).max(80).optional(),
    age: z.number().int().min(18).max(99).optional(),
    location: z.string().max(120).optional(),
    gender: z.string().max(30).optional(),
    preferences: z.array(z.string()).max(10).optional(),
    relationship_intents: z.array(z.string()).max(10).optional(),
    bio: z.string().max(500).optional(),
    avatar_url: z.string().url().optional(),
    photos: z.array(z.string().url()).max(10).optional(),
    phone_country_code: z.string().max(8).optional(),
    phone_number: z.string().max(30).optional(),
  })
  .describe("Champs à mettre à jour (tous optionnels) — mêmes champs que ProfileSettings.tsx");

export const registerProfileTools: RegisterDomainTools = ({ server, admin, config }) => {
  const storage = () => admin.storage.from("loverose");

  // -------------------------------------------------------------------
  // complete_onboarding — équivalent de la soumission Onboarding.tsx
  // -------------------------------------------------------------------
  server.tool(
    "complete_onboarding",
    "Finalise le profil obligatoire après inscription (étape d'onboarding) : username, nom, âge, ville, genre, préférences, bio, photo de profil. " +
      "Même upsert `profiles` que Onboarding.tsx. Les photos peuvent être envoyées avant avec upload_photo.",
    {
      accessToken: accessTokenSchema,
      username: z.string().min(2).max(40).describe("Pseudo unique, sera mis en minuscules"),
      full_name: z.string().min(1).max(80).describe("Nom complet affiché"),
      age: z.number().int().min(18).max(99).describe("Âge (18 minimum)"),
      location: z.string().min(1).max(120).describe("Ville / localisation (ex: Douala, Cameroun)"),
      gender: z.string().min(1).max(30).describe("Genre du membre (ex: homme, femme...)"),
      preferences: z.array(z.string()).min(1).max(10).describe("Genres recherchés"),
      relationship_intents: z.array(z.string()).max(10).default([]).describe("Intentions relationnelles"),
      bio: z.string().max(500).default("").describe("Présentation libre"),
      avatar_url: z.string().url().optional().describe("URL de la photo de profil (via upload_photo)"),
      photos: z.array(z.string().url()).max(10).default([]).describe("Galerie photo (URLs via upload_photo)"),
      phone_country_code: z.string().max(8).default("").describe("Indicatif pays (ex: CM, 237)"),
      phone_number: z.string().max(30).default("").describe("Numéro de téléphone (format E.164 recommandé)"),
    },
    withMcpErrorHandling(async (args: {
      accessToken: string; username: string; full_name: string; age: number; location: string;
      gender: string; preferences: string[]; relationship_intents: string[]; bio: string;
      avatar_url?: string; photos: string[]; phone_country_code: string; phone_number: string;
    }) => {
      const { uid, db } = await asUser(admin, config, args.accessToken);
      const row = {
        uid,
        username: args.username.toLowerCase().trim(),
        full_name: args.full_name.trim(),
        age: args.age,
        location: args.location.trim(),
        gender: args.gender,
        preferences: args.preferences,
        relationship_intents: args.relationship_intents,
        bio: args.bio,
        avatar_url: args.avatar_url ?? "",
        photos: args.photos,
        verification_status: "none",
        phone_country_code: args.phone_country_code,
        phone_number: args.phone_number,
        updated_at: new Date().toISOString(),
      };
      const data = unwrap(await db.from("profiles").upsert(row).select().single(), "Onboarding échoué");
      logger.info("onboarding completed", { uid });
      return mcpOk({ profile: data, onboarding_complete: true });
    })
  );

  // -------------------------------------------------------------------
  // get_my_profile
  // -------------------------------------------------------------------
  server.tool(
    "get_my_profile",
    "Récupère le profil complet du membre connecté (table profiles) : identité, photos, préférences, statut de vérification, stats.",
    { accessToken: accessTokenSchema },
    withMcpErrorHandling(async (args: { accessToken: string }) => {
      const { uid, db } = await asUser(admin, config, args.accessToken);
      const data = unwrap(
        await db.from("profiles").select("*").eq("uid", uid).maybeSingle(),
        "Lecture du profil impossible"
      );
      if (!data) return mcpFail("Aucun profil trouvé — complétez d'abord l'onboarding (complete_onboarding)", { code: "not_found" });
      return mcpOk({ profile: data });
    })
  );

  // -------------------------------------------------------------------
  // update_my_profile
  // -------------------------------------------------------------------
  server.tool(
    "update_my_profile",
    "Met à jour le profil du membre connecté (mêmes champs/validations que ProfileSettings.tsx) : bio, photos, ville, préférences, etc.",
    {
      accessToken: accessTokenSchema,
      updates: profileUpdateSchema,
    },
    withMcpErrorHandling(async (args: { accessToken: string; updates: Record<string, unknown> }) => {
      const { uid, db } = await asUser(admin, config, args.accessToken);
      if (!args.updates || Object.keys(args.updates).length === 0) {
        return mcpFail("Aucun champ à mettre à jour : passez au moins une valeur dans updates", { code: "validation_error" });
      }
      const payload = { ...args.updates, updated_at: new Date().toISOString() };
      const data = unwrap(
        await db.from("profiles").update(payload).eq("uid", uid).select().single(),
        "Mise à jour du profil impossible"
      );
      return mcpOk({ profile: data });
    })
  );

  // -------------------------------------------------------------------
  // get_public_profile
  // -------------------------------------------------------------------
  server.tool(
    "get_public_profile",
    "Récupère le profil public d'un membre par son uid (fiche profil, photos publiques) — équivalent de PublicProfile.tsx / ProfileDetailModal.tsx.",
    {
      accessToken: accessTokenSchema,
      uid: z.string().uuid().describe("uid Supabase du membre"),
      include_reviews: z.boolean().default(true).describe("Inclure les avis vendeur (post_reviews)"),
    },
    withMcpErrorHandling(async (args: { accessToken: string; uid: string; include_reviews: boolean }) => {
      const { db } = await asUser(admin, config, args.accessToken);
      const profile = unwrap(
        await db.from("profiles").select("*").eq("uid", args.uid).maybeSingle(),
        "Lecture du profil impossible"
      );
      if (!profile) return mcpFail("Profil introuvable", { code: "not_found" });
      let reviews: any[] = [];
      if (args.include_reviews) {
        const r = await db.from("post_reviews").select("*").eq("seller_id", args.uid).order("created_at", { ascending: false }).limit(20);
        reviews = (r.data as any[]) ?? [];
      }
      return mcpOk({ profile, reviews });
    })
  );

  // -------------------------------------------------------------------
  // upload_photo
  // -------------------------------------------------------------------
  server.tool(
    "upload_photo",
    "Envoie une photo (base64, éventuellement au format data:URL) dans le bucket Storage `loverose` du membre : avatars/, gallery/ ou posts/. " +
      "Retourne l'URL publique à utiliser dans le profil ou les posts — même mécanique qu'Onboarding.tsx/PublishListing.tsx.",
    {
      accessToken: accessTokenSchema,
      image_base64: z.string().min(16).describe("Contenu de l'image en base64 (préfixe data:image/...;base64, accepté)"),
      target: z.enum(["avatar", "gallery", "post"]).describe("avatar = photo de profil, gallery = galerie profil, post = média de publication"),
      file_name: z.string().optional().describe("Nom de fichier souhaité (sinon généré automatiquement)"),
      set_as_avatar: z.boolean().default(false).describe("Pour target=avatar : définit aussi profiles.avatar_url"),
    },
    withMcpErrorHandling(async (args: { accessToken: string; image_base64: string; target: "avatar" | "gallery" | "post"; file_name?: string; set_as_avatar: boolean }) => {
      const { uid, db } = await asUser(admin, config, args.accessToken);
      const { buffer, contentType } = decodeImageInput(args.image_base64);
      const ext = contentType.includes("png") ? ".png" : contentType.includes("webp") ? ".webp" : ".jpg";
      const path = `${args.target === "post" ? "posts" : args.target + "s"}/${uid}/${args.file_name ?? storageFileName(ext)}`;

      const up = await storage().upload(path, buffer, { contentType, upsert: false });
      if (up.error) {
        return mcpFail(`Upload impossible : ${up.error.message}`, { code: up.error.name });
      }
      const { data } = storage().getPublicUrl(path);
      const publicUrl = data.publicUrl;

      let avatarUpdated = false;
      if (args.target === "avatar" && args.set_as_avatar) {
        unwrap(await db.from("profiles").update({ avatar_url: publicUrl, updated_at: new Date().toISOString() }).eq("uid", uid), "Mise à jour avatar impossible");
        avatarUpdated = true;
      }
      logger.info("photo uploaded", { uid, target: args.target });
      return mcpOk({ url: publicUrl, path, target: args.target, avatar_updated: avatarUpdated });
    })
  );

  // -------------------------------------------------------------------
  // delete_photo
  // -------------------------------------------------------------------
  server.tool(
    "delete_photo",
    "Supprime une photo de la galerie du membre (retrait de profiles.photos + suppression du fichier Storage) — même logique que ProfileSettings.tsx.",
    {
      accessToken: accessTokenSchema,
      url: z.string().url().describe("URL publique de la photo à supprimer"),
    },
    withMcpErrorHandling(async (args: { accessToken: string; url: string }) => {
      const { uid, db } = await asUser(admin, config, args.accessToken);
      const profile = unwrap(await db.from("profiles").select("photos, avatar_url").eq("uid", uid).maybeSingle(), "Lecture profil impossible");
      if (!profile) return mcpFail("Profil introuvable", { code: "not_found" });
      const photos: string[] = Array.isArray(profile.photos) ? profile.photos : [];
      if (!photos.includes(args.url)) {
        return mcpFail("Cette photo ne fait pas partie de votre galerie", { code: "not_found" });
      }
      const next = photos.filter((u) => u !== args.url);
      const update: Record<string, unknown> = { photos: next, updated_at: new Date().toISOString() };
      if (profile.avatar_url === args.url) update.avatar_url = next[0] ?? "";
      unwrap(await db.from("profiles").update(update).eq("uid", uid), "Mise à jour galerie impossible");

      // Best-effort : suppression du fichier storage (ne bloque pas)
      const marker = "/storage/v1/object/public/loverose/";
      const idx = args.url.indexOf(marker);
      if (idx >= 0) await storage().remove([args.url.slice(idx + marker.length)]);

      return mcpOk({ deleted: args.url, remaining_photos: next.length });
    })
  );

  // -------------------------------------------------------------------
  // request_verification — Settings.tsx (badge vérifié, 500 FCFA)
  // -------------------------------------------------------------------
  server.tool(
    "request_verification",
    "Dépose une demande de badge « Profil vérifié » : pièces d'identité + selfie déjà envoyés (via upload_photo avec cible adaptée), " +
      "crée une ligne verification_requests (payment_status unpaid) — même flux que Settings.tsx, le paiement de 500 FCFA se fait ensuite via create_payment.",
    {
      accessToken: accessTokenSchema,
      id_document_url: z.string().url().describe("URL (storage public) de la pièce d'identité envoyée"),
      selfie_url: z.string().url().describe("URL (storage public) du selfie"),
    },
    withMcpErrorHandling(async (args: { accessToken: string; id_document_url: string; selfie_url: string }) => {
      const { uid, db } = await asUser(admin, config, args.accessToken);
      const toPath = (url: string) => {
        const marker = "/storage/v1/object/public/loverose/";
        const i = url.indexOf(marker);
        return i >= 0 ? url.slice(i + marker.length) : url;
      };
      const row = {
        user_id: uid,
        documents: [toPath(args.id_document_url), toPath(args.selfie_url)],
        payment_status: "unpaid",
      };
      const data = unwrap(await db.from("verification_requests").insert([row]).select().single(), "Demande de vérification impossible");
      return mcpOk({
        verification_request: data,
        next_step: "Payer les 500 FCFA de frais de dossier avec l'outil create_payment (plan verification_badge), puis la demande part en revue admin.",
      });
    })
  );

  // -------------------------------------------------------------------
  // get_verification_status
  // -------------------------------------------------------------------
  server.tool(
    "get_verification_status",
    "Statut de la demande de vérification du membre (verification_requests la plus récente) + statut du badge sur le profil.",
    { accessToken: accessTokenSchema },
    withMcpErrorHandling(async (args: { accessToken: string }) => {
      const { uid, db } = await asUser(admin, config, args.accessToken);
      const req = await db
        .from("verification_requests")
        .select("*")
        .eq("user_id", uid)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      const profile = unwrap(await db.from("profiles").select("verification_status").eq("uid", uid).maybeSingle(), "Lecture profil impossible");
      return mcpOk({ badge_status: profile?.verification_status ?? "none", latest_request: req.data ?? null });
    })
  );

  // -------------------------------------------------------------------
  // boost_profile — Shop.tsx (10 crédits, boost d'1 heure)
  // -------------------------------------------------------------------
  server.tool(
    "boost_profile",
    "Active un boost de profil pendant 1 heure (10 crédits débités) : insère une ligne profile_boosts et débitte user_credits — exactement comme Shop.tsx.",
    { accessToken: accessTokenSchema },
    withMcpErrorHandling(async (args: { accessToken: string }) => {
      const { uid, db } = await asUser(admin, config, args.accessToken);
      const credits = unwrap(
        await db.from("user_credits").select("balance").eq("user_id", uid).maybeSingle(),
        "Lecture des crédits impossible"
      );
      const balance = credits?.balance ?? 0;
      if (balance < 10) {
        return mcpFail(`Crédits insuffisants : ${balance}/10. Rechargez avec buy_credits.`, { code: "insufficient_credits" });
      }
      unwrap(await db.from("user_credits").update({ balance: balance - 10 }).eq("user_id", uid), "Débit des crédits impossible");
      const startedAt = new Date();
      const endsAt = new Date(startedAt.getTime() + 60 * 60 * 1000);
      unwrap(
        await db.from("profile_boosts").insert([{ user_id: uid, started_at: startedAt.toISOString(), ends_at: endsAt.toISOString() }]),
        "Création du boost impossible"
      );
      logger.info("profile boosted", { uid });
      return mcpOk({ boosted_until: endsAt.toISOString(), remaining_credits: balance - 10 });
    })
  );

  // -------------------------------------------------------------------
  // get_profile_views
  // -------------------------------------------------------------------
  server.tool(
    "get_profile_views",
    "Liste les dernières visites du profil du membre (table profile_views : viewer_id/viewed_id, consultée par WhoLikedMe.tsx) avec les profils publics des visiteurs.",
    {
      accessToken: accessTokenSchema,
      limit: z.number().int().min(1).max(100).default(20),
    },
    withMcpErrorHandling(async (args: { accessToken: string; limit: number }) => {
      const { uid, db } = await asUser(admin, config, args.accessToken);
      const views = await db
        .from("profile_views")
        .select("viewer_id, created_at")
        .eq("viewed_id", uid)
        .order("created_at", { ascending: false })
        .limit(args.limit);
      if (views.error) {
        return mcpFail(`Lecture des vues impossible : ${views.error.message}`, { code: views.error.code });
      }
      const viewerIds = Array.from(new Set(((views.data as any[]) ?? []).map((v) => v.viewer_id).filter(Boolean)));
      const viewers = viewerIds.length
        ? (await db.from("profiles").select("uid, username, full_name, avatar_url, age, location").in("uid", viewerIds)).data ?? []
        : [];
      const byUid: Record<string, any> = {};
      (viewers as any[]).forEach((p) => (byUid[p.uid] = p));
      return mcpOk({
        views: ((views.data as any[]) ?? []).map((v) => ({ ...v, viewer: byUid[v.viewer_id] ?? null })),
      });
    })
  );
};
