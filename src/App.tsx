import { useState, useEffect } from "react";
import { supabase, isSupabaseConfigured } from "./lib/supabase";
import { Profile } from "./types";
import { Heart, LayoutDashboard, PlusCircle, Settings, Sparkles, User, LogOut, X, Bell, ShieldAlert, Newspaper, Bot } from "lucide-react";

// Component imports
import SupabaseSetupBanner from "./components/SupabaseSetupBanner";
import PaymentSuccess from "./components/PaymentSuccess";
import Auth from "./components/Auth";
import Feed from "./components/Feed";
import PublishListing from "./components/PublishListing";
import Dashboard from "./components/Dashboard";
import ProfileSettings from "./components/ProfileSettings";
import SettingsView from "./components/Settings";
import NotificationsView from "./components/Notifications";
import WhoLikedMe from "./components/WhoLikedMe";
import Onboarding from "./components/Onboarding";
import PublicProfile from "./components/PublicProfile";
import PublicLayout from "./components/public/PublicLayout";
import AdminPanel from "./components/AdminPanel";
import AdminAnnouncementToast from "./components/AdminAnnouncementToast";
import ErrorBoundary from "./components/ErrorBoundary";
import { isPushSupported, getNotificationPermission, subscribeToPushNotifications } from "./lib/push";

export default function App() {
  // Simple Path Routing
  const [currentPath, setCurrentPath] = useState(window.location.pathname);
  const [currentSearch, setCurrentSearch] = useState(window.location.search);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const isAdmin = profile?.role === 'admin';
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'discover' | 'publier' | 'dashboard' | 'profile' | 'settings' | 'notifications' | 'likes' | 'admin'>('discover');
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState<number>(0);
  
  // Guest mode auth modal
  const [showGuestAuthModal, setShowGuestAuthModal] = useState<boolean>(false);
  const [authInitialIsSignUp, setAuthInitialIsSignUp] = useState<boolean>(true);

  const triggerAuthRequired = (isSignUp = true) => {
    setAuthInitialIsSignUp(isSignUp);
    setShowGuestAuthModal(true);
  };

  // Match alerts overlay
  const [matchedPartner, setMatchedPartner] = useState<Profile | null>(null);

  // Push notifications overlay state
  const [toastNotification, setToastNotification] = useState<{ title: string; body: string; icon?: string } | null>(null);

  // PWA installation states
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallBanner, setShowInstallBanner] = useState<boolean>(false);

  // Deep-link: emails/push links can open a specific tab directly via ?tab=notifications etc.
  useEffect(() => {
    if (!currentUser) return;
    const params = new URLSearchParams(window.location.search);
    let requestedTab = params.get("tab");
    // Anciens liens pointant vers des onglets supprimés (messagerie, boutique) :
    // on redirige vers leurs équivalents actuels plutôt que d'ignorer le lien.
    if (requestedTab === "chat") requestedTab = "discover";
    if (requestedTab === "shop") requestedTab = "dashboard";
    const validTabs = ["discover", "publier", "dashboard", "profile", "settings", "notifications"] as const;
    if (requestedTab && (validTabs as readonly string[]).includes(requestedTab)) {
      setActiveTab(requestedTab as typeof activeTab);
      params.delete("tab");
      const cleanSearch = params.toString();
      window.history.replaceState({}, document.title, window.location.pathname + (cleanSearch ? `?${cleanSearch}` : ""));
    }
  }, [currentUser]);

  // Offer to enable real push notifications (Chrome/Android) once per logged-in user,
  // unless they've already granted/denied permission or dismissed the banner before.
  const [showPushBanner, setShowPushBanner] = useState<boolean>(false);
  const [isEnablingPush, setIsEnablingPush] = useState<boolean>(false);

  useEffect(() => {
    if (!currentUser || !isPushSupported()) return;
    const permission = getNotificationPermission();

    if (permission === "granted") {
      // Permission was already granted (often from before this feature
      // existed), so the banner below never fires for this person and they'd
      // otherwise stay silently unsubscribed forever. No prompt needed here —
      // the browser won't re-ask — so just make sure a real subscription
      // actually exists and is saved. subscribeToPushNotifications() reuses
      // any existing PushManager subscription, so this is a harmless no-op
      // for anyone already properly subscribed.
      subscribeToPushNotifications(currentUser.id).catch(() => {});
      return;
    }

    // Instead of hiding the banner forever after one dismissal, re-show it
    // every few days as long as permission is still "default" (never
    // actually decided) — dismissing isn't the same as declining, and a lot
    // of people just close banners reflexively on first open without
    // meaning to opt out permanently.
    const RENOTIFY_AFTER_MS = 3 * 24 * 60 * 60 * 1000; // 3 days
    const dismissedAt = Number(localStorage.getItem(`push_banner_dismissed_${currentUser.id}`) || 0);
    const shouldReshow = !dismissedAt || Date.now() - dismissedAt > RENOTIFY_AFTER_MS;
    if (permission === "default" && shouldReshow) {
      setShowPushBanner(true);
    }
  }, [currentUser]);

  const handleEnablePush = async () => {
    if (!currentUser) return;
    setIsEnablingPush(true);
    const result = await subscribeToPushNotifications(currentUser.id);
    setIsEnablingPush(false);
    setShowPushBanner(false);
    if (currentUser) {
      // Successful subscription, or an explicit browser-level "denied", both
      // stop mattering here (nothing left to re-ask) — only a lingering
      // "default" (banner dismissed without deciding) should come back later.
      localStorage.setItem(`push_banner_dismissed_${currentUser.id}`, String(Date.now()));
    }
    if (!result.success) {
      console.warn("Push subscription not enabled:", result.reason);
    }
  };

  const dismissPushBanner = () => {
    setShowPushBanner(false);
    if (currentUser) {
      localStorage.setItem(`push_banner_dismissed_${currentUser.id}`, String(Date.now()));
    }
  };

  useEffect(() => {
    const handlePushToast = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent?.detail) {
        setToastNotification(customEvent.detail);
        // Automatically close after 5 seconds
        const timer = setTimeout(() => {
          setToastNotification(null);
        }, 5000);
        return () => clearTimeout(timer);
      }
    };
    window.addEventListener("loverose-push-toast", handlePushToast);
    return () => {
      window.removeEventListener("loverose-push-toast", handlePushToast);
    };
  }, []);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstallBanner(true);
    };
    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, []);

  useEffect(() => {
    const handleAppInstalled = () => {
      supabase.from("pwa_install_events").insert({
        user_id: currentUser?.id ?? null,
        event_type: "installed",
      }).then(({ error }) => {
        if (error) console.warn("Could not log PWA install confirmation:", error);
      });
    };
    window.addEventListener("appinstalled", handleAppInstalled);
    return () => {
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, [currentUser]);

  const handleInstallApp = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`User response to install prompt: ${outcome}`);
    supabase.from("pwa_install_events").insert({
      user_id: currentUser?.id ?? null,
      event_type: "button_click",
      outcome,
    }).then(({ error }) => {
      if (error) console.warn("Could not log PWA install click:", error);
    });
    setDeferredPrompt(null);
    setShowInstallBanner(false);
  };

  useEffect(() => {
    if (currentUser) {
      import("./lib/notifications").then(({ requestNotificationPermission }) => {
        requestNotificationPermission();
      });
    }
  }, [currentUser]);

  const fetchUnreadNotificationsCount = async (uid: string) => {
    try {
      const { count, error } = await supabase
        .from("notifications")
        .select("*", { count: "exact", head: true })
        .eq("user_id", uid)
        .eq("lu", false);

      if (!error && count !== null) {
        setUnreadNotificationsCount(count);
      }
    } catch (err) {
      console.error("Error loading unread notification count:", err);
    }
  };

  useEffect(() => {
    if (!currentUser) return;

    fetchUnreadNotificationsCount(currentUser.id);

    // Listen to manual unread counter triggers
    const handleReadTrigger = () => fetchUnreadNotificationsCount(currentUser.id);
    window.addEventListener("loverose-notification-read", handleReadTrigger);

    // Subscribe to notifications updates
    const channelName = `user-notifications-count-${currentUser.id}-${Math.random().toString(36).substring(2, 11)}`;
    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${currentUser.id}`
        },
        () => {
          fetchUnreadNotificationsCount(currentUser.id);
        }
      )
      .subscribe();

    return () => {
      window.removeEventListener("loverose-notification-read", handleReadTrigger);
      supabase.removeChannel(channel);
    };
  }, [currentUser]);

  // Real-time presence status, location tracker, and subscription watcher
  useEffect(() => {
    if (!currentUser) return;

    // 1. Continuous location tracking while the app is open, so "nearby"
    // suggestions stay accurate as the person actually moves — not just a
    // one-off read at login. The browser's geolocation permission prompt
    // still applies: nothing is tracked unless the person allows it, and
    // they can revoke it at any time from their browser/OS settings.
    let lastSentAt = 0;
    let lastSentCoords: { lat: number; lng: number } | null = null;
    let geoWatchId: number | null = null;

    // Small local haversine calc (km) so we don't need to import from Discover.tsx.
    const distanceKm = (lat1: number, lon1: number, lat2: number, lon2: number) => {
      const R = 6371;
      const dLat = (lat2 - lat1) * (Math.PI / 180);
      const dLon = (lon2 - lon1) * (Math.PI / 180);
      const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLon / 2) ** 2;
      return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    };

    const MIN_INTERVAL_MS = 3 * 60 * 1000; // don't write more than once every 3 min
    const MIN_MOVE_KM = 0.3; // ...unless they've moved at least ~300m

    const pushLocation = async (lat: number, lng: number, force = false) => {
      const now = Date.now();
      const movedEnough =
        !lastSentCoords || distanceKm(lastSentCoords.lat, lastSentCoords.lng, lat, lng) >= MIN_MOVE_KM;
      const enoughTimePassed = now - lastSentAt >= MIN_INTERVAL_MS;
      if (!force && !movedEnough && !enoughTimePassed) return;

      try {
        await supabase.rpc('update_my_location', { lat, lng });
        lastSentAt = now;
        lastSentCoords = { lat, lng };
      } catch (e) {
        console.warn("Failed to update location in Supabase:", e);
      }
    };

    if (navigator.geolocation) {
      // Immediate fix on load (force=true so the very first one always writes).
      navigator.geolocation.getCurrentPosition(
        (pos) => pushLocation(pos.coords.latitude, pos.coords.longitude, true),
        (err) => console.log("Geolocation permission not active or rejected:", err)
      );

      // Then keep watching in the background for as long as the tab is open.
      geoWatchId = navigator.geolocation.watchPosition(
        (pos) => pushLocation(pos.coords.latitude, pos.coords.longitude),
        (err) => console.log("Geolocation watch error:", err),
        { enableHighAccuracy: false, maximumAge: 60000, timeout: 20000 }
      );
    }

    // 2. Set presence online immediately
    const setOnline = async () => {
      try {
        await supabase.rpc('update_my_presence', { online: true });
      } catch (e) {
        console.warn("Failed to update presence online", e);
      }
    };
    setOnline();

    // Heartbeat every 60 seconds
    const presenceHeartbeat = setInterval(async () => {
      try {
        await supabase.rpc('update_my_presence', { online: true });
      } catch (e) {}
    }, 60000);

    // Set offline callback
    const setOffline = async () => {
      try {
        await supabase.rpc('update_my_presence', { online: false });
      } catch (e) {}
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        setOffline();
      } else {
        setOnline();
        // watchPosition can be throttled/paused by the browser while the tab
        // is in the background, so grab a fresh fix as soon as it's back.
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            (pos) => pushLocation(pos.coords.latitude, pos.coords.longitude, true),
            (err) => console.log("Geolocation permission not active or rejected:", err)
          );
        }
      }
    };

    window.addEventListener("beforeunload", setOffline);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    // 3. Realtime subscription to the user's profile changes (online status / updates)
    const profileChannelName = `user-profile-${currentUser.id}-${Math.random().toString(36).substring(2, 11)}`;
    const profileChannel = supabase
      .channel(profileChannelName)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "profiles",
          filter: `uid=eq.${currentUser.id}`
        },
        (payload) => {
          if (payload.new) {
            setProfile(payload.new as Profile);
            localStorage.setItem(`profile_backup_${currentUser.id}`, JSON.stringify(payload.new));
          }
        }
      )
      .subscribe();

    return () => {
      clearInterval(presenceHeartbeat);
      window.removeEventListener("beforeunload", setOffline);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (geoWatchId !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(geoWatchId);
      }
      supabase.removeChannel(profileChannel);
      setOffline();
    };
  }, [currentUser]);

  useEffect(() => {
    // Sync location path and search
    const handleLocationChange = () => {
      setCurrentPath(window.location.pathname);
      setCurrentSearch(window.location.search);
    };
    window.addEventListener("popstate", handleLocationChange);
    
    // Support programmatic history updates
    const originalPushState = window.history.pushState;
    window.history.pushState = function (...args) {
      originalPushState.apply(this, args);
      handleLocationChange();
    };
    
    const originalReplaceState = window.history.replaceState;
    window.history.replaceState = function (...args) {
      originalReplaceState.apply(this, args);
      handleLocationChange();
    };

    return () => {
      window.removeEventListener("popstate", handleLocationChange);
      window.history.pushState = originalPushState;
      window.history.replaceState = originalReplaceState;
    };
  }, []);

  // Listen to Auth State changes
  useEffect(() => {
    if (!isSupabaseConfigured) {
      setIsLoading(false);
      return;
    }

    // Check current session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setCurrentUser(session.user);
        loadProfile(session.user.id);
      } else {
        setIsLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        setCurrentUser(session.user);
        loadProfile(session.user.id);
      } else {
        setCurrentUser(null);
        setProfile(null);
        setIsLoading(false);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const loadProfile = async (uid: string) => {
    try {
      // Fetch profile data
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("uid", uid)
        .single();

      if (error) {
        console.warn("Profile record not found from Supabase, checking local backup.");
        const localBackup = localStorage.getItem(`profile_backup_${uid}`);
        if (localBackup) {
          try {
            setProfile(JSON.parse(localBackup));
            return;
          } catch (e) {}
        }
        setProfile({ uid, relationship_intents: [] });
      } else {
        setProfile(data);
        localStorage.setItem(`profile_backup_${uid}`, JSON.stringify(data));
      }
    } catch (err) {
      console.error("Profile fetch error:", err);
      const localBackup = localStorage.getItem(`profile_backup_${uid}`);
      if (localBackup) {
        try {
          setProfile(JSON.parse(localBackup));
        } catch (e) {}
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    if (confirm("Voulez-vous vous déconnecter de LoveRose ?")) {
      await supabase.auth.signOut();
    }
  };

  // Enregistre un match mutuel avec cet utilisateur suite à un "like en retour"
  // (ex: depuis "Qui m'a aimé" ou une notification de match). La messagerie
  // ayant été retirée, cette action ne fait plus que confirmer le match.
  const handleLikeBack = async (partnerId: string) => {
    try {
      const { data: existingMatches, error: matchError } = await supabase
        .from("matches")
        .select("*")
        .contains("users", [currentUser.id, partnerId]);

      if (!matchError && existingMatches && existingMatches.length > 0) {
        // Match already exists
      } else {
        const { error: createError } = await supabase
          .from("matches")
          .insert([{ users: [currentUser.id, partnerId] }]);

        if (createError) {
          // Fallback: try inserting reciprocal likes to trigger automatic DB match trigger
          await supabase.from("likes").upsert([
            { from_uid: currentUser.id, to_uid: partnerId },
            { from_uid: partnerId, to_uid: currentUser.id }
          ]);
        }
      }
    } catch (err) {
      console.error("Error confirming match:", err);
    }
  };

  // --- RENDERING PATH ROUTING FALLBACKS ---

  // Render Supabase Setup Guide if credentials aren't loaded yet
  if (!isSupabaseConfigured) {
    return <SupabaseSetupBanner />;
  }

  const urlParams = new URLSearchParams(currentSearch);
  const queryUsername = urlParams.get("profil") || urlParams.get("profile");
  const isPublicProfileView = currentPath.startsWith("/profil/") || !!queryUsername;
  const publicUsername = queryUsername || currentPath.replace("/profil/", "").trim();

  // Render Public Profile without requiring user to be logged in
  if (isPublicProfileView && publicUsername) {
    return (
      <PublicProfile 
        username={publicUsername} 
        onGoHome={() => {
          setCurrentPath("/");
          setCurrentSearch("");
          window.history.replaceState({}, document.title, "/");
        }} 
      />
    );
  }

  // Public marketing/legal pages (CGU, politique de confidentialité, FAQ, etc.).
  // PublicLayout existed and handled all of these paths correctly already.
  // Note: "/" is intentionally NOT in this list — opening the site should
  // drop guests straight into the live Discover feed (anonymous browsing),
  // not a marketing splash page. "/accueil" is kept as an explicit marketing
  // page for anyone who wants to link to it directly.
  const publicMarketingPaths = [
    "/accueil",
    "/a-propos",
    "/faq",
    "/contact",
    "/conditions-d-utilisation",
    "/politique-de-confidentialite",
  ];
  if (!currentUser && !isLoading && publicMarketingPaths.includes(currentPath)) {
    return (
      <PublicLayout
        currentPath={currentPath}
        onNavigate={(path) => {
          setCurrentPath(path);
          window.history.pushState({}, "", path);
        }}
        onShowAuth={(signUp) => {
          setCurrentPath("/");
          window.history.replaceState({}, document.title, "/");
          setShowGuestAuthModal(true);
        }}
      />
    );
  }


  const isPaymentSuccess = currentPath === "/payment-success" || urlParams.get("payment") === "success";
  const isPaymentCancel = currentPath === "/payment-cancel" || urlParams.get("payment") === "cancel";

  // Render Payment Success Screen
  if (isPaymentSuccess) {
    return (
      <PaymentSuccess 
        userId={currentUser?.id} 
        loadProfile={currentUser?.id ? loadProfile : undefined}
        onBackToApp={() => {
          setCurrentPath("/");
          setCurrentSearch("");
          window.history.replaceState({}, document.title, "/");
        }} 
      />
    );
  }

  // Render Payment Cancel Screen
  if (isPaymentCancel) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 font-sans">
        <div className="max-w-md w-full bg-white rounded-3xl p-8 shadow-xl border border-slate-100 text-center space-y-6">
          <div className="mx-auto bg-red-50 w-20 h-20 rounded-full flex items-center justify-center text-red-500">
            <Heart size={48} className="rotate-45" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-slate-900">Transaction Annulée</h1>
            <p className="text-slate-500 text-xs leading-relaxed">La commande a été suspendue à votre demande.</p>
          </div>
          <button
            onClick={() => {
              setCurrentPath("/");
              setCurrentSearch("");
              window.history.replaceState({}, document.title, "/");
            }}
            className="w-full py-3 bg-rose-500 hover:bg-rose-600 text-white font-bold rounded-2xl transition cursor-pointer"
          >
            Retourner sur l'application
          </button>
        </div>
      </div>
    );
  }

  // Show general global loading indicator
  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center font-sans">
        <div className="text-center space-y-3">
          <div className="w-12 h-12 border-4 border-rose-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider">Connexion à LoveRose...</p>
        </div>
      </div>
    );
  }

  // Block access for accounts an admin has suspended.
  // profiles is readable by its own owner (RLS), so we can gate here directly;
  // the real enforcement against write actions lives in the database policies.
  if (currentUser && profile) {
    const suspendedUntil = profile.suspended_until ? new Date(profile.suspended_until) : null;
    const isCurrentlySuspended = !!profile.is_suspended && (!suspendedUntil || suspendedUntil > new Date());

    if (isCurrentlySuspended) {
      return (
        <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center font-sans px-6 text-center">
          <div className="max-w-sm space-y-4">
            <div className="w-16 h-16 bg-red-100 text-red-500 rounded-full flex items-center justify-center mx-auto">
              <ShieldAlert size={28} />
            </div>
            <h1 className="font-extrabold text-lg text-slate-800">Compte suspendu</h1>
            <p className="text-sm text-slate-500">
              {profile.suspension_reason
                ? profile.suspension_reason
                : "Votre compte a été suspendu par l'équipe LoveRose pour non-respect des règles de la communauté."}
            </p>
            {suspendedUntil && (
              <p className="text-xs text-slate-400">
                Suspension valable jusqu'au {suspendedUntil.toLocaleString("fr-FR")}.
              </p>
            )}
            <button
              onClick={handleLogout}
              className="w-full bg-slate-800 hover:bg-slate-900 text-white font-bold py-3 rounded-xl cursor-pointer transition"
            >
              Se déconnecter
            </button>
          </div>
        </div>
      );
    }
  }

  // Check if logged in user profile is incomplete.
  // Les comptes anonymes (connexion invité) ne sont jamais forcés dans ce
  // parcours : ils ont accès à toutes les fonctionnalités (annonces, photo
  // de profil, etc.) dès la connexion, et peuvent compléter leur profil
  // plus tard, s'ils le souhaitent, depuis les Réglages.
  if (currentUser && !currentUser.is_anonymous) {
    const isProfileIncomplete = !profile || 
      !profile.full_name || 
      !profile.age || 
      !profile.location || 
      !profile.gender || 
      !profile.preferences || 
      !profile.relationship_intents || 
      profile.relationship_intents.length === 0 || 
      !profile.avatar_url;

    if (isProfileIncomplete) {
      return (
        <Onboarding
          currentUser={currentUser}
          onComplete={() => loadProfile(currentUser.id)}
        />
      );
    }
  }

  // Guest Auth Page (full page, not a popup)
  if (!currentUser && (showGuestAuthModal || currentPath === "/connexion" || currentPath === "/inscription")) {
    return (
      <Auth
        initialIsSignUp={currentPath === "/inscription"}
        onBack={() => {
          setShowGuestAuthModal(false);
          setCurrentPath("/");
          window.history.pushState(null, "", "/");
        }}
        onSuccess={() => {
          setShowGuestAuthModal(false);
          setIsLoading(true);
          if (currentPath === "/connexion" || currentPath === "/inscription") {
            setCurrentPath("/");
            window.history.pushState(null, "", "/");
          }
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col h-screen h-[100dvh] overflow-hidden font-sans text-slate-800 pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)]">
      
      {/* ============ EN-TÊTE ============ */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 flex-shrink-0">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          {/* Logotype éditorial */}
          <button
            onClick={() => setActiveTab('discover')}
            className="flex items-baseline gap-px cursor-pointer flex-shrink-0 group"
            aria-label="Aller au fil d'annonces"
          >
            <span className="u-display text-[26px] leading-none text-slate-950">Love</span>
            <span className="u-display text-[26px] leading-none text-rose-500">Rose</span>
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 ml-1 mb-0.5 group-hover:scale-125 transition-transform" />
          </button>

          {/* Navigation bureau */}
          <nav className="hidden md:flex items-center gap-1" aria-label="Navigation principale">
            {[
              { id: 'discover', label: 'Annonces', Icon: Newspaper },
              { id: 'publier', label: 'Publier', Icon: PlusCircle },
              { id: 'dashboard', label: 'Tableau de bord', Icon: LayoutDashboard },
              { id: 'notifications', label: 'Notifications', Icon: Bell, badge: unreadNotificationsCount },
            ].map(({ id, label, Icon, badge }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id as any)}
                aria-current={activeTab === id ? 'page' : undefined}
                className={`relative flex items-center gap-2 h-10 px-3.5 rounded-lg text-[13px] font-bold cursor-pointer transition-colors ${
                  activeTab === id
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <Icon size={16} />
                <span>{label}</span>
                {!!badge && badge > 0 && (
                  <span className="ml-0.5 bg-rose-500 text-white text-[12px] font-black min-w-4.5 h-4.5 px-1 rounded-full flex items-center justify-center">
                    {badge}
                  </span>
                )}
              </button>
            ))}
          </nav>

          {/* Actions compte */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <a
              href="/mcp"
              target="_blank"
              rel="noopener noreferrer"
              title="Utiliser LoveRose depuis ChatGPT ou Claude (guide)"
              aria-label="Utiliser LoveRose depuis ChatGPT ou Claude"
              className="hidden sm:flex items-center gap-1.5 h-9 px-3 rounded-lg border border-slate-300 text-slate-700 hover:border-slate-900 hover:text-slate-950 text-[13px] font-bold transition-colors cursor-pointer"
            >
              <Bot size={15} />
              <span className="hidden lg:inline">Chatbot IA</span>
            </a>

            {currentUser ? (
              <>
                {isAdmin && (
                  <button
                    onClick={() => setActiveTab('admin')}
                    title="Panel Admin"
                    aria-label="Ouvrir le panel admin"
                    className={`flex items-center justify-center w-9 h-9 rounded-lg transition-colors cursor-pointer ${
                      activeTab === 'admin'
                        ? 'bg-slate-900 text-white'
                        : 'border border-slate-300 text-slate-600 hover:border-slate-900 hover:text-slate-900'
                    }`}
                  >
                    <ShieldAlert size={16} />
                  </button>
                )}
                <button
                  onClick={() => setActiveTab('settings')}
                  title="Paramètres"
                  aria-label="Ouvrir les paramètres"
                  className={`hidden md:flex items-center justify-center w-9 h-9 rounded-lg transition-colors cursor-pointer ${
                    activeTab === 'settings'
                      ? 'bg-slate-900 text-white'
                      : 'border border-slate-300 text-slate-600 hover:border-slate-900 hover:text-slate-900'
                  }`}
                >
                  <Settings size={16} />
                </button>
                <button
                  onClick={() => setActiveTab('profile')}
                  className="flex items-center gap-2.5 pl-1 cursor-pointer group"
                  aria-label="Ouvrir mon profil"
                >
                  <span className="text-right hidden lg:block">
                    <span className="block text-[13px] font-bold text-slate-900 leading-tight group-hover:underline underline-offset-2">
                      {profile?.full_name || currentUser.email?.split("@")[0] || "Membre"}
                    </span>
                    <span className="block text-[11px] text-slate-500">Voir mon profil</span>
                  </span>
                  <img
                    src={profile?.avatar_url || `https://api.dicebear.com/7.x/adventurer/svg?seed=${profile?.full_name || currentUser.id}`}
                    alt=""
                    referrerPolicy="no-referrer"
                    className="w-9 h-9 rounded-full object-cover bg-slate-100 border border-slate-200 group-hover:border-slate-900 transition-colors"
                  />
                </button>
                <button
                  onClick={handleLogout}
                  className="hidden sm:flex items-center justify-center w-9 h-9 rounded-lg border border-slate-300 text-slate-500 hover:border-red-500 hover:text-red-600 transition-colors cursor-pointer"
                  title="Se déconnecter"
                  aria-label="Se déconnecter"
                >
                  <LogOut size={15} />
                </button>
              </>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => triggerAuthRequired(false)}
                  className="h-9 px-3 text-[13px] font-bold text-slate-700 hover:text-slate-950 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  Connexion
                </button>
                <button
                  onClick={() => triggerAuthRequired(true)}
                  className="h-9 px-4 bg-rose-500 hover:bg-rose-600 text-white text-[13px] font-bold rounded-lg transition-colors cursor-pointer"
                >
                  S'inscrire
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Workspace viewport */}
      <main className="flex-1 overflow-hidden flex flex-col bg-slate-50 relative min-h-0">
        
        {/* ============ BANDEAU CONTEXTUEL UNIQUE ============
            Auparavant trois bandeaux dégradés pouvaient s'empiler et
            repousser le contenu vers le bas. On n'en affiche plus qu'un
            seul à la fois, par ordre de priorité, en style sobre. */}
        {(() => {
          if (!currentUser) {
            return (
              <div className="bg-slate-900 text-white flex-shrink-0">
                <div className="max-w-6xl mx-auto px-4 sm:px-6 py-2.5 flex items-center justify-between gap-3">
                  <p className="text-[13px] font-medium text-slate-200 min-w-0 truncate">
                    <span className="font-bold text-white">Mode aperçu.</span>{" "}
                    <span className="hidden sm:inline">
                      Créez un compte gratuit pour liker, commenter et publier.
                    </span>
                  </p>
                  <button
                    onClick={() => triggerAuthRequired(true)}
                    className="flex-shrink-0 h-8 px-3.5 bg-white text-slate-900 hover:bg-rose-50 text-xs font-bold rounded-lg transition-colors cursor-pointer"
                  >
                    S'inscrire
                  </button>
                </div>
              </div>
            );
          }
          if (showInstallBanner) {
            return (
              <div className="bg-rose-50 border-b border-rose-200 flex-shrink-0">
                <div className="max-w-6xl mx-auto px-4 sm:px-6 py-2.5 flex items-center justify-between gap-3">
                  <p className="text-[13px] font-medium text-rose-900 min-w-0 truncate">
                    <span className="font-bold">Installez LoveRose</span>{" "}
                    <span className="hidden sm:inline">sur votre écran d'accueil.</span>
                  </p>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={handleInstallApp}
                      className="h-8 px-3.5 bg-rose-500 hover:bg-rose-600 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer"
                    >
                      Installer
                    </button>
                    <button
                      onClick={() => setShowInstallBanner(false)}
                      className="p-1.5 text-rose-400 hover:text-rose-700 rounded cursor-pointer transition"
                      aria-label="Masquer"
                    >
                      <X size={14} />
                    </button>
                  </div>
                </div>
              </div>
            );
          }
          if (showPushBanner) {
            return (
              <div className="bg-slate-100 border-b border-slate-200 flex-shrink-0">
                <div className="max-w-6xl mx-auto px-4 sm:px-6 py-2.5 flex items-center justify-between gap-3">
                  <p className="text-[13px] font-medium text-slate-700 min-w-0 truncate">
                    <span className="font-bold text-slate-900">Notifications</span>{" "}
                    <span className="hidden sm:inline">
                      — soyez prévenu même app fermée.
                    </span>
                  </p>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={handleEnablePush}
                      disabled={isEnablingPush}
                      className="h-8 px-3.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer disabled:opacity-60"
                    >
                      {isEnablingPush ? "…" : "Activer"}
                    </button>
                    <button
                      onClick={dismissPushBanner}
                      className="p-1.5 text-slate-400 hover:text-slate-900 rounded cursor-pointer transition"
                      aria-label="Masquer"
                    >
                      <X size={14} />
                    </button>
                  </div>
                </div>
              </div>
            );
          }
          return null;
        })()}

        {/* Core Application Tabs switcher */}
        <>
          <div className={activeTab === 'discover' ? 'flex flex-col flex-1 min-h-0' : 'hidden'}>
            <Feed
              currentUser={currentUser}
              currentUserProfile={profile}
              onAuthRequired={() => triggerAuthRequired(true)}
            />
          </div>
          <div className={activeTab === 'publier' ? 'flex flex-col flex-1 min-h-0' : 'hidden'}>
            <PublishListing
              currentUser={currentUser}
              currentUserProfile={profile}
              onAuthRequired={() => triggerAuthRequired(true)}
              onPublished={() => setActiveTab('discover')}
            />
          </div>
          <div className={activeTab === 'dashboard' ? 'flex flex-col flex-1 min-h-0' : 'hidden'}>
            <Dashboard
              currentUser={currentUser}
              currentUserProfile={profile}
              onAuthRequired={() => triggerAuthRequired(true)}
            />
          </div>
          <div className={activeTab === 'profile' ? 'flex flex-col flex-1 min-h-0' : 'hidden'}>
            <ProfileSettings
              currentUser={currentUser}
              profile={profile}
              onProfileUpdated={() => loadProfile(currentUser.id)}
              onGoToSettings={() => setActiveTab('settings')}
              onAuthRequired={() => triggerAuthRequired(true)}
            />
          </div>
          <div className={activeTab === 'settings' ? 'flex flex-col flex-1 min-h-0' : 'hidden'}>
            <SettingsView
              currentUser={currentUser}
              profile={profile}
              onBackToProfile={() => setActiveTab('profile')}
              onLogout={handleLogout}
              onProfileUpdated={() => loadProfile(currentUser.id)}
              onAuthRequired={() => triggerAuthRequired(true)}
            />
          </div>
          <div className={activeTab === 'notifications' ? 'flex flex-col flex-1 min-h-0' : 'hidden'}>
            <NotificationsView
              currentUser={currentUser}
              onNavigateToTab={(tab) => setActiveTab(tab)}
              onLikeBack={handleLikeBack}
              onAuthRequired={() => triggerAuthRequired(true)}
            />
          </div>
          <div className={activeTab === 'likes' ? 'flex flex-col flex-1 min-h-0 overflow-y-auto' : 'hidden'}>
            <WhoLikedMe
              currentUser={currentUser}
              currentUserProfile={profile}
              onLikeBack={handleLikeBack}
              onAuthRequired={() => triggerAuthRequired(true)}
            />
          </div>
          {isAdmin && activeTab === 'admin' && (
            <div className="flex flex-col flex-1 min-h-0">
              <ErrorBoundary>
                <AdminPanel currentUser={currentUser} />
              </ErrorBoundary>
            </div>
          )}
        </>
      </main>

      {/* ============ NAVIGATION MOBILE ============
          "Publier" est sorti de la rangée pour devenir une action centrale
          proéminente : c'est le geste qui fait vivre le fil d'annonces. */}
      <nav
        aria-label="Navigation principale"
        className="bg-white border-t border-slate-200 sticky bottom-0 z-30 md:hidden flex-shrink-0"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="grid grid-cols-5 items-end px-1 pt-1.5 pb-1">
          {[
            { id: 'discover', label: 'Annonces', Icon: Newspaper },
            { id: 'dashboard', label: 'Activité', Icon: LayoutDashboard },
            null, // emplacement du bouton central
            { id: 'notifications', label: 'Notifs', Icon: Bell, badge: unreadNotificationsCount },
            { id: 'profile', label: 'Profil', Icon: User },
          ].map((item, i) => {
            if (!item) {
              return (
                <div key="publish" className="flex justify-center">
                  <button
                    onClick={() => setActiveTab('publier')}
                    aria-label="Publier une annonce"
                    aria-current={activeTab === 'publier' ? 'page' : undefined}
                    className={`-mt-5 w-14 h-14 rounded-full flex items-center justify-center border-4 border-white cursor-pointer transition-colors ${
                      activeTab === 'publier'
                        ? 'bg-slate-900 text-white'
                        : 'bg-rose-500 text-white hover:bg-rose-600'
                    }`}
                  >
                    <PlusCircle size={24} strokeWidth={2.2} />
                  </button>
                </div>
              );
            }
            const { id, label, Icon, badge } = item as any;
            const isActive = activeTab === id;
            return (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                aria-current={isActive ? 'page' : undefined}
                className={`relative flex flex-col items-center justify-center gap-1 min-h-11 py-1.5 rounded-lg cursor-pointer transition-colors ${
                  isActive ? 'text-rose-600' : 'text-slate-400 hover:text-slate-700'
                }`}
              >
                <Icon size={21} strokeWidth={isActive ? 2.3 : 1.9} />
                <span className={`text-[11px] leading-none ${isActive ? 'font-extrabold' : 'font-semibold'}`}>
                  {label}
                </span>
                {!!badge && badge > 0 && (
                  <span className="absolute top-0 right-1/2 translate-x-4 bg-rose-500 text-white text-[11px] font-black min-w-4 h-4 px-1 rounded-full flex items-center justify-center border-2 border-white">
                    {badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </nav>

      {/* Floating Push Toast Banner Overlay */}
      {toastNotification && (
        <div className="fixed top-4 left-4 right-4 z-[9999] bg-slate-950 text-white p-3.5 rounded-xl shadow-xl border border-slate-800 flex items-center gap-3 md:max-w-md md:mx-auto animate-rise">
          <div className="w-10 h-10 rounded-full overflow-hidden bg-rose-500/10 flex-shrink-0 border border-white/10">
            <img
              src={toastNotification.icon || "https://api.dicebear.com/7.x/initials/svg?seed=LoveRose"}
              alt="Notification sender"
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
            />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-[13px] font-bold text-rose-400 truncate">{toastNotification.title}</h4>
            <p className="text-[13px] text-slate-300 mt-0.5 font-medium leading-snug u-line-clamp-2">{toastNotification.body}</p>
          </div>
          <button
            onClick={() => setToastNotification(null)}
            className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-white/5 transition cursor-pointer"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Admin announcement preview — separate from the push toast above;
          purely visual, reads the same notifications rows the Notifs tab
          already shows and never marks anything as read itself. */}
      {currentUser && (
        <AdminAnnouncementToast
          currentUser={currentUser}
          onOpenNotifications={() => setActiveTab('notifications')}
        />
      )}

      {/* Sparkling Romantic Mutual Match Popup Modal Overlay */}
      {matchedPartner && (
        <div className="fixed inset-0 bg-slate-950/92 backdrop-blur-sm flex flex-col justify-center items-center p-4 z-50 animate-fade-in font-sans">
          <div className="max-w-md w-full text-center space-y-8 p-6">
            
            <div className="space-y-2">
              <div className="inline-block bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full flex items-center gap-1.5 mx-auto w-max">
                <Sparkles size={12} className="fill-rose-400" />
                <span>C'est un Match réciproque !</span>
              </div>
              <h1 className="text-3xl md:text-4xl font-black text-white tracking-tight">Félicitations ! 🎉</h1>
              <p className="text-slate-300 text-xs md:text-sm px-6">
                Vous plaisez tous les deux à l'autre. Brisez la glace dès maintenant !
              </p>
            </div>

            {/* Intersecting Avatars layout */}
            <div className="flex justify-center items-center -space-x-8 py-4 relative">
              {/* Pulsing hearts */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10 bg-rose-500 text-white rounded-full p-4 border-4 border-slate-900 shadow-xl shadow-rose-500/35">
                <Heart size={24} fill="currentColor" className="animate-pulse" />
              </div>
              
              <img
                src={profile?.avatar_url || `https://api.dicebear.com/7.x/adventurer/svg?seed=${profile?.full_name}`}
                alt="Moi"
                referrerPolicy="no-referrer"
                className="w-28 h-28 md:w-32 md:h-32 rounded-full object-cover border-4 border-slate-900 bg-slate-800 shadow-xl"
              />
              <img
                src={matchedPartner.avatar_url || `https://api.dicebear.com/7.x/adventurer/svg?seed=${matchedPartner.full_name}`}
                alt="L'autre"
                referrerPolicy="no-referrer"
                className="w-28 h-28 md:w-32 md:h-32 rounded-full object-cover border-4 border-slate-900 bg-slate-800 shadow-xl"
              />
            </div>

            <div className="space-y-3 pt-4">
              <button
                onClick={() => setMatchedPartner(null)}
                className="w-full py-4 bg-rose-500 hover:bg-rose-600 active:bg-rose-700 text-white font-black text-sm rounded-2xl shadow-lg shadow-rose-500/25 transition cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Heart size={16} fill="currentColor" />
                <span>Super !</span>
              </button>
              <button
                onClick={() => setMatchedPartner(null)}
                className="w-full py-3 bg-white/10 hover:bg-white/15 text-white/90 font-bold text-xs rounded-2xl transition cursor-pointer"
              >
                Continuer à explorer d'autres profils
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
