import type { Env } from "./_shared/supabaseAdmin";

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env } = context;
  const body = `
    window.__ENV__ = {
      VITE_SUPABASE_URL: ${JSON.stringify(env.VITE_SUPABASE_URL || "")},
      VITE_SUPABASE_ANON_KEY: ${JSON.stringify(env.VITE_SUPABASE_ANON_KEY || "")},
      VITE_TURNSTILE_SITE_KEY: ${JSON.stringify(env.VITE_TURNSTILE_SITE_KEY || "")}
    };
  `;
  return new Response(body, {
    headers: { "Content-Type": "application/javascript" },
  });
};
