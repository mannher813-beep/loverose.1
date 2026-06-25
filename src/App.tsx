import { useState, useEffect } from "react";
import { supabase, isSupabaseConfigured } from "./lib/supabase";
import { Profile } from "./types";
import { Heart, MessageSquare, Newspaper, ShoppingBag, Settings, Coins, Sparkles, CheckCircle2, User, LogOut, Loader2, ArrowRight } from "lucide-react";

// Component imports
import SupabaseSetupBanner from "./components/SupabaseSetupBanner";
import PaymentSandbox from "./components/PaymentSandbox";
import PaymentSuccess from "./components/PaymentSuccess";
import Auth from "./components/Auth";
import Discover from "./components/Discover";
import Chat from "./components/Chat";
import Feed from "./components/Feed";
import Shop from "./components/Shop";
import ProfileSettings from "./components/ProfileSettings";

export default function App() {
  // Simple Path Routing
  const [currentPath, setCurrentPath] = useState(window.location.pathname);
  const [currentSearch, setCurrentSearch] = useState(window.location.search);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'discover' | 'chat' | 'feed' | 'shop' | 'profile'>('discover');
  
  // Match alerts overlay
  const [matchedPartner, setMatchedPartner] = useState<Profile | null>(null);

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
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("uid", uid)
        .single();

      if (error) {
        // Row might not exist, we will create one upon onboarding or update it
        console.warn("Profile record not found, will onboard upon first edits.");
        setProfile({ uid, relationship_intents: [] });
      } else {
        setProfile(data);
      }
    } catch (err) {
      console.error("Profile fetch error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    if (confirm("Voulez-vous vous déconnecter de LoveRose ?")) {
      await supabase.auth.signOut();
    }
  };

  // --- RENDERING PATH ROUTING FALLBACKS ---

  // Render Supabase Setup Guide if credentials aren't loaded yet
  if (!isSupabaseConfigured) {
    return <SupabaseSetupBanner />;
  }

  const urlParams = new URLSearchParams(currentSearch);
  const isPaymentSuccess = currentPath === "/payment-success" || urlParams.get("payment") === "success";
  const isPaymentCancel = currentPath === "/payment-cancel" || urlParams.get("payment") === "cancel";

  // Render Money Fusion Sandbox checkout simulator
  if (currentPath === "/payment-sandbox") {
    return <PaymentSandbox />;
  }

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
    return <Auth onSuccess={() => setIsLoading(true)} />;
  }

  // If logged in, check if user profile lacks mandatory relationship intentions.
  // Force user to select at least one intent before swiping/matching.
  const isProfileIncomplete = !profile || !profile.relationship_intents || profile.relationship_intents.length === 0;

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col h-screen overflow-hidden font-sans text-slate-800">
      
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
            onClick={() => { if (!isProfileIncomplete) setActiveTab('discover'); }}
            className={`flex items-center gap-1.5 transition cursor-pointer hover:text-rose-500 ${activeTab === 'discover' ? 'text-rose-500 font-extrabold' : ''}`}
          >
            <Heart size={16} />
            <span>Découvrir</span>
          </button>
          <button
            onClick={() => { if (!isProfileIncomplete) setActiveTab('chat'); }}
            className={`flex items-center gap-1.5 transition cursor-pointer hover:text-rose-500 ${activeTab === 'chat' ? 'text-rose-500 font-extrabold' : ''}`}
          >
            <MessageSquare size={16} />
            <span>Messagerie</span>
          </button>
          <button
            onClick={() => { if (!isProfileIncomplete) setActiveTab('feed'); }}
            className={`flex items-center gap-1.5 transition cursor-pointer hover:text-rose-500 ${activeTab === 'feed' ? 'text-rose-500 font-extrabold' : ''}`}
          >
            <Newspaper size={16} />
            <span>Actualités</span>
          </button>
          <button
            onClick={() => { if (!isProfileIncomplete) setActiveTab('shop'); }}
            className={`flex items-center gap-1.5 transition cursor-pointer hover:text-rose-500 ${activeTab === 'shop' ? 'text-rose-500 font-extrabold' : ''}`}
          >
            <ShoppingBag size={16} />
            <span>Boutique</span>
          </button>
          <button
            onClick={() => setActiveTab('profile')}
            className={`flex items-center gap-1.5 transition cursor-pointer hover:text-rose-500 ${activeTab === 'profile' ? 'text-rose-500 font-extrabold' : ''}`}
          >
            <Settings size={16} />
            <span>Mon Profil</span>
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
        
        {isProfileIncomplete ? (
          // Force Onboarding Flow for Completing intents
          <div className="flex-1 flex items-center justify-center p-4">
            <div className="max-w-md w-full bg-white rounded-3xl p-6 md:p-8 shadow-lg border border-slate-150 space-y-6">
              <div className="text-center space-y-2">
                <div className="mx-auto w-12 h-12 bg-rose-50 rounded-full flex items-center justify-center text-rose-500">
                  <Sparkles size={24} className="animate-bounce" />
                </div>
                <h2 className="text-lg font-black text-slate-900 tracking-tight">Onboarding LoveRose Obligatoire</h2>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Veuillez spécifier vos <strong>intentions de rencontres recherchées</strong> dans vos paramètres pour pouvoir accéder à la découverte de profils de notre algorithme.
                </p>
              </div>

              <div className="bg-rose-50/50 border border-rose-100 p-4 rounded-xl text-xs text-slate-600 leading-relaxed">
                Le champ <strong>relationship_intents</strong> alimente l'affichage de compatibilité et permet de filtrer la liste de rencontres.
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
                onMatchDetected={(partner) => setMatchedPartner(partner)}
              />
            )}
            {activeTab === 'chat' && (
              <Chat
                currentUser={currentUser}
                currentUserProfile={profile}
                onOpenShop={() => setActiveTab('shop')}
              />
            )}
            {activeTab === 'feed' && (
              <Feed
                currentUser={currentUser}
                currentUserProfile={profile}
              />
            )}
            {activeTab === 'shop' && (
              <Shop
                currentUser={currentUser}
                currentUserProfile={profile}
              />
            )}
            {activeTab === 'profile' && (
              <ProfileSettings
                currentUser={currentUser}
                profile={profile}
                onProfileUpdated={() => loadProfile(currentUser.id)}
              />
            )}
          </>
        )}
      </main>

      {/* Mobile Tab Navbar */}
      <footer className="bg-white border-t border-slate-200 py-2.5 px-4 flex justify-around items-center sticky bottom-0 z-30 md:hidden flex-shrink-0">
        <button
          onClick={() => { if (!isProfileIncomplete) setActiveTab('discover'); }}
          className={`flex flex-col items-center gap-1 cursor-pointer ${activeTab === 'discover' ? 'text-rose-500 font-bold' : 'text-slate-400'}`}
        >
          <Heart size={18} fill={activeTab === 'discover' ? 'currentColor' : 'none'} />
          <span className="text-[10px]">Découvrir</span>
        </button>
        <button
          onClick={() => { if (!isProfileIncomplete) setActiveTab('chat'); }}
          className={`flex flex-col items-center gap-1 cursor-pointer ${activeTab === 'chat' ? 'text-rose-500 font-bold' : 'text-slate-400'}`}
        >
          <MessageSquare size={18} fill={activeTab === 'chat' ? 'currentColor' : 'none'} />
          <span className="text-[10px]">Messagerie</span>
        </button>
        <button
          onClick={() => { if (!isProfileIncomplete) setActiveTab('feed'); }}
          className={`flex flex-col items-center gap-1 cursor-pointer ${activeTab === 'feed' ? 'text-rose-500 font-bold' : 'text-slate-400'}`}
        >
          <Newspaper size={18} />
          <span className="text-[10px]">Actualités</span>
        </button>
        <button
          onClick={() => { if (!isProfileIncomplete) setActiveTab('shop'); }}
          className={`flex flex-col items-center gap-1 cursor-pointer ${activeTab === 'shop' ? 'text-rose-500 font-bold' : 'text-slate-400'}`}
        >
          <ShoppingBag size={18} />
          <span className="text-[10px]">Boutique</span>
        </button>
        <button
          onClick={() => setActiveTab('profile')}
          className={`flex flex-col items-center gap-1 cursor-pointer ${activeTab === 'profile' ? 'text-rose-500 font-bold' : 'text-slate-400'}`}
        >
          <Settings size={18} />
          <span className="text-[10px]">Profil</span>
        </button>
      </footer>

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
    </div>
  );
}
