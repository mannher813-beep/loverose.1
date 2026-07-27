import { useState, useEffect } from "react";
import { supabase, isSupabaseConfigured } from "./lib/supabase";
import { Profile } from "./types";
import { Heart, MessageSquare, ShoppingBag, Settings, Sparkles, User, LogOut, ArrowRight, X, Bell, ShieldAlert } from "lucide-react";

// Component imports
import SupabaseSetupBanner from "./components/SupabaseSetupBanner";
import PaymentSuccess from "./components/PaymentSuccess";
import Auth from "./components/Auth";
import Discover from "./components/Discover";
import Chat from "./components/Chat";
import Shop from "./components/Shop";
import ProfileSettings from "./components/ProfileSettings";
import SettingsView from "./components/Settings";
import NotificationsView from "./components/Notifications";
import Onboarding from "./components/Onboarding";
import PublicProfile from "./components/PublicProfile";
import PublicLayout from "./components/public/PublicLayout";
import AdminPanel from "./components/AdminPanel";
import ErrorBoundary from "./components/ErrorBoundary";
import { usePremiumStatus } from "./hooks/usePremiumStatus";
import { isPushSupported, getNotificationPermission, subscribeToPushNotifications } from "./lib/push";

export default function App() {
  // Simple Path Routing
  const [currentPath, setCurrentPath] = useState(window.location.pathname);
  const [currentSearch, setCurrentSearch] = useState(window.location.search);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [subscription, setSubscription] = useState<any>(null);
  const [isPremium, setIsPremium] = useState<boolean>(false);
  const { entitlements } = usePremiumStatus(currentUser?.id);
  const isPremiumUser = isPremium || entitlements.premium;
  const isAdmin = profile?.role === 'admin';
  const [showConversionPopup, setShowConversionPopup] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'discover' | 'chat' | 'shop' | 'profile' | 'settings' | 'notifications' | 'admin'>('discover');
  const [targetChatPartnerId, setTargetChatPartnerId] = useState<string | null>(null);
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

  // Deep-link: clicking a push notification for a message opens ?chat=<uid> directly.
  useEffect(() => {
    if (!currentUser) return;
    const params = new URLSearchParams(window.location.search);
    const chatPartnerId = params.get("chat");
    if (chatPartnerId) {
      setTargetChatPartnerId(chatPartnerId);
      setActiveTab("chat");
      params.delete("chat");
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

    const dismissed = localStorage.getItem(`push_banner_dismissed_${currentUser.id}`);
    if (permission === "default" && !dismissed) {
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
      localStorage.setItem(`push_banner_dismissed_${currentUser.id}`, "1");
    }
    if (!result.success) {
      console.warn("Push subscription not enabled:", result.reason);
    }
  };

  const dismissPushBanner = () => {
    setShowPushBanner(false);
    if (currentUser) {
      localStorage.setItem(`push_banner_dismissed_${currentUser.id}`, "1");
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

    // 3. Realtime subscription to the user's subscription record
    const subChannelName = `user-subscriptions-${currentUser.id}-${Math.random().toString(36).substring(2, 11)}`;
    const subChannel = supabase
      .channel(subChannelName)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "subscriptions",
          filter: `user_id=eq.${currentUser.id}`
        },
        async () => {
          // Re-evaluate premium status
          loadProfile(currentUser.id);
        }
      )
      .subscribe();

    // 4. Realtime subscription to the user's profile changes (online status / updates)
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
      supabase.removeChannel(subChannel);
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
      // 1. Fetch subscription status from subscriptions table directly
      const { data: subData } = await supabase
        .from("subscriptions")
        .select("*")
        .eq("user_id", uid)
        .maybeSingle();

      setSubscription(subData);

      // Check premium status via official RPC
      const { data: isPremiumRpc } = await supabase.rpc('is_user_premium', { check_user_id: uid });
      const isCurrentlyPremium = !!isPremiumRpc;
      setIsPremium(isCurrentlyPremium);

      if (subData) {
        const now = new Date();
        const endDate = new Date(subData.end_date);

        // Pop-up de conversion à J-3 avant expiration
        if (isCurrentlyPremium && subData.status === 'trial') {
          const diffTime = endDate.getTime() - now.getTime();
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          // If 3 days or fewer remaining, and not yet seen in session
          if (diffDays <= 3 && !sessionStorage.getItem("conversion_popup_seen")) {
            setShowConversionPopup(true);
            sessionStorage.setItem("conversion_popup_seen", "true");
          }
        }
      }

      // 2. Fetch profile data
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

  const startChatWithUser = async (partnerId: string) => {
    try {
      // 1. Check if a match already exists between currentUser.id and partnerId
      const { data: existingMatches, error: matchError } = await supabase
        .from("matches")
        .select("*")
        .contains("users", [currentUser.id, partnerId]);

      if (!matchError && existingMatches && existingMatches.length > 0) {
        // Match already exists
      } else {
        // 2. No match exists, insert match directly
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

      // 3. Navigate to chat and pre-select partner
      setTargetChatPartnerId(partnerId);
      setActiveTab("chat");
    } catch (err) {
      console.error("Error starting chat with user:", err);
      // Fallback: navigate to chat tab anyway
      setTargetChatPartnerId(partnerId);
      setActiveTab("chat");
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

  // Check if logged in user profile is incomplete
  if (currentUser) {
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

  const getRemainingDays = () => {
    if (!subscription || !subscription.end_date) return 0;
    const diff = new Date(subscription.end_date).getTime() - new Date().getTime();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col h-screen h-[100dvh] overflow-hidden font-sans text-slate-800 pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)]">
      
      {/* Desktop Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between sticky top-0 z-30 flex-shrink-0">
        <div 
          onClick={() => setActiveTab('discover')}
          className="flex items-center space-x-2 cursor-pointer"
        >
          <div className="bg-rose-500 p-2 rounded-xl text-white">
            <Heart size={20} fill="currentColor" />
          </div>
          <div>
            <span className="font-black text-xl tracking-tight text-slate-900">Love</span>
            <span className="font-black text-xl tracking-tight text-rose-500">Rose</span>
          </div>
        </div>

        {/* Desktop Quick Nav Controls */}
        <div className="hidden md:flex items-center space-x-6 text-xs font-bold text-slate-600">
          <button
            onClick={() => setActiveTab('discover')}
            className={`flex items-center gap-1.5 transition cursor-pointer hover:text-rose-500 ${activeTab === 'discover' ? 'text-rose-500 font-extrabold' : ''}`}
          >
            <Heart size={16} />
            <span>Découvrir</span>
          </button>
          <button
            onClick={() => setActiveTab('chat')}
            className={`flex items-center gap-1.5 transition cursor-pointer hover:text-rose-500 ${activeTab === 'chat' ? 'text-rose-500 font-extrabold' : ''}`}
          >
            <MessageSquare size={16} />
            <span>Messagerie</span>
          </button>
          <button
            onClick={() => setActiveTab('shop')}
            className={`flex items-center gap-1.5 transition cursor-pointer hover:text-rose-500 ${activeTab === 'shop' ? 'text-rose-500 font-extrabold' : ''}`}
          >
            <ShoppingBag size={16} />
            <span>Boutique</span>
          </button>
          <button
            onClick={() => setActiveTab('notifications')}
            className={`flex items-center gap-1.5 transition cursor-pointer hover:text-rose-500 relative ${activeTab === 'notifications' ? 'text-rose-500 font-extrabold' : ''}`}
          >
            <Bell size={16} />
            <span>Notifications</span>
            {unreadNotificationsCount > 0 && (
              <span className="absolute -top-2.5 -right-3 bg-rose-500 text-white text-[8px] font-black h-4.5 w-4.5 rounded-full flex items-center justify-center animate-pulse border border-white">
                {unreadNotificationsCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('profile')}
            className={`flex items-center gap-1.5 transition cursor-pointer hover:text-rose-500 ${activeTab === 'profile' ? 'text-rose-500 font-extrabold' : ''}`}
          >
            <User size={16} />
            <span>Mon Profil</span>
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`flex items-center gap-1.5 transition cursor-pointer hover:text-rose-500 ${activeTab === 'settings' ? 'text-rose-500 font-extrabold' : ''}`}
          >
            <Settings size={16} />
            <span>Paramètres</span>
          </button>
          {profile?.role === 'admin' && (
            <button
              onClick={() => setActiveTab('admin')}
              className={`flex items-center gap-1.5 transition cursor-pointer hover:text-rose-500 ${activeTab === 'admin' ? 'text-rose-500 font-extrabold' : ''}`}
            >
              <ShieldAlert size={16} />
              <span>Admin</span>
            </button>
          )}
        </div>

        {/* Quick User details or Auth Buttons for Guest */}
        <div className="flex items-center space-x-3">
          {currentUser ? (
            <>
              <div className="text-right hidden sm:block">
                <p className="text-xs font-bold text-slate-800">{profile?.full_name || currentUser.email.split("@")[0]}</p>
                <p className="text-[10px] text-slate-400 font-medium">Membre LoveRose</p>
              </div>
              <img
                onClick={() => setActiveTab('profile')}
                src={profile?.avatar_url || `https://api.dicebear.com/7.x/adventurer/svg?seed=${profile?.full_name || currentUser.id}`}
                alt="Moi"
                referrerPolicy="no-referrer"
                className="w-10 h-10 rounded-full object-cover bg-slate-50 border border-slate-200 cursor-pointer hover:border-rose-500 transition"
              />
              <button
                onClick={handleLogout}
                className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-red-500 transition cursor-pointer"
                title="Se déconnecter"
              >
                <LogOut size={16} />
              </button>
            </>
          ) : (
            <div className="flex items-center space-x-2">
              <button
                onClick={() => triggerAuthRequired(false)}
                className="text-xs font-bold text-slate-700 hover:text-rose-500 transition px-3 py-1.5 cursor-pointer"
              >
                Se connecter
              </button>
              <button
                onClick={() => triggerAuthRequired(true)}
                className="bg-rose-500 hover:bg-rose-600 text-white text-xs font-black px-4 py-2 rounded-xl shadow-md transition cursor-pointer"
              >
                S'inscrire
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Main Content Workspace viewport */}
      <main className="flex-1 overflow-hidden flex flex-col bg-slate-50 relative min-h-0">
        
        {/* Guest Banner if not logged in */}
        {!currentUser && (
          <div className="bg-gradient-to-r from-rose-500 via-pink-500 to-rose-600 text-white px-4 py-2.5 flex items-center justify-between text-xs font-semibold shadow-inner relative flex-shrink-0">
            <div className="flex items-center gap-2">
              <Heart size={14} className="fill-white animate-pulse" />
              <span>👀 Mode aperçu : Vous découvrez LoveRose sans être inscrit. Inscrivez-vous gratuitement pour liker et discuter !</span>
            </div>
            <button
              onClick={() => triggerAuthRequired(true)}
              className="bg-white text-rose-600 px-3.5 py-1.5 rounded-full font-black text-[10px] tracking-wide uppercase transition hover:bg-rose-50 cursor-pointer shadow-sm ml-2 flex-shrink-0"
            >
              S'inscrire gratuitement
            </button>
          </div>
        )}

        {showInstallBanner && (
          <div className="bg-gradient-to-r from-rose-500 to-pink-500 text-white px-4 py-2.5 flex items-center justify-between text-xs font-semibold shadow-inner relative flex-shrink-0">
            <div className="flex items-center gap-2">
              <Heart size={14} className="fill-white animate-pulse" />
              <span>Installez LoveRose sur votre écran d'accueil pour une expérience 100% immersive !</span>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handleInstallApp}
                className="bg-white text-rose-600 px-3 py-1 rounded-full font-black text-[10px] tracking-wide uppercase transition hover:bg-rose-50 cursor-pointer shadow-sm"
              >
                Installer
              </button>
              <button
                onClick={() => setShowInstallBanner(false)}
                className="text-white/80 hover:text-white cursor-pointer"
              >
                <X size={14} />
              </button>
            </div>
          </div>
        )}

        {showPushBanner && (
          <div className="bg-gradient-to-r from-slate-800 to-slate-900 text-white px-4 py-2.5 flex items-center justify-between text-xs font-semibold shadow-inner relative flex-shrink-0">
            <div className="flex items-center gap-2">
              <MessageSquare size={14} className="text-rose-400" />
              <span>Activez les notifications pour ne rater aucun message ni aucun match, même app fermée !</span>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handleEnablePush}
                disabled={isEnablingPush}
                className="bg-rose-500 text-white px-3 py-1 rounded-full font-black text-[10px] tracking-wide uppercase transition hover:bg-rose-600 cursor-pointer shadow-sm disabled:opacity-60"
              >
                {isEnablingPush ? "..." : "Activer"}
              </button>
              <button
                onClick={dismissPushBanner}
                className="text-white/80 hover:text-white cursor-pointer"
              >
                <X size={14} />
              </button>
            </div>
          </div>
        )}

        {/* Core Application Tabs switcher */}
        <>
          <div className={activeTab === 'discover' ? 'flex flex-col flex-1 min-h-0' : 'hidden'}>
            <Discover
              currentUser={currentUser}
              currentUserProfile={profile}
              isPremium={isPremiumUser}
              onMatchDetected={(partner) => setMatchedPartner(partner)}
              onAuthRequired={() => triggerAuthRequired(true)}
            />
          </div>
          <div className={activeTab === 'chat' ? 'flex flex-col flex-1 min-h-0' : 'hidden'}>
            <Chat
              currentUser={currentUser}
              currentUserProfile={profile}
              isPremium={isPremiumUser}
              onOpenShop={() => setActiveTab('shop')}
              targetChatPartnerId={targetChatPartnerId}
              onClearTargetChatPartner={() => setTargetChatPartnerId(null)}
              onAuthRequired={() => triggerAuthRequired(true)}
            />
          </div>
          <div className={activeTab === 'shop' ? 'flex flex-col flex-1 min-h-0' : 'hidden'}>
            <Shop
              currentUser={currentUser}
              currentUserProfile={profile}
              isPremium={isPremiumUser}
              onAuthRequired={() => triggerAuthRequired(true)}
            />
          </div>
          <div className={activeTab === 'profile' ? 'flex flex-col flex-1 min-h-0' : 'hidden'}>
            <ProfileSettings
              currentUser={currentUser}
              profile={profile}
              isPremium={isPremiumUser}
              onProfileUpdated={() => loadProfile(currentUser.id)}
              onGoToSettings={() => setActiveTab('settings')}
              onAuthRequired={() => triggerAuthRequired(true)}
            />
          </div>
          <div className={activeTab === 'settings' ? 'flex flex-col flex-1 min-h-0' : 'hidden'}>
            <SettingsView
              currentUser={currentUser}
              profile={profile}
              isPremium={isPremiumUser}
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
              onStartChat={startChatWithUser}
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

      {/* Mobile Tab Navbar */}
      <footer className="bg-white border-t border-slate-200 py-2.5 px-4 flex justify-around items-center sticky bottom-0 z-30 md:hidden flex-shrink-0">
        <button
          onClick={() => setActiveTab('discover')}
          className={`flex flex-col items-center gap-1 cursor-pointer ${activeTab === 'discover' ? 'text-rose-500 font-bold' : 'text-slate-400'}`}
        >
          <Heart size={18} fill={activeTab === 'discover' ? 'currentColor' : 'none'} />
          <span className="text-[10px]">Découvrir</span>
        </button>
        <button
          onClick={() => setActiveTab('chat')}
          className={`flex flex-col items-center gap-1 cursor-pointer ${activeTab === 'chat' ? 'text-rose-500 font-bold' : 'text-slate-400'}`}
        >
          <MessageSquare size={18} fill={activeTab === 'chat' ? 'currentColor' : 'none'} />
          <span className="text-[10px]">Messagerie</span>
        </button>
        <button
          onClick={() => setActiveTab('shop')}
          className={`flex flex-col items-center gap-1 cursor-pointer ${activeTab === 'shop' ? 'text-rose-500 font-bold' : 'text-slate-400'}`}
        >
          <ShoppingBag size={18} />
          <span className="text-[10px]">Boutique</span>
        </button>
        <button
          onClick={() => setActiveTab('notifications')}
          className={`flex flex-col items-center gap-1 cursor-pointer relative ${activeTab === 'notifications' ? 'text-rose-500 font-bold' : 'text-slate-400'}`}
        >
          <Bell size={18} fill={activeTab === 'notifications' ? 'currentColor' : 'none'} />
          <span className="text-[10px]">Notifs</span>
          {unreadNotificationsCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 bg-rose-500 text-white text-[8px] font-black h-4.5 w-4.5 rounded-full flex items-center justify-center animate-pulse border border-white">
              {unreadNotificationsCount}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('profile')}
          className={`flex flex-col items-center gap-1 cursor-pointer ${activeTab === 'profile' ? 'text-rose-500 font-bold' : 'text-slate-400'}`}
        >
          <User size={18} />
          <span className="text-[10px]">Profil</span>
        </button>
        {profile?.role === 'admin' && (
          <button
            onClick={() => setActiveTab('admin')}
            className={`flex flex-col items-center gap-1 cursor-pointer ${activeTab === 'admin' ? 'text-rose-500 font-bold' : 'text-slate-400'}`}
          >
            <ShieldAlert size={18} />
            <span className="text-[10px]">Admin</span>
          </button>
        )}
      </footer>

      {/* Guest Auth Dialog Popup Modal */}
      {(showGuestAuthModal || currentPath === "/connexion" || currentPath === "/inscription") && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in font-sans">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => {
                setShowGuestAuthModal(false);
                if (currentPath === "/connexion" || currentPath === "/inscription") {
                  setCurrentPath("/");
                  window.history.pushState(null, "", "/");
                }
              }}
              className="absolute top-4 right-4 bg-slate-100 hover:bg-slate-200 text-slate-600 p-2 rounded-full transition cursor-pointer z-10"
              title="Fermer"
            >
              <X size={18} />
            </button>
            <Auth
              onSuccess={() => {
                setShowGuestAuthModal(false);
                setIsLoading(true);
                if (currentPath === "/connexion" || currentPath === "/inscription") {
                  setCurrentPath("/");
                  window.history.pushState(null, "", "/");
                }
              }}
            />
          </div>
        </div>
      )}

      {/* Floating Push Toast Banner Overlay */}
      {toastNotification && (
        <div className="fixed top-4 left-4 right-4 z-[9999] bg-slate-900/95 backdrop-blur-md text-white p-3.5 rounded-2xl shadow-2xl border border-white/15 flex items-center space-x-3 md:max-w-md md:mx-auto animate-bounce">
          <div className="w-10 h-10 rounded-full overflow-hidden bg-rose-500/10 flex-shrink-0 border border-white/10">
            <img
              src={toastNotification.icon || "https://api.dicebear.com/7.x/initials/svg?seed=LoveRose"}
              alt="Notification sender"
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
            />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-xs font-black text-rose-400 tracking-wide truncate">{toastNotification.title}</h4>
            <p className="text-[10px] text-slate-200 mt-0.5 font-medium leading-normal line-clamp-2">{toastNotification.body}</p>
          </div>
          <button
            onClick={() => setToastNotification(null)}
            className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-white/5 transition cursor-pointer"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Sparkling Romantic Mutual Match Popup Modal Overlay */}
      {matchedPartner && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex flex-col justify-center items-center p-4 z-50 animate-fade-in font-sans">
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
                onClick={() => { setTargetChatPartnerId(matchedPartner.uid); setMatchedPartner(null); setActiveTab('chat'); }}
                className="w-full py-4 bg-rose-500 hover:bg-rose-600 active:bg-rose-700 text-white font-black text-sm rounded-2xl shadow-lg shadow-rose-500/25 transition cursor-pointer flex items-center justify-center gap-1.5"
              >
                <MessageSquare size={16} />
                <span>Lui envoyer un message</span>
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

      {/* Pop-up de conversion à J-3 avant expiration */}
      {showConversionPopup && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex flex-col justify-center items-center p-4 z-50 animate-fade-in font-sans">
          <div className="max-w-sm w-full text-center space-y-5 p-8 bg-white rounded-3xl border border-slate-100 shadow-2xl relative">
            <button
              onClick={() => setShowConversionPopup(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X size={18} />
            </button>
            
            <div className="mx-auto bg-amber-50 w-14 h-14 rounded-full flex items-center justify-center text-amber-500">
              <Sparkles size={28} className="fill-amber-400 animate-pulse" />
            </div>

            <div className="space-y-2">
              <span className="text-[10px] bg-amber-100 text-amber-800 border border-amber-200 font-extrabold px-3 py-1 rounded-full uppercase tracking-wider inline-block">
                Essai Premium bientôt terminé ⏳
              </span>
              <h2 className="text-lg font-black text-slate-900 tracking-tight">
                Plus que {getRemainingDays()} jours d'essai gratuit !
              </h2>
              <p className="text-slate-500 text-[11px] leading-relaxed px-1">
                Ne perdez pas l'accès à vos fonctionnalités exclusives LoveRose Premium ! Discutez en illimité, swipez sans limite et découvrez qui a liké votre profil.
              </p>
            </div>

            <div className="space-y-2 pt-1">
              <button
                onClick={() => {
                  setShowConversionPopup(false);
                  setActiveTab('shop');
                }}
                className="w-full py-3 bg-rose-500 hover:bg-rose-600 text-white font-extrabold text-xs uppercase tracking-wider rounded-xl shadow-md shadow-rose-500/10 flex items-center justify-center gap-1.5 transition cursor-pointer"
              >
                <span>Passer au Premium Permanent</span>
                <ArrowRight size={14} />
              </button>
              <button
                onClick={() => setShowConversionPopup(false)}
                className="w-full py-2 text-slate-400 hover:text-slate-600 font-bold text-[10px] transition cursor-pointer"
              >
                Continuer l'essai pour l'instant
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
