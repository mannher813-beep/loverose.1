import { getSupabaseAdmin, type Env } from "../_shared/supabaseAdmin";

// GET /s/:code -> 302 redirect to the real annonce link.
//
// We redirect to the same /?tab=feed&post=<id> URL the app already uses
// internally, rather than duplicating it — that route is already handled by
// functions/index.ts, which rewrites the Open Graph tags server-side so
// WhatsApp/Facebook/Telegram previews still show the annonce's own photo
// and caption (crawlers generally follow redirects when fetching OG tags,
// so this reuses that logic instead of re-implementing it here).
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const code = (context.params.code as string) || "";
  const homeUrl = new URL("/", context.request.url).toString();

  if (!code) {
    return Response.redirect(homeUrl, 302);
  }

  const supabaseAdmin = getSupabaseAdmin(context.env);
  if (!supabaseAdmin) {
    return Response.redirect(homeUrl, 302);
  }

  const { data: link } = await supabaseAdmin
    .from("short_links")
    .select("id, post_id, clicks")
    .eq("code", code)
    .maybeSingle();

  if (!link) {
    // Code inconnu (lien expiré/faux) : on renvoie vers l'accueil plutôt
    // qu'une erreur brute.
    return Response.redirect(homeUrl, 302);
  }

  // Compteur de clics best-effort : ne doit jamais retarder la redirection.
  context.waitUntil(
    supabaseAdmin
      .from("short_links")
      .update({ clicks: (link.clicks || 0) + 1, last_clicked_at: new Date().toISOString() })
      .eq("id", link.id)
      .then(
        () => {},
        () => {}
      )
  );

  const target = new URL(`/?tab=feed&post=${link.post_id}`, context.request.url);
  return Response.redirect(target.toString(), 302);
};
