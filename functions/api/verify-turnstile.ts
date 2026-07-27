import { json, type Env } from "../_shared/supabaseAdmin";

// Verifies a Cloudflare Turnstile token server-side before letting a signup
// proceed. Never trust a token verification done in the browser — the
// secret key must never reach client code, so this check has to happen here.
export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  try {
    const { turnstileToken } = await request.json<any>();

    if (!turnstileToken) {
      return json({ success: false, error: "Vérification anti-robot manquante." }, 400);
    }

    // If Turnstile isn't configured on this environment, don't block signups —
    // just let them through (matches the tolerant behavior used elsewhere).
    if (!env.TURNSTILE_SECRET) {
      return json({ success: true });
    }

    const verifyRes = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        secret: env.TURNSTILE_SECRET,
        response: turnstileToken,
        remoteip: request.headers.get("CF-Connecting-IP") || "",
      }),
    });
    const verifyData: any = await verifyRes.json();

    if (!verifyData.success) {
      console.warn("Turnstile verification failed on signup:", verifyData["error-codes"]);
      return json({ success: false, error: "Vérification anti-robot échouée. Veuillez réessayer." }, 400);
    }

    return json({ success: true });
  } catch (err: any) {
    console.error("Error handling /api/verify-turnstile:", err);
    return json({ success: false, error: "Erreur interne du serveur." }, 500);
  }
};
