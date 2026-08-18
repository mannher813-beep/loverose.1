import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

// Envoie une notification push de RELANCE GENERIQUE (pas de contenu personnalise
// base sur l'activite : pas de faux "vous avez un message/like/match") a TOUS
// les utilisateurs ayant un abonnement push valide.
//
// Fonction independante de "broadcast-personalized-push" (non modifiee, non impactee).
// Reutilise les memes secrets VAPID / PUSH_TRIGGER_SECRET deja configures sur le projet.

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const PUSH_TRIGGER_SECRET = Deno.env.get("PUSH_TRIGGER_SECRET")!;
const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY")!;
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY")!;
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") || "mailto:hermannlana9@gmail.com";

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, x-push-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Contenu fixe, volontairement generique : aucune allegation d'activite
// (pas de "vous avez un message" / "un like" / "un match") qui serait fausse
// pour la majorite des destinataires.
const NOTIF_TITLE = "❤️ Loverose vous attend";
const NOTIF_BODY = "De nouvelles rencontres vous attendent. Revenez découvrir les profils qui pourraient vous correspondre.";
const NOTIF_TAG = "loverose-reengagement";
const NOTIF_URL = "/";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const providedSecret = req.headers.get("x-push-secret");
  if (!PUSH_TRIGGER_SECRET || providedSecret !== PUSH_TRIGGER_SECRET) {
    return new Response(JSON.stringify({ error: "Non autorise" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    // 1. Tous les abonnements push enregistres
    const { data: subs, error: subsError } = await supabase
      .from("push_subscriptions")
      .select("id, user_id, endpoint, p256dh, auth");

    if (subsError) throw subsError;

    if (!subs || subs.length === 0) {
      return new Response(
        JSON.stringify({ sent: 0, skipped: 0, cleaned: 0, errors_count: 0, reason: "no_subscriptions" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Deduplication par endpoint : evite d'envoyer 2x la meme notif au meme
    // navigateur/appareil s'il existe plusieurs lignes en base pour le meme endpoint.
    const uniqueByEndpoint = new Map<string, (typeof subs)[number]>();
    for (const s of subs) {
      if (!uniqueByEndpoint.has(s.endpoint)) {
        uniqueByEndpoint.set(s.endpoint, s);
      }
    }
    const dedupedSubs = [...uniqueByEndpoint.values()];
    const duplicatesSkipped = subs.length - dedupedSubs.length;

    const userIds = [...new Set(dedupedSubs.map((s) => s.user_id))];

    // 3. Respecte les utilisateurs ayant desactive les notifications push
    const { data: settingsRows } = await supabase
      .from("user_settings")
      .select("user_id, notifications")
      .in("user_id", userIds);

    const pushDisabledUsers = new Set(
      (settingsRows || [])
        .filter((s) => s.notifications?.push_enabled === false)
        .map((s) => s.user_id)
    );

    const payload = JSON.stringify({
      title: NOTIF_TITLE,
      body: NOTIF_BODY,
      url: NOTIF_URL,
      tag: NOTIF_TAG,
    });

    let sent = 0;
    let skipped = duplicatesSkipped;
    const staleIds: string[] = [];
    const errors: string[] = [];

    await Promise.all(
      dedupedSubs.map(async (sub) => {
        if (pushDisabledUsers.has(sub.user_id)) {
          skipped++;
          return;
        }

        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            payload
          );
          sent++;
        } catch (err: any) {
          if (err?.statusCode === 404 || err?.statusCode === 410) {
            staleIds.push(sub.id);
          } else {
            errors.push(`${sub.id}: ${err?.message || err}`);
          }
        }
      })
    );

    if (staleIds.length > 0) {
      await supabase.from("push_subscriptions").delete().in("id", staleIds);
    }

    return new Response(
      JSON.stringify({
        sent,
        skipped,
        cleaned: staleIds.length,
        errors_count: errors.length,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[broadcast-reengagement-push] Erreur:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
