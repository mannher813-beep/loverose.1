import React, { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { 
  Sparkles, 
  UserCheck, 
  Coins, 
  CreditCard, 
  Plus, 
  Trash2, 
  Eye, 
  Image as ImageIcon, 
  CheckCircle, 
  Zap, 
  FileText, 
  Activity, 
  ArrowRight, 
  Users, 
  Newspaper, 
  ArrowDownCircle, 
  BadgeHelp, 
  Share2, 
  Heart, 
  DollarSign, 
  ShieldAlert, 
  Compass, 
  Settings as SettingsIcon,
  Lock,
  Unlock,
  Check,
  Smartphone,
  ChevronRight,
  Loader2
} from "lucide-react";
import { Profile } from "../types";
import AdSlot from "./AdSlot";
import CreatorOnboarding from "./CreatorOnboarding";
import CreatorDashboard from "./CreatorDashboard";

interface CreatorsProps {
  currentUser: any;
  currentUserProfile: Profile | null;
  onOpenShop: () => void;
  onNavigateToTab: (tab: any) => void;
}

export default function Creators({ currentUser, currentUserProfile, onOpenShop, onNavigateToTab }: CreatorsProps) {
  // Navigation tabs within Creators Hub
  // 'discover': Discover creator pages (for everyone)
  // 'my_pages': Creator dashboard / Page creation & management
  const [activeTab, setActiveTab] = useState<'discover' | 'creator_hub'>('discover');
  
  // States for general profiles and selected page to view publicly
  const [creatorPages, setCreatorPages] = useState<any[]>([]);
  const [selectedPage, setSelectedPage] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // States for user's owned pages
  const [myPages, setMyPages] = useState<any[]>([]);
  const [myPagesLoading, setMyPagesLoading] = useState<boolean>(true);
  
  // Dashboard & Wallet Stats
  const [stats, setStats] = useState<any | null>(null);
  const [wallet, setWallet] = useState<any | null>(null);
  const [recentEarnings, setRecentEarnings] = useState<any[]>([]);
  const [payouts, setPayouts] = useState<any[]>([]);
  
  // Active page context for creator dashboard
  const [selectedDashboardPage, setSelectedDashboardPage] = useState<any | null>(null);

  // Creator Onboarding Step state
  // 1: Avantages, 2: Règles, 3: Monétisation, 4: Créer Page Draft + Payer
  const [onboardingStep, setOnboardingStep] = useState<number>(1);
  const [isPayingCreator, setIsPayingCreator] = useState<boolean>(false);

  // Billing confirmation modal states
  const [showCreatorPaymentConfirm, setShowCreatorPaymentConfirm] = useState<boolean>(false);
  const [creatorPaymentForm, setCreatorPaymentForm] = useState({
    planId: "",
    planName: "",
    amount: 0,
    phoneNumber: currentUserProfile?.phone_number || "",
    fullName: currentUserProfile?.full_name || currentUserProfile?.username || "",
    relatedPageId: null as string | null,
    relatedPostId: null as string | null
  });

  // Sync profile details if they load later
  useEffect(() => {
    if (currentUserProfile) {
      setCreatorPaymentForm(prev => ({
        ...prev,
        phoneNumber: prev.phoneNumber || currentUserProfile.phone_number || "",
        fullName: prev.fullName || currentUserProfile.full_name || currentUserProfile.username || ""
      }));
    }
  }, [currentUserProfile]);

  // Page Creator Form
  const [pageForm, setPageForm] = useState({
    page_name: "",
    description: "",
    category: "Dating & Romance",
    interests: "",
    location: currentUserProfile?.location || "",
    language: "fr",
    avatar_url: currentUserProfile?.avatar_url || "",
    banner_url: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1200&q=80",
    subscription_price: "2500",
    tips_enabled: true
  });

  // Verification request fields
  const [verificationForm, setVerificationForm] = useState({
    fullName: "",
    idNumber: "",
    moneyFusionPhone: currentUserProfile?.phone_number || "",
    countryIso: "CM",
    city: currentUserProfile?.location || "",
  });
  const [idFile, setIdFile] = useState<File | null>(null);
  const [selfieFile, setSelfieFile] = useState<File | null>(null);
  const [isSubmittingVerification, setIsSubmittingVerification] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState<'none' | 'pending' | 'approved' | 'rejected'>('none');

  // New Post Form for Creator
  const [newPostContent, setNewPostContent] = useState("");
  const [newPostImage, setNewPostImage] = useState("");
  const [newPostIsPremium, setNewPostIsPremium] = useState(false);
  const [newPostUnlockPrice, setNewPostUnlockPrice] = useState("500");
  const [isPublishingPost, setIsPublishingPost] = useState(false);

  // Public Viewer states (when normal member views creator page)
  const [publicPosts, setPublicPosts] = useState<any[]>([]);
  const [isFollowing, setIsFollowing] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [unlockedPostIds, setUnlockedPostIds] = useState<Set<string>>(new Set());
  const [isActionLoading, setIsActionLoading] = useState<string | null>(null);
  const [tipAmount, setTipAmount] = useState<string>("500");
  const [tipMessage, setTipMessage] = useState<string>("");

  // Payout request fields
  const [payoutAmount, setPayoutAmount] = useState<string>("");
  const [payoutPhone, setPayoutPhone] = useState<string>(currentUserProfile?.phone_number || "");
  const [payoutCountry, setPayoutCountry] = useState<string>("CM");
  const [payoutName, setPayoutName] = useState<string>(currentUserProfile?.full_name || "");
  const [isSubmittingPayout, setIsSubmittingPayout] = useState(false);

  // Edit Page Settings form state
  const [isEditingSettings, setIsEditingSettings] = useState(false);
  const [editPageForm, setEditPageForm] = useState<any>(null);

  // Load basic data
  useEffect(() => {
    fetchCreatorPages();
    if (currentUser) {
      fetchMyCreatorPages();
      checkExistingVerification();
    }
  }, [currentUser]);

  // If user selected active page context, fetch dashboard stats
  useEffect(() => {
    if (selectedDashboardPage) {
      fetchDashboardData(selectedDashboardPage.id);
      setEditPageForm({ ...selectedDashboardPage });
    }
  }, [selectedDashboardPage]);

  // Load public page relations when viewing a specific page
  useEffect(() => {
    if (selectedPage) {
      loadPublicPageData(selectedPage);
    }
  }, [selectedPage, currentUser]);

  const handleCreatorPaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const { planId, planName, amount, phoneNumber, fullName, relatedPageId, relatedPostId } = creatorPaymentForm;
    
    if (!phoneNumber.trim()) {
      alert("Veuillez renseigner votre numéro de téléphone mobile money.");
      return;
    }
    if (!fullName.trim()) {
      alert("Veuillez renseigner votre nom complet.");
      return;
    }

    setIsActionLoading(planId);
    setShowCreatorPaymentConfirm(false);

    try {
      const { data, error } = await supabase.functions.invoke('moneyfusion-create-payment', {
        body: {
          plan_id: planId,
          plan_name: planName,
          montant: amount,
          phone_number: phoneNumber,
          full_name: fullName,
          related_page_id: relatedPageId || null,
          related_post_id: relatedPostId || null
        }
      });

      if (error) {
        throw error;
      }

      if (data?.payment_url) {
        window.location.href = data.payment_url;
      } else {
        throw new Error(data?.error || "Impossible d'initialiser la session de paiement.");
      }
    } catch (err: any) {
      console.error("Payment initiation failed:", err);
      alert("Erreur lors de l'initialisation du paiement avec Money Fusion : " + (err.message || "Veuillez réessayer."));
    } finally {
      setIsActionLoading(null);
    }
  };

  const fetchCreatorPages = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("creator_pages")
        .select("*")
        .eq("status", "active")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setCreatorPages(data || []);
    } catch (err) {
      console.error("Error loading active creator pages:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const checkExistingVerification = async () => {
    try {
      const { data, error } = await supabase
        .from("creator_verification_requests")
        .select("status")
        .eq("user_id", currentUser.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (data) {
        setVerificationStatus(data.status);
      }
    } catch (err) {
      console.warn("Error fetching verification request:", err);
    }
  };

  const fetchMyCreatorPages = async () => {
    setMyPagesLoading(true);
    try {
      const { data, error } = await supabase
        .from("creator_pages")
        .select("*")
        .eq("owner_id", currentUser.id);

      if (error) throw error;
      setMyPages(data || []);
      
      // Default dashboard context to first page if owned
      if (data && data.length > 0) {
        // Prefer paid/active pages first, then pending
        const sorted = [...data].sort((a, b) => (b.activation_paid ? 1 : 0) - (a.activation_paid ? 1 : 0));
        setSelectedDashboardPage(sorted[0]);
      }
    } catch (err) {
      console.error("Error loading my creator pages:", err);
    } finally {
      setMyPagesLoading(false);
    }
  };

  const fetchDashboardData = async (pageId: string) => {
    try {
      // 1. Fetch wallet from creator_wallet view
      const { data: walletData } = await supabase
        .from("creator_wallet")
        .select("*")
        .eq("page_id", pageId)
        .maybeSingle();

      setWallet(walletData || {
        page_id: pageId,
        available_balance: 0,
        claimed_earnings: 0,
        total_earnings: 0
      });

      // 2. Fetch stats from creator_dashboard_stats view
      const { data: statsData } = await supabase
        .from("creator_dashboard_stats")
        .select("*")
        .eq("page_id", pageId)
        .maybeSingle();

      setStats(statsData || {
        page_id: pageId,
        followers_count: 0,
        subscribers_count: 0,
        posts_count: 0,
        referrals_count: 0
      });

      // 3. Fetch earnings details
      const { data: earningsData } = await supabase
        .from("creator_earnings")
        .select("*")
        .eq("page_id", pageId)
        .order("created_at", { ascending: false })
        .limit(10);

      setRecentEarnings(earningsData || []);

      // 4. Fetch payout requests
      const { data: payoutRequests } = await supabase
        .from("payout_requests")
        .select("*")
        .eq("page_id", pageId)
        .order("created_at", { ascending: false });

      setPayouts(payoutRequests || []);
    } catch (err) {
      console.error("Error loading creator dashboard statistics:", err);
    }
  };

  const loadPublicPageData = async (page: any) => {
    try {
      // 1. Fetch posts related to this creator page (reusing posts with page_id filter)
      const { data: postsData } = await supabase
        .from("posts")
        .select("*")
        .eq("page_id", page.id)
        .order("created_at", { ascending: false });

      setPublicPosts(postsData || []);

      if (!currentUser) return;

      // 2. Check follower state
      const { data: followData } = await supabase
        .from("page_followers")
        .select("id")
        .eq("page_id", page.id)
        .eq("user_id", currentUser.id)
        .maybeSingle();

      setIsFollowing(!!followData);

      // 3. Check active subscription
      const { data: subData } = await supabase
        .from("page_subscriptions")
        .select("id")
        .eq("page_id", page.id)
        .eq("user_id", currentUser.id)
        .eq("status", "active")
        .gt("ends_at", new Date().toISOString())
        .maybeSingle();

      setIsSubscribed(!!subData);

      // 4. Check premium posts unlocked
      const { data: unlockData } = await supabase
        .from("post_unlocks")
        .select("post_id")
        .eq("user_id", currentUser.id);

      const unlockedSet = new Set<string>((unlockData || []).map(u => u.post_id));
      setUnlockedPostIds(unlockedSet);
    } catch (err) {
      console.error("Error loading public page relations:", err);
    }
  };

  const handleCreateDraftPage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    if (!pageForm.page_name || !pageForm.description) {
      alert("Veuillez remplir le nom et la description de votre page.");
      return;
    }

    setIsPayingCreator(true);
    try {
      // Generate slug and referral code
      const slug = pageForm.page_name.toLowerCase().trim()
        .replace(/[^a-z0-9 ]/g, "")
        .replace(/\s+/g, "-") + "-" + Math.floor(1000 + Math.random() * 9000);
      const referralCode = "LR-" + Math.floor(100000 + Math.random() * 900000);

      const pagePayload = {
        owner_id: currentUser.id,
        page_name: pageForm.page_name,
        description: pageForm.description,
        category: pageForm.category,
        interests: pageForm.interests ? pageForm.interests.split(",").map(i => i.trim()) : [],
        location: pageForm.location,
        language: pageForm.language,
        avatar_url: pageForm.avatar_url || `https://api.dicebear.com/7.x/initials/svg?seed=${pageForm.page_name}`,
        banner_url: pageForm.banner_url,
        subscription_price: parseInt(pageForm.subscription_price) || 2500,
        tips_enabled: pageForm.tips_enabled,
        slug,
        referral_code: referralCode,
        status: "pending_verification",
        activation_paid: false
      };

      // 1. Save Page draft
      const { data: newPage, error: createError } = await supabase
        .from("creator_pages")
        .insert([pagePayload])
        .select()
        .single();

      if (createError) throw createError;

      // 2. Open billing details confirmation modal for page activation (1,000 FCFA)
      setCreatorPaymentForm({
        planId: "creator_page_activation",
        planName: `Activation de la page ${newPage.page_name}`,
        amount: 1000,
        phoneNumber: currentUserProfile?.phone_number || "",
        fullName: currentUserProfile?.full_name || currentUserProfile?.username || "",
        relatedPageId: newPage.id,
        relatedPostId: null
      });
      setShowCreatorPaymentConfirm(true);

    } catch (err: any) {
      console.error("Error creating creator page:", err);
      alert("Erreur lors de la création de la page : " + err.message);
    } finally {
      setIsPayingCreator(false);
    }
  };

  const handleSavePageSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editPageForm) return;

    setIsActionLoading("save_settings");
    try {
      const { error } = await supabase
        .from("creator_pages")
        .update({
          page_name: editPageForm.page_name,
          description: editPageForm.description,
          category: editPageForm.category,
          interests: typeof editPageForm.interests === 'string' ? editPageForm.interests.split(",").map((i: any) => i.trim()) : editPageForm.interests,
          location: editPageForm.location,
          language: editPageForm.language,
          avatar_url: editPageForm.avatar_url,
          banner_url: editPageForm.banner_url,
          subscription_price: parseInt(editPageForm.subscription_price) || 2500,
          tips_enabled: editPageForm.tips_enabled
        })
        .eq("id", editPageForm.id);

      if (error) throw error;
      
      alert("Paramètres mis à jour !");
      setIsEditingSettings(false);
      fetchMyCreatorPages();
    } catch (err: any) {
      console.error("Error updating page settings:", err);
      alert("Impossible de mettre à jour : " + err.message);
    } finally {
      setIsActionLoading(null);
    }
  };

  const handlePostPublish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDashboardPage || !newPostContent) return;

    setIsPublishingPost(true);
    try {
      const { error } = await supabase
        .from("posts")
        .insert([
          {
            author_id: currentUser.id,
            page_id: selectedDashboardPage.id,
            contenu: newPostContent,
            medias: newPostImage ? [newPostImage] : [],
            is_premium: newPostIsPremium,
            unlock_price: newPostIsPremium ? parseInt(newPostUnlockPrice) || 500 : 0
          }
        ]);

      if (error) throw error;

      alert("Publication réussie !");
      setNewPostContent("");
      setNewPostImage("");
      setNewPostIsPremium(false);
      setNewPostUnlockPrice("500");
      
      fetchDashboardData(selectedDashboardPage.id);
    } catch (err: any) {
      console.error("Error creating post:", err);
      alert("Impossible de publier le post : " + err.message);
    } finally {
      setIsPublishingPost(false);
    }
  };

  const handleFollowToggle = async () => {
    if (!currentUser || !selectedPage) return;

    setIsActionLoading("follow");
    try {
      if (isFollowing) {
        // Unfollow
        const { error } = await supabase
          .from("page_followers")
          .delete()
          .eq("page_id", selectedPage.id)
          .eq("user_id", currentUser.id);

        if (error) throw error;
        setIsFollowing(false);
      } else {
        // Follow
        const { error } = await supabase
          .from("page_followers")
          .insert([
            {
              page_id: selectedPage.id,
              user_id: currentUser.id
            }
          ]);

        if (error) throw error;
        setIsFollowing(true);
      }
    } catch (err: any) {
      console.error("Follow toggling error:", err);
    } finally {
      setIsActionLoading(null);
    }
  };

  const handlePageSubscribe = async () => {
    if (!currentUser || !selectedPage) return;

    const price = selectedPage.subscription_price || 2500;
    setCreatorPaymentForm({
      planId: "page_subscription",
      planName: `Abonnement à la page ${selectedPage.page_name}`,
      amount: price,
      phoneNumber: currentUserProfile?.phone_number || "",
      fullName: currentUserProfile?.full_name || currentUserProfile?.username || "",
      relatedPageId: selectedPage.id,
      relatedPostId: null
    });
    setShowCreatorPaymentConfirm(true);
  };

  const handleSendTip = async () => {
    if (!currentUser || !selectedPage) return;
    const amount = parseInt(tipAmount);
    if (!amount || amount < 100) {
      alert("Le montant minimum d'un pourboire est de 100 FCFA.");
      return;
    }

    setCreatorPaymentForm({
      planId: "tip",
      planName: `Pourboire pour ${selectedPage.page_name}`,
      amount: amount,
      phoneNumber: currentUserProfile?.phone_number || "",
      fullName: currentUserProfile?.full_name || currentUserProfile?.username || "",
      relatedPageId: selectedPage.id,
      relatedPostId: null
    });
    setShowCreatorPaymentConfirm(true);
  };

  const handleUnlockPost = async (post: any) => {
    if (!currentUser) return;

    const price = post.unlock_price || 500;
    setCreatorPaymentForm({
      planId: "premium_content_unlock",
      planName: "Déblocage de publication",
      amount: price,
      phoneNumber: currentUserProfile?.phone_number || "",
      fullName: currentUserProfile?.full_name || currentUserProfile?.username || "",
      relatedPageId: null,
      relatedPostId: post.id
    });
    setShowCreatorPaymentConfirm(true);
  };

  const handleRequestPayout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDashboardPage || !wallet) return;

    const amountRequested = parseInt(payoutAmount);
    if (!amountRequested || amountRequested <= 0) {
      alert("Veuillez saisir un montant valide.");
      return;
    }

    if (amountRequested > wallet.available_balance) {
      alert(`Votre solde disponible (${wallet.available_balance} FCFA) est insuffisant pour retirer ce montant.`);
      return;
    }

    if (!payoutPhone) {
      alert("Veuillez renseigner votre numéro Money Fusion pour le reversement.");
      return;
    }

    setIsSubmittingPayout(true);
    try {
      // Calling request_payout RPC on database as requested
      const { data, error } = await supabase.rpc('request_payout', {
        target_page_id: selectedDashboardPage.id,
        amount: amountRequested,
        phone: payoutPhone,
        country_iso: payoutCountry,
        full_name: payoutName
      });

      if (error) throw error;

      alert(`🎉 Demande de paiement de ${amountRequested} FCFA enregistrée ! Elle sera validée et créditée par notre équipe sur votre compte Money Fusion sous 24h.`);
      setPayoutAmount("");
      
      // Reload stats & history
      fetchDashboardData(selectedDashboardPage.id);
    } catch (err: any) {
      console.error("Error requesting payout:", err);
      alert("Impossible de soumettre la demande : " + err.message);
    } finally {
      setIsSubmittingPayout(false);
    }
  };

  const handleVerificationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    if (!verificationForm.fullName || !verificationForm.idNumber) {
      alert("Veuillez renseigner les informations d'identité obligatoires.");
      return;
    }

    setIsSubmittingVerification(true);
    try {
      let idUrl = "";
      let selfieUrl = "";

      // Document Upload folder: verifications/{uid}/
      if (idFile) {
        const idPath = `verifications/${currentUser.id}/id_${Date.now()}_${idFile.name}`;
        const { error: idUploadError } = await supabase.storage
          .from("loverose")
          .upload(idPath, idFile);
        
        if (!idUploadError) {
          const { data } = supabase.storage.from("loverose").getPublicUrl(idPath);
          idUrl = data.publicUrl;
        } else {
          console.warn("Storage upload failed, falling back to base64 simulation:", idUploadError);
          idUrl = `https://placeholder-document-url.com/id_${currentUser.id}.png`;
        }
      } else {
        idUrl = `https://placeholder-document-url.com/id_${currentUser.id}.png`;
      }

      if (selfieFile) {
        const selfiePath = `verifications/${currentUser.id}/selfie_${Date.now()}_${selfieFile.name}`;
        const { error: selfieUploadError } = await supabase.storage
          .from("loverose")
          .upload(selfiePath, selfieFile);

        if (!selfieUploadError) {
          const { data } = supabase.storage.from("loverose").getPublicUrl(selfiePath);
          selfieUrl = data.publicUrl;
        } else {
          console.warn("Storage upload failed, falling back to base64 simulation:", selfieUploadError);
          selfieUrl = `https://placeholder-document-url.com/selfie_${currentUser.id}.png`;
        }
      } else {
        selfieUrl = `https://placeholder-document-url.com/selfie_${currentUser.id}.png`;
      }

      // Record in creator_verification_requests table
      const { error } = await supabase
        .from("creator_verification_requests")
        .insert([
          {
            user_id: currentUser.id,
            status: "pending",
            documents: [idUrl, selfieUrl],
            full_name: verificationForm.fullName,
            id_number: verificationForm.idNumber,
            money_fusion_phone: verificationForm.moneyFusionPhone,
            country_iso: verificationForm.countryIso,
            city: verificationForm.city,
            metadata: {
              submitted_at: new Date().toISOString()
            }
          }
        ]);

      if (error) throw error;

      alert("Félicitations ! Votre dossier d'identité a été soumis à notre équipe d'examen. Vous recevrez une notification dès qu'il sera approuvé.");
      setVerificationStatus("pending");
    } catch (err: any) {
      console.error("Verification submit error:", err);
      alert("Impossible de soumettre : " + err.message);
    } finally {
      setIsSubmittingVerification(false);
    }
  };

  // Check if current user has any creator page
  const hasPage = myPages.length > 0;
  // Check if any owned page is fully activated (active status)
  const isCreatorActive = myPages.some(p => p.status === 'active');

  return (
    <div className="flex-1 overflow-y-auto w-full max-w-5xl mx-auto px-4 md:px-6 py-6 space-y-6 text-left">
      
      {/* Advertising Space Banner (Responsively sized) */}
      <AdSlot slot="creators_header_top" userId={currentUser?.id} countryCode={currentUserProfile?.phone_country_code} />

      {/* Main Title Banner & Selector */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-150 pb-5">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Sparkles className="text-rose-500 fill-rose-500 animate-pulse" size={24} />
            <span>LoveRose Creators</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1 font-semibold leading-normal">
            Le premier écosystème de rencontre et de partage de contenu monétisé en Afrique Francophone !
          </p>
        </div>

        {/* Global tab toggler between Discover Pages and Creator Console */}
        <div className="flex items-center space-x-1.5 bg-slate-100 p-1 rounded-xl w-full md:w-auto">
          <button
            onClick={() => { setSelectedPage(null); setActiveTab('discover'); }}
            className={`flex-1 md:flex-none px-4 py-2.5 rounded-lg text-xs font-extrabold flex items-center justify-center gap-1.5 transition cursor-pointer ${
              activeTab === 'discover' && !selectedPage ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Compass size={14} />
            <span>Découvrir les Pages</span>
          </button>
          
          <button
            onClick={() => { setSelectedPage(null); setActiveTab('creator_hub'); }}
            className={`flex-1 md:flex-none px-4 py-2.5 rounded-lg text-xs font-extrabold flex items-center justify-center gap-1.5 transition cursor-pointer ${
              activeTab === 'creator_hub' && !selectedPage ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Zap size={14} className="text-amber-500 fill-amber-400" />
            <span>Espace Créateur</span>
          </button>
        </div>
      </div>

      {/* DISCOVER TAB: LIST PUBLIC CREATOR PAGES */}
      {activeTab === 'discover' && !selectedPage && (
        <div className="space-y-6">
          {isLoading ? (
            <div className="flex justify-center items-center py-20">
              <Loader2 className="animate-spin text-rose-500" size={32} />
            </div>
          ) : creatorPages.length === 0 ? (
            <div className="bg-white border border-slate-150 rounded-3xl p-12 text-center max-w-lg mx-auto space-y-4 shadow-sm">
              <div className="mx-auto w-12 h-12 bg-rose-50 text-rose-500 rounded-full flex items-center justify-center">
                <Compass size={24} />
              </div>
              <div className="space-y-1.5">
                <h3 className="font-extrabold text-slate-900 text-sm">Aucun créateur actif pour le moment</h3>
                <p className="text-xs text-slate-400 leading-normal">
                  Soyez le tout premier membre à lancer votre page sur LoveRose et à commencer à monétiser votre communauté !
                </p>
              </div>
              <button
                onClick={() => setActiveTab('creator_hub')}
                className="px-6 py-3 bg-rose-500 hover:bg-rose-600 text-white font-extrabold text-xs rounded-xl shadow-md transition cursor-pointer inline-flex items-center gap-1.5"
              >
                <span>Créer ma Page maintenant</span>
                <ArrowRight size={12} />
              </button>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-6">
              {creatorPages.map((page) => (
                <div 
                  key={page.id}
                  className="bg-white border border-slate-150 rounded-3xl overflow-hidden hover:shadow-md transition flex flex-col justify-between"
                >
                  <div>
                    {/* Page Banner banner_url */}
                    <div className="h-28 relative bg-slate-100">
                      <img 
                        src={page.banner_url || "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=500&q=80"} 
                        alt="" 
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                      <div className="absolute top-2 right-2 bg-slate-900/65 backdrop-blur-md px-2.5 py-1 rounded-full text-[9px] font-extrabold text-white">
                        {page.category}
                      </div>
                    </div>

                    {/* Content */}
                    <div className="p-5 space-y-4 relative -mt-8 text-left">
                      {/* Avatar */}
                      <div className="w-14 h-14 rounded-2xl overflow-hidden border-2 border-white bg-white shadow-md relative">
                        <img 
                          src={page.avatar_url} 
                          alt="" 
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      </div>

                      <div className="space-y-1">
                        <h4 className="font-black text-slate-900 text-sm flex items-center gap-1">
                          <span>{page.page_name}</span>
                          <CheckCircle className="text-rose-500 fill-rose-500" size={13} />
                        </h4>
                        <p className="text-[10px] text-slate-400 font-bold">{page.location || "Cameroun"}</p>
                        <p className="text-[11px] text-slate-500 font-medium line-clamp-3 leading-normal mt-2.5">{page.description}</p>
                      </div>

                      {/* Tag list */}
                      {page.interests && page.interests.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {page.interests.slice(0, 3).map((tag: string, i: number) => (
                            <span key={i} className="bg-slate-50 border border-slate-150 px-2 py-0.5 rounded-md text-[9px] text-slate-500 font-bold">
                              #{tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="p-5 border-t border-slate-100 flex items-center justify-between bg-slate-50/50">
                    <div>
                      <p className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider">Abonnement</p>
                      <p className="text-xs font-black text-rose-500">{page.subscription_price} FCFA/mois</p>
                    </div>
                    <button
                      onClick={() => setSelectedPage(page)}
                      className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-[10px] rounded-lg transition cursor-pointer"
                    >
                      Visiter
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* PUBLIC CREATOR PAGE DETAIL (Viewer Mode) */}
      {selectedPage && (
        <div className="space-y-6 text-left">
          {/* Back button */}
          <button
            onClick={() => setSelectedPage(null)}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition cursor-pointer flex items-center gap-1.5"
          >
            <Compass size={14} />
            <span>Retour à l'exploration</span>
          </button>

          {/* Banner cover */}
          <div className="bg-white border border-slate-150 rounded-3xl overflow-hidden shadow-xs">
            <div className="h-44 md:h-56 relative bg-slate-100">
              <img 
                src={selectedPage.banner_url} 
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
                    src={selectedPage.avatar_url} 
                    alt="" 
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                </div>
                <div className="space-y-1 pt-10 md:pt-1">
                  <h3 className="text-xl font-black text-slate-950 flex items-center gap-1.5">
                    <span>{selectedPage.page_name}</span>
                    <CheckCircle className="text-rose-500 fill-rose-500" size={18} />
                  </h3>
                  <p className="text-xs font-bold text-slate-400">{selectedPage.category} • {selectedPage.location || "Afrique Francophone"}</p>
                  <p className="text-xs text-slate-500 font-medium leading-relaxed max-w-xl mt-3">{selectedPage.description}</p>
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

                {!isSubscribed && (
                  <button
                    onClick={handlePageSubscribe}
                    disabled={isActionLoading === "subscribe"}
                    className="flex-1 md:flex-none px-5 py-3 bg-rose-500 hover:bg-rose-600 text-white font-extrabold text-xs rounded-xl shadow-md transition cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <Lock size={12} />
                    <span>S'abonner ({selectedPage.subscription_price} F)</span>
                  </button>
                )}

                {isSubscribed && (
                  <span className="bg-emerald-50 text-emerald-700 text-xs font-black px-4 py-3 rounded-xl border border-emerald-150 flex items-center gap-1.5">
                    <CheckCircle size={14} className="fill-emerald-400 text-emerald-600" />
                    <span>Abonné Actif</span>
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            
            {/* Left Column: Tips and Referral info */}
            <div className="space-y-6">
              
              {/* Send Tip Section */}
              {selectedPage.tips_enabled && (
                <div className="bg-white border border-slate-150 rounded-3xl p-5 shadow-xs space-y-4">
                  <div className="space-y-1">
                    <h4 className="font-extrabold text-slate-950 text-sm flex items-center gap-1.5">
                      <Sparkles className="text-amber-500 fill-amber-400" size={16} />
                      <span>💝 Envoyer un pourboire</span>
                    </h4>
                    <p className="text-[10px] text-slate-400 font-medium">Soutenez directement ce créateur avec un don sécurisé Money Fusion.</p>
                  </div>

                  {/* Amounts row */}
                  <div className="grid grid-cols-4 gap-1.5">
                    {["100", "500", "1000", "2000"].map((amt) => (
                      <button
                        key={amt}
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

                  <div className="space-y-3 pt-1">
                    {/* Custom input */}
                    <div className="relative">
                      <input
                        type="number"
                        placeholder="Autre montant libre"
                        value={tipAmount}
                        onChange={(e) => setTipAmount(e.target.value)}
                        className="w-full p-2.5 bg-slate-50 border border-slate-250 focus:border-rose-450 focus:bg-white focus:ring-1 focus:ring-rose-200 outline-none rounded-xl text-xs font-bold transition pr-12"
                      />
                      <span className="absolute right-3 top-3 text-[10px] text-slate-400 font-bold">FCFA</span>
                    </div>

                    <input
                      type="text"
                      placeholder="Petit mot de soutien (Optionnel)"
                      value={tipMessage}
                      onChange={(e) => setTipMessage(e.target.value)}
                      className="w-full p-2.5 bg-slate-50 border border-slate-250 focus:border-rose-450 focus:bg-white focus:ring-1 focus:ring-rose-200 outline-none rounded-xl text-xs font-bold transition"
                    />

                    <button
                      onClick={handleSendTip}
                      disabled={isActionLoading === "tip"}
                      className="w-full py-3 bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-white font-extrabold text-xs rounded-xl shadow-md flex items-center justify-center gap-1.5 transition cursor-pointer"
                    >
                      {isActionLoading === "tip" ? (
                        <Loader2 className="animate-spin" size={12} />
                      ) : (
                        <>
                          <span>Envoyer {tipAmount || 500} FCFA</span>
                          <Zap size={11} className="fill-white" />
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* Referral details */}
              <div className="bg-gradient-to-br from-purple-50 to-indigo-50 border border-purple-100 rounded-3xl p-5 shadow-xs space-y-3">
                <h4 className="font-extrabold text-indigo-950 text-sm flex items-center gap-1.5">
                  <Share2 className="text-purple-600" size={16} />
                  <span>Programme d'Affiliation</span>
                </h4>
                <p className="text-[11px] text-indigo-700 leading-normal font-medium">
                  Partagez le lien de cette page ! Gagnez des commissions automatiques de parrainage sur TOUS les achats effectués par vos affiliés à vie.
                </p>
                
                {/* Copyable referral link */}
                <div className="bg-white/80 border border-purple-100 p-2.5 rounded-xl flex items-center justify-between gap-2">
                  <span className="text-[9px] font-mono font-bold text-slate-500 truncate select-all">
                    {`https://loverose.pages.dev/page/${selectedPage.slug}?ref=${selectedPage.referral_code}`}
                  </span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(`https://loverose.pages.dev/page/${selectedPage.slug}?ref=${selectedPage.referral_code}`);
                      alert("Lien de parrainage copié !");
                    }}
                    className="text-[9px] font-black text-purple-700 hover:text-purple-800 transition bg-purple-100 px-2 py-1 rounded-md cursor-pointer"
                  >
                    Copier
                  </button>
                </div>
              </div>
            </div>

            {/* Right Column (2/3): Post feeds */}
            <div className="md:col-span-2 space-y-6">
              
              <AdSlot slot="public_page_feed" userId={currentUser?.id} countryCode={currentUserProfile?.phone_country_code} />

              <h4 className="font-extrabold text-slate-900 text-sm border-b border-slate-100 pb-2 px-1">
                Publications ({publicPosts.length})
              </h4>

              {publicPosts.length === 0 ? (
                <div className="bg-white border border-slate-150 rounded-3xl p-10 text-center text-slate-400 text-xs">
                  Aucun post publié sur cette page créateur pour l'instant.
                </div>
              ) : (
                <div className="space-y-6">
                  {publicPosts.map((post) => {
                    // Check if post is locked (is premium and current user is NOT subscribed AND has not unlocked)
                    const isLocked = post.is_premium && !isSubscribed && !unlockedPostIds.has(post.id);
                    
                    return (
                      <div key={post.id} className="bg-white border border-slate-150 rounded-3xl overflow-hidden shadow-xs">
                        
                        {/* Post Header */}
                        <div className="p-5 flex items-center space-x-3 text-xs font-semibold text-slate-500">
                          <img 
                            src={selectedPage.avatar_url} 
                            alt="" 
                            className="w-8 h-8 rounded-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                          <div>
                            <p className="font-extrabold text-slate-900">{selectedPage.page_name}</p>
                            <p className="text-[10px] text-slate-400 font-bold">{new Date(post.created_at).toLocaleDateString()}</p>
                          </div>
                        </div>

                        {/* Post Content */}
                        <div className="px-5 pb-5 space-y-4">
                          
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
                                    <Unlock size={11} />
                                    <span>Débloquer pour {post.unlock_price} F</span>
                                  </button>
                                  
                                  <button
                                    onClick={handlePageSubscribe}
                                    className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-[10px] rounded-lg transition cursor-pointer"
                                  >
                                    S'abonner ({selectedPage.subscription_price} F)
                                  </button>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className="space-y-4">
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
        </div>
      )}

      {/* CREATOR CONSOLE HUB (For Creators) */}
      {activeTab === 'creator_hub' && !selectedPage && (
        <div className="w-full">
          {myPagesLoading ? (
            <div className="flex justify-center items-center py-20">
              <Loader2 className="animate-spin text-rose-500" size={32} />
            </div>
          ) : isCreatorActive ? (
            <CreatorDashboard 
              page={selectedDashboardPage} 
              currentUser={currentUser} 
              currentUserProfile={currentUserProfile} 
              onBackToApp={() => setActiveTab('discover')} 
            />
          ) : (
            <CreatorOnboarding 
              currentUser={currentUser} 
              currentUserProfile={currentUserProfile} 
              onPageCreated={(newPage) => {
                fetchMyCreatorPages();
              }} 
              onBack={() => {
                setActiveTab('discover');
              }} 
            />
          )}
        </div>
      )}

      {/* LEGACY INLINE CREATOR CONSOLE HUB (Bypassed) */}
      {false && activeTab === 'creator_hub' && !selectedPage && (
        <div>
          {myPagesLoading ? (
            <div className="flex justify-center items-center py-20">
              <Loader2 className="animate-spin text-rose-500" size={32} />
            </div>
          ) : !isCreatorActive ? (
            /* ONBOARDING FLOW AND FORM FOR UNPAID/NEW CREATORS */
            <div className="max-w-2xl mx-auto bg-white border border-slate-150 rounded-3xl p-6 md:p-8 shadow-sm text-left space-y-6">
              
              {/* Stepper Header */}
              <div className="flex justify-between items-center border-b border-slate-100 pb-4">
                <div className="space-y-0.5">
                  <h3 className="font-extrabold text-slate-900 text-base">Devenir Créateur LoveRose</h3>
                  <p className="text-[10px] font-bold text-rose-500 uppercase tracking-wider">Étape {onboardingStep} sur 4</p>
                </div>
                {/* Visual steps bullet indicators */}
                <div className="flex space-x-1">
                  {[1, 2, 3, 4].map((s) => (
                    <div 
                      key={s} 
                      className={`h-1.5 rounded-full transition-all ${
                        onboardingStep >= s ? 'w-4 bg-rose-500' : 'w-1.5 bg-slate-200'
                      }`} 
                    />
                  ))}
                </div>
              </div>

              {/* STEP 1: BENEFITS */}
              {onboardingStep === 1 && (
                <div className="space-y-6">
                  <div className="space-y-2">
                    <h4 className="font-black text-slate-900 text-lg">Pourquoi lancer votre Page Créateur ?</h4>
                    <p className="text-xs text-slate-500 font-medium leading-relaxed">
                      LoveRose est bien plus qu'une application de rencontre. Nous offrons aux créateurs de contenu un moyen simple et ultra-sécurisé de fédérer une communauté privée et de monétiser vos partages.
                    </p>
                  </div>

                  <div className="grid gap-4 pt-2">
                    <div className="flex items-start space-x-3.5 bg-slate-50 p-4 rounded-2xl border border-slate-150/60">
                      <div className="p-2.5 bg-rose-100 rounded-xl text-rose-500">
                        <Users size={18} />
                      </div>
                      <div>
                        <h5 className="font-bold text-slate-900 text-xs">Audience Ciblée & Qualifiée</h5>
                        <p className="text-[10px] text-slate-400 leading-normal mt-0.5">Rencontrez des personnes réellement engagées, abonnées à votre univers exclusif.</p>
                      </div>
                    </div>

                    <div className="flex items-start space-x-3.5 bg-slate-50 p-4 rounded-2xl border border-slate-150/60">
                      <div className="p-2.5 bg-amber-100 rounded-xl text-amber-600">
                        <Coins size={18} />
                      </div>
                      <div>
                        <h5 className="font-bold text-slate-900 text-xs">Paiements Locaux Faciles</h5>
                        <p className="text-[10px] text-slate-400 leading-normal mt-0.5">Vos abonnés vous payent en un clic avec Orange Money, MTN MoMo, Wave ou CB (via Money Fusion).</p>
                      </div>
                    </div>

                    <div className="flex items-start space-x-3.5 bg-slate-50 p-4 rounded-2xl border border-slate-150/60">
                      <div className="p-2.5 bg-indigo-100 rounded-xl text-indigo-600">
                        <Zap size={18} />
                      </div>
                      <div>
                        <h5 className="font-bold text-slate-900 text-xs">4 Canaux de Revenus Simultanés</h5>
                        <p className="text-[10px] text-slate-400 leading-normal mt-0.5">Abonnements récurrents, pourboires libres, déblocage de posts à l'unité, et affiliation parrainage.</p>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => setOnboardingStep(2)}
                    className="w-full py-3.5 bg-rose-500 hover:bg-rose-600 text-white font-extrabold text-xs rounded-xl shadow-md flex items-center justify-center gap-1.5 transition cursor-pointer"
                  >
                    <span>Continuer vers les règles d'utilisation</span>
                    <ArrowRight size={12} />
                  </button>
                </div>
              )}

              {/* STEP 2: RULES */}
              {onboardingStep === 2 && (
                <div className="space-y-6">
                  <div className="space-y-2">
                    <h4 className="font-black text-slate-900 text-lg">Règles et Obligations d'éthique</h4>
                    <p className="text-xs text-slate-500 font-medium leading-relaxed">
                      Pour préserver la sécurité de tous nos membres et rester conforme à la législation AdSense, chaque créateur s'engage à respecter notre charte communautaire.
                    </p>
                  </div>

                  <div className="bg-rose-50/50 border border-rose-100 p-4 rounded-2xl space-y-3.5 text-xs font-semibold text-rose-900 leading-relaxed">
                    <p className="flex gap-2">🚫 Contenu pornographique, sexuellement explicite ou prostitution strictement interdit.</p>
                    <p className="flex gap-2">🚫 Propos haineux, harcèlement, insultes, intimidation et usurpation d'identité interdits.</p>
                    <p className="flex gap-2">🚫 Escroquerie, manipulation de profil ou partage de coordonnées de tiers sans accord interdits.</p>
                    <p className="flex gap-2">⚠️ Tout dossier d'identité factice lors du parcours de vérification mènera au bannissement à vie.</p>
                  </div>

                  <div className="flex space-x-3 pt-2">
                    <button
                      onClick={() => setOnboardingStep(1)}
                      className="flex-1 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-xs rounded-xl transition cursor-pointer text-center"
                    >
                      Retour
                    </button>
                    <button
                      onClick={() => setOnboardingStep(3)}
                      className="flex-[2] py-3.5 bg-rose-500 hover:bg-rose-600 text-white font-extrabold text-xs rounded-xl shadow-md flex items-center justify-center gap-1.5 transition cursor-pointer"
                    >
                      <span>J'accepte et je continue</span>
                      <ArrowRight size={12} />
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 3: MONETIZATION EXPLANATION */}
              {onboardingStep === 3 && (
                <div className="space-y-6">
                  <div className="space-y-2">
                    <h4 className="font-black text-slate-900 text-lg">Comment fonctionne la Monétisation ?</h4>
                    <p className="text-xs text-slate-500 font-medium leading-relaxed">
                      Voici les mécanismes financiers à votre disposition pour valoriser vos partages.
                    </p>
                  </div>

                  <div className="space-y-3.5">
                    <div className="flex gap-3 text-xs leading-normal">
                      <div className="font-extrabold text-rose-500">1.</div>
                      <div className="font-medium">
                        <strong className="text-slate-900">Abonnement Récurrent :</strong> Vous fixez un prix mensuel (ex: 2 500 F). Les membres payent pour déverrouiller l'accès complet à votre flux.
                      </div>
                    </div>
                    <div className="flex gap-3 text-xs leading-normal">
                      <div className="font-extrabold text-amber-500">2.</div>
                      <div className="font-medium">
                        <strong className="text-slate-900">Pourboires Libres :</strong> Les visiteurs de votre page peuvent vous envoyer des pourboires pour vous encourager, même s'ils ne sont pas abonnés.
                      </div>
                    </div>
                    <div className="flex gap-3 text-xs leading-normal">
                      <div className="font-extrabold text-indigo-500">3.</div>
                      <div className="font-medium">
                        <strong className="text-slate-900">Publications Premium :</strong> Floutez un post photo exclusif et exigez un prix fixe de déverrouillage (ex: 500 F) pour les non-abonnés.
                      </div>
                    </div>
                    <div className="flex gap-3 text-xs leading-normal">
                      <div className="font-extrabold text-purple-500">4.</div>
                      <div className="font-medium">
                        <strong className="text-slate-900">Commissions d'Affiliation :</strong> Partagez votre lien. Si un filleul effectue un paiement (premium, crédits) sur LoveRose, un pourcentage est crédité à votre cagnotte de parrainage automatiquement.
                      </div>
                    </div>
                  </div>

                  <div className="flex space-x-3 pt-2">
                    <button
                      onClick={() => setOnboardingStep(2)}
                      className="flex-1 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-xs rounded-xl transition cursor-pointer text-center"
                    >
                      Retour
                    </button>
                    <button
                      onClick={() => setOnboardingStep(4)}
                      className="flex-[2] py-3.5 bg-rose-500 hover:bg-rose-600 text-white font-extrabold text-xs rounded-xl shadow-md flex items-center justify-center gap-1.5 transition cursor-pointer"
                    >
                      <span>Créer ma Page</span>
                      <ArrowRight size={12} />
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 4: CREATE PAGE + PAY FEE */}
              {onboardingStep === 4 && (
                <form onSubmit={handleCreateDraftPage} className="space-y-6">
                  <div className="space-y-1.5">
                    <h4 className="font-black text-slate-900 text-lg">Configurez votre première Page</h4>
                    <p className="text-xs text-slate-500 font-medium">L'accès créateur est soumis à un paiement unique de <strong className="text-rose-500 font-extrabold">1 000 FCFA à vie</strong> pour activer la création illimitée de pages et de publications monétisées.</p>
                  </div>

                  <div className="space-y-4">
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div>
                        <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block">Nom de votre Page</label>
                        <input
                          type="text"
                          required
                          value={pageForm.page_name}
                          onChange={(e) => setPageForm({ ...pageForm, page_name: e.target.value })}
                          placeholder="Ex: Rose de Douala, Coach Seduction"
                          className="w-full mt-1.5 p-3 bg-slate-50 border border-slate-200 focus:border-rose-450 focus:bg-white focus:ring-1 focus:ring-rose-200 outline-none rounded-xl text-xs font-bold transition"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block">Catégorie principale</label>
                        <select
                          value={pageForm.category}
                          onChange={(e) => setPageForm({ ...pageForm, category: e.target.value })}
                          className="w-full mt-1.5 p-3 bg-slate-50 border border-slate-200 focus:border-rose-450 focus:bg-white focus:ring-1 focus:ring-rose-200 outline-none rounded-xl text-xs font-bold transition"
                        >
                          <option value="Dating & Romance">Dating & Romance</option>
                          <option value="Conseils Séduction">Conseils Séduction & Amour</option>
                          <option value="Beauté & Style">Beauté & Style</option>
                          <option value="Lifestyle">Lifestyle & Vlogs</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block">Description de la Page (Sera visible publiquement)</label>
                      <textarea
                        required
                        rows={3}
                        value={pageForm.description}
                        onChange={(e) => setPageForm({ ...pageForm, description: e.target.value })}
                        placeholder="Présentez-vous brièvement, ainsi que le type de contenu premium auquel vos abonnés auront droit..."
                        className="w-full mt-1.5 p-3 bg-slate-50 border border-slate-200 focus:border-rose-450 focus:bg-white focus:ring-1 focus:ring-rose-200 outline-none rounded-xl text-xs font-bold transition"
                      />
                    </div>

                    <div className="grid sm:grid-cols-2 gap-4">
                      <div>
                        <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block">Localisation / Ville</label>
                        <input
                          type="text"
                          value={pageForm.location}
                          onChange={(e) => setPageForm({ ...pageForm, location: e.target.value })}
                          placeholder="Ex: Douala, Abidjan, Dakar"
                          className="w-full mt-1.5 p-3 bg-slate-50 border border-slate-200 focus:border-rose-450 focus:bg-white focus:ring-1 focus:ring-rose-200 outline-none rounded-xl text-xs font-bold transition"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block">Prix d'Abonnement Mensuel (FCFA)</label>
                        <input
                          type="number"
                          required
                          value={pageForm.subscription_price}
                          onChange={(e) => setPageForm({ ...pageForm, subscription_price: e.target.value })}
                          placeholder="Ex: 2500"
                          className="w-full mt-1.5 p-3 bg-slate-50 border border-slate-200 focus:border-rose-450 focus:bg-white focus:ring-1 focus:ring-rose-200 outline-none rounded-xl text-xs font-bold transition"
                        />
                      </div>
                    </div>

                    <div className="grid sm:grid-cols-2 gap-4">
                      <div>
                        <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block">Photo de profil (URL ou Avatar)</label>
                        <input
                          type="text"
                          value={pageForm.avatar_url}
                          onChange={(e) => setPageForm({ ...pageForm, avatar_url: e.target.value })}
                          placeholder="Ex: https://..."
                          className="w-full mt-1.5 p-3 bg-slate-50 border border-slate-200 focus:border-rose-450 focus:bg-white focus:ring-1 focus:ring-rose-200 outline-none rounded-xl text-xs font-bold transition"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block">Photo de couverture bannière (URL)</label>
                        <input
                          type="text"
                          value={pageForm.banner_url}
                          onChange={(e) => setPageForm({ ...pageForm, banner_url: e.target.value })}
                          placeholder="Ex: https://..."
                          className="w-full mt-1.5 p-3 bg-slate-50 border border-slate-200 focus:border-rose-450 focus:bg-white focus:ring-1 focus:ring-rose-200 outline-none rounded-xl text-xs font-bold transition"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block">Centres d'intérêt (Séparés par des virgules)</label>
                      <input
                        type="text"
                        value={pageForm.interests}
                        onChange={(e) => setPageForm({ ...pageForm, interests: e.target.value })}
                        placeholder="Ex: vlogs, seduction, mode, conseils"
                        className="w-full mt-1.5 p-3 bg-slate-50 border border-slate-200 focus:border-rose-450 focus:bg-white focus:ring-1 focus:ring-rose-200 outline-none rounded-xl text-xs font-bold transition"
                      />
                    </div>

                    <div className="flex items-center space-x-2 bg-slate-50 p-4 border border-slate-150 rounded-2xl">
                      <input
                        type="checkbox"
                        id="tips_enabled"
                        checked={pageForm.tips_enabled}
                        onChange={(e) => setPageForm({ ...pageForm, tips_enabled: e.target.checked })}
                        className="accent-rose-500 cursor-pointer h-4 w-4"
                      />
                      <label htmlFor="tips_enabled" className="text-xs font-semibold text-slate-700 cursor-pointer">
                        Autoriser les abonnés à m'envoyer des pourboires libres
                      </label>
                    </div>
                  </div>

                  {/* Payment fee highlight */}
                  <div className="bg-amber-50/50 border border-amber-200 p-4 rounded-2xl flex items-center justify-between">
                    <div>
                      <p className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider">Frais d'Activation Unique</p>
                      <h5 className="font-black text-slate-900 text-sm">Frais d'accès créateur à vie</h5>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-black text-amber-600">1 000 FCFA</p>
                      <p className="text-[8px] text-slate-400 font-bold uppercase tracking-wider">Sécurisé Money Fusion</p>
                    </div>
                  </div>

                  <div className="flex space-x-3">
                    <button
                      type="button"
                      onClick={() => setOnboardingStep(3)}
                      className="flex-1 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-xs rounded-xl transition cursor-pointer text-center"
                    >
                      Retour
                    </button>
                    <button
                      type="submit"
                      disabled={isPayingCreator}
                      className="flex-[2] py-3.5 bg-amber-500 hover:bg-amber-600 text-white font-extrabold text-xs rounded-xl shadow-md flex items-center justify-center gap-1.5 transition cursor-pointer disabled:opacity-50"
                    >
                      {isPayingCreator ? (
                        <Loader2 className="animate-spin" size={14} />
                      ) : (
                        <>
                          <span>Créer & Payer (1 000 F)</span>
                          <CreditCard size={12} />
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}
            </div>
          ) : (
            
            /* MAIN CREATOR ACTIVE CONSOLE DASHBOARD PANEL */
            <div className="grid md:grid-cols-4 gap-6 text-left">
              
              {/* Creator Sidebar menu */}
              <div className="space-y-6">
                
                {/* Creator profile selector */}
                <div className="bg-white border border-slate-150 rounded-3xl p-5 shadow-xs text-center space-y-3">
                  <div className="w-16 h-16 rounded-2xl overflow-hidden bg-slate-100 mx-auto border border-slate-200 shadow-sm">
                    <img 
                      src={selectedDashboardPage?.avatar_url} 
                      alt="" 
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                  <div>
                    <h4 className="font-extrabold text-slate-900 text-xs flex items-center justify-center gap-1">
                      <span>{selectedDashboardPage?.page_name}</span>
                      <CheckCircle className="text-rose-500 fill-rose-500" size={12} />
                    </h4>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider mt-0.5">{selectedDashboardPage?.category}</p>
                    
                    {/* Status badge */}
                    <div className="mt-2">
                      {selectedDashboardPage?.status === 'active' ? (
                        <span className="bg-emerald-50 text-emerald-700 border border-emerald-150 text-[8px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                          Page Active
                        </span>
                      ) : (
                        <span className="bg-amber-50 text-amber-700 border border-amber-150 text-[8px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                          En cours de validation
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Multi pages drop-down if user has multiple */}
                  {myPages.length > 1 && (
                    <div className="pt-2 border-t border-slate-100">
                      <label className="text-[8px] font-black text-slate-400 uppercase tracking-wider block text-left mb-1">Changer de page</label>
                      <select
                        value={selectedDashboardPage?.id}
                        onChange={(e) => {
                          const pg = myPages.find(p => p.id === e.target.value);
                          if (pg) setSelectedDashboardPage(pg);
                        }}
                        className="w-full p-2 bg-slate-50 border border-slate-200 outline-none rounded-lg text-[10px] font-bold transition"
                      >
                        {myPages.map(p => (
                          <option key={p.id} value={p.id}>{p.page_name}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                {/* Left Side Quick Menu */}
                <div className="bg-white border border-slate-150 rounded-3xl p-2 shadow-xs space-y-1">
                  <div className="p-2 text-[9px] font-black text-slate-400 uppercase tracking-wider border-b border-slate-50">Menu Administrateur</div>
                  
                  <button
                    onClick={() => { setSelectedPage(selectedDashboardPage); }}
                    className="w-full p-2.5 hover:bg-slate-50 rounded-xl text-left text-xs font-bold text-slate-700 flex items-center justify-between transition cursor-pointer"
                  >
                    <span className="flex items-center gap-2">
                      <Eye size={13} className="text-slate-400" />
                      <span>Visualiser ma page publique</span>
                    </span>
                    <ChevronRight size={12} className="text-slate-400" />
                  </button>

                  <button
                    onClick={() => setIsEditingSettings(!isEditingSettings)}
                    className={`w-full p-2.5 rounded-xl text-left text-xs font-bold flex items-center justify-between transition cursor-pointer ${
                      isEditingSettings ? "bg-slate-900 text-white" : "hover:bg-slate-50 text-slate-700"
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <SettingsIcon size={13} className={isEditingSettings ? "text-white" : "text-slate-400"} />
                      <span>Paramètres de Page</span>
                    </span>
                    <ChevronRight size={12} className={isEditingSettings ? "text-white" : "text-slate-400"} />
                  </button>
                </div>
              </div>

              {/* Main Console Center Column (3/4 grid size) */}
              <div className="md:col-span-3 space-y-6">
                
                {/* 1. EDIT SETTINGS MODAL/VIEW INTERFACE */}
                {isEditingSettings && editPageForm && (
                  <form onSubmit={handleSavePageSettings} className="bg-white border border-slate-150 rounded-3xl p-6 shadow-sm space-y-5">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                      <h4 className="font-extrabold text-slate-900 text-sm">Paramètres et informations de Page</h4>
                      <button 
                        type="button" 
                        onClick={() => setIsEditingSettings(false)}
                        className="text-[10px] font-black text-slate-400 hover:text-slate-600 uppercase tracking-wider cursor-pointer"
                      >
                        Annuler
                      </button>
                    </div>

                    <div className="grid sm:grid-cols-2 gap-4">
                      <div>
                        <label className="text-[9px] font-extrabold text-slate-500 uppercase tracking-wider block">Nom de votre Page</label>
                        <input
                          type="text"
                          required
                          value={editPageForm.page_name}
                          onChange={(e) => setEditPageForm({ ...editPageForm, page_name: e.target.value })}
                          className="w-full mt-1.5 p-2.5 bg-slate-50 border border-slate-200 outline-none rounded-xl text-xs font-bold transition"
                        />
                      </div>
                      <div>
                        <label className="text-[9px] font-extrabold text-slate-500 uppercase tracking-wider block">Prix Abonnement Mensuel (FCFA)</label>
                        <input
                          type="number"
                          required
                          value={editPageForm.subscription_price}
                          onChange={(e) => setEditPageForm({ ...editPageForm, subscription_price: e.target.value })}
                          className="w-full mt-1.5 p-2.5 bg-slate-50 border border-slate-200 outline-none rounded-xl text-xs font-bold transition"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-[9px] font-extrabold text-slate-500 uppercase tracking-wider block">Description de la Page</label>
                      <textarea
                        required
                        rows={3}
                        value={editPageForm.description}
                        onChange={(e) => setEditPageForm({ ...editPageForm, description: e.target.value })}
                        className="w-full mt-1.5 p-2.5 bg-slate-50 border border-slate-200 outline-none rounded-xl text-xs font-bold transition"
                      />
                    </div>

                    <div className="grid sm:grid-cols-2 gap-4">
                      <div>
                        <label className="text-[9px] font-extrabold text-slate-500 uppercase tracking-wider block">URL Avatar</label>
                        <input
                          type="text"
                          value={editPageForm.avatar_url}
                          onChange={(e) => setEditPageForm({ ...editPageForm, avatar_url: e.target.value })}
                          className="w-full mt-1.5 p-2.5 bg-slate-50 border border-slate-200 outline-none rounded-xl text-xs font-bold transition"
                        />
                      </div>
                      <div>
                        <label className="text-[9px] font-extrabold text-slate-500 uppercase tracking-wider block">URL Couverture Bannière</label>
                        <input
                          type="text"
                          value={editPageForm.banner_url}
                          onChange={(e) => setEditPageForm({ ...editPageForm, banner_url: e.target.value })}
                          className="w-full mt-1.5 p-2.5 bg-slate-50 border border-slate-200 outline-none rounded-xl text-xs font-bold transition"
                        />
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="edit_tips"
                        checked={editPageForm.tips_enabled}
                        onChange={(e) => setEditPageForm({ ...editPageForm, tips_enabled: e.target.checked })}
                        className="accent-rose-500 cursor-pointer h-4 w-4"
                      />
                      <label htmlFor="edit_tips" className="text-xs font-semibold text-slate-700 cursor-pointer">
                        Autoriser les pourboires
                      </label>
                    </div>

                    <button
                      type="submit"
                      disabled={isActionLoading === "save_settings"}
                      className="w-full py-3 bg-rose-500 hover:bg-rose-600 text-white font-extrabold text-xs rounded-xl shadow-md flex items-center justify-center gap-1.5 transition cursor-pointer"
                    >
                      {isActionLoading === "save_settings" ? (
                        <Loader2 className="animate-spin" size={12} />
                      ) : (
                        <span>Enregistrer les modifications</span>
                      )}
                    </button>
                  </form>
                )}

                {/* 2. WALLET BALANCE & REVENUE SUMMARY */}
                {wallet && (
                  <div className="bg-slate-900 text-white rounded-3xl p-6 shadow-sm grid sm:grid-cols-3 gap-6 border border-slate-800">
                    <div>
                      <p className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider">Solde Disponible</p>
                      <h4 className="text-3xl font-black text-amber-300 mt-1">{wallet.available_balance} F</h4>
                      <p className="text-[9px] text-slate-400 mt-1 leading-normal font-medium">Revenus prêts à être versés sur votre compte Money Fusion.</p>
                    </div>
                    
                    <div className="border-t sm:border-t-0 sm:border-l border-white/10 pt-4 sm:pt-0 sm:pl-6">
                      <p className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider font-semibold">Revenus Déjà Retirés</p>
                      <h4 className="text-2xl font-black text-slate-100 mt-1">{wallet.claimed_earnings} F</h4>
                      <p className="text-[9px] text-slate-400 mt-1 leading-normal font-medium">Revenus cumulés qui ont déjà été transférés avec succès.</p>
                    </div>

                    <div className="border-t sm:border-t-0 sm:border-l border-white/10 pt-4 sm:pt-0 sm:pl-6">
                      <p className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider font-semibold">Revenus Totaux Générés</p>
                      <h4 className="text-2xl font-black text-rose-400 mt-1">{wallet.total_earnings} F</h4>
                      <p className="text-[9px] text-slate-400 mt-1 leading-normal font-medium">L'intégralité des revenus cumulés sur cette page créateur.</p>
                    </div>
                  </div>
                )}

                {/* 3. METRICS / STATS BENTO BOARD */}
                {stats && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div className="bg-white border border-slate-150 rounded-2xl p-4 shadow-xs text-left">
                      <p className="text-[8px] font-black text-slate-400 uppercase tracking-wider">Followers</p>
                      <h4 className="text-xl font-black text-slate-900 mt-1">{stats.followers_count || 0}</h4>
                      <p className="text-[8px] text-slate-400 font-medium">Membres abonnés gratuitement</p>
                    </div>

                    <div className="bg-white border border-slate-150 rounded-2xl p-4 shadow-xs text-left">
                      <p className="text-[8px] font-black text-slate-400 uppercase tracking-wider">Abonnés VIP</p>
                      <h4 className="text-xl font-black text-rose-500 mt-1">{stats.subscribers_count || 0}</h4>
                      <p className="text-[8px] text-slate-400 font-medium">Abonnés payants actifs</p>
                    </div>

                    <div className="bg-white border border-slate-150 rounded-2xl p-4 shadow-xs text-left">
                      <p className="text-[8px] font-black text-slate-400 uppercase tracking-wider">Publications</p>
                      <h4 className="text-xl font-black text-indigo-500 mt-1">{stats.posts_count || 0}</h4>
                      <p className="text-[8px] text-slate-400 font-medium">Contenus partagés</p>
                    </div>

                    <div className="bg-white border border-slate-150 rounded-2xl p-4 shadow-xs text-left">
                      <p className="text-[8px] font-black text-slate-400 uppercase tracking-wider">Affiliés</p>
                      <h4 className="text-xl font-black text-purple-500 mt-1">{stats.referrals_count || 0}</h4>
                      <p className="text-[8px] text-slate-400 font-medium">Filleuls parrainés enregistrés</p>
                    </div>
                  </div>
                )}

                {/* 4. CHANNELS TAB: CASHOUT / PAYOUTS */}
                <div className="bg-white border border-slate-150 rounded-3xl p-6 shadow-sm space-y-4">
                  <div className="space-y-1">
                    <h4 className="font-extrabold text-slate-950 text-sm flex items-center gap-1.5">
                      <ArrowDownCircle className="text-rose-500" size={16} />
                      <span>Demander un Payout (Reversement)</span>
                    </h4>
                    <p className="text-xs text-slate-500 font-medium">Bénéficiez d'un virement rapide de vos gains de LoveRose vers votre compte Mobile Money / Money Fusion.</p>
                  </div>

                  <form onSubmit={handleRequestPayout} className="grid sm:grid-cols-3 gap-4 items-end bg-slate-50 p-4 border border-slate-150/60 rounded-2xl">
                    <div>
                      <label className="text-[9px] font-extrabold text-slate-500 uppercase tracking-wider block">Montant à retirer (FCFA)</label>
                      <input
                        type="number"
                        required
                        placeholder="Ex: 5000"
                        value={payoutAmount}
                        onChange={(e) => setPayoutAmount(e.target.value)}
                        className="w-full mt-1.5 p-2.5 bg-white border border-slate-250 focus:border-rose-450 outline-none rounded-xl text-xs font-bold transition"
                      />
                    </div>
                    <div>
                      <label className="text-[9px] font-extrabold text-slate-500 uppercase tracking-wider block">Numéro de téléphone reversement</label>
                      <input
                        type="text"
                        required
                        placeholder="Ex: 06223344"
                        value={payoutPhone}
                        onChange={(e) => setPayoutPhone(e.target.value)}
                        className="w-full mt-1.5 p-2.5 bg-white border border-slate-250 focus:border-rose-450 outline-none rounded-xl text-xs font-bold transition"
                      />
                    </div>
                    
                    <button
                      type="submit"
                      disabled={isSubmittingPayout || !payoutAmount || parseInt(payoutAmount) <= 0}
                      className="w-full py-2.5 bg-rose-500 hover:bg-rose-600 disabled:opacity-40 text-white font-extrabold text-xs rounded-xl shadow-md flex items-center justify-center gap-1.5 transition cursor-pointer"
                    >
                      {isSubmittingPayout ? (
                        <Loader2 className="animate-spin" size={12} />
                      ) : (
                        <>
                          <span>Demander le virement</span>
                          <CheckCircle size={12} />
                        </>
                      )}
                    </button>
                  </form>

                  {/* Payout requests list table */}
                  {payouts.length > 0 && (
                    <div className="pt-3">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-2">Historique des versements</p>
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs text-left">
                          <thead>
                            <tr className="border-b border-slate-100 text-slate-400 font-bold">
                              <th className="py-2">Date</th>
                              <th className="py-2">Montant</th>
                              <th className="py-2">Numéro</th>
                              <th className="py-2">Statut</th>
                            </tr>
                          </thead>
                          <tbody>
                            {payouts.map((p) => (
                              <tr key={p.id} className="border-b border-slate-50 text-slate-600">
                                <td className="py-2">{new Date(p.created_at).toLocaleDateString()}</td>
                                <td className="py-2 font-extrabold text-rose-500">{p.amount} {p.currency || 'XAF'}</td>
                                <td className="py-2">{p.phone}</td>
                                <td className="py-2">
                                  {p.status === 'approved' && (
                                    <span className="bg-emerald-50 text-emerald-700 text-[9px] font-black px-2 py-0.5 rounded-md border border-emerald-100">Payé</span>
                                  )}
                                  {p.status === 'pending' && (
                                    <span className="bg-amber-50 text-amber-700 text-[9px] font-black px-2 py-0.5 rounded-md border border-amber-100">En cours</span>
                                  )}
                                  {p.status === 'rejected' && (
                                    <span className="bg-rose-50 text-rose-700 text-[9px] font-black px-2 py-0.5 rounded-md border border-rose-100">Rejeté</span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>

                {/* 5. PUBLISH NEW POST EDITOR TAB */}
                <div className="bg-white border border-slate-150 rounded-3xl p-6 shadow-sm space-y-4">
                  <div className="space-y-1">
                    <h4 className="font-extrabold text-slate-950 text-sm flex items-center gap-1.5">
                      <Newspaper className="text-indigo-500" size={16} />
                      <span>Publier sur votre Page</span>
                    </h4>
                    <p className="text-xs text-slate-500 font-medium">Partagez des histoires, des photos ou des actualités. Configurez des verrouillages premium pour générer des revenus.</p>
                  </div>

                  <form onSubmit={handlePostPublish} className="space-y-4">
                    <textarea
                      required
                      rows={3}
                      value={newPostContent}
                      onChange={(e) => setNewPostContent(e.target.value)}
                      placeholder="Quoi de neuf aujourd'hui ?"
                      className="w-full p-3 bg-slate-50 border border-slate-200 focus:border-rose-450 focus:bg-white outline-none rounded-xl text-xs font-semibold transition"
                    />

                    <div className="grid sm:grid-cols-2 gap-4">
                      {/* Image URL input */}
                      <div>
                        <label className="text-[9px] font-extrabold text-slate-500 uppercase tracking-wider block">URL de l'image (Optionnel)</label>
                        <input
                          type="text"
                          value={newPostImage}
                          onChange={(e) => setNewPostImage(e.target.value)}
                          placeholder="Ex: https://images.unsplash.com/..."
                          className="w-full mt-1.5 p-2.5 bg-slate-50 border border-slate-200 outline-none rounded-xl text-xs font-bold transition"
                        />
                      </div>

                      {/* Premium config */}
                      <div className="space-y-2">
                        <div className="flex items-center space-x-2 pt-2.5">
                          <input
                            type="checkbox"
                            id="is_premium_post"
                            checked={newPostIsPremium}
                            onChange={(e) => setNewPostIsPremium(e.target.checked)}
                            className="accent-rose-500 cursor-pointer h-4 w-4"
                          />
                          <label htmlFor="is_premium_post" className="text-xs font-semibold text-slate-700 cursor-pointer flex items-center gap-1">
                            <Lock size={12} className="text-amber-500" />
                            <span>Rendre cette publication Premium</span>
                          </label>
                        </div>

                        {newPostIsPremium && (
                          <div className="relative max-w-44">
                            <input
                              type="number"
                              placeholder="Prix de déblocage"
                              value={newPostUnlockPrice}
                              onChange={(e) => setNewPostUnlockPrice(e.target.value)}
                              className="w-full p-2 bg-slate-50 border border-slate-250 outline-none rounded-lg text-xs font-bold pr-12"
                            />
                            <span className="absolute right-2 top-2 text-[8px] font-bold text-slate-400">FCFA</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={isPublishingPost || !newPostContent}
                      className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs rounded-xl shadow-md flex items-center justify-center gap-1.5 transition cursor-pointer"
                    >
                      {isPublishingPost ? (
                        <Loader2 className="animate-spin" size={12} />
                      ) : (
                        <>
                          <span>Publier maintenant</span>
                          <ArrowRight size={11} />
                        </>
                      )}
                    </button>
                  </form>
                </div>

                {/* 6. CREATOR ID VERIFICATION TAB REQUEST */}
                <div className="bg-white border border-slate-150 rounded-3xl p-6 shadow-sm space-y-4">
                  <div className="space-y-1">
                    <h4 className="font-extrabold text-slate-950 text-sm flex items-center gap-1.5">
                      <UserCheck className="text-emerald-500" size={16} />
                      <span>Vérification d'Identité & Sécurité</span>
                    </h4>
                    <p className="text-xs text-slate-500 font-medium">Pour pouvoir débloquer la monétisation, notre équipe doit vérifier vos pièces d'identité afin de garantir la sécurité de la communauté.</p>
                  </div>

                  {verificationStatus === "approved" ? (
                    <div className="bg-emerald-50 border border-emerald-150 p-5 rounded-2xl flex items-start space-x-3 text-emerald-800 text-xs font-semibold leading-relaxed">
                      <CheckCircle className="text-emerald-600 fill-emerald-100 flex-shrink-0" size={20} />
                      <div>
                        <h5 className="font-bold text-slate-900 text-sm">Identité Vérifiée !</h5>
                        <p className="text-[11px] text-slate-500 mt-0.5">Votre compte créateur est approuvé de manière permanente. Vous apparaissez comme officiel dans l'application.</p>
                      </div>
                    </div>
                  ) : verificationStatus === "pending" ? (
                    <div className="bg-amber-50 border border-amber-150 p-5 rounded-2xl flex items-start space-x-3 text-amber-800 text-xs font-semibold leading-relaxed">
                      <Loader2 className="text-amber-600 animate-spin flex-shrink-0" size={20} />
                      <div>
                        <h5 className="font-bold text-slate-900 text-sm">Vérification en cours...</h5>
                        <p className="text-[11px] text-slate-500 mt-0.5">Vos documents d'identité sont actuellement en cours d'examen par notre équipe de modération. Temps d'attente estimé : moins de 24 heures.</p>
                      </div>
                    </div>
                  ) : (
                    <form onSubmit={handleVerificationSubmit} className="space-y-4 bg-slate-50 p-4 border border-slate-150/60 rounded-2xl">
                      <div className="grid sm:grid-cols-2 gap-4">
                        <div>
                          <label className="text-[9px] font-extrabold text-slate-500 uppercase tracking-wider block">Nom complet (Tel que sur la carte d'identité)</label>
                          <input
                            type="text"
                            required
                            value={verificationForm.fullName}
                            onChange={(e) => setVerificationForm({ ...verificationForm, fullName: e.target.value })}
                            placeholder="Ex: Jean Paul Ngueme"
                            className="w-full mt-1.5 p-2.5 bg-white border border-slate-250 focus:border-rose-450 outline-none rounded-xl text-xs font-bold transition"
                          />
                        </div>
                        <div>
                          <label className="text-[9px] font-extrabold text-slate-500 uppercase tracking-wider block">Numéro de pièce d'identité (CNI / Passeport)</label>
                          <input
                            type="text"
                            required
                            value={verificationForm.idNumber}
                            onChange={(e) => setVerificationForm({ ...verificationForm, idNumber: e.target.value })}
                            placeholder="Ex: 100223344"
                            className="w-full mt-1.5 p-2.5 bg-white border border-slate-250 focus:border-rose-450 outline-none rounded-xl text-xs font-bold transition"
                          />
                        </div>
                      </div>

                      <div className="grid sm:grid-cols-3 gap-4">
                        <div>
                          <label className="text-[9px] font-extrabold text-slate-500 uppercase tracking-wider block">Numéro Money Fusion lié</label>
                          <input
                            type="text"
                            required
                            value={verificationForm.moneyFusionPhone}
                            onChange={(e) => setVerificationForm({ ...verificationForm, moneyFusionPhone: e.target.value })}
                            className="w-full mt-1.5 p-2.5 bg-white border border-slate-250 focus:border-rose-450 outline-none rounded-xl text-xs font-bold transition"
                          />
                        </div>
                        <div>
                          <label className="text-[9px] font-extrabold text-slate-500 uppercase tracking-wider block">Pays</label>
                          <select
                            value={verificationForm.countryIso}
                            onChange={(e) => setVerificationForm({ ...verificationForm, countryIso: e.target.value })}
                            className="w-full mt-1.5 p-2.5 bg-white border border-slate-250 focus:border-rose-450 outline-none rounded-xl text-xs font-bold transition"
                          >
                            <option value="CM">Cameroun (XAF)</option>
                            <option value="CI">Côte d'Ivoire (XOF)</option>
                            <option value="SN">Sénégal (XOF)</option>
                            <option value="TG">Togo (XOF)</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-[9px] font-extrabold text-slate-500 uppercase tracking-wider block">Ville de résidence</label>
                          <input
                            type="text"
                            required
                            value={verificationForm.city}
                            onChange={(e) => setVerificationForm({ ...verificationForm, city: e.target.value })}
                            className="w-full mt-1.5 p-2.5 bg-white border border-slate-250 focus:border-rose-450 outline-none rounded-xl text-xs font-bold transition"
                          />
                        </div>
                      </div>

                      <div className="grid sm:grid-cols-2 gap-4">
                        <div>
                          <label className="text-[9px] font-extrabold text-slate-500 uppercase tracking-wider block">Photo Recto-Verso CNI / Passeport</label>
                          <input
                            type="file"
                            accept="image/*"
                            required
                            onChange={(e) => {
                              if (e.target.files && e.target.files[0]) setIdFile(e.target.files[0]);
                            }}
                            className="w-full mt-1.5 text-xs text-slate-500"
                          />
                        </div>
                        <div>
                          <label className="text-[9px] font-extrabold text-slate-500 uppercase tracking-wider block">Selfie tenant la pièce d'identité</label>
                          <input
                            type="file"
                            accept="image/*"
                            required
                            onChange={(e) => {
                              if (e.target.files && e.target.files[0]) setSelfieFile(e.target.files[0]);
                            }}
                            className="w-full mt-1.5 text-xs text-slate-500"
                          />
                        </div>
                      </div>

                      <button
                        type="submit"
                        disabled={isSubmittingVerification}
                        className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl shadow-md flex items-center justify-center gap-1.5 transition cursor-pointer"
                      >
                        {isSubmittingVerification ? (
                          <Loader2 className="animate-spin" size={12} />
                        ) : (
                          <>
                            <span>Soumettre mon dossier d'identité</span>
                            <UserCheck size={11} />
                          </>
                        )}
                      </button>
                    </form>
                  )}
                </div>

                {/* 7. DETAILED EARNINGS LOGS ledger */}
                {recentEarnings.length > 0 && (
                  <div className="bg-white border border-slate-150 rounded-3xl p-6 shadow-sm space-y-4">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Historique détaillé des revenus reçus</p>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs text-left">
                        <thead>
                          <tr className="border-b border-slate-100 text-slate-400 font-bold">
                            <th className="py-2">Date</th>
                            <th className="py-2">Type / Source</th>
                            <th className="py-2">Gains nets</th>
                          </tr>
                        </thead>
                        <tbody>
                          {recentEarnings.map((earn) => (
                            <tr key={earn.id} className="border-b border-slate-50 text-slate-600">
                              <td className="py-2">{new Date(earn.created_at).toLocaleDateString()}</td>
                              <td className="py-2">
                                {earn.source === 'referral_commission' && "Commission de parrainage"}
                                {earn.source === 'page_subscription' && "Abonnement VIP récurrent"}
                                {earn.source === 'tip' && "Pourboire de soutien 💝"}
                                {earn.source === 'premium_content' && "Déblocage de publication exclusive"}
                              </td>
                              <td className="py-2 font-black text-emerald-600">+{earn.amount} FCFA</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
      
      {/* Footer legal reference link banners */}
      <div className="border-t border-slate-150 pt-5 text-center flex flex-wrap gap-4 justify-center text-[10px] text-slate-400 font-black uppercase tracking-wider">
        <a href="#terms" onClick={(e) => { e.preventDefault(); alert("Consultez la charte et les CGU de LoveRose Creators en accédant aux informations légales."); }} className="hover:text-slate-600">CGU</a>
        <span>•</span>
        <a href="#privacy" onClick={(e) => { e.preventDefault(); alert("LoveRose respecte la confidentialité et crypte toutes les pièces d'identité."); }} className="hover:text-slate-600">Confidentialité</a>
        <span>•</span>
        <a href="#contact" onClick={(e) => { e.preventDefault(); alert("Pour toute question d'écosystème créateurs, écrivez à contact@loverose.com"); }} className="hover:text-slate-600">Contact d'assistance</a>
      </div>

      {/* Modern Billing Confirmation Modal for Creator Hub */}
      {showCreatorPaymentConfirm && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl p-6 border border-slate-100 space-y-6 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
                <CheckCircle className="text-rose-500 fill-rose-500/10" size={20} />
                <span>Paiement Sécurisé</span>
              </h3>
              <button 
                onClick={() => setShowCreatorPaymentConfirm(false)}
                className="text-slate-400 hover:text-slate-600 transition p-1"
              >
                <ChevronRight className="rotate-90" size={18} />
              </button>
            </div>

            <div className="bg-rose-50/50 border border-rose-100 rounded-2xl p-4 space-y-2 text-center">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Transaction</p>
              <h4 className="text-md font-extrabold text-slate-900">{creatorPaymentForm.planName}</h4>
              <p className="text-3xl font-black text-rose-500">{creatorPaymentForm.amount} FCFA</p>
            </div>

            <form onSubmit={handleCreatorPaymentSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                  Nom Complet du Client
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Jean Dupont"
                  value={creatorPaymentForm.fullName}
                  onChange={(e) => setCreatorPaymentForm(p => ({ ...p, fullName: e.target.value }))}
                  className="w-full bg-slate-50 border border-slate-200 focus:border-rose-500 focus:ring-1 focus:ring-rose-500 rounded-xl px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition font-medium"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                  Numéro de Téléphone Mobile Money
                </label>
                <input
                  type="tel"
                  required
                  placeholder="Ex: 677123456"
                  value={creatorPaymentForm.phoneNumber}
                  onChange={(e) => setCreatorPaymentForm(p => ({ ...p, phoneNumber: e.target.value }))}
                  className="w-full bg-slate-50 border border-slate-200 focus:border-rose-500 focus:ring-1 focus:ring-rose-500 rounded-xl px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition font-medium"
                />
                <span className="text-[10px] text-slate-400 block font-medium">
                  Entrez le numéro associé à votre compte de paiement (Orange, MTN, Moov, Wave, etc.)
                </span>
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowCreatorPaymentConfirm(false)}
                  className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 bg-rose-500 hover:bg-rose-600 active:bg-rose-700 text-white font-extrabold text-xs rounded-xl shadow-lg shadow-rose-500/10 flex items-center justify-center gap-1.5 transition cursor-pointer"
                >
                  <span>Payer {creatorPaymentForm.amount} FCFA</span>
                  <ArrowRight size={12} />
                </button>
              </div>
            </form>

            <p className="text-[9px] text-slate-400 text-center font-medium leading-relaxed">
              En cliquant sur "Payer", vous serez redirigé vers l'interface officielle de Money Fusion pour effectuer votre transaction en toute sécurité.
            </p>
          </div>
        </div>
      )}

    </div>
  );
}
