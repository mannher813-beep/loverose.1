import { getSupabaseAdmin, Env, json } from "../../_shared/supabaseAdmin";

// POST /api/admin/kyc-signed-urls
// header: Authorization: Bearer <supabase access token de l'admin connecté>
// body: { paths: string[] }  (chemins stockage kyc-documents/{user_id}/{slot}.jpg)
// -> { urls: Record<path, signedUrl> }
//
// Les policies RLS du bucket kyc-documents restreignent chaque utilisateur à
// son propre dossier — un admin normal ne peut donc PAS lire les documents
// des autres via le client Supabase classique. Cet endpoint passe par la
// service role côté serveur, mais vérifie d'abord que l'appelant est bien
// un admin avant de générer quoi que ce soit.
export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { env, request } = context;

  const authHeader = request.headers.get("Authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) return json({ error: "Missing Authorization header" }, 401);

  const supabaseAdmin = getSupabaseAdmin(env);
  if (!supabaseAdmin) return json({ error: "Server misconfigured" }, 500);

  const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token);
  if (userErr || !userData?.user) return json({ error: "Invalid session" }, 401);

  const { data: profile, error: profileErr } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("uid", userData.user.id)
    .maybeSingle();

  if (profileErr || profile?.role !== "admin") {
    return json({ error: "Not authorized" }, 403);
  }

  let body: { paths?: string[] };
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const paths = Array.isArray(body.paths) ? body.paths.filter((p) => typeof p === "string") : [];
  if (paths.length === 0) return json({ error: "No paths provided" }, 400);

  const urls: Record<string, string | null> = {};
  for (const path of paths) {
    const { data, error } = await supabaseAdmin.storage
      .from("kyc-documents")
      .createSignedUrl(path, 600); // 10 minutes, largement assez pour une revue
    urls[path] = error ? null : data?.signedUrl || null;
  }

  return json({ urls });
};
