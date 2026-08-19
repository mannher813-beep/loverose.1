import React, { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import {
  Loader2, ShieldCheck, ShoppingBag, X,
  Eye, FileText, Heart, Star, Users, TrendingUp, ArrowDownCircle, Gauge, Wallet, ChevronRight
} from "lucide-react";
import { Profile } from "../types";

interface DashboardProps {
  currentUser: any;
  currentUserProfile: Profile | null;
  onPaymentSuccess?: () => void;
  onAuthRequired?: () => void;
}

// Formatte un montant en FCFA, sans décimales inutiles.
const formatFcfa = (n: number) => `${Math.round(n).toLocaleString("fr-FR")} FCFA`;

export default function Dashboard({ currentUser, currentUserProfile, onPaymentSuccess, onAuthRequired }: DashboardProps) {
  const [recentPayments, setRecentPayments] = useState<any[]>([]);
  const [isVerifyingRef, setIsVerifyingRef] = useState<string | null>(null);

  // ------------------------------------------------------------------
  // Dashboard : statistiques réelles de l'utilisateur
  // ------------------------------------------------------------------
  const [isStatsLoading, setIsStatsLoading] = useState<boolean>(true);
  const [postsCount, setPostsCount] = useState<number>(0);
  const [totalViews, setTotalViews] = useState<number>(0);
  const [totalInteractions, setTotalInteractions] = useState<number>(0);
  const [reviewsCount, setReviewsCount] = useState<number>(0);
  const [avgRating, setAvgRating] = useState<number>(0);
  const [followersCount, setFollowersCount] = useState<number>(0);
  const [totalRevenue, setTotalRevenue] = useState<number>(0);
  const [amountWithdrawn, setAmountWithdrawn] = useState<number>(0);
  const [amountAvailable, setAmountAvailable] = useState<number>(0); // gains disponibles (non réclamés)
  const [amountRequestPending, setAmountRequestPending] = useState<number>(0); // déjà en cours de retrait
  const [payoutRequests, setPayoutRequests] = useState<any[]>([]);

  // Withdrawal (retrait de gains d'annonces) modal state
  const [showWithdrawModal, setShowWithdrawModal] = useState<boolean>(false);
  const [operators, setOperators] = useState<any[]>([]);
  const [countries, setCountries] = useState<any[]>([]);
  const [withdrawForm, setWithdrawForm] = useState({
    amount: "",
    fullName: currentUserProfile?.full_name || "",
    phoneNumber: currentUserProfile?.phone_number || "",
    countryCode: currentUserProfile?.phone_country_code || "CM",
    operatorId: ""
  });
  const [isSubmittingWithdraw, setIsSubmittingWithdraw] = useState<boolean>(false);

  // Sync profile details if they load later
  useEffect(() => {
    if (currentUserProfile) {
      setWithdrawForm(prev => ({
        ...prev,
        fullName: prev.fullName || currentUserProfile.full_name || "",
        phoneNumber: prev.phoneNumber || currentUserProfile.phone_number || "",
        countryCode: prev.countryCode || currentUserProfile.phone_country_code || "CM"
      }));
    }
  }, [currentUserProfile]);

  useEffect(() => {
    if (!currentUser) return;
    loadAccountStatus();
    loadDashboardStats();
    fetchOperators();
    fetchCountries();
  }, [currentUser]);

  const loadAccountStatus = async () => {
    try {
      // Fetch Recent Payments
      const { data: paymentsData } = await supabase
        .from("payments")
        .select("*")
        .eq("user_id", currentUser.id)
        .order("created_at", { ascending: false })
        .limit(5);

      if (paymentsData) {
        setRecentPayments(paymentsData);
      }
    } catch (err) {
      console.error("Error loading account status:", err);
    }
  };

  // ------------------------------------------------------------------
  // Charge toutes les statistiques réelles du Dashboard.
  // Chaque bloc est isolé dans son propre try/catch : si une table venait
  // à être vide ou une requête à échouer, le reste du dashboard continue
  // de s'afficher normalement (aucune donnée fictive n'est utilisée en
  // remplacement — on affiche simplement 0).
  // ------------------------------------------------------------------
  const loadDashboardStats = async () => {
    setIsStatsLoading(true);
    try {
      // 1. Publications / annonces de l'utilisateur (+ compteurs déjà maintenus sur `posts`)
      const { data: myPosts } = await supabase
        .from("posts")
        .select("id, likes_count, comments_count, shares_count")
        .eq("author_id", currentUser.id);

      const posts = myPosts || [];
      setPostsCount(posts.length);
      setTotalInteractions(
        posts.reduce((sum, p) => sum + (p.likes_count || 0) + (p.comments_count || 0) + (p.shares_count || 0), 0)
      );

      // 2. Vues cumulées de toutes les annonces (table post_views)
      const postIds = posts.map(p => p.id);
      if (postIds.length > 0) {
        const { count: viewsCount } = await supabase
          .from("post_views")
          .select("id", { count: "exact", head: true })
          .in("post_id", postIds);
        setTotalViews(viewsCount || 0);
      } else {
        setTotalViews(0);
      }
    } catch (e) {
      console.warn("Dashboard: erreur chargement publications/vues:", e);
    }

    try {
      // 3. Étoiles reçues (avis clients sur les annonces vendues)
      const { data: reviews } = await supabase
        .from("post_reviews")
        .select("rating")
        .eq("seller_id", currentUser.id)
        .eq("is_hidden", false);

      const list = reviews || [];
      setReviewsCount(list.length);
      setAvgRating(list.length > 0 ? list.reduce((s, r) => s + (r.rating || 0), 0) / list.length : 0);
    } catch (e) {
      console.warn("Dashboard: erreur chargement avis:", e);
    }

    try {
      // 4. Followers / abonnés du profil
      const { count: followers } = await supabase
        .from("profile_followers")
        .select("follower_id", { count: "exact", head: true })
        .eq("followed_id", currentUser.id);
      setFollowersCount(followers || 0);
    } catch (e) {
      // Table éventuellement pas encore déployée sur cet environnement : dégrade proprement.
      setFollowersCount(0);
    }

    try {
      // 5. Revenus générés sur les annonces payantes (listing_earnings)
      const { data: earnings } = await supabase
        .from("listing_earnings")
        .select("gross_amount, commission_amount, status")
        .eq("seller_id", currentUser.id);

      const list = earnings || [];
      setTotalRevenue(list.reduce((s, e) => s + (e.gross_amount || 0), 0));
      setAmountAvailable(
        list.filter(e => e.status === "available").reduce((s, e) => s + Number(e.commission_amount || 0), 0)
      );
    } catch (e) {
      console.warn("Dashboard: erreur chargement revenus:", e);
    }

    try {
      // 6. Demandes de retrait (montant déjà retiré + montant en cours de traitement)
      const { data: requests } = await supabase
        .from("listing_payout_requests")
        .select("*")
        .eq("seller_id", currentUser.id)
        .order("created_at", { ascending: false });

      const list = requests || [];
      setPayoutRequests(list);
      setAmountWithdrawn(
        list.filter(r => r.status === "completed").reduce((s, r) => s + Number(r.requested_amount || 0), 0)
      );
      setAmountRequestPending(
        list.filter(r => r.status === "pending" || r.status === "processing").reduce((s, r) => s + Number(r.requested_amount || 0), 0)
      );
    } catch (e) {
      console.warn("Dashboard: erreur chargement retraits:", e);
    }

    setIsStatsLoading(false);
  };

  const fetchOperators = async () => {
    try {
      const { data } = await supabase.from("mobile_money_operators").select("*");
      if (data && data.length > 0) {
        setOperators(data);
        setWithdrawForm(p => ({ ...p, operatorId: p.operatorId || data[0].id }));
      }
    } catch (e) {
      console.warn("Opérateurs mobile money indisponibles:", e);
    }
  };

  const fetchCountries = async () => {
    try {
      const { data } = await supabase.from("country_codes").select("iso_code, name_fr, flag_emoji").order("name_fr");
      setCountries(data || []);
    } catch (e) {
      console.warn("Liste des pays indisponible:", e);
    }
  };

  const handleVerifyPayment = async (ref: string) => {
    setIsVerifyingRef(ref);
    try {
      // Force une re-vérification réelle auprès de Money Fusion via la fonction edge Supabase
      // (le serveur Express n'existe pas en prod sur Cloudflare Pages)
      const { data, error } = await supabase.functions.invoke("moneyfusion-webhook", {
        body: { tokenPay: ref },
      });
      if (error) throw error;

      if (data?.statut === "success" || data?.already) {
        alert("Félicitations ! Votre paiement a été confirmé et votre compte a été crédité !");
        await loadAccountStatus();
        if (onPaymentSuccess) {
          onPaymentSuccess();
        }
      } else {
        alert("Le paiement est toujours indiqué en attente chez Money Fusion. Si vous avez déjà effectué le paiement, veuillez patienter une minute puis cliquer à nouveau sur 'Vérifier'.");
      }
    } catch (err) {
      console.error("Error verifying payment:", err);
      alert("Erreur de connexion avec le serveur.");
    } finally {
      setIsVerifyingRef(null);
    }
  };

  const withdrawableNow = Math.max(0, amountAvailable - amountRequestPending);

  const handleOpenWithdraw = () => {
    if (!currentUser) {
      if (onAuthRequired) onAuthRequired();
      return;
    }
    if (withdrawableNow < 1000) {
      alert("Le montant minimum pour une demande de retrait est de 1000 FCFA. Continuez à vendre des annonces pour augmenter votre solde disponible !");
      return;
    }
    setWithdrawForm(p => ({ ...p, amount: String(withdrawableNow) }));
    setShowWithdrawModal(true);
  };

  const handleRequestWithdrawSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = parseInt(withdrawForm.amount, 10);

    if (!amountNum || amountNum < 1000) {
      alert("Le montant minimum de retrait est de 1000 FCFA.");
      return;
    }
    if (amountNum > withdrawableNow) {
      alert(`Vous ne pouvez pas retirer plus que votre solde disponible (${formatFcfa(withdrawableNow)}).`);
      return;
    }
    if (!withdrawForm.fullName.trim() || !withdrawForm.phoneNumber.trim()) {
      alert("Veuillez renseigner votre nom complet et votre numéro de téléphone.");
      return;
    }

    setIsSubmittingWithdraw(true);
    try {
      const { error } = await supabase.from("listing_payout_requests").insert([
        {
          seller_id: currentUser.id,
          requested_amount: amountNum,
          currency: "XAF",
          payout_phone_number: withdrawForm.phoneNumber,
          payout_country_code: withdrawForm.countryCode,
          payout_full_name: withdrawForm.fullName,
          operator_id: withdrawForm.operatorId || null
        }
      ]);
      if (error) throw error;

      alert("✅ Votre demande de retrait a bien été enregistrée. Elle sera traitée manuellement par notre équipe sous peu.");
      setShowWithdrawModal(false);
      await loadDashboardStats();
    } catch (err: any) {
      console.error("Error requesting withdrawal:", err);
      alert("Impossible d'enregistrer la demande de retrait : " + (err.message || "Veuillez réessayer."));
    } finally {
      setIsSubmittingWithdraw(false);
    }
  };

  // Taux d'engagement réel = interactions reçues / vues reçues sur les annonces.
  // C'est une donnée dérivée honnête (pas de note inventée) : 0 tant qu'il n'y a pas de vues.
  const engagementRate = totalViews > 0 ? Math.min(100, Math.round((totalInteractions / totalViews) * 100)) : 0;
  const performanceLabel = postsCount === 0
    ? "Publiez votre première annonce"
    : totalViews === 0
      ? "En attente de vues"
      : engagementRate >= 15
        ? "Excellente"
        : engagementRate >= 5
          ? "Bonne"
          : "À développer";

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50">
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-4 md:px-8 pt-6 pb-5 flex items-end justify-between gap-4">
          <div>
            <span className="u-kicker text-rose-600">Votre activité</span>
            <h1 className="u-display text-3xl sm:text-4xl text-slate-950 mt-1.5">
              Tableau de bord
            </h1>
          </div>
          {isStatsLoading && <Loader2 className="animate-spin text-slate-300 mb-2" size={20} />}
        </div>
      </div>

      <div className="p-4 md:p-8 space-y-8 font-sans">
      {/* ================= DASHBOARD : vue d'ensemble ================= */}
      <div className="max-w-5xl mx-auto space-y-4">

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <StatCard icon={<FileText size={16} />} label="Publications" value={postsCount.toLocaleString("fr-FR")} accent="text-slate-700 bg-slate-100" />
          <StatCard icon={<Eye size={16} />} label="Vues totales" value={totalViews.toLocaleString("fr-FR")} accent="text-sky-600 bg-sky-50" />
          <StatCard icon={<Heart size={16} />} label="Likes / interactions" value={totalInteractions.toLocaleString("fr-FR")} accent="text-rose-600 bg-rose-50" />
          <StatCard
            icon={<Star size={16} />}
            label="Étoiles reçues"
            value={reviewsCount > 0 ? avgRating.toFixed(1) : "—"}
            subtitle={reviewsCount > 0 ? `${reviewsCount} avis` : "Aucun avis"}
            accent="text-amber-600 bg-amber-50"
          />
          <StatCard icon={<Users size={16} />} label="Followers" value={followersCount.toLocaleString("fr-FR")} accent="text-indigo-600 bg-indigo-50" />
          <StatCard icon={<TrendingUp size={16} />} label="Revenus générés" value={formatFcfa(totalRevenue)} accent="text-emerald-600 bg-emerald-50" />
          <StatCard icon={<Wallet size={16} />} label="Montant en attente" value={formatFcfa(amountAvailable)} accent="text-orange-600 bg-orange-50" />
          <StatCard icon={<ArrowDownCircle size={16} />} label="Déjà retiré" value={formatFcfa(amountWithdrawn)} accent="text-slate-700 bg-slate-100" />
          <StatCard icon={<Gauge size={16} />} label="Performance globale" value={postsCount > 0 && totalViews > 0 ? `${engagementRate}%` : "—"} subtitle={performanceLabel} accent="text-violet-600 bg-violet-50" />
        </div>
      </div>

      {/* ================= Revenus & retraits (annonces payantes) ================= */}
      <div className="max-w-5xl mx-auto">
        <div className="bg-white border border-slate-150 rounded-3xl p-6 md:p-8 shadow-sm space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="font-extrabold text-slate-800 text-base flex items-center gap-1.5">
                <Wallet size={17} className="text-emerald-500" />
                <span>Mes revenus d'annonces</span>
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">Gains issus de vos annonces payantes, disponibles au retrait.</p>
            </div>
            <button
              onClick={handleOpenWithdraw}
              disabled={withdrawableNow < 1000}
              className="whitespace-nowrap py-2.5 px-4 bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-sm flex items-center justify-center gap-1.5 transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ArrowDownCircle size={14} />
              <span>Demander un retrait</span>
            </button>
          </div>

          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="bg-slate-50 rounded-2xl p-3">
              <p className="text-[12px] font-bold text-slate-400 uppercase tracking-wide">Disponible</p>
              <p className="text-sm font-black text-emerald-600 mt-1">{formatFcfa(withdrawableNow)}</p>
            </div>
            <div className="bg-slate-50 rounded-2xl p-3">
              <p className="text-[12px] font-bold text-slate-400 uppercase tracking-wide">En cours</p>
              <p className="text-sm font-black text-orange-500 mt-1">{formatFcfa(amountRequestPending)}</p>
            </div>
            <div className="bg-slate-50 rounded-2xl p-3">
              <p className="text-[12px] font-bold text-slate-400 uppercase tracking-wide">Retiré</p>
              <p className="text-sm font-black text-slate-700 mt-1">{formatFcfa(amountWithdrawn)}</p>
            </div>
          </div>

          {payoutRequests.length > 0 && (
            <div className="overflow-x-auto pt-1">
              <table className="w-full text-xs text-left min-w-[420px]">
                <thead>
                  <tr className="border-b border-slate-100 text-slate-400 font-bold">
                    <th className="py-2">Montant</th>
                    <th className="py-2">Date</th>
                    <th className="py-2">Statut</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {payoutRequests.slice(0, 5).map((r) => (
                    <tr key={r.id} className="text-slate-600">
                      <td className="py-2.5 font-semibold text-slate-900">{formatFcfa(r.requested_amount)}</td>
                      <td className="py-2.5">
                        {r.created_at ? new Date(r.created_at).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' }) : "—"}
                      </td>
                      <td className="py-2.5">
                        {r.status === "completed" ? (
                          <span className="bg-emerald-50 text-emerald-700 px-2.5 py-0.5 rounded-full font-bold text-[12px]">Complété</span>
                        ) : r.status === "rejected" ? (
                          <span className="bg-red-50 text-red-700 px-2.5 py-0.5 rounded-full font-bold text-[12px]">Rejeté</span>
                        ) : r.status === "processing" ? (
                          <span className="bg-sky-50 text-sky-700 px-2.5 py-0.5 rounded-full font-bold text-[12px]">En traitement</span>
                        ) : (
                          <span className="bg-amber-50 text-amber-700 px-2.5 py-0.5 rounded-full font-bold text-[12px] animate-pulse">En attente</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {postsCount === 0 && (
            <p className="text-[11px] text-slate-400 bg-slate-50 rounded-xl p-3 leading-relaxed">
              💡 Publiez une annonce payante depuis l'onglet Annonces pour commencer à générer des revenus visibles ici.
            </p>
          )}
        </div>
      </div>

      {/* Current Balance Hero Banner */}
      <div className="max-w-4xl mx-auto bg-slate-950 text-white rounded-3xl p-6 md:p-8 shadow-xl flex flex-col md:flex-row justify-between items-center gap-6 relative overflow-hidden">
        <div className="absolute top-[-20%] right-[-10%] w-60 h-60 bg-rose-500/10 rounded-full blur-3xl"></div>
        
        <div className="space-y-3 z-10 text-center md:text-left">
          <div className="flex items-center justify-center md:justify-start space-x-2">
            <span className="bg-rose-500/20 text-rose-300 border border-rose-500/20 text-[12px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full">LoveRose Dashboard</span>
          </div>
          <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight">Gérez votre activité</h2>
          <p className="text-slate-300 text-xs md:text-sm max-w-md leading-relaxed">
            Suivez vos revenus, vos statistiques et la performance de vos annonces.
          </p>
        </div>

        {/* Current status display card */}
        <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-5 w-full md:w-auto md:min-w-64 space-y-4 z-10 text-xs font-semibold text-slate-300">
          <div className="flex justify-between items-center">
            <span>Revenus générés :</span>
            <span className="font-extrabold text-emerald-400 text-sm">
              {formatFcfa(totalRevenue)}
            </span>
          </div>
          <div className="flex justify-between items-center border-t border-white/5 pt-2">
            <span>Montant disponible :</span>
            <span className="font-extrabold text-amber-400 text-sm">
              {formatFcfa(amountAvailable)}
            </span>
          </div>
        </div>
      </div>

      {/* Section paiements & retraits */}
      <div className="max-w-4xl mx-auto space-y-6">

        {/* Recent Transactions & Manual Verification Section */}
        {recentPayments.length > 0 && (
          <div className="bg-white border border-slate-150 rounded-3xl p-6 shadow-sm space-y-4">
            <div className="flex items-center space-x-2 border-b border-slate-100 pb-3">
              <ShoppingBag size={18} className="text-rose-500" />
              <div>
                <h4 className="font-extrabold text-slate-800 text-sm">
                  Suivi & vérification de vos paiements
                </h4>
                <p className="text-[12px] text-slate-400 font-medium">
                  Si un paiement mobile n'a pas crédité votre compte automatiquement, vérifiez-le ici.
                </p>
              </div>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left min-w-[500px]">
                <thead>
                  <tr className="border-b border-slate-100 text-slate-400 font-bold pb-2">
                    <th className="py-2">Produit</th>
                    <th className="py-2">Montant</th>
                    <th className="py-2">Date d'achat</th>
                    <th className="py-2">Statut</th>
                    <th className="py-2 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {recentPayments.map((pay) => (
                    <tr key={pay.id} className="text-slate-600">
                      <td className="py-3 font-semibold text-slate-900">{pay.plan_name}</td>
                      <td className="py-3">{pay.montant} FCFA</td>
                      <td className="py-3">
                        {pay.created_at ? new Date(pay.created_at).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' }) : "Indisponible"}
                      </td>
                      <td className="py-3">
                        {pay.statut === "success" ? (
                          <span className="bg-emerald-50 text-emerald-700 px-2.5 py-0.5 rounded-full font-bold text-[12px]">
                            Complété
                          </span>
                        ) : pay.statut === "failed" ? (
                          <span className="bg-red-50 text-red-700 px-2.5 py-0.5 rounded-full font-bold text-[12px]">
                            Échoué
                          </span>
                        ) : (
                          <span className="bg-amber-50 text-amber-700 px-2.5 py-0.5 rounded-full font-bold text-[12px] animate-pulse">
                            En attente
                          </span>
                        )}
                      </td>
                      <td className="py-3 text-right">
                        {pay.statut === "pending" ? (
                          <button
                            onClick={() => handleVerifyPayment(pay.reference)}
                            disabled={isVerifyingRef === pay.reference}
                            className="bg-rose-500 hover:bg-rose-600 text-white font-bold text-[12px] px-3 py-1.5 rounded-lg transition disabled:opacity-50 cursor-pointer shadow-sm"
                          >
                            {isVerifyingRef === pay.reference ? "Vérification..." : "Vérifier le statut"}
                          </button>
                        ) : (
                          <span className="text-[12px] text-slate-400 font-semibold">Aucune action requise</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Security / money fusion guarantees */}
        <div className="bg-slate-100 border border-slate-150 rounded-2xl p-4 flex items-center space-x-3 text-slate-500 text-xs font-semibold">
          <ShieldCheck size={20} className="text-emerald-500" />
          <p className="leading-relaxed">
            Paiements 100% sécurisés par cryptage SSL de bout en bout et gérés directement via la passerelle Mobile Money africaine <strong className="text-slate-700">Money Fusion</strong>. Aucune donnée bancaire n'est conservée.
          </p>
        </div>

      </div>

      {/* Withdrawal request modal (retrait des gains d'annonces) */}
      {showWithdrawModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl p-6 border border-slate-100 space-y-5 animate-in fade-in zoom-in-95 duration-200 my-8">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
                <ArrowDownCircle className="text-emerald-500" size={20} />
                <span>Demande de retrait</span>
              </h3>
              <button
                onClick={() => setShowWithdrawModal(false)}
                className="text-slate-400 hover:text-slate-600 transition p-1"
              >
                <X size={18} />
              </button>
            </div>

            <div className="bg-emerald-50/50 border border-emerald-100 rounded-2xl p-4 text-center">
              <p className="text-[12px] font-bold text-slate-400 uppercase tracking-wider">Solde disponible au retrait</p>
              <p className="text-2xl font-black text-emerald-600">{formatFcfa(withdrawableNow)}</p>
            </div>

            <form onSubmit={handleRequestWithdrawSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[12px] font-bold text-slate-500 uppercase tracking-wider block">Montant à retirer (FCFA)</label>
                <input
                  type="number"
                  required
                  min={1000}
                  max={withdrawableNow}
                  value={withdrawForm.amount}
                  onChange={(e) => setWithdrawForm(p => ({ ...p, amount: e.target.value }))}
                  className="w-full bg-slate-50 border border-slate-200 focus:border-slate-900 focus:ring-1 focus:ring-emerald-500 rounded-xl px-4 py-3 text-sm text-slate-900 outline-none transition font-bold"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[12px] font-bold text-slate-500 uppercase tracking-wider block">Nom complet</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Jean Dupont"
                  value={withdrawForm.fullName}
                  onChange={(e) => setWithdrawForm(p => ({ ...p, fullName: e.target.value }))}
                  className="w-full bg-slate-50 border border-slate-200 focus:border-slate-900 focus:ring-1 focus:ring-emerald-500 rounded-xl px-4 py-3 text-sm text-slate-900 outline-none transition font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[12px] font-bold text-slate-500 uppercase tracking-wider block">Pays</label>
                  <select
                    value={withdrawForm.countryCode}
                    onChange={(e) => setWithdrawForm(p => ({ ...p, countryCode: e.target.value }))}
                    className="w-full bg-slate-50 border border-slate-200 focus:border-slate-900 rounded-xl px-3 py-3 text-sm text-slate-900 outline-none transition font-medium"
                  >
                    {countries.length > 0 ? countries.map(c => (
                      <option key={c.iso_code} value={c.iso_code}>{c.flag_emoji ? `${c.flag_emoji} ` : ""}{c.name_fr}</option>
                    )) : <option value="CM">Cameroun</option>}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[12px] font-bold text-slate-500 uppercase tracking-wider block">Opérateur</label>
                  <select
                    value={withdrawForm.operatorId}
                    onChange={(e) => setWithdrawForm(p => ({ ...p, operatorId: e.target.value }))}
                    className="w-full bg-slate-50 border border-slate-200 focus:border-slate-900 rounded-xl px-3 py-3 text-sm text-slate-900 outline-none transition font-medium"
                  >
                    {operators.length > 0 ? operators.map(op => (
                      <option key={op.id} value={op.id}>{op.name}</option>
                    )) : <option value="">Non renseigné</option>}
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[12px] font-bold text-slate-500 uppercase tracking-wider block">Numéro Mobile Money</label>
                <input
                  type="tel"
                  required
                  placeholder="Ex: 677123456"
                  value={withdrawForm.phoneNumber}
                  onChange={(e) => setWithdrawForm(p => ({ ...p, phoneNumber: e.target.value }))}
                  className="w-full bg-slate-50 border border-slate-200 focus:border-slate-900 focus:ring-1 focus:ring-emerald-500 rounded-xl px-4 py-3 text-sm text-slate-900 outline-none transition font-medium"
                />
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowWithdrawModal(false)}
                  className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingWithdraw}
                  className="flex-1 py-3 bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white font-extrabold text-xs rounded-xl shadow-lg shadow-emerald-500/10 flex items-center justify-center gap-1.5 transition cursor-pointer disabled:opacity-50"
                >
                  {isSubmittingWithdraw ? <Loader2 className="animate-spin" size={14} /> : <><span>Confirmer</span><ChevronRight size={12} /></>}
                </button>
              </div>
            </form>

            <p className="text-[11px] text-slate-400 text-center font-medium leading-relaxed">
              Les retraits sont traités manuellement par notre équipe sous quelques jours ouvrés.
            </p>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------
// Carte statistique du Dashboard — compacte, responsive, réutilisable.
// ------------------------------------------------------------------
function StatCard({ icon, label, value, subtitle, accent }: { icon: React.ReactNode; label: string; value: string; subtitle?: string; accent: string }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col gap-3 min-w-0">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${accent}`}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="u-display text-2xl text-slate-950 truncate leading-none">{value}</p>
        <p className="text-[12px] font-bold text-slate-500 truncate mt-1.5">{label}</p>
        {subtitle && <p className="text-[11px] text-slate-400 truncate mt-0.5">{subtitle}</p>}
      </div>
    </div>
  );
}
