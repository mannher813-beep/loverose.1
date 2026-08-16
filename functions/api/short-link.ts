import { getSupabaseAdmin, json, type Env } from "../_shared/supabaseAdmin";

// POST /api/short-link { postId } -> { success, shortUrl }
//
// Raccourcit le lien d'une annonce via l'API Cutt.ly (gratuite avec une clé
// API — cutt.ly -> compte -> API) plutôt que d'héberger notre propre
// redirection : le lien partagé devient cutt.ly/xxxxx au lieu d'un lien
// loverose.pages.dev. Le résultat est mis en cache dans short_links (un seul
// appel Cutt.ly par annonce — le plan gratuit est limité à 3 requêtes/60s).
export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  try {
    const { postId } = await request.json<any>();
    if (!postId || typeof postId !== "string") {
      return json({ success: false, error: "postId requis." }, 400);
    }

    const supabaseAdmin = getSupabaseAdmin(env);
    if (!supabaseAdmin) {
      return json({ success: false, error: "Service momentanément indisponible." }, 500);
    }

    // Déjà raccourci pour cette annonce ? On réutilise plutôt que de
    // resolliciter l'API Cutt.ly (limitée en requêtes/minute côté gratuit).
    const { data: existing } = await supabaseAdmin
      .from("short_links")
      .select("external_short_url")
      .eq("post_id", postId)
      .maybeSingle();

    if (existing?.external_short_url) {
      return json({ success: true, shortUrl: existing.external_short_url });
    }

    if (!env.CUTTLY_API_KEY) {
      console.error("CUTTLY_API_KEY manquante dans les variables d'environnement.");
      return json({ success: false, error: "Raccourcisseur non configuré." }, 500);
    }

    const { data: post } = await supabaseAdmin
      .from("posts")
      .select("id")
      .eq("id", postId)
      .maybeSingle();
    if (!post) {
      return json({ success: false, error: "Annonce introuvable." }, 404);
    }

    const longUrl = new URL(`/?tab=feed&post=${postId}`, request.url).toString();
    const cuttlyEndpoint =
      `https://cutt.ly/api/api.php?key=${encodeURIComponent(env.CUTTLY_API_KEY)}` +
      `&short=${encodeURIComponent(longUrl)}`;

    const cuttlyRes = await fetch(cuttlyEndpoint);
    if (!cuttlyRes.ok) {
      console.error("Cutt.ly API HTTP error:", cuttlyRes.status);
      return json({ success: false, error: "Raccourcisseur momentanément indisponible." }, 502);
    }

    const cuttlyData: any = await cuttlyRes.json();
    // status 7 = succès côté API Cutt.ly ; tout le reste (clé invalide,
    // quota dépassé, URL rejetée...) est traité comme un échec récupérable.
    if (cuttlyData?.url?.status !== 7 || !cuttlyData.url.shortLink) {
      console.error("Cutt.ly API a renvoyé une erreur:", cuttlyData);
      return json({ success: false, error: "Impossible de raccourcir ce lien." }, 502);
    }

    const shortUrl: string = cuttlyData.url.shortLink;

    // Cache best-effort : si l'upsert échoue, le lien Cutt.ly obtenu reste
    // valide quand même, on le renvoie sans bloquer sur l'écriture DB.
    const { error: upsertErr } = await supabaseAdmin
      .from("short_links")
      .upsert({ post_id: postId, external_short_url: shortUrl }, { onConflict: "post_id" });
    if (upsertErr) {
      console.warn("Échec de mise en cache du lien court (non bloquant) :", upsertErr);
    }

    return json({ success: true, shortUrl });
  } catch (err: any) {
    console.error("Error handling /api/short-link:", err);
    return json({ success: false, error: "Erreur interne du serveur." }, 500);
  }
};
