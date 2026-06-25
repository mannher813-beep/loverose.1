/**
 * Handles HTML5 Native Push Notifications on mobile/desktop 
 * and fallback in-app floating banner notifications.
 */

// Request push notification permission
export async function requestNotificationPermission(): Promise<string> {
  if (!("Notification" in window)) {
    console.warn("This browser does not support desktop notifications.");
    return "unsupported";
  }
  
  try {
    const permission = await Notification.requestPermission();
    return permission;
  } catch (err) {
    console.error("Error requesting notification permission:", err);
    return "denied";
  }
}

// Triggers a native push notification
export function triggerPushNotification(title: string, body: string, iconUrl?: string) {
  // Play sound in parallel
  
  // 1. Try Native HTML5 Notification
  if ("Notification" in window && Notification.permission === "granted") {
    try {
      navigator.serviceWorker?.ready.then((registration) => {
        registration.showNotification(title, {
          body,
          icon: iconUrl || "/icon-192x192.png",
          badge: "/icon-192x192.png",
          vibrate: [200, 100, 200],
          tag: "loverose-msg",
          renewed: true
        } as any);
      }).catch(() => {
        // Fallback to standard Notification if service worker registration is not ready
        new Notification(title, {
          body,
          icon: iconUrl || "https://api.dicebear.com/7.x/initials/svg?seed=LoveRose"
        });
      });
    } catch (err) {
      console.warn("Failed to show native notification, falling back:", err);
    }
  }

  // 2. Always dispatch a custom event so the UI can show a stunning top banner 
  // if the app is currently focused in foreground!
  const event = new CustomEvent("loverose-push-toast", {
    detail: { title, body, icon: iconUrl }
  });
  window.dispatchEvent(event);
}
