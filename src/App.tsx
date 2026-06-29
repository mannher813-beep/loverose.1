import { useState, useEffect } from "react";
import { supabase, isSupabaseConfigured } from "./lib/supabase";
import { Profile } from "./types";
import { Heart, MessageSquare, Newspaper, ShoppingBag, Settings, Coins, Sparkles, CheckCircle2, User, LogOut, Loader2, ArrowRight, X, Bell } from "lucide-react";

// Component imports
import SupabaseSetupBanner from "./components/SupabaseSetupBanner";
import PaymentSuccess from "./components/PaymentSuccess";
import Auth from "./components/Auth";
import Discover from "./components/Discover";
import Chat from "./components/Chat";
import Feed from "./components/Feed";
import Shop from "./components/Shop";
import ProfileSettings from "./components/ProfileSettings";
import SettingsView from "./components/Settings";
import NotificationsView from "./components/Notifications";
import Onboarding from "./components/Onboarding";
import PublicProfile from "./components/PublicProfile";
import Creators from "./components/Creators";
import PublicLayout from "./components/public/PublicLayout";
import PublicCreatorPage from "./components/PublicCreatorPage";
import { usePremiumStatus } from "./hooks/usePremiumStatus";

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
  const [showConversionPopup, setShowConversionPopup] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'discover' | 'chat' | 'feed' | 'shop' | 'profile' | 'settings' | 'notifications' | 'creators'>('discover');
  const [targetChatPartnerId, setTargetChatPartnerId] = useState<string | null>(null);
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState<number>(0);
  
  // Match alerts overlay
  const [matchedPartner, setMatchedPartner] = useState<Profile | null>(null);

  // Push notifications overlay state
  const [toastNotification, setToastNotification] = useState<{ title: string; body: string; icon?: string } | null>(null);

  // PWA installation states
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallBanner, setShowInstallBanner] = useState<boolean>(false);

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

  const handleInstallApp = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`User response to install prompt: ${outcome}`);
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

    // 1. Initial location sync if permission is granted
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          try {
            await supabase.rpc('update_my_location', {
              lat: pos.coords.latitude,
              lng: pos.coords.longitude,
            });
          } catch (e) {
            console.warn("Failed to update location in Supabase:", e);
          }
        },
        (err) => {
          console.log("Geolocation permission not active or rejected:", err);
        }
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

  const isPublicCreatorPageView = currentPath.startsWith("/page/");
  const creatorSlug = currentPath.replace("/page/", "").split("?")[0].trim();

  // Render Public Creator Page without requiring user to be logged in
  if (isPublicCreatorPageView && creatorSlug) {
    return (
      <PublicCreatorPage 
        slug={creatorSlug} 
        currentUser={currentUser} 
        currentUserProfile={profile} 
        onGoHome={() => {
          setCurrentPath("/");
          setCurrentSearch("");
          window.history.pushState(null, "", "/");
        }} 
        onShowAuth={(signUp) => {
          setCurrentPath(signUp ? "/inscription" : "/connexion");
          window.history.pushState(null, "", signUp ? "/inscription" : "/connexion");
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

  // Render Auth flow if no logged user
  if (!currentUser) {
    const publicPaths = ["/", "/accueil", "/a-propos", "/faq", "/contact", "/conditions-d-utilisation", "/politique-de-confidentialite"];
    if (publicPaths.includes(currentPath)) {
      return (
        <PublicLayout 
          currentPath={currentPath} 
          onNavigate={(path) => {
            setCurrentPath(path);
            window.history.pushState(null, "", path);
          }} 
          onShowAuth={(signUp) => {
            setCurrentPath(signUp ? "/inscription" : "/connexion");
            window.history.pushState(null, "", signUp ? "/inscription" : "/connexion");
          }} 
        />
      );
    }

    // For any other path, or specific auth paths (/connexion or /inscription), render Auth
    return (
      <div className="min-h-screen flex flex-col bg-slate-50 font-sans">
        <header className="bg-white border-b border-slate-100 px-6 py-4 flex items-center justify-between">
          <div 
            onClick={() => {
              setCurrentPath("/");
              window.history.pushState(null, "", "/");
            }}
            className="flex items-center space-x-2 cursor-pointer group"
          >
            <div className="bg-rose-500 p-2 rounded-xl text-white group-hover:scale-105 transition-all">
              <Heart size={20} fill="currentColor" />
            </div>
            <div>
              <span className="font-black text-xl tracking-tight text-slate-900">Love</span>
              <span className="font-black text-xl tracking-tight text-rose-500">Rose</span>
            </div>
          </div>
          <button 
            onClick={() => {
              setCurrentPath("/");
              window.history.pushState(null, "", "/");
            }}
            className="text-xs font-bold text-slate-500 hover:text-rose-500 transition cursor-pointer"
          >
            Retour à l'accueil
          </button>
        </header>
        <main className="flex-1 flex items-center justify-center py-10 px-4 bg-slate-50">
          <Auth 
            onSuccess={() => setIsLoading(true)} 
            initialIsSignUp={currentPath === "/inscription"} 
          />
        </main>
      </div>
    );
  }

  // Check if profile is incomplete
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

  const getRemainingDays = () => {
    if (!subscription || !subscription.end_date) return 0;
    const diff = new Date(subscription.end_date).getTime() - new Date().getTime();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col h-screen h-[100dvh] overflow-hidden font-sans text-slate-800 pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)]">
      
      {/* Desktop Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between sticky top-0 z-30 flex-shrink-0">
        <div className="flex items-center space-x-2">
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
            onClick={() => setActiveTab('feed')}
            className={`flex items-center gap-1.5 transition cursor-pointer hover:text-rose-500 ${activeTab === 'feed' ? 'text-rose-500 font-extrabold' : ''}`}
          >
            <Newspaper size={16} />
            <span>Actualités</span>
          </button>
          <button
            onClick={() => setActiveTab('shop')}
            className={`flex items-center gap-1.5 transition cursor-pointer hover:text-rose-500 ${activeTab === 'shop' ? 'text-rose-500 font-extrabold' : ''}`}
          >
            <ShoppingBag size={16} />
            <span>Boutique</span>
          </button>
          <button
            onClick={() => setActiveTab('creators')}
            className={`flex items-center gap-1.5 transition cursor-pointer hover:text-rose-500 ${activeTab === 'creators' ? 'text-rose-500 font-extrabold' : ''}`}
          >
            <Sparkles size={16} className="text-amber-500 fill-amber-400" />
            <span>Créateurs</span>
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
        </div>

        {/* Quick User details */}
        <div className="flex items-center space-x-4">
          <div className="text-right hidden sm:block">
            <p className="text-xs font-bold text-slate-800">{profile?.full_name || currentUser.email.split("@")[0]}</p>
            <p className="text-[10px] text-slate-400 font-medium">Bénéficiaire</p>
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
        </div>
      </header>

      {/* Main Content Workspace viewport */}
      <main className="flex-1 overflow-hidden flex flex-col bg-slate-50 relative min-h-0">
        
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

        {false ? (
          // Force Onboarding Flow for Completing intents
          <div className="flex-1 flex items-center justify-center p-4">
            <div className="max-w-md w-full bg-white rounded-3xl p-6 md:p-8 shadow-lg border border-slate-150 space-y-6">
              <div className="text-center space-y-2">
                <div className="mx-auto w-12 h-12 bg-rose-50 rounded-full flex items-center justify-center text-rose-500">
                  <Sparkles size={24} className="animate-bounce" />
                </div>
                <h2 className="text-lg font-black text-slate-900 tracking-tight">Choix de vos intentions requis</h2>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Veuillez spécifier vos <strong>intentions de rencontres recherchées</strong> dans vos paramètres afin que nous puissions vous proposer des profils compatibles.
                </p>
              </div>

              <button
                onClick={() => setActiveTab('profile')}
                className="w-full py-3.5 bg-rose-500 hover:bg-rose-600 text-white font-extrabold text-xs uppercase tracking-wider rounded-xl shadow-md shadow-rose-500/10 flex items-center justify-center gap-1.5 transition cursor-pointer"
              >
                <span>Configurer mes intentions</span>
                <ArrowRight size={14} />
              </button>
            </div>
          </div>
        ) : (
          // Core Application Tabs switcher
          <>
            {activeTab === 'discover' && (
              <Discover
                currentUser={currentUser}
                currentUserProfile={profile}
                isPremium={isPremiumUser}
                onMatchDetected={(partner) => setMatchedPartner(partner)}
              />
            )}
            {activeTab === 'chat' && (
              <Chat
                currentUser={currentUser}
                currentUserProfile={profile}
                isPremium={isPremiumUser}
                onOpenShop={() => setActiveTab('shop')}
                targetChatPartnerId={targetChatPartnerId}
                onClearTargetChatPartner={() => setTargetChatPartnerId(null)}
              />
            )}
            {activeTab === 'feed' && (
              <Feed
                currentUser={currentUser}
                currentUserProfile={profile}
                isPremium={isPremiumUser}
                onStartChat={startChatWithUser}
              />
            )}
            {activeTab === 'shop' && (
              <Shop
                currentUser={currentUser}
                currentUserProfile={profile}
                isPremium={isPremiumUser}
              />
            )}
            {activeTab === 'profile' && (
              <ProfileSettings
                currentUser={currentUser}
                profile={profile}
                isPremium={isPremiumUser}
                onProfileUpdated={() => loadProfile(currentUser.id)}
                onGoToSettings={() => setActiveTab('settings')}
              />
            )}
            {activeTab === 'settings' && (
              <SettingsView
                currentUser={currentUser}
                profile={profile}
                isPremium={isPremiumUser}
                onBackToProfile={() => setActiveTab('profile')}
                onLogout={handleLogout}
                onProfileUpdated={() => loadProfile(currentUser.id)}
              />
            )}
            {activeTab === 'notifications' && (
              <NotificationsView
                currentUser={currentUser}
                onNavigateToTab={(tab) => setActiveTab(tab)}
                onStartChat={startChatWithUser}
              />
            )}
            {activeTab === 'creators' && (
              <Creators
                currentUser={currentUser}
                currentUserProfile={profile}
                onOpenShop={() => setActiveTab('shop')}
                onNavigateToTab={(tab) => setActiveTab(tab)}
              />
            )}
          </>
        )}
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
          onClick={() => setActiveTab('feed')}
          className={`flex flex-col items-center gap-1 cursor-pointer ${activeTab === 'feed' ? 'text-rose-500 font-bold' : 'text-slate-400'}`}
        >
          <Newspaper size={18} />
          <span className="text-[10px]">Actualités</span>
        </button>
        <button
          onClick={() => setActiveTab('shop')}
          className={`flex flex-col items-center gap-1 cursor-pointer ${activeTab === 'shop' ? 'text-rose-500 font-bold' : 'text-slate-400'}`}
        >
          <ShoppingBag size={18} />
          <span className="text-[10px]">Boutique</span>
        </button>
        <button
          onClick={() => setActiveTab('creators')}
          className={`flex flex-col items-center gap-1 cursor-pointer ${activeTab === 'creators' ? 'text-rose-500 font-bold' : 'text-slate-400'}`}
        >
          <Sparkles size={18} className={activeTab === 'creators' ? "text-amber-500 fill-amber-400 animate-pulse" : ""} />
          <span className="text-[10px]">Créateurs</span>
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
      </footer>

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
                onClick={() => { setMatchedPartner(null); setActiveTab('chat'); }}
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
