import { getSupabaseAdmin, json, type Env } from "../_shared/supabaseAdmin";

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env } = context;
  const url = env.VITE_SUPABASE_URL || "";
  const anonKey = env.VITE_SUPABASE_ANON_KEY || "";
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY || "";

  const status: any = {
    urlConfigured: !!url,
    anonKeyConfigured: !!anonKey,
    serviceKeyConfigured: !!serviceKey,
    urlPrefix: url ? url.substring(0, 20) + "..." : "none",
    testConnection: "pending",
    errorMessage: null,
  };

  const supabaseAdmin = getSupabaseAdmin(env);

  if (!supabaseAdmin) {
    status.testConnection = "failed";
    status.errorMessage = "supabaseAdmin is not initialized (missing URL or Service Key in Cloudflare env vars)";
    return json(status);
  }

  try {
    const { error } = await supabaseAdmin.from("profiles").select("uid").limit(1);
    if (error) {
      status.testConnection = "failed";
      status.errorMessage = `${error.code}: ${error.message}`;
    } else {
      status.testConnection = "success";
    }
  } catch (err: any) {
    status.testConnection = "failed";
    status.errorMessage = err.message || String(err);
  }

  return json(status);
};
