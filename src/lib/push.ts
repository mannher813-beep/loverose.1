import { supabase } from "./supabase";

// Clé publique VAPID (peut être exposée côté client sans risque : c'est sa raison d'être).
// La clé privée correspondante ne vit QUE côté serveur (secret de l'Edge Function "send-push").
const VAPID_PUBLIC_KEY = "BNQP14WGOKyegpqbcBtrWAVzOEzM0Go63oQbft2t0hDFA1rFg65LVmcp2euR4Pem4yidNC2aAJcipFUFa8ukLa4";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function isPushSupported(): boolean {
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

export function getNotificationPermission(): NotificationPermission | "unsupported" {
  if (!("Notification" in window)) return "unsupported";
  return Notification.permission;
}

/**
 * Demande la permission (si besoin), s'abonne au Push Manager du navigateur,
 * puis enregistre l'abonnement dans push_subscriptions pour que le serveur
 * puisse envoyer de vraies notifications (Web Push / VAPID) même app fermée.
 */
export async function subscribeToPushNotifications(userId: string): Promise<{ success: boolean; reason?: string }> {
  if (!isPushSupported()) {
    return { success: false, reason: "unsupported" };
  }

  try {
    let permission = Notification.permission;
    if (permission === "default") {
      permission = await Notification.requestPermission();
    }
    if (permission !== "granted") {
      return { success: false, reason: "denied" };
    }

    const registration = await navigator.serviceWorker.ready;

    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
    }

    const subJson = subscription.toJSON();
    if (!subJson.endpoint || !subJson.keys?.p256dh || !subJson.keys?.auth) {
      return { success: false, reason: "invalid_subscription" };
    }

    const { error } = await supabase.from("push_subscriptions").upsert(
      {
        user_id: userId,
        endpoint: subJson.endpoint,
        p256dh: subJson.keys.p256dh,
        auth: subJson.keys.auth,
      },
      { onConflict: "endpoint" }
    );

    if (error) {
      console.error("Failed to save push subscription:", error);
      return { success: false, reason: "save_failed" };
    }

    return { success: true };
  } catch (err) {
    console.error("Push subscription error:", err);
    return { success: false, reason: "error" };
  }
}
