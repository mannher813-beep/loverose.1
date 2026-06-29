import React, { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { Profile } from "../types";
import { 
  Heart, 
  CheckCircle, 
  Sparkles, 
  Share2, 
  Home, 
  Loader2, 
  Lock, 
  Unlock, 
  User, 
  MapPin, 
  Send, 
  Check, 
  AlertCircle 
} from "lucide-react";
import { motion } from "motion/react";

interface PublicCreatorPageProps {
  slug: string;
  currentUser: any;
  currentUserProfile: Profile | null;
  onGoHome: () => void;
  onShowAuth: (signUp: boolean) => void;
}

export default function PublicCreatorPage({ 
  slug, 
  currentUser, 
  currentUserProfile, 
  onGoHome,
  onShowAuth
}: PublicCreatorPageProps) {
  const [page, setPage] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [posts, setPosts] = useState<any[]>([]);
  const [isFollowing, setIsFollowing] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [unlockedPostIds, setUnlockedPostIds] = useState<Set<string>>(new Set());
  
  const [isActionLoading, setIsActionLoading] = useState<string | null>(null);
  const [tipAmount, setTipAmount] = useState<string>("500");
  const [tipMessage, setTipMessage] = useState<string>("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    // 1. Capture referral code if present on current URL and save to localStorage
    const urlParams = new URLSearchParams(window.location.search);
    const refCode = urlParams.get("ref");
    if (refCode) {
      localStorage.setItem("referral_code_used", refCode);
      console.log("[Referral Tracking] Saved referral code in localStorage:", refCode);
    }
  }, [slug]);

  useEffect(() => {
    async function loadCreatorPage() {
      setLoading(true);
      setError(null);
      try {
        // Fetch creator page by slug
        const { data: pageData, error: pageErr } = await supabase
          .from("creator_pages")
          .select("*")
          .eq("slug", slug)
          .eq("status", "active")
          .maybeSingle();

        if (pageErr) throw pageErr;

        if (!pageData) {
          setError("Cette page créateur n'existe pas ou n'est plus active.");
          setLoading(false);
          return;
        }

        setPage(pageData);

        // Fetch posts associated with this page
        const { data: postsData, error: postsErr } = await supabase
          .from("posts")
          .select("*")
          .eq("page_id", pageData.id)
          .order("created_at", { ascending: false });

        if (postsErr) throw postsErr;
        setPosts(postsData || []);

        // Fetch relationship states if user is logged in
        if (currentUser) {
          // Check following state
          let following = false;
          try {
            const { data: followData, error: followErr } = await supabase
              .from("page_followers")
              .select("id")
              .eq("page_id", pageData.id)
              .eq("user_id", currentUser.id)
              .maybeSingle();

            if (followErr) throw followErr;
            following = !!followData;
          } catch (followFetchErr) {
            console.warn("Could not load page_followers from database, using localStorage fallback:", followFetchErr);
            const localFollowed = JSON.parse(localStorage.getItem(`followed_pages_${currentUser.id}`) || "[]");
            following = localFollowed.includes(pageData.id);
          }
          setIsFollowing(following);

          // Check active subscription
          let subscribed = false;
          try {
            const { data: subData, error: subErr } = await supabase
              .from("page_subscriptions")
              .select("id")
              .eq("page_id", pageData.id)
              .eq("user_id", currentUser.id)
              .eq("status", "active")
              .gt("ends_at", new Date().toISOString())
              .maybeSingle();

            if (subErr) throw subErr;
            subscribed = !!subData;
          } catch (subFetchErr) {
            console.warn("Could not load page_subscriptions from database, using localStorage fallback:", subFetchErr);
            const localSubscribed = JSON.parse(localStorage.getItem(`subscribed_pages_${currentUser.id}`) || "[]");
            subscribed = localSubscribed.includes(pageData.id);
          }
          setIsSubscribed(subscribed);

          // Check individual premium unlocked posts
          let unlockedSet = new Set<string>();
          try {
            const { data: unlockData, error: unlockErr } = await supabase
              .from("post_unlocks")
              .select("post_id")
              .eq("user_id", currentUser.id);

            if (unlockErr) throw unlockErr;
            unlockedSet = new Set<string>((unlockData || []).map(u => u.post_id));
          } catch (unlockFetchErr) {
            console.warn("Could not load post_unlocks from database:", unlockFetchErr);
          }
          setUnlockedPostIds(unlockedSet);
        }
      } catch (err: any) {
        console.error("Error loading creator page content:", err);
        setError("Impossible de charger les données du créateur.");
      } finally {
        setLoading(false);
      }
    }

    if (slug) {
      loadCreatorPage();
    }
  }, [slug, currentUser]);

  const handleFollowToggle = async () => {
    if (!currentUser) {
      onShowAuth(false);
      return;
    }
    if (!page) return;

    setIsActionLoading("follow");
    try {
      if (isFollowing) {
        // Unfollow in DB if possible
        try {
          const { error } = await supabase
            .from("page_followers")
            .delete()
            .eq("page_id", page.id)
            .eq("user_id", currentUser.id);

          if (error) throw error;
        } catch (dbErr) {
          console.warn("Database unfollow failed, falling back to localStorage:", dbErr);
        }

        // Update local storage fallback
        const localFollowed = JSON.parse(localStorage.getItem(`followed_pages_${currentUser.id}`) || "[]");
        const updated = localFollowed.filter((id: string) => id !== page.id);
        localStorage.setItem(`followed_pages_${currentUser.id}`, JSON.stringify(updated));

        setIsFollowing(false);
      } else {
        // Follow in DB if possible
        try {
          const { error } = await supabase
            .from("page_followers")
            .insert([{ page_id: page.id, user_id: currentUser.id }]);

          if (error) throw error;
        } catch (dbErr) {
          console.warn("Database follow failed, falling back to localStorage:", dbErr);
        }

        // Update local storage fallback
        const localFollowed = JSON.parse(localStorage.getItem(`followed_pages_${currentUser.id}`) || "[]");
        if (!localFollowed.includes(page.id)) {
          localFollowed.push(page.id);
        }
        localStorage.setItem(`followed_pages_${currentUser.id}`, JSON.stringify(localFollowed));

        setIsFollowing(true);

        // Insert automatic notification in-app
        try {
          await supabase.from("notifications").insert([
            {
              user_id: page.owner_id,
              sender_id: currentUser.id,
              type: "page_follow",
              content: `${currentUserProfile?.full_name || "Un membre"} a commencé à suivre votre page créateur !`,
              lu: false
            }
          ]);
        } catch (notifErr) {
          console.warn("Could not insert follow notification:", notifErr);
        }
      }
    } catch (err: any) {
      console.error("Error toggling follow:", err);
      // Don't show alert to user if it's just a warning/fallback-handled case, but let's log it.
    } finally {
      setIsActionLoading(null);
    }
  };

  const handlePageSubscribe = async () => {
    if (!currentUser) {
      onShowAuth(false);
      return;
    }
    if (!page) return;

    setIsActionLoading("subscribe");
    try {
      const price = page.subscription_price || 2500;

      // Contact standard Express payments route for official FusionPay session
      const response = await fetch("/api/payments/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          userId: currentUser.id,
          planId: `page_subscription:${page.id}`,
          planName: `Abonnement page ${page.page_name}`,
          amount: price,
          email: currentUser.email,
          related_page_id: page.id
        })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.checkoutUrl) {
          localStorage.setItem("last_payment_reference", data.reference);
          window.location.href = data.checkoutUrl;
        } else {
          throw new Error("Impossible de générer le lien de paiement.");
        }
      } else {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || "La passerelle de paiement a renvoyé une erreur.");
      }
    } catch (err: any) {
      console.error("Error subscribing to page:", err);
      alert("Erreur de paiement : " + err.message);
    } finally {
      setIsActionLoading(null);
    }
  };

  const handleSendTip = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) {
      onShowAuth(false);
      return;
    }
    if (!page) return;

    const amount = parseInt(tipAmount);
    if (!amount || amount <= 0) {
      alert("Veuillez saisir un montant valide.");
      return;
    }

    setIsActionLoading("tip");
    try {
      // Create payments record with tip plan using the backend endpoint
      const response = await fetch("/api/payments/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          userId: currentUser.id,
          planId: `tip:${page.id}`,
          planName: `Pourboire pour ${page.page_name}`,
          amount: amount,
          email: currentUser.email,
          related_page_id: page.id
        })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.checkoutUrl) {
          localStorage.setItem("last_payment_reference", data.reference);
          window.location.href = data.checkoutUrl;
        } else {
          throw new Error("Lien de paiement indisponible.");
        }
      } else {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || "Échec d'initialisation du pourboire.");
      }
    } catch (err: any) {
      console.error("Error sending tip:", err);
      alert("Impossible d'envoyer le pourboire : " + err.message);
    } finally {
      setIsActionLoading(null);
    }
  };

  const handleUnlockPost = async (post: any) => {
    if (!currentUser) {
      onShowAuth(false);
      return;
    }
    if (!page) return;

    setIsActionLoading(`unlock_${post.id}`);
    try {
      const response = await fetch("/api/payments/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          userId: currentUser.id,
          planId: `premium_content_unlock:${post.id}`,
          planName: `Déblocage post de ${page.page_name}`,
          amount: post.unlock_price,
          email: currentUser.email,
          related_post_id: post.id
        })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.checkoutUrl) {
          localStorage.setItem("last_payment_reference", data.reference);
          window.location.href = data.checkoutUrl;
        } else {
          throw new Error("Échec d'obtention de la passerelle.");
        }
      } else {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || "Erreur lors de la validation du déblocage.");
      }
    } catch (err: any) {
      console.error("Error unlocking post:", err);
      alert("Impossible d'initier le déblocage : " + err.message);
    } finally {
      setIsActionLoading(null);
    }
  };

  const handleCopyLink = () => {
    const shareUrl = `${window.location.origin}/page/${slug}`;
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center font-sans">
        <div className="text-center space-y-3">
          <Loader2 className="animate-spin text-rose-500 mx-auto" size={32} />
          <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider">Chargement de la page créateur...</p>
        </div>
      </div>
    );
  }

  if (error || !page) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center p-4 font-sans">
        <div className="max-w-md w-full bg-white rounded-3xl p-8 shadow-xl border border-slate-100 text-center space-y-6">
          <div className="mx-auto bg-amber-50 w-20 h-20 rounded-full flex items-center justify-center text-amber-500">
            <AlertCircle size={44} />
          </div>
          <div className="space-y-2">
            <h1 className="text-xl font-black text-slate-900">Page créateur introuvable</h1>
            <p className="text-slate-500 text-xs leading-relaxed">{error || "Cette page n'existe pas ou n'est plus active."}</p>
          </div>
          <button
            onClick={onGoHome}
            className="w-full py-3 bg-rose-500 hover:bg-rose-600 text-white font-extrabold text-xs uppercase tracking-wider rounded-2xl transition cursor-pointer flex items-center justify-center gap-1.5 shadow-md shadow-rose-500/10"
          >
            <Home size={14} />
            <span>Aller à l'accueil public</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      {/* Header */}
      <header className="bg-white border-b border-slate-100 px-6 py-4 flex items-center justify-between sticky top-0 z-30 flex-shrink-0">
        <div 
          onClick={onGoHome}
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

        <div className="flex items-center gap-2">
          {currentUser ? (
            <button
              onClick={onGoHome}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-xs rounded-xl transition cursor-pointer flex items-center gap-1"
            >
              <Home size={14} />
              <span className="hidden sm:inline">Mon Espace Client</span>
            </button>
          ) : (
            <>
              <button
                onClick={() => onShowAuth(false)}
                className="px-4 py-2 text-slate-600 hover:text-slate-900 font-extrabold text-xs cursor-pointer"
              >
                Connexion
              </button>
              <button
                onClick={() => onShowAuth(true)}
                className="px-4 py-2 bg-rose-500 hover:bg-rose-600 text-white font-extrabold text-xs rounded-xl cursor-pointer"
              >
                Inscription
              </button>
            </>
          )}
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-4 md:py-8 space-y-6">
        
        {/* Banner Cover Block */}
        <div className="bg-white border border-slate-150 rounded-3xl overflow-hidden shadow-sm">
          <div className="h-44 md:h-56 relative bg-slate-100">
            <img 
              src={page.banner_url || "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1200&q=80"} 
              alt="" 
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
            <div className="absolute top-4 right-4 bg-slate-900/70 backdrop-blur-sm px-3.5 py-1.5 rounded-full text-[10px] font-black text-amber-300 border border-white/10 uppercase tracking-wider">
              Créateur Vérifié
            </div>
          </div>

          {/* Profile Info */}
          <div className="p-6 md:p-8 flex flex-col md:flex-row justify-between items-start md:items-end gap-6 relative -mt-10">
            <div className="flex flex-col md:flex-row gap-4 md:gap-5 items-start">
              <div className="w-20 h-20 md:w-24 md:h-24 rounded-3xl overflow-hidden border-4 border-white bg-white shadow-lg relative">
                <img 
                  src={page.avatar_url || `https://api.dicebear.com/7.x/initials/svg?seed=${page.page_name}`} 
                  alt="" 
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              </div>
              <div className="space-y-1 pt-10 md:pt-1 text-left">
                <h3 className="text-xl font-black text-slate-950 flex items-center gap-1.5">
                  <span>{page.page_name}</span>
                  <CheckCircle className="text-rose-500 fill-rose-500" size={18} />
                </h3>
                <p className="text-xs font-bold text-slate-400 flex items-center gap-1">
                  <MapPin size={12} />
                  <span>{page.category} • {page.location || "Afrique Francophone"}</span>
                </p>
                <p className="text-xs text-slate-500 font-medium leading-relaxed max-w-xl mt-3 whitespace-pre-wrap">{page.description}</p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-3 w-full md:w-auto border-t md:border-t-0 pt-4 md:pt-0">
              <button
                onClick={handleFollowToggle}
                disabled={isActionLoading === "follow"}
                className={`flex-1 md:flex-none px-4 py-3 border rounded-xl text-xs font-extrabold transition cursor-pointer flex items-center justify-center gap-1.5 ${
                  isFollowing 
                    ? 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100' 
                    : 'bg-white text-slate-950 border-slate-250 hover:bg-slate-50'
                }`}
              >
                <Heart size={14} className={isFollowing ? "fill-rose-500 text-rose-500" : ""} />
                <span>{isFollowing ? "Suivi" : "Suivre"}</span>
              </button>

              {!isSubscribed ? (
                <button
                  onClick={handlePageSubscribe}
                  disabled={isActionLoading === "subscribe"}
                  className="flex-1 md:flex-none px-5 py-3 bg-rose-500 hover:bg-rose-600 text-white font-extrabold text-xs rounded-xl shadow-md transition cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Lock size={12} />
                  <span>S'abonner ({page.subscription_price} F)</span>
                </button>
              ) : (
                <span className="bg-emerald-50 text-emerald-700 text-xs font-black px-4 py-3 rounded-xl border border-emerald-150 flex items-center gap-1.5">
                  <Check size={14} className="text-emerald-600" />
                  <span>Abonné Actif</span>
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Outer Split Layout */}
        <div className="grid md:grid-cols-3 gap-6">
          
          {/* Left Panel: Tip box & Referral share link */}
          <div className="space-y-6 text-left">
            
            {/* Direct Tip Block */}
            {page.tips_enabled && (
              <div className="bg-white border border-slate-150 rounded-3xl p-5 shadow-sm space-y-4">
                <div className="space-y-1">
                  <h4 className="font-extrabold text-slate-950 text-sm flex items-center gap-1.5">
                    <Sparkles className="text-amber-500 fill-amber-400" size={16} />
                    <span>💝 Envoyer un pourboire</span>
                  </h4>
                  <p className="text-[10px] text-slate-400 font-medium">Soutenez directement ce créateur avec un don sécurisé par Mobile Money.</p>
                </div>

                {/* Amount presets */}
                <div className="grid grid-cols-4 gap-1.5">
                  {["100", "500", "1000", "2000"].map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setTipAmount(amt)}
                      className={`py-2 text-[10px] font-black rounded-lg border transition cursor-pointer text-center ${
                        tipAmount === amt 
                          ? "bg-amber-50 text-amber-700 border-amber-300" 
                          : "bg-slate-50 text-slate-600 border-slate-150 hover:bg-slate-100"
                      }`}
                    >
                      {amt} F
                    </button>
                  ))}
                </div>

                {/* Custom numeric field */}
                <form onSubmit={handleSendTip} className="space-y-2">
                  <div className="relative">
                    <input 
                      type="number" 
                      placeholder="Montant libre (F)" 
                      value={tipAmount}
                      onChange={(e) => setTipAmount(e.target.value)}
                      min="100"
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:outline-none focus:border-amber-400"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-extrabold text-slate-400">FCFA</span>
                  </div>
                  
                  <button
                    type="submit"
                    disabled={isActionLoading === "tip"}
                    className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 text-white text-[10px] uppercase tracking-wider font-black rounded-xl shadow-xs transition flex items-center justify-center gap-1 cursor-pointer"
                  >
                    {isActionLoading === "tip" ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <>
                        <Send size={10} />
                        <span>Soutenir le créateur</span>
                      </>
                    )}
                  </button>
                </form>
              </div>
            )}

            {/* Referral / Share block */}
            <div className="bg-white border border-slate-150 rounded-3xl p-5 shadow-sm space-y-4">
              <div className="space-y-1">
                <h4 className="font-extrabold text-slate-950 text-sm flex items-center gap-1.5">
                  <Share2 className="text-rose-500" size={16} />
                  <span>📢 Partager & Parrainer</span>
                </h4>
                <p className="text-[10px] text-slate-400 font-medium">Invitez des amis via ce lien de parrainage et touchez <strong>10% de commission</strong> sur tous leurs futurs achats.</p>
              </div>

              <div className="bg-slate-50 border border-slate-200 p-2.5 rounded-xl flex items-center justify-between gap-2">
                <span className="text-[9px] font-mono text-slate-500 truncate select-all">
                  {`${window.location.origin}/page/${page.slug}?ref=${page.referral_code}`}
                </span>
                <button
                  onClick={handleCopyLink}
                  className="p-1.5 bg-white border border-slate-150 hover:bg-slate-50 text-slate-600 rounded-lg transition shrink-0 cursor-pointer"
                  title="Copier le lien"
                >
                  {copied ? <Check size={12} className="text-emerald-500" /> : <Share2 size={12} />}
                </button>
              </div>
            </div>

            {/* Non-authenticated alert notice if visitor not logged in */}
            {!currentUser && (
              <div className="bg-rose-50 border border-rose-100 rounded-3xl p-5 space-y-3">
                <h5 className="font-black text-rose-950 text-xs">Abonnement exclusif</h5>
                <p className="text-[10px] text-rose-700 leading-relaxed font-medium">
                  Connectez-vous ou créez un compte gratuit pour vous abonner à la page de {page.page_name}, débloquer ses publications privées et discuter en direct !
                </p>
                <button
                  onClick={() => onShowAuth(true)}
                  className="w-full py-2 bg-rose-500 hover:bg-rose-600 text-white text-[10px] font-black rounded-xl uppercase tracking-wider cursor-pointer transition shadow-sm"
                >
                  Rejoindre LoveRose
                </button>
              </div>
            )}
          </div>

          {/* Right/Center panel: Creator Posts */}
          <div className="md:col-span-2 space-y-6 text-left">
            <h3 className="text-md font-black text-slate-950 tracking-tight border-b border-slate-100 pb-3 flex items-center gap-2">
              <span>Publications</span>
              <span className="bg-slate-100 text-slate-600 text-[10px] font-bold px-2.5 py-0.5 rounded-full">
                {posts.length}
              </span>
            </h3>

            {posts.length === 0 ? (
              <div className="bg-white border border-slate-150 rounded-3xl p-10 text-center space-y-2 shadow-xs">
                <div className="mx-auto bg-slate-50 w-12 h-12 rounded-full flex items-center justify-center text-slate-400">
                  <User size={20} />
                </div>
                <h4 className="text-slate-800 font-black text-sm">Aucune publication</h4>
                <p className="text-slate-400 text-xs font-medium">Ce créateur n'a pas encore partagé de contenu.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {posts.map((post) => {
                  const isLocked = post.is_premium && !isSubscribed && !unlockedPostIds.has(post.id);
                  
                  return (
                    <div 
                      key={post.id} 
                      className="bg-white border border-slate-150 rounded-3xl overflow-hidden shadow-xs relative"
                    >
                      {/* Post Header */}
                      <div className="p-5 flex items-center space-x-3 border-b border-slate-50">
                        <img 
                          src={page.avatar_url || `https://api.dicebear.com/7.x/initials/svg?seed=${page.page_name}`} 
                          alt="" 
                          className="w-8 h-8 rounded-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                        <div>
                          <p className="font-extrabold text-slate-900">{page.page_name}</p>
                          <p className="text-[10px] text-slate-400 font-bold">{new Date(post.created_at).toLocaleDateString()}</p>
                        </div>
                      </div>

                      {/* Post Content */}
                      <div className="px-5 pb-5 space-y-4 pt-3">
                        {/* Premium indicator badge */}
                        {post.is_premium && (
                          <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-700 border border-amber-200 text-[9px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                            <Lock size={9} />
                            <span>Publication Premium</span>
                          </span>
                        )}

                        {isLocked ? (
                          <div className="space-y-4">
                            {/* Flurred/blurred text layout for locked content */}
                            <p className="text-slate-300 font-medium select-none blur-[4px]">
                              This is premium creator locked content. You must unlock this specific post or subscribe to view all media and texts.
                            </p>
                            
                            {/* Blur image block */}
                            {post.medias && post.medias.length > 0 && (
                              <div className="h-44 bg-slate-100 rounded-2xl relative overflow-hidden flex items-center justify-center border border-slate-200/50">
                                <img 
                                  src={post.medias[0]} 
                                  alt="" 
                                  className="w-full h-full object-cover blur-[12px] opacity-45"
                                  referrerPolicy="no-referrer"
                                />
                              </div>
                            )}

                            {/* Unlock CTA card */}
                            <div className="bg-amber-50/50 border border-amber-200/55 rounded-2xl p-5 text-center space-y-3.5 max-w-sm mx-auto">
                              <div className="mx-auto w-9 h-9 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center">
                                <Lock size={16} />
                              </div>
                              <div className="space-y-1">
                                <h5 className="font-black text-slate-900 text-xs">Cette publication est verrouillée</h5>
                                <p className="text-[10px] text-slate-400 font-medium leading-normal">Abonnez-vous à la page pour débloquer tout le contenu, ou déverrouillez ce post unique.</p>
                              </div>
                              
                              <div className="flex gap-2 justify-center">
                                <button
                                  onClick={() => handleUnlockPost(post)}
                                  disabled={isActionLoading === `unlock_${post.id}`}
                                  className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white font-extrabold text-[10px] rounded-lg transition shadow-xs cursor-pointer flex items-center gap-1"
                                >
                                  {isActionLoading === `unlock_${post.id}` ? (
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                  ) : (
                                    <>
                                      <Unlock size={11} />
                                      <span>Débloquer ({post.unlock_price} F)</span>
                                    </>
                                  )}
                                </button>
                                
                                <button
                                  onClick={handlePageSubscribe}
                                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-[10px] rounded-lg transition cursor-pointer"
                                >
                                  S'abonner ({page.subscription_price} F)
                                </button>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-4 text-left">
                            <p className="text-slate-700 font-medium text-xs whitespace-pre-wrap leading-normal">{post.contenu}</p>
                            {post.medias && post.medias.length > 0 && (
                              <div className="rounded-2xl overflow-hidden border border-slate-100">
                                <img 
                                  src={post.medias[0]} 
                                  alt="" 
                                  className="w-full object-cover max-h-[350px]"
                                  referrerPolicy="no-referrer"
                                />
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
