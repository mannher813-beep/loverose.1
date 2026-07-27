import { getSupabaseAdmin, json, type Env } from "../_shared/supabaseAdmin";

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  try {
    const { name, email, subject, message, turnstileToken } = await request.json<any>();

    if (!email || !message) {
      return json({ success: false, error: "Adresse email et message requis." }, 400);
    }

    if (env.TURNSTILE_SECRET) {
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
        console.warn("Turnstile verification failed:", verifyData["error-codes"]);
        return json({ success: false, error: "Vérification anti-robot échouée." }, 400);
      }
    }

    // Actually persist the submission — this used to only console.log it,
    // which meant every message vanished into Cloudflare's function logs
    // and never reached anyone.
    const supabaseAdmin = getSupabaseAdmin(env);
    if (!supabaseAdmin) {
      console.error("Contact form: Supabase admin client unavailable, message lost:", { name, email, subject, message });
      return json({ success: false, error: "Service momentanément indisponible. Réessayez plus tard." }, 500);
    }

    const { error: insertErr } = await supabaseAdmin.from("contact_messages").insert({
      name: name || null,
      email,
      subject: subject || null,
      message,
    });

    if (insertErr) {
      console.error("Error saving contact message:", insertErr);
      return json({ success: false, error: "Impossible d'enregistrer votre message. Réessayez plus tard." }, 500);
    }

    return json({ success: true });
  } catch (err: any) {
    console.error("Error handling /api/contact:", err);
    return json({ success: false, error: "Erreur interne du serveur." }, 500);
  }
};
