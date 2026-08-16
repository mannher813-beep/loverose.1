import { getSupabaseAdmin, json, type Env } from "../_shared/supabaseAdmin";

// POST /api/short-link { postId } -> { success, code, shortUrl }
//
// Génère (ou réutilise) un lien court natif Loverose pour une annonce,
// stocké dans Supabase (table short_links). Aucun service externe :
// le lien partagé est "https://<domaine>/p/<code>", résolu par la route
// GET /p/:code qui redirige vers l'annonce correspondante.
const CODE_ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
const CODE_LENGTH = 6;
const MAX_ATTEMPTS = 5;

function generateShortCode(): string {
  const bytes = new Uint8Array(CODE_LENGTH);
  crypto.getRandomValues(bytes);
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  }
  return code;
}

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

    const origin = new URL(request.url).origin;

    // Déjà raccourci pour cette annonce ? On réutilise le même code plutôt
    // que d'en générer un nouveau (une annonce = un seul code, quel que
    // soit le nombre de partages).
    const { data: existing } = await supabaseAdmin
      .from("short_links")
      .select("code")
      .eq("post_id", postId)
      .maybeSingle();

    if (existing?.code) {
      return json({ success: true, code: existing.code, shortUrl: `${origin}/p/${existing.code}` });
    }

    const { data: post } = await supabaseAdmin
      .from("posts")
      .select("id")
      .eq("id", postId)
      .maybeSingle();
    if (!post) {
      return json({ success: false, error: "Annonce introuvable." }, 404);
    }

    // Génère un code court unique et l'attribue via une fonction Postgres
    // atomique (get_or_create_short_link) : elle crée la ligne si besoin,
    // complète le code s'il manque (lignes héritées), et ne l'écrase jamais
    // si un code existe déjà (gère aussi les partages simultanés).
    let lastError: any = null;
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const code = generateShortCode();
      const { data: resultCode, error: rpcErr } = await supabaseAdmin.rpc(
        "get_or_create_short_link",
        { p_post_id: postId, p_code: code }
      );

      if (!rpcErr && resultCode) {
        return json({ success: true, code: resultCode, shortUrl: `${origin}/p/${resultCode}` });
      }

      lastError = rpcErr;
      // 23505 = collision sur "code" (extrêmement rare) -> on réessaie avec
      // un nouveau code généré.
      if (rpcErr?.code === "23505") continue;
      break;
    }

    console.error("Impossible de générer un lien court:", lastError);
    return json({ success: false, error: "Impossible de générer le lien court." }, 500);
  } catch (err: any) {
    console.error("Error handling /api/short-link:", err);
    return json({ success: false, error: "Erreur interne du serveur." }, 500);
  }
};
