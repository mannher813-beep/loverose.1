import { json, type Env } from "../_shared/supabaseAdmin";

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  try {
    const { name, email, subject, message, turnstileToken } = await request.json<any>();

    const verifyRes = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        secret: env.TURNSTILE_SECRET_KEY,
        response: turnstileToken,
        remoteip: request.headers.get("CF-Connecting-IP") || "",
      }),
    });
    const verifyData: any = await verifyRes.json();

    if (!verifyData.success) {
      console.warn("Turnstile verification failed:", verifyData["error-codes"]);
      return json({ success: false, error: "Vérification anti-robot échouée." }, 400);
    }

    // TODO: plug in real delivery (e.g. Supabase insert, Resend email, etc.)
    console.log("Contact form submission:", { name, email, subject, message });

    return json({ success: true });
  } catch (err: any) {
    console.error("Error handling /api/contact:", err);
    return json({ success: false, error: "Erreur interne du serveur." }, 500);
  }
};
