import { getSupabaseAdmin, type Env } from "../_shared/supabaseAdmin";

// GET /p/:code -> résout le code court natif Loverose et redirige vers
// l'annonce correspondante.
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { params, request, env } = context;
  const code = typeof params.code === "string" ? params.code : "";

  if (!code) {
    return new Response("Lien introuvable.", { status: 404 });
  }

  const supabaseAdmin = getSupabaseAdmin(env);
  if (!supabaseAdmin) {
    return new Response("Service momentanément indisponible.", { status: 500 });
  }

  const { data } = await supabaseAdmin
    .from("short_links")
    .select("post_id")
    .eq("code", code)
    .maybeSingle();

  if (!data?.post_id) {
    return new Response("Lien introuvable.", { status: 404 });
  }

  const destination = new URL(`/?tab=feed&post=${data.post_id}`, request.url);
  return Response.redirect(destination.toString(), 302);
};
