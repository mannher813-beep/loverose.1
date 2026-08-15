import { getSupabaseAdmin, json, type Env } from "../_shared/supabaseAdmin";

// Alphabet without visually ambiguous characters (0/O, 1/l/I).
const CODE_CHARS = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 7;

function generateCode(): string {
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  }
  return code;
}

// POST /api/short-link { postId } -> { success, code }
//
// Returns a short code that redirects to a given annonce (see
// functions/s/[code].ts). Codes are reused: calling this twice for the same
// postId returns the same code instead of minting a new row every time.
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

    // Un code existe déjà pour cette annonce ? On le réutilise.
    const { data: existing } = await supabaseAdmin
      .from("short_links")
      .select("code")
      .eq("post_id", postId)
      .maybeSingle();

    if (existing?.code) {
      return json({ success: true, code: existing.code });
    }

    // On vérifie que l'annonce existe avant de générer un code pour elle.
    const { data: post } = await supabaseAdmin
      .from("posts")
      .select("id")
      .eq("id", postId)
      .maybeSingle();

    if (!post) {
      return json({ success: false, error: "Annonce introuvable." }, 404);
    }

    // Quelques tentatives avec un code aléatoire : les collisions sont
    // astronomiquement rares vu l'alphabet/la longueur choisis, mais on
    // gère le cas proprement (unique_violation = 23505 en Postgres).
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = generateCode();
      const { error: insertErr } = await supabaseAdmin
        .from("short_links")
        .insert({ code, post_id: postId });

      if (!insertErr) {
        return json({ success: true, code });
      }

      if (insertErr.code === "23505") {
        // Soit le code généré existait déjà, soit une requête concurrente
        // vient de créer le lien de cette même annonce entre-temps : dans
        // ce second cas, on récupère et renvoie ce code plutôt que d'échouer.
        const { data: raceWinner } = await supabaseAdmin
          .from("short_links")
          .select("code")
          .eq("post_id", postId)
          .maybeSingle();
        if (raceWinner?.code) {
          return json({ success: true, code: raceWinner.code });
        }
        continue;
      }

      console.error("Error creating short link:", insertErr);
      return json({ success: false, error: "Impossible de créer le lien court." }, 500);
    }

    return json({ success: false, error: "Impossible de générer un code unique." }, 500);
  } catch (err: any) {
    console.error("Error handling /api/short-link:", err);
    return json({ success: false, error: "Erreur interne du serveur." }, 500);
  }
};
