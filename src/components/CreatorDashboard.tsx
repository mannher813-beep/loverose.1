import React, { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { 
  Sparkles, 
  TrendingUp, 
  Coins, 
  Users, 
  Plus, 
  Trash2, 
  Eye, 
  CheckCircle, 
  FileText, 
  ArrowRight, 
  ArrowDownCircle, 
  HelpCircle, 
  Settings, 
  Lock, 
  Unlock, 
  Check, 
  Smartphone, 
  Loader2, 
  ChevronRight, 
  ShieldAlert, 
  Bell, 
  LogOut, 
  ArrowUpRight, 
  Key, 
  Clock,
  Briefcase
} from "lucide-react";
import AdSlot from "./AdSlot";

interface CreatorDashboardProps {
  currentUser: any;
  currentUserProfile: any;
  page: any;
  onBackToApp: () => void;
}

export default function CreatorDashboard({ currentUser, currentUserProfile, page, onBackToApp }: CreatorDashboardProps) {
  // Navigation tabs in Creator Independent Workspace
  // 'dashboard', 'stats', 'revenue', 'subscribers', 'posts', 'notifications', 'settings', 'help'
  const [activeTab, setActiveTab] = useState<'dashboard' | 'stats' | 'revenue' | 'subscribers' | 'posts' | 'notifications' | 'settings' | 'help'>('dashboard');
  
  // States
  const [wallet, setWallet] = useState<any | null>(null);
  const [recentEarnings, setRecentEarnings] = useState<any[]>([]);
  const [payouts, setPayouts] = useState<any[]>([]);
  const [followers, setFollowers] = useState<any[]>([]);
  const [followersCount, setFollowersCount] = useState<number>(0);
  const [posts, setPosts] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [verificationRequest, setVerificationRequest] = useState<any | null>(null);

  // Stats
  const [stats, setStats] = useState({
    viewsCount: 1420,
    tipsReceived: 4,
    monthlySubscribers: 12
  });

  // Payout Method Setup State
  const [isMethodSetup, setIsMethodSetup] = useState<boolean>(false);
  const [payoutMethod, setPayoutMethod] = useState<any | null>(null);
  const [operators, setOperators] = useState<any[]>([]);
  const [showPayoutSetup, setShowPayoutSetup] = useState<boolean>(false);
  
  // Payout Setup Form
  const [payoutForm, setPayoutForm] = useState({
    fullName: currentUserProfile?.full_name || "",
    phone: currentUserProfile?.phone_number || "",
    operatorId: "",
    countryIso: "CM",
    pinCode: ""
  });

  // Payout submission state
  const [showPayoutModal, setShowPayoutModal] = useState<boolean>(false);
  const [payoutAmount, setPayoutAmount] = useState<string>("");
  const [enteredPin, setEnteredPin] = useState<string>("");
  const [isSubmittingPayout, setIsSubmittingPayout] = useState<boolean>(false);

  // Post formulation state
  const [newPostContent, setNewPostContent] = useState("");
  const [newPostImage, setNewPostImage] = useState("");
  const [newPostIsPremium, setNewPostIsPremium] = useState(false);
  const [newPostUnlockPrice, setNewPostUnlockPrice] = useState("500");
  const [isPublishingPost, setIsPublishingPost] = useState(false);

  // Page Certification Request
  const [showCertifyModal, setShowCertifyModal] = useState<boolean>(false);
  const [certificationForm, setCertificationForm] = useState({
    fullName: currentUserProfile?.full_name || "",
    idNumber: "",
    city: currentUserProfile?.location || ""
  });
  const [isSubmittingCertify, setIsSubmittingCertify] = useState(false);

  // Loading indicator for tabs
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Load overall creator data on mount / tab change
  useEffect(() => {
    loadCreatorData();
  }, [page, activeTab]);

  const loadCreatorData = async () => {
    setIsLoading(true);
    try {
      await Promise.all([
        fetchWalletAndEarnings(),
        fetchPayoutMethod(),
        fetchFollowers(),
        fetchPosts(),
        fetchNotifications(),
        fetchVerificationStatus(),
        fetchOperators()
      ]);
    } catch (err) {
      console.warn("Error loading creator dashboard data:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchWalletAndEarnings = async () => {
    try {
      // Wallet
      const { data: walletData } = await supabase
        .from("creator_wallet")
        .select("*")
        .eq("page_id", page.id)
        .maybeSingle();
      
      setWallet(walletData || { balance: 0, total_earned: 0, pending_payout: 0, currency: "XOF" });

      // Earnings (exclude archived referral earnings from active balance)
      const { data: earningsData } = await supabase
        .from("creator_earnings")
        .select(`
          *,
          platform_commissions(commission_amt, creator_net, gross_amount)
        `)
        .eq("page_id", page.id)
        .eq("is_referral_archived", false)
        .order("created_at", { ascending: false });

      setRecentEarnings(earningsData || []);

      // Payouts
      const { data: payoutsData } = await supabase
        .from("payout_requests")
        .select("*")
        .eq("page_id", page.id)
        .order("created_at", { ascending: false });

      setPayouts(payoutsData || []);
    } catch (e) {
      console.warn("Failed fetching wallet details:", e);
    }
  };

  const fetchPayoutMethod = async () => {
    try {
      const { data, error } = await supabase
        .from("creator_payout_methods")
        .select("*")
        .eq("page_id", page.id)
        .maybeSingle();

      if (data) {
        setPayoutMethod(data);
        setIsMethodSetup(true);
      } else {
        setIsMethodSetup(false);
      }
    } catch (e) {
      console.warn("Payout method check error:", e);
    }
  };

  const fetchFollowers = async () => {
    try {
      const { data, count } = await supabase
        .from("page_followers")
        .select("id, user_id, created_at", { count: "exact" })
        .eq("page_id", page.id);

      setFollowersCount(count || 0);

      if (data && data.length > 0) {
        const uids = data.map(f => f.user_id);
        const { data: profiles } = await supabase
          .from("profiles")
          .select("*")
          .in("uid", uids);

        if (profiles) {
          const mapped = data.map(f => ({
            ...f,
            profile: profiles.find(p => p.uid === f.user_id) || { full_name: "Membre Anonyme" }
          }));
          setFollowers(mapped);
        }
      } else {
        setFollowers([]);
      }
    } catch (e) {
      console.warn("Followers fetch error:", e);
    }
  };

  const fetchPosts = async () => {
    try {
      const { data } = await supabase
        .from("posts")
        .select("*")
        .eq("page_id", page.id)
        .order("created_at", { ascending: false });

      setPosts(data || []);
    } catch (e) {
      console.warn("Posts fetch error:", e);
    }
  };

  const fetchNotifications = async () => {
    try {
      // Fetch user notifications filtered or direct notifications related to page activity
      const { data } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", currentUser.id)
        .order("created_at", { ascending: false })
        .limit(10);

      setNotifications(data || []);
    } catch (e) {
      console.warn("Page notifications error:", e);
    }
  };

  const fetchVerificationStatus = async () => {
    try {
      const { data } = await supabase
        .from("creator_verification_requests")
        .select("*")
        .eq("user_id", currentUser.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      setVerificationRequest(data);
    } catch (e) {
      console.warn("Verification check error:", e);
    }
  };

  const fetchOperators = async () => {
    try {
      const { data } = await supabase
        .from("mobile_money_operators")
        .select("*");
      
      setOperators(data || []);
      if (data && data.length > 0) {
        setPayoutForm(p => ({ ...p, operatorId: data[0].id }));
      }
    } catch (e) {
      console.warn("Mobile operators load failed:", e);
      // Fallback
      setOperators([
        { id: "orange_cm", name: "Orange Money", country_code: "CM" },
        { id: "mtn_cm", name: "MTN MoMo", country_code: "CM" },
        { id: "wave_ci", name: "Wave", country_code: "CI" },
        { id: "orange_ci", name: "Orange Money CI", country_code: "CI" }
      ]);
    }
  };

  // Submit Payout Method Setup
  const handlePayoutMethodSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payoutForm.fullName || !payoutForm.phone || !payoutForm.pinCode) {
      alert("Veuillez renseigner tous les champs obligatoires.");
      return;
    }

    if (payoutForm.pinCode.length < 4) {
      alert("Le code PIN doit comporter au moins 4 chiffres.");
      return;
    }

    setIsSubmittingPayout(true);
    try {
      const { error } = await supabase.rpc("set_payout_method", {
        target_page_id: page.id,
        operator: payoutForm.operatorId || "orange_cm",
        phone: payoutForm.phone,
        country_iso: payoutForm.countryIso,
        full_name_input: payoutForm.fullName,
        pin: payoutForm.pinCode
      });

      if (error) throw error;

      alert("🎉 Méthode de reversement configurée avec succès !");
      setShowPayoutSetup(false);
      fetchPayoutMethod();
    } catch (err: any) {
      console.error("Setup payout method error:", err);
      alert("Impossible de configurer la méthode de reversement : " + err.message);
    } finally {
      setIsSubmittingPayout(false);
    }
  };

  // Claim payout with PIN
  const handleRequestPayoutSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseInt(payoutAmount);
    if (!amount || amount < 1000) {
      alert("Le montant minimum de retrait est de 1 000 FCFA.");
      return;
    }

    if (!enteredPin) {
      alert("Veuillez saisir votre code PIN de sécurité.");
      return;
    }

    setIsSubmittingPayout(true);
    try {
      const { error } = await supabase.rpc("request_payout", {
        target_page_id: page.id,
        amount: amount,
        pin: enteredPin
      });

      if (error) throw error;

      alert(`🎉 Demande de retrait de ${amount} FCFA enregistrée ! Elle sera traitée sous 24h.`);
      setPayoutAmount("");
      setEnteredPin("");
      setShowPayoutModal(false);
      loadCreatorData();
    } catch (err: any) {
      console.error("Payout request error:", err);
      alert("Erreur lors de la demande de retrait : " + err.message);
    } finally {
      setIsSubmittingPayout(false);
    }
  };

  // Publish Creator Post
  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPostContent.trim()) return;

    setIsPublishingPost(true);
    try {
      const newPostPayload = {
        author_id: currentUser.id,
        page_id: page.id,
        contenu: newPostContent.trim(),
        medias: newPostImage ? [newPostImage] : [],
        media_types: newPostImage ? ["image"] : [],
        is_premium: newPostIsPremium,
        unlock_price: newPostIsPremium ? parseInt(newPostUnlockPrice) || 500 : 0
      };

      const { data: newPost, error } = await supabase
        .from("posts")
        .insert([newPostPayload])
        .select()
        .single();

      if (error) throw error;

      // Mentions detection & trigger if "@" exists in content
      const mentionRegex = /@([a-zA-Z0-9_-]+)/g;
      const usernames: string[] = [];
      let match;
      while ((match = mentionRegex.exec(newPostContent)) !== null) {
        usernames.push(match[1]);
      }

      if (usernames.length > 0) {
        try {
          await supabase.rpc("create_mentions", {
            p_source_type: "post",
            p_source_id: newPost.id,
            usernames: usernames
          });
        } catch (me) {
          console.warn("Mentions trigger failed:", me);
        }
      }

      setNewPostContent("");
      setNewPostImage("");
      setNewPostIsPremium(false);
      fetchPosts();
      alert("🎉 Votre publication créateur est en ligne !");
    } catch (err: any) {
      console.error("Error creating creator post:", err);
      alert("Erreur lors de la publication : " + err.message);
    } finally {
      setIsPublishingPost(false);
    }
  };

  // Submit Certification
  const handleCertifySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!certificationForm.fullName || !certificationForm.idNumber) {
      alert("Tous les champs sont obligatoires.");
      return;
    }

    setIsSubmittingCertify(true);
    try {
      const { error } = await supabase
        .from("creator_verification_requests")
        .insert([{
          user_id: currentUser.id,
          page_id: page.id,
          full_name: certificationForm.fullName,
          id_number: certificationForm.idNumber,
          city: certificationForm.city,
          documents: [
            "https://placeholder-doc.com/id.png",
            "https://placeholder-doc.com/selfie.png"
          ],
          status: "pending"
        }]);

      if (error) throw error;

      alert("🎉 Demande de certification envoyée ! Notre équipe va l'examiner d'ici 24h.");
      setShowCertifyModal(false);
      fetchVerificationStatus();
    } catch (err: any) {
      console.error("Certification submit error:", err);
      alert("Erreur lors de la soumission : " + err.message);
    } finally {
      setIsSubmittingCertify(false);
    }
  };

  // Archive Referral Earnings View filter
  const isCertified = verificationRequest?.status === "approved";

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-950 text-slate-100 font-sans overflow-hidden">
      
      {/* Header */}
      <header className="bg-slate-900 border-b border-slate-800 px-6 py-4 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center space-x-3">
          <img 
            src={page.avatar_url} 
            alt="Page Avatar" 
            className="w-10 h-10 rounded-xl object-cover border-2 border-amber-500/30 shadow-md"
            referrerPolicy="no-referrer"
          />
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-black text-sm tracking-tight text-white">{page.page_name}</span>
              {isCertified ? (
                <span className="bg-amber-500 text-slate-950 text-[8px] font-black px-1.5 py-0.5 rounded-full uppercase tracking-wider">CERTIFIÉ</span>
              ) : (
                <span className="bg-slate-800 text-slate-400 text-[8px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wider">NON CERTIFIÉ</span>
              )}
            </div>
            <p className="text-[10px] text-amber-500 font-semibold tracking-wide flex items-center gap-1 uppercase">
              <Briefcase size={10} />
              <span>Espace Créateur Indépendant</span>
            </p>
          </div>
        </div>

        <button 
          onClick={onBackToApp}
          className="bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs px-3.5 py-2 rounded-xl transition flex items-center gap-1 cursor-pointer"
        >
          <span>Retour Appli</span>
          <ArrowRight size={12} />
        </button>
      </header>

      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* Left Side Dashboard Menu Nav */}
        <nav className="hidden md:flex flex-col w-64 bg-slate-900 border-r border-slate-800 p-4 space-y-1.5 flex-shrink-0">
          <button 
            onClick={() => setActiveTab('dashboard')}
            className={`flex items-center space-x-3 px-4 py-3 rounded-xl text-xs font-bold transition ${activeTab === 'dashboard' ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-white hover:bg-slate-800/40'}`}
          >
            <TrendingUp size={16} />
            <span>Tableau de Bord</span>
          </button>
          <button 
            onClick={() => setActiveTab('posts')}
            className={`flex items-center space-x-3 px-4 py-3 rounded-xl text-xs font-bold transition ${activeTab === 'posts' ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-white hover:bg-slate-800/40'}`}
          >
            <FileText size={16} />
            <span>Mes Publications</span>
          </button>
          <button 
            onClick={() => setActiveTab('revenue')}
            className={`flex items-center space-x-3 px-4 py-3 rounded-xl text-xs font-bold transition ${activeTab === 'revenue' ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-white hover:bg-slate-800/40'}`}
          >
            <Coins size={16} />
            <span>Portefeuille & Retraits</span>
          </button>
          <button 
            onClick={() => setActiveTab('subscribers')}
            className={`flex items-center space-x-3 px-4 py-3 rounded-xl text-xs font-bold transition ${activeTab === 'subscribers' ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-white hover:bg-slate-800/40'}`}
          >
            <Users size={16} />
            <span>Mes Abonnés ({followersCount})</span>
          </button>
          <button 
            onClick={() => setActiveTab('notifications')}
            className={`flex items-center space-x-3 px-4 py-3 rounded-xl text-xs font-bold transition ${activeTab === 'notifications' ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-white hover:bg-slate-800/40'}`}
          >
            <Bell size={16} />
            <span>Notifs Créateur</span>
          </button>
          <button 
            onClick={() => setActiveTab('settings')}
            className={`flex items-center space-x-3 px-4 py-3 rounded-xl text-xs font-bold transition ${activeTab === 'settings' ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-white hover:bg-slate-800/40'}`}
          >
            <Settings size={16} />
            <span>Paramètres de Page</span>
          </button>
          <button 
            onClick={() => setActiveTab('help')}
            className={`flex items-center space-x-3 px-4 py-3 rounded-xl text-xs font-bold transition ${activeTab === 'help' ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-white hover:bg-slate-800/40'}`}
          >
            <HelpCircle size={16} />
            <span>Centre d'aide</span>
          </button>
        </nav>

        {/* View Workspace Content */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 bg-slate-950/40 relative max-h-[100dvh]">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-24 space-y-2">
              <Loader2 className="animate-spin text-amber-500" size={32} />
              <p className="text-xs text-slate-500">Chargement de votre univers...</p>
            </div>
          ) : (
            <>
              {/* Certification Warning banner */}
              {!isCertified && (
                <div className="bg-gradient-to-r from-amber-500/10 to-amber-600/5 border border-amber-500/25 rounded-2xl p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                  <div className="space-y-1">
                    <h4 className="text-xs font-extrabold text-amber-500 flex items-center gap-1.5 uppercase tracking-wide">
                      <ShieldAlert size={14} />
                      <span>Certification Requise</span>
                    </h4>
                    <p className="text-[10px] text-slate-400 leading-relaxed max-w-xl">
                      Votre page est gratuite et fonctionnelle ! Cependant, pour retirer vos gains vers votre compte Mobile Money, votre identité doit être validée par nos équipes.
                    </p>
                  </div>
                  <button 
                    onClick={() => setShowCertifyModal(true)}
                    className="bg-amber-500 hover:bg-amber-600 text-slate-950 text-[10px] font-black tracking-wider uppercase px-4 py-2 rounded-xl transition cursor-pointer flex items-center gap-1"
                  >
                    <span>Faire certifier ma page</span>
                  </button>
                </div>
              )}

              {/* DASHBOARD TAB */}
              {activeTab === 'dashboard' && (
                <div className="space-y-6">
                  {/* Stats Bento Grid */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-slate-900 border border-slate-800 p-4 rounded-3xl space-y-1">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Solde Disponible</p>
                      <h3 className="text-xl md:text-2xl font-black text-amber-500">
                        {wallet?.balance || 0} {wallet?.currency || "FCFA"}
                      </h3>
                      <p className="text-[9px] text-slate-500">Reversement direct à la demande</p>
                    </div>

                    <div className="bg-slate-900 border border-slate-800 p-4 rounded-3xl space-y-1">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Abonnés Actifs</p>
                      <h3 className="text-xl md:text-2xl font-black text-white">
                        {followersCount}
                      </h3>
                      <p className="text-[9px] text-slate-500">Membres abonnés gratuitement</p>
                    </div>

                    <div className="bg-slate-900 border border-slate-800 p-4 rounded-3xl space-y-1">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Total des gains</p>
                      <h3 className="text-xl md:text-2xl font-black text-emerald-500">
                        {wallet?.total_earned || 0} {wallet?.currency || "FCFA"}
                      </h3>
                      <p className="text-[9px] text-slate-500">Commissions LoveRose 20% déduites</p>
                    </div>

                    <div className="bg-slate-900 border border-slate-800 p-4 rounded-3xl space-y-1">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Visites Page</p>
                      <h3 className="text-xl md:text-2xl font-black text-white">
                        {stats.viewsCount}
                      </h3>
                      <p className="text-[9px] text-slate-500">Portée de vos publications</p>
                    </div>
                  </div>

                  {/* Actions Row */}
                  <div className="flex flex-wrap gap-4">
                    <button 
                      onClick={() => {
                        if (!isMethodSetup) {
                          setShowPayoutSetup(true);
                        } else {
                          setShowPayoutModal(true);
                        }
                      }}
                      className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs px-5 py-3 rounded-2xl transition flex items-center gap-1.5 shadow-md shadow-amber-500/10 cursor-pointer"
                    >
                      <ArrowUpRight size={16} />
                      <span>Réclamer mon paiement</span>
                    </button>

                    <button 
                      onClick={() => setActiveTab('posts')}
                      className="bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs px-5 py-3 rounded-2xl border border-slate-800 transition flex items-center gap-1.5 cursor-pointer"
                    >
                      <Plus size={16} className="text-amber-500" />
                      <span>Créer une publication</span>
                    </button>
                  </div>

                  {/* Two Columns Dashboard */}
                  <div className="grid lg:grid-cols-3 gap-6">
                    {/* Recent Earnings list */}
                    <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-4">
                      <h4 className="text-xs font-extrabold tracking-wide uppercase text-white flex items-center gap-1.5 border-b border-slate-800 pb-3">
                        <Coins size={14} className="text-amber-500" />
                        <span>Derniers Gains</span>
                      </h4>

                      {recentEarnings.length === 0 ? (
                        <div className="text-center py-10 text-slate-500 text-xs font-semibold">
                          Aucun gain enregistré sur votre page pour le moment.
                        </div>
                      ) : (
                        <div className="divide-y divide-slate-800/60 max-h-80 overflow-y-auto pr-1">
                          {recentEarnings.map((earn) => (
                            <div key={earn.id} className="py-3 flex justify-between items-center text-xs">
                              <div className="space-y-0.5">
                                <p className="font-bold text-white">
                                  {earn.source === 'page_subscription' && "Abonnement Mensuel"}
                                  {earn.source === 'tip' && "Pourboire reçu"}
                                  {earn.source === 'premium_content' && "Déblocage de contenu exclusif"}
                                </p>
                                <p className="text-[10px] text-slate-500">
                                  {new Date(earn.created_at).toLocaleDateString()}
                                </p>
                              </div>
                              <div className="text-right">
                                <p className="font-extrabold text-emerald-400">+{earn.creator_net || earn.amount_collected} {wallet?.currency || "XOF"}</p>
                                <p className="text-[9px] text-slate-500">Commission déduite</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Quick Payout methods details / Setup status */}
                    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-4">
                      <h4 className="text-xs font-extrabold tracking-wide uppercase text-white flex items-center gap-1.5 border-b border-slate-800 pb-3">
                        <Smartphone size={14} className="text-amber-500" />
                        <span>Méthode de retrait</span>
                      </h4>

                      {isMethodSetup ? (
                        <div className="space-y-4">
                          <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 flex items-center justify-between">
                            <div className="space-y-1">
                              <p className="text-[10px] font-bold text-slate-400 uppercase">Numéro de retrait</p>
                              <p className="text-sm font-black text-white">{payoutMethod.payout_phone_number || payoutMethod.phone}</p>
                              <p className="text-[9px] font-semibold text-slate-500 uppercase">{payoutMethod.operator_id || payoutMethod.operator}</p>
                            </div>
                            <CheckCircle size={20} className="text-amber-500" />
                          </div>
                          <button 
                            onClick={() => setShowPayoutSetup(true)}
                            className="w-full text-center py-2 text-[10px] text-slate-400 hover:text-white font-extrabold transition cursor-pointer"
                          >
                            Modifier les informations
                          </button>
                        </div>
                      ) : (
                        <div className="text-center py-6 space-y-4">
                          <p className="text-xs text-slate-400">Vous n'avez pas encore configuré de numéro Mobile Money pour recevoir vos paiements.</p>
                          <button 
                            onClick={() => setShowPayoutSetup(true)}
                            className="bg-slate-800 hover:bg-slate-700 text-white font-extrabold text-xs px-4 py-2.5 rounded-xl transition cursor-pointer"
                          >
                            Configurer Mobile Money
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* POSTS TAB */}
              {activeTab === 'posts' && (
                <div className="grid lg:grid-cols-3 gap-6">
                  {/* Create post form column */}
                  <div className="lg:col-span-1 bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-4 h-fit">
                    <h4 className="text-xs font-extrabold tracking-wide uppercase text-white border-b border-slate-800 pb-3">
                      Nouvelle Publication
                    </h4>

                    <form onSubmit={handleCreatePost} className="space-y-4">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-500 uppercase block">Texte de la publication</label>
                        <textarea
                          rows={4}
                          value={newPostContent}
                          onChange={(e) => setNewPostContent(e.target.value)}
                          placeholder="Partagez une histoire, une photo exclusive..."
                          className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 focus:outline-none rounded-xl p-3 text-xs font-semibold text-slate-100 resize-none leading-relaxed"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-500 uppercase block">Lien Photo/Média URL (Optionnel)</label>
                        <input
                          type="text"
                          placeholder="https://..."
                          value={newPostImage}
                          onChange={(e) => setNewPostImage(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 focus:outline-none rounded-xl p-3 text-xs font-semibold text-slate-100"
                        />
                      </div>

                      <div className="flex items-center justify-between p-3 bg-slate-950 rounded-xl border border-slate-800">
                        <span className="text-xs font-bold text-slate-300">Contenu payant exclusif</span>
                        <input
                          type="checkbox"
                          checked={newPostIsPremium}
                          onChange={(e) => setNewPostIsPremium(e.target.checked)}
                          className="w-4 h-4 accent-amber-500 cursor-pointer"
                        />
                      </div>

                      {newPostIsPremium && (
                        <div className="space-y-1.5 animate-fadeIn">
                          <label className="text-[10px] font-bold text-slate-500 uppercase block">Prix de déblocage (FCFA)</label>
                          <input
                            type="number"
                            value={newPostUnlockPrice}
                            onChange={(e) => setNewPostUnlockPrice(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 focus:outline-none rounded-xl p-3 text-xs font-semibold text-slate-100"
                          />
                        </div>
                      )}

                      <button
                        type="submit"
                        disabled={isPublishingPost || !newPostContent.trim()}
                        className="w-full bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs py-3 rounded-xl transition flex items-center justify-center gap-1 disabled:opacity-50"
                      >
                        {isPublishingPost ? (
                          <Loader2 className="animate-spin" size={14} />
                        ) : (
                          <>
                            <Plus size={14} />
                            <span>Publier sur ma Page</span>
                          </>
                        )}
                      </button>
                    </form>
                  </div>

                  {/* Creator posts list column */}
                  <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-4">
                    <h4 className="text-xs font-extrabold tracking-wide uppercase text-white border-b border-slate-800 pb-3">
                      Mes Publications ({posts.length})
                    </h4>

                    {posts.length === 0 ? (
                      <div className="text-center py-20 text-slate-500 text-xs">
                        Aucun post publié pour le moment. Remplissez le formulaire de gauche pour votre premier post !
                      </div>
                    ) : (
                      <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
                        {posts.map((post) => (
                          <div key={post.id} className="p-4 bg-slate-950 rounded-2xl border border-slate-800 flex flex-col space-y-3 text-xs relative">
                            <div className="flex justify-between items-start">
                              <span className="text-[10px] text-slate-500">{new Date(post.created_at).toLocaleString()}</span>
                              {post.is_premium ? (
                                <span className="bg-amber-500/10 border border-amber-500/20 text-amber-500 text-[8px] font-black px-2 py-0.5 rounded uppercase tracking-wide flex items-center gap-1">
                                  <Lock size={10} />
                                  <span>Payant ({post.unlock_price} F)</span>
                                </span>
                              ) : (
                                <span className="bg-slate-800 text-slate-400 text-[8px] font-bold px-2 py-0.5 rounded uppercase tracking-wide flex items-center gap-1">
                                  <Unlock size={10} />
                                  <span>Public / Gratuit</span>
                                </span>
                              )}
                            </div>
                            <p className="text-slate-200 leading-relaxed whitespace-pre-wrap">{post.contenu}</p>
                            {post.medias && post.medias.length > 0 && post.medias[0] && (
                              <img src={post.medias[0]} alt="Post media" className="rounded-xl max-h-48 object-cover w-full border border-slate-800" />
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* REVENUE & PORTFOLIO TAB */}
              {activeTab === 'revenue' && (
                <div className="space-y-6">
                  {/* Detailed summary */}
                  <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-5">
                    <h4 className="text-xs font-extrabold tracking-wide uppercase text-white border-b border-slate-800 pb-3 flex items-center justify-between">
                      <span>Portefeuille de Reversement</span>
                      <span className="font-semibold text-[10px] text-slate-400">Commission de 20% déduite en temps réel</span>
                    </h4>

                    <div className="grid sm:grid-cols-3 gap-6">
                      <div className="space-y-1">
                        <p className="text-[10px] text-slate-400 font-bold uppercase">Solde réclamable</p>
                        <h2 className="text-2xl font-black text-amber-500">{wallet?.balance || 0} FCFA</h2>
                        <p className="text-[9px] text-slate-500">Montant net que vous pouvez demander</p>
                      </div>

                      <div className="space-y-1">
                        <p className="text-[10px] text-slate-400 font-bold uppercase">En cours de validation</p>
                        <h2 className="text-2xl font-black text-slate-400">{wallet?.pending_payout || 0} FCFA</h2>
                        <p className="text-[9px] text-slate-500">Demandes de retraits en attente</p>
                      </div>

                      <div className="space-y-1">
                        <p className="text-[10px] text-slate-400 font-bold uppercase">Déjà retiré à vie</p>
                        <h2 className="text-2xl font-black text-emerald-500">
                          {payouts.filter(p => p.status === 'approved').reduce((sum, p) => sum + p.requested_amount, 0)} FCFA
                        </h2>
                        <p className="text-[9px] text-slate-500">Total payé avec succès</p>
                      </div>
                    </div>

                    <div className="pt-3">
                      <button 
                        onClick={() => {
                          if (!isMethodSetup) {
                            setShowPayoutSetup(true);
                          } else {
                            setShowPayoutModal(true);
                          }
                        }}
                        className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs px-5 py-3 rounded-xl transition cursor-pointer"
                      >
                        Réclamer un virement (MoMo/Orange)
                      </button>
                    </div>
                  </div>

                  {/* History List */}
                  <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-4">
                    <h4 className="text-xs font-extrabold tracking-wide uppercase text-white border-b border-slate-800 pb-3">
                      Historique des Demandes de Retrait
                    </h4>

                    {payouts.length === 0 ? (
                      <div className="text-center py-10 text-slate-500 text-xs">
                        Aucune demande de retrait soumise pour le moment.
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs text-slate-300">
                          <thead>
                            <tr className="border-b border-slate-800 text-slate-500 uppercase text-[9px] font-black">
                              <th className="py-2">Date</th>
                              <th>ID/Référence</th>
                              <th>Montant Brut</th>
                              <th>Commission 20%</th>
                              <th>Reçu Net</th>
                              <th>Statut</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800/40">
                            {payouts.map((p) => (
                              <tr key={p.id} className="py-2">
                                <td className="py-3 font-semibold">{new Date(p.created_at).toLocaleDateString()}</td>
                                <td className="font-mono text-[10px] text-slate-400">{p.id.substring(0, 8)}...</td>
                                <td className="font-bold">{p.requested_amount || p.amount} FCFA</td>
                                <td className="text-rose-500">-{p.platform_fee || Math.round((p.requested_amount || p.amount) * 0.2)} FCFA</td>
                                <td className="font-extrabold text-emerald-400">{p.net_amount || Math.round((p.requested_amount || p.amount) * 0.8)} FCFA</td>
                                <td>
                                  {p.status === "approved" && (
                                    <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[9px] font-bold px-2 py-0.5 rounded">Reversé</span>
                                  )}
                                  {p.status === "pending" && (
                                    <span className="bg-amber-500/10 text-amber-500 border border-amber-500/20 text-[9px] font-bold px-2 py-0.5 rounded">En cours</span>
                                  )}
                                  {p.status === "rejected" && (
                                    <span className="bg-red-500/10 text-red-400 border border-red-500/20 text-[9px] font-bold px-2 py-0.5 rounded">Rejeté</span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* SUBSCRIBERS TAB */}
              {activeTab === 'subscribers' && (
                <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-4">
                  <h4 className="text-xs font-extrabold tracking-wide uppercase text-white border-b border-slate-800 pb-3">
                    Liste de mes abonnés ({followers.length})
                  </h4>

                  {followers.length === 0 ? (
                    <div className="text-center py-20 text-slate-500 text-xs">
                      Vous n'avez pas encore d'abonnés sur votre page créateur. Vos posts de fil d'actualité gratuit aideront à vous faire connaître !
                    </div>
                  ) : (
                    <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
                      {followers.map((f) => (
                        <div key={f.id} className="bg-slate-950 p-4 border border-slate-800 rounded-2xl flex items-center space-x-3 text-xs">
                          <img
                            src={f.profile?.avatar_url || "https://api.dicebear.com/7.x/adventurer/svg?seed=Anon"}
                            alt=""
                            className="w-10 h-10 rounded-full object-cover border border-slate-800"
                          />
                          <div>
                            <p className="font-extrabold text-white">{f.profile?.full_name || "Membre"}</p>
                            <p className="text-[9px] text-slate-500">Suivi depuis {new Date(f.created_at).toLocaleDateString()}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* NOTIFICATIONS TAB */}
              {activeTab === 'notifications' && (
                <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-4">
                  <h4 className="text-xs font-extrabold tracking-wide uppercase text-white border-b border-slate-800 pb-3">
                    Notifications de Page Créateur
                  </h4>

                  {notifications.length === 0 ? (
                    <div className="text-center py-20 text-slate-500 text-xs">
                      Aucune notification créateur reçue pour l'instant.
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-800/60 max-h-[60vh] overflow-y-auto pr-1">
                      {notifications.map((n) => (
                        <div key={n.id} className="py-3 flex items-start space-x-3 text-xs">
                          <div className="p-1.5 bg-amber-500/10 text-amber-500 rounded-lg">
                            <Bell size={14} />
                          </div>
                          <div className="flex-1 space-y-0.5">
                            <p className="text-slate-200 font-semibold">{n.content}</p>
                            <p className="text-[9px] text-slate-500">{new Date(n.created_at).toLocaleString()}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* SETTINGS TAB */}
              {activeTab === 'settings' && (
                <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-4">
                  <h4 className="text-xs font-extrabold tracking-wide uppercase text-white border-b border-slate-800 pb-3">
                    Paramètres de Page Créateur
                  </h4>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Configurez le prix d'abonnement payant mensuel ou changez les détails de votre profil. LoveRose gère tous les paiements locaux directement par Orange Money et MTN Mobile Money.
                  </p>

                  <div className="pt-4 max-w-md space-y-4 text-xs">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase block">Prix de l'abonnement (FCFA / mois)</label>
                      <input 
                        type="number" 
                        value={page.subscription_price || 2500} 
                        disabled
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-slate-400 cursor-not-allowed font-semibold"
                      />
                      <p className="text-[9px] text-slate-500">Contactez le support administratif pour modifier la tarification récurrente.</p>
                    </div>

                    <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 space-y-2">
                      <p className="font-bold text-white">Slug unique d'accès :</p>
                      <p className="font-mono text-amber-500 text-xs">@{page.slug}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* HELP CENTER TAB */}
              {activeTab === 'help' && (
                <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-4 text-xs">
                  <h4 className="text-xs font-extrabold tracking-wide uppercase text-white border-b border-slate-800 pb-3">
                    Centre d'aide pour Créateurs
                  </h4>

                  <div className="space-y-4 leading-relaxed text-slate-300">
                    <div className="space-y-1">
                      <h5 className="font-extrabold text-white text-sm">Comment fonctionnent les reversements ?</h5>
                      <p className="text-slate-400">Toutes les demandes de paiement initiées sont validées et transférées manuellement ou automatiquement par nos équipes vers votre numéro Mobile Money enregistré sous 24 heures.</p>
                    </div>

                    <div className="space-y-1">
                      <h5 className="font-extrabold text-white text-sm">Quelles sont les limites de retrait ?</h5>
                      <p className="text-slate-400">Le retrait minimum est de 1 000 FCFA. Il n'y a aucune limite maximale de retrait.</p>
                    </div>

                    <div className="space-y-1">
                      <h5 className="font-extrabold text-white text-sm">Comment obtenir la certification ?</h5>
                      <p className="text-slate-400">Allez dans le bouton "Faire certifier ma page" sur le tableau de bord et envoyez un selfie tenant votre carte d'identité nationale ou passeport. Notre équipe valide généralement les demandes sous 24h.</p>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* MOBILE BOTTOM NAV */}
      <footer className="bg-slate-900 border-t border-slate-800 py-2 px-4 flex justify-around items-center sticky bottom-0 z-30 md:hidden flex-shrink-0">
        <button 
          onClick={() => setActiveTab('dashboard')}
          className={`flex flex-col items-center gap-1 cursor-pointer ${activeTab === 'dashboard' ? 'text-amber-500 font-bold' : 'text-slate-500'}`}
        >
          <TrendingUp size={16} />
          <span className="text-[9px]">Dashboard</span>
        </button>
        <button 
          onClick={() => setActiveTab('posts')}
          className={`flex flex-col items-center gap-1 cursor-pointer ${activeTab === 'posts' ? 'text-amber-500 font-bold' : 'text-slate-500'}`}
        >
          <FileText size={16} />
          <span className="text-[9px]">Posts</span>
        </button>
        <button 
          onClick={() => setActiveTab('revenue')}
          className={`flex flex-col items-center gap-1 cursor-pointer ${activeTab === 'revenue' ? 'text-amber-500 font-bold' : 'text-slate-500'}`}
        >
          <Coins size={16} />
          <span className="text-[9px]">Retraits</span>
        </button>
        <button 
          onClick={() => setActiveTab('subscribers')}
          className={`flex flex-col items-center gap-1 cursor-pointer ${activeTab === 'subscribers' ? 'text-amber-500 font-bold' : 'text-slate-500'}`}
        >
          <Users size={16} />
          <span className="text-[9px]">Abonnés</span>
        </button>
      </footer>

      {/* MODAL: PAYOUT SETUP / UPDATE */}
      {showPayoutSetup && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 text-left space-y-4 shadow-2xl animate-fadeIn">
            <h3 className="text-base font-black text-white flex items-center gap-1.5 uppercase tracking-wide">
              <Smartphone className="text-amber-500" size={18} />
              <span>Configuration Mobile Money</span>
            </h3>

            <p className="text-[11px] text-slate-400 leading-normal">
              Spécifiez vos informations et définissez votre <strong className="text-white">PIN de sécurité</strong> pour valider chaque retrait instantanément.
            </p>

            <form onSubmit={handlePayoutMethodSetup} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 block uppercase">Nom Complet (Bénéficiaire)</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Jean Dupont"
                  value={payoutForm.fullName}
                  onChange={(e) => setPayoutForm(p => ({ ...p, fullName: e.target.value }))}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 focus:outline-none rounded-xl p-3 text-white font-semibold"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 block uppercase">Opérateur Mobile Money</label>
                <select
                  value={payoutForm.operatorId}
                  onChange={(e) => setPayoutForm(p => ({ ...p, operatorId: e.target.value }))}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 focus:outline-none rounded-xl p-3 text-white font-semibold"
                >
                  {operators.map(op => (
                    <option key={op.id} value={op.id}>{op.name} ({op.country_code})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1 col-span-1">
                  <label className="text-[10px] font-bold text-slate-400 block uppercase">Code Pays</label>
                  <select
                    value={payoutForm.countryIso}
                    onChange={(e) => setPayoutForm(p => ({ ...p, countryIso: e.target.value }))}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 focus:outline-none rounded-xl p-3 text-white font-semibold"
                  >
                    <option value="CM">CM (+237)</option>
                    <option value="CI">CI (+225)</option>
                    <option value="SN">SN (+221)</option>
                    <option value="TG">TG (+228)</option>
                    <option value="BJ">BJ (+229)</option>
                  </select>
                </div>
                <div className="space-y-1 col-span-2">
                  <label className="text-[10px] font-bold text-slate-400 block uppercase">Numéro Téléphone</label>
                  <input
                    type="tel"
                    required
                    placeholder="6xxxxxx"
                    value={payoutForm.phone}
                    onChange={(e) => setPayoutForm(p => ({ ...p, phone: e.target.value }))}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 focus:outline-none rounded-xl p-3 text-white font-semibold"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 block uppercase">Définir un Code PIN de Paiement (4 chiffres min.)</label>
                <input
                  type="password"
                  required
                  maxLength={8}
                  placeholder="••••"
                  value={payoutForm.pinCode}
                  onChange={(e) => setPayoutForm(p => ({ ...p, pinCode: e.target.value.replace(/\D/g, "") }))}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 focus:outline-none rounded-xl p-3 text-white font-black tracking-widest text-center text-lg"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowPayoutSetup(false)}
                  className="flex-1 py-3 border border-slate-800 hover:bg-slate-800 text-slate-400 font-bold rounded-xl transition cursor-pointer text-center"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingPayout}
                  className="flex-1 py-3 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black rounded-xl transition cursor-pointer text-center disabled:opacity-50"
                >
                  {isSubmittingPayout ? <Loader2 className="animate-spin mx-auto" size={16} /> : "Enregistrer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: SUBMIT PAYOUT REQUEST WITH PIN */}
      {showPayoutModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 text-left space-y-4 shadow-2xl animate-fadeIn">
            <h3 className="text-base font-black text-white flex items-center gap-1.5 uppercase tracking-wide">
              <Key className="text-amber-500" size={18} />
              <span>Demande de Retrait Sécurisée</span>
            </h3>

            <form onSubmit={handleRequestPayoutSubmit} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 block uppercase">Montant à retirer (FCFA)</label>
                <input
                  type="number"
                  required
                  min={1000}
                  placeholder="Min. 1000 FCFA"
                  value={payoutAmount}
                  onChange={(e) => setPayoutAmount(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 focus:outline-none rounded-xl p-3 text-white font-black text-lg"
                />
              </div>

              {payoutAmount && (
                <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-1 text-[11px] text-slate-400">
                  <div className="flex justify-between">
                    <span>Frais LoveRose (20%) :</span>
                    <span className="text-rose-500">-{Math.round(parseInt(payoutAmount) * 0.20 || 0)} FCFA</span>
                  </div>
                  <div className="flex justify-between font-black text-white">
                    <span>Vous recevrez :</span>
                    <span className="text-emerald-400">{Math.round(parseInt(payoutAmount) * 0.80 || 0)} FCFA</span>
                  </div>
                </div>
              )}

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 block uppercase">Saisissez votre PIN de sécurité</label>
                <input
                  type="password"
                  required
                  placeholder="••••"
                  maxLength={8}
                  value={enteredPin}
                  onChange={(e) => setEnteredPin(e.target.value.replace(/\D/g, ""))}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 focus:outline-none rounded-xl p-3 text-white font-black tracking-widest text-center text-lg"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowPayoutModal(false)}
                  className="flex-1 py-3 border border-slate-800 hover:bg-slate-800 text-slate-400 font-bold rounded-xl transition cursor-pointer text-center"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingPayout || !payoutAmount}
                  className="flex-1 py-3 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black rounded-xl transition cursor-pointer text-center disabled:opacity-50"
                >
                  {isSubmittingPayout ? <Loader2 className="animate-spin mx-auto" size={16} /> : "Valider le retrait"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: SUBMIT CERTIFICATION */}
      {showCertifyModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 text-left space-y-4 shadow-2xl animate-fadeIn">
            <h3 className="text-base font-black text-white flex items-center gap-1.5 uppercase tracking-wide">
              <CheckCircle className="text-amber-500" size={18} />
              <span>Demande de Certification</span>
            </h3>

            <p className="text-[11px] text-slate-400 leading-normal">
              Afin de débloquer la possibilité d'initier des retraits de gains réels vers votre compte Mobile Money, veuillez renseigner vos informations réelles de carte d'identité ou passeport.
            </p>

            <form onSubmit={handleCertifySubmit} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 block uppercase">Nom Complet (Identique à la CNI)</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Jean Paul"
                  value={certificationForm.fullName}
                  onChange={(e) => setCertificationForm(c => ({ ...c, fullName: e.target.value }))}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 focus:outline-none rounded-xl p-3 text-white font-semibold"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 block uppercase">Numéro de Pièce d'Identité (CNI / Passeport)</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: 100982736"
                  value={certificationForm.idNumber}
                  onChange={(e) => setCertificationForm(c => ({ ...c, idNumber: e.target.value }))}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 focus:outline-none rounded-xl p-3 text-white font-semibold"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 block uppercase">Ville de résidence</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Yaoundé"
                  value={certificationForm.city}
                  onChange={(e) => setCertificationForm(c => ({ ...c, city: e.target.value }))}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 focus:outline-none rounded-xl p-3 text-white font-semibold"
                />
              </div>

              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800/80 text-[10px] text-slate-500 leading-relaxed">
                ℹ️ <strong>Photos d'identité :</strong> En soumettant ce formulaire, vous confirmez l'exactitude des informations. Nos équipes peuvent demander une preuve physique supplémentaire lors de la validation.
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCertifyModal(false)}
                  className="flex-1 py-3 border border-slate-800 hover:bg-slate-800 text-slate-400 font-bold rounded-xl transition cursor-pointer text-center"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingCertify}
                  className="flex-1 py-3 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black rounded-xl transition cursor-pointer text-center disabled:opacity-50"
                >
                  {isSubmittingCertify ? <Loader2 className="animate-spin mx-auto" size={16} /> : "Soumettre la demande"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
