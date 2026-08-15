import { getSupabaseAdmin, Env } from "./_shared/supabaseAdmin";

// Handles GET / — this is the SPA's homepage route.
//
// Normal visits (no `post` query param) are passed straight through to the
// static index.html via context.next(), so this adds zero overhead to
// regular traffic.
//
// Links shared from the Feed look like /?tab=feed&post=<POST_ID>. When a
// crawler (WhatsApp, Facebook, Telegram, etc.) fetches that URL it never
// runs our client-side JS, so it only ever saw the generic site-wide OG tags
// baked into index.html. Here we fetch the actual post server-side and swap
// in its own photo/caption before returning the HTML, so the link preview
// matches the publication being shared. A human opening the same link still
// gets the normal app shell/bundle — nothing else changes.
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const url = new URL(context.request.url);
  const postId = url.searchParams.get("post");

  if (!postId) {
    return context.next();
  }

  const assetResponse = await context.next();

  try {
    const supabaseAdmin = getSupabaseAdmin(context.env);
    if (!supabaseAdmin) return assetResponse;

    const { data: post } = await supabaseAdmin
      .from("posts")
      .select("id, contenu, medias, author_id")
      .eq("id", postId)
      .maybeSingle();

    if (!post) return assetResponse;

    let authorName = "Un membre LoveRose";
    if (post.author_id) {
      const { data: authorProfile } = await supabaseAdmin
        .from("profiles")
        .select("full_name")
        .eq("uid", post.author_id)
        .maybeSingle();
      if (authorProfile?.full_name) authorName = authorProfile.full_name;
    }

    // Clone before reading so assetResponse's body is still intact for the
    // fallback return path if anything below throws.
    const html = await assetResponse.clone().text();

    const rawCaption = (post.contenu || "").trim();
    const description = rawCaption
      ? (rawCaption.length > 180 ? rawCaption.slice(0, 177) + "…" : rawCaption)
      : `Découvrez la publication de ${authorName} sur LoveRose.`;
    const title = `${authorName} sur LoveRose`;
    const image = post.medias && post.medias.length > 0 ? post.medias[0] : "https://loverose.pages.dev/og-image.jpg";
    const pageUrl = url.toString();

    const escapeHtml = (s: string) =>
      s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

    let updatedHtml = html
      .replace(/<title>.*?<\/title>/, `<title>${escapeHtml(title)}</title>`)
      .replace(/(<meta property="og:url" content=")[^"]*(")/, `$1${escapeHtml(pageUrl)}$2`)
      .replace(/(<meta property="og:title" content=")[^"]*(")/, `$1${escapeHtml(title)}$2`)
      .replace(/(<meta property="og:description" content=")[^"]*(")/, `$1${escapeHtml(description)}$2`)
      .replace(/(<meta property="og:image" content=")[^"]*(")/, `$1${escapeHtml(image)}$2`)
      // Width/height hints were sized for the generic 1200x630 site banner;
      // strip them for post photos so crawlers measure the real image instead.
      .replace(/\s*<meta property="og:image:width" content="[^"]*"\s*\/>\n?/, "\n")
      .replace(/\s*<meta property="og:image:height" content="[^"]*"\s*\/>\n?/, "\n")
      .replace(/(<meta name="twitter:title" content=")[^"]*(")/, `$1${escapeHtml(title)}$2`)
      .replace(/(<meta name="twitter:description" content=")[^"]*(")/, `$1${escapeHtml(description)}$2`)
      .replace(/(<meta name="twitter:image" content=")[^"]*(")/, `$1${escapeHtml(image)}$2`)
      .replace(/(<meta name="description" content=")[^"]*(")/, `$1${escapeHtml(description)}$2`);

    return new Response(updatedHtml, {
      status: assetResponse.status,
      headers: {
        "Content-Type": "text/html; charset=UTF-8",
        "Cache-Control": "public, max-age=300",
      },
    });
  } catch (err) {
    console.error("[og:post] Failed to build per-post preview:", err);
    return assetResponse;
  }
};
