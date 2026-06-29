import React, { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { Coins, CheckCircle, Sparkles, Loader2, ArrowRight, ShieldCheck, ShoppingBag, Zap, X } from "lucide-react";
import { Profile } from "../types";

interface ShopProps {
  currentUser: any;
  currentUserProfile: Profile | null;
  onPaymentSuccess?: () => void;
  isPremium?: boolean;
}

export default function Shop({ currentUser, currentUserProfile, onPaymentSuccess, isPremium = false }: ShopProps) {
  const [credits, setCredits] = useState<number>(0);
  const [isSubscribed, setIsSubscribed] = useState<boolean>(isPremium);
  const [expiryDate, setExpiryDate] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<string | null>(null);
  const [recentPayments, setRecentPayments] = useState<any[]>([]);
  const [isVerifyingRef, setIsVerifyingRef] = useState<string | null>(null);
  const [activeBoostEnd, setActiveBoostEnd] = useState<string | null>(null);
  const [isBoosting, setIsBoosting] = useState<boolean>(false);
  
  // Payment confirmation dialog state
  const [showPaymentConfirm, setShowPaymentConfirm] = useState<boolean>(false);
  const [paymentForm, setPaymentForm] = useState({
    planId: "",
    planName: "",
    amount: 0,
    phoneNumber: currentUserProfile?.phone_number || "",
    fullName: currentUserProfile?.full_name || currentUserProfile?.username || ""
  });

  // Sync profile details if they load later
  useEffect(() => {
    if (currentUserProfile) {
      setPaymentForm(prev => ({
        ...prev,
        phoneNumber: prev.phoneNumber || currentUserProfile.phone_number || "",
        fullName: prev.fullName || currentUserProfile.full_name || currentUserProfile.username || ""
      }));
    }
  }, [currentUserProfile]);

  useEffect(() => {
    if (!currentUser) return;
    loadAccountStatus();

    // Realtime credits subscriber
    const creditsSubName = `shop-credits-${currentUser.id}-${Math.random().toString(36).substring(2, 11)}`;
    const creditsSub = supabase
      .channel(creditsSubName)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "user_credits",
          filter: `user_id=eq.${currentUser.id}`
        },
        (payload) => {
          if (payload.new) {
            setCredits((payload.new as any).balance);
          }
        }
      )
      .subscribe();

    // Realtime subscriptions subscriber
    const subsSubName = `shop-subs-${currentUser.id}-${Math.random().toString(36).substring(2, 11)}`;
    const subsSub = supabase
      .channel(subsSubName)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "subscriptions",
          filter: `user_id=eq.${currentUser.id}`
        },
        () => {
          loadAccountStatus();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(creditsSub);
      supabase.removeChannel(subsSub);
    };
  }, [currentUser, isPremium]);

  const loadAccountStatus = async () => {
    try {
      // 1. Fetch Credits Balance
      const { data: creditsData } = await supabase
        .from("user_credits")
        .select("balance")
        .eq("user_id", currentUser.id)
        .single();
      
      if (creditsData) {
        setCredits(creditsData.balance);
      } else {
        setCredits(0);
      }

      // 2. Fetch Subscription Status via official RPC check
      const { data: isPremiumRpc } = await supabase.rpc('is_user_premium', { check_user_id: currentUser.id });
      const isCurrentlyPremium = !!isPremiumRpc;
      setIsSubscribed(isCurrentlyPremium);

      if (isCurrentlyPremium) {
        const { data: subData } = await supabase
          .from("subscriptions")
          .select("end_date")
          .eq("user_id", currentUser.id)
          .maybeSingle();
        if (subData?.end_date) {
          setExpiryDate(new Date(subData.end_date).toLocaleDateString([], { day: 'numeric', month: 'long', year: 'numeric' }));
        } else {
          setExpiryDate(null);
        }
      } else {
        setExpiryDate(null);
      }

      // 2.5 Fetch Active Profile Boost
      const { data: boostData } = await supabase
        .from("profile_boosts")
        .select("ends_at")
        .eq("user_id", currentUser.id)
        .gt("ends_at", new Date().toISOString())
        .order("ends_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (boostData?.ends_at) {
        setActiveBoostEnd(boostData.ends_at);
      } else {
        setActiveBoostEnd(null);
      }

      // 3. Fetch Recent Payments
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

  const handlePurchaseBoost = async () => {
    if (credits < 10) {
      alert("Vous avez besoin de 10 crédits pour activer un Boost d'une heure. Veuillez recharger votre solde de crédits !");
      return;
    }
    
    setIsBoosting(true);
    try {
      // 1. Deduct 10 credits
      const { error: deductErr } = await supabase
        .from("user_credits")
        .update({ balance: credits - 10 })
        .eq("user_id", currentUser.id);

      if (deductErr) throw deductErr;

      // 2. Insert/add boost in profile_boosts
      const startedAt = new Date();
      const endsAt = new Date(startedAt.getTime() + 60 * 60 * 1000); // 1 hour
      
      const { error: boostErr } = await supabase
        .from("profile_boosts")
        .insert([
          {
            user_id: currentUser.id,
            started_at: startedAt.toISOString(),
            ends_at: endsAt.toISOString()
          }
        ]);

      if (boostErr) throw boostErr;

      // Update state
      setCredits(prev => prev - 10);
      setActiveBoostEnd(endsAt.toISOString());
      alert("🚀 Votre profil est maintenant BOOSTÉ pour 1 heure ! Vous apparaitrez en priorité absolue dans le flux Discover des autres membres !");
    } catch (err: any) {
      console.error("Error activating boost:", err);
      alert("Impossible d'activer le boost : " + err.message);
    } finally {
      setIsBoosting(false);
    }
  };

  const handlePurchase = async (planId: string, planName: string, amount: number) => {
    setPaymentForm({
      planId,
      planName,
      amount,
      phoneNumber: currentUserProfile?.phone_number || "",
      fullName: currentUserProfile?.full_name || currentUserProfile?.username || ""
    });
    setShowPaymentConfirm(true);
  };

  const handleConfirmPaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const { planId, planName, amount, phoneNumber, fullName } = paymentForm;
    
    if (!phoneNumber.trim()) {
      alert("Veuillez renseigner votre numéro de téléphone mobile money.");
      return;
    }
    if (!fullName.trim()) {
      alert("Veuillez renseigner votre nom complet.");
      return;
    }

    setIsLoading(planId);
    setShowPaymentConfirm(false);

    try {
      // Direct call to official moneyfusion-create-payment Edge Function
      const { data, error } = await supabase.functions.invoke('moneyfusion-create-payment', {
        body: {
          plan_id: planId,
          plan_name: planName,
          montant: amount,
          phone_number: phoneNumber,
          full_name: fullName,
          related_page_id: null,
          related_post_id: null
        }
      });

      if (error) {
        throw error;
      }

      if (data?.payment_url) {
        // Redirect user directly to the official Money Fusion gateway
        window.location.href = data.payment_url;
      } else {
        throw new Error(data?.error || "Impossible d'initialiser l'URL de paiement.");
      }
    } catch (err: any) {
      console.error("Payment initiation failed:", err);
      alert("Erreur d'initialisation de paiement avec Money Fusion : " + (err.message || "Veuillez réessayer."));
    } finally {
      setIsLoading(null);
    }
  };

  const handleVerifyPayment = async (ref: string) => {
    setIsVerifyingRef(ref);
    try {
      const res = await fetch(`/api/payments/verify?reference=${ref}`);
      if (res.ok) {
        const data = await res.json();
        if (data.status === "success") {
          alert("Félicitations ! Votre paiement a été confirmé et votre compte a été crédité !");
          await loadAccountStatus();
          if (onPaymentSuccess) {
            onPaymentSuccess();
          }
        } else {
          alert("Le paiement est toujours indiqué en attente chez Money Fusion. Si vous avez déjà effectué le paiement, veuillez patienter une minute puis cliquer à nouveau sur 'Vérifier'.");
        }
      } else {
        alert("Une erreur est survenue lors de la vérification. Veuillez réessayer.");
      }
    } catch (err) {
      console.error("Error verifying payment:", err);
      alert("Erreur de connexion avec le serveur.");
    } finally {
      setIsVerifyingRef(null);
    }
  };

  const packages = [
    {
      id: "pack_bronze",
      name: "Pack Bronze",
      credits: 10,
      amount: 500,
      badge: "Idéal pour débuter",
      description: "Permet d'envoyer 10 messages supplémentaires après épuisement de vos messages gratuits."
    },
    {
      id: "pack_argent",
      name: "Pack Argent",
      credits: 50,
      amount: 2000,
      badge: "Recommandé",
      description: "Économisez 20% ! Envoyez 50 messages payants pour maintenir le contact avec tous vos matchs."
    },
    {
      id: "pack_or",
      name: "Pack Or",
      credits: 100,
      amount: 3500,
      badge: "Meilleure valeur",
      description: "Économisez 30% ! Recharge de 100 messages pour les dragueurs confirmés de la communauté."
    }
  ];

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50 p-4 md:p-8 space-y-8 font-sans">
      
      {/* Current Balance / Premium Status Hero Banner */}
      <div className="max-w-4xl mx-auto bg-gradient-to-br from-slate-900 to-indigo-950 text-white rounded-3xl p-6 md:p-8 shadow-xl flex flex-col md:flex-row justify-between items-center gap-6 relative overflow-hidden">
        <div className="absolute top-[-20%] right-[-10%] w-60 h-60 bg-rose-500/10 rounded-full blur-3xl"></div>
        
        <div className="space-y-3 z-10 text-center md:text-left">
          <div className="flex items-center justify-center md:justify-start space-x-2">
            <span className="bg-rose-500/20 text-rose-300 border border-rose-500/20 text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full">LoveRose Boutique</span>
          </div>
          <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight">Acheter des Crédits & Premium</h2>
          <p className="text-slate-300 text-xs md:text-sm max-w-md leading-relaxed">
            Profitez d'une expérience de rencontre de premier choix. Discutez en illimité et boostez la visibilité de votre profil pour attirer de nouveaux matchs.
          </p>
        </div>

        {/* Current status display card */}
        <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-5 w-full md:w-auto md:min-w-64 space-y-4 z-10 text-xs font-semibold text-slate-300">
          <div className="flex justify-between items-center border-b border-white/5 pb-2">
            <span>Solde actuel :</span>
            <span className="font-extrabold text-amber-400 text-sm flex items-center gap-1">
              <Coins size={14} className="fill-amber-400" />
              <span>{credits} crédits</span>
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span>Abonnement Premium :</span>
            {isSubscribed ? (
              <span className="text-emerald-400 font-bold bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 rounded-full text-[10px]">ACTIF</span>
            ) : (
              <span className="text-slate-400">Aucun</span>
            )}
          </div>
          {isSubscribed && expiryDate && (
            <p className="text-[10px] text-slate-400 text-right">Renouvellement le : {expiryDate}</p>
          )}
          {activeBoostEnd && (
            <div className="flex justify-between items-center border-t border-white/5 pt-2 text-[10px] text-amber-300">
              <span className="flex items-center gap-1">
                <Zap size={10} className="fill-amber-300 text-amber-400 animate-pulse" /> Boost actif :
              </span>
              <span className="font-bold">
                Jusqu'à {new Date(activeBoostEnd).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Grid containing plans & packages */}
      <div className="max-w-4xl mx-auto space-y-6">
        
        {/* Section 1: Premium Sub */}
        <div className="bg-white border border-rose-500/20 rounded-3xl p-6 md:p-8 shadow-sm relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="absolute top-0 right-0 bg-rose-500 text-white text-[10px] font-extrabold px-3 py-1 rounded-bl-xl uppercase tracking-wider flex items-center gap-1">
            <Sparkles size={10} className="fill-white" />
            <span>Meilleur Choix</span>
          </div>

          <div className="space-y-4 max-w-xl">
            <div className="space-y-1">
              <h3 className="text-xl font-extrabold text-slate-900 flex items-center gap-1.5">
                <Sparkles className="text-rose-500 fill-rose-500" size={18} />
                <span>Abonnement LoveRose Premium</span>
              </h3>
              <p className="text-xs text-slate-500">Exprimez-vous librement, sans aucune limite ni blocage de messagerie.</p>
            </div>

            <div className="grid sm:grid-cols-2 gap-3 pt-2 text-xs font-semibold text-slate-600">
              <div className="flex items-center space-x-2">
                <CheckCircle size={14} className="text-rose-500" />
                <span>Messages illimités (plus besoin de crédits)</span>
              </div>
              <div className="flex items-center space-x-2">
                <CheckCircle size={14} className="text-rose-500" />
                <span>Badge de profil Premium exclusif</span>
              </div>
              <div className="flex items-center space-x-2">
                <CheckCircle size={14} className="text-rose-500" />
                <span>Mise en vedette de votre profil</span>
              </div>
              <div className="flex items-center space-x-2">
                <CheckCircle size={14} className="text-rose-500" />
                <span>Déblocage de tous vos likes reçus</span>
              </div>
            </div>
          </div>

          <div className="flex flex-col items-center justify-center p-4 bg-rose-50/50 border border-rose-100 rounded-2xl md:min-w-56 text-center space-y-3">
            <div>
              <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">Abonnement Mensuel</p>
              <p className="text-2xl font-black text-rose-500">5 000 FCFA</p>
              <p className="text-[10px] text-slate-400">Sans engagement, résiliable à tout moment</p>
            </div>
            
            <button
              onClick={() => handlePurchase("premium_sub", "Abonnement Premium", 5000)}
              disabled={isLoading !== null || isSubscribed}
              className="w-full py-3.5 bg-rose-500 hover:bg-rose-600 active:bg-rose-700 text-white font-extrabold text-xs rounded-xl shadow-md shadow-rose-500/10 flex items-center justify-center gap-1.5 transition cursor-pointer disabled:opacity-50"
            >
              {isLoading === "premium_sub" ? (
                <Loader2 className="animate-spin" size={12} />
              ) : isSubscribed ? (
                <span>Déjà Abonné</span>
              ) : (
                <>
                  <span>S'abonner maintenant</span>
                  <ArrowRight size={12} />
                </>
              )}
            </button>
          </div>
        </div>

        {/* Section 1.5: Profile Boost */}
        <div className="bg-white border border-slate-150 rounded-3xl p-6 md:p-8 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-4 max-w-xl text-left">
            <div className="space-y-1">
              <h3 className="text-xl font-extrabold text-slate-900 flex items-center gap-1.5">
                <Zap className="text-amber-500 fill-amber-450" size={18} />
                <span>Boost de profil (1 Heure)</span>
              </h3>
              <p className="text-xs text-slate-500">Dépassez la file d'attente ! Votre profil passe en priorité absolue dans le Discover de tous les membres de votre région.</p>
            </div>
            <div className="grid sm:grid-cols-2 gap-3 pt-2 text-xs font-semibold text-slate-600">
              <p className="flex items-center gap-2">🚀 Visibilité multipliée par 10</p>
              <p className="flex items-center gap-2">💬 Plus de chances de matchs et de conversations</p>
            </div>
          </div>

          <div className="flex flex-col items-center justify-center p-4 bg-amber-50/50 border border-amber-100 rounded-2xl md:min-w-56 text-center space-y-3">
            <div>
              <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">Activer avec vos crédits</p>
              <p className="text-2xl font-black text-amber-600 flex items-center justify-center gap-1">
                <Coins size={20} className="fill-amber-400 text-amber-500" /> 10 Crédits
              </p>
              <p className="text-[10px] text-slate-400">Boost actif instantanément pendant 1 heure</p>
            </div>
            
            <button
              onClick={handlePurchaseBoost}
              disabled={isBoosting || credits < 10}
              className="w-full py-3.5 bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs rounded-xl shadow-md flex items-center justify-center gap-1.5 transition cursor-pointer disabled:opacity-40"
            >
              {isBoosting ? (
                <Loader2 className="animate-spin" size={12} />
              ) : activeBoostEnd ? (
                <span>Boost déjà actif !</span>
              ) : (
                <>
                  <span>Activer le Boost (10 cr.)</span>
                  <Zap size={11} className="fill-white" />
                </>
              )}
            </button>
          </div>
        </div>

        {/* Section 2: Credit packages */}
        <div className="space-y-4">
          <h3 className="font-extrabold text-slate-800 text-lg flex items-center space-x-1.5 px-1">
            <Coins size={18} className="fill-amber-400 text-amber-500" />
            <span>Packs de crédits d'échange</span>
          </h3>

          <div className="grid md:grid-cols-3 gap-6">
            {packages.map(p => (
              <div key={p.id} className="bg-white border border-slate-150 rounded-3xl p-5 flex flex-col justify-between space-y-5 hover:shadow-md transition">
                <div className="space-y-3">
                  {p.badge && (
                    <span className="bg-amber-50 text-amber-700 border border-amber-200 text-[9px] font-extrabold px-2 py-0.5 rounded uppercase tracking-wider">
                      {p.badge}
                    </span>
                  )}
                  <div className="space-y-1">
                    <h4 className="font-extrabold text-slate-900 text-base">{p.name}</h4>
                    <p className="text-[11px] text-slate-400 leading-relaxed">{p.description}</p>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                  <div className="flex items-center space-x-1 text-amber-500">
                    <Coins size={16} className="fill-amber-400" />
                    <span className="text-lg font-black text-slate-800">+{p.credits} cr.</span>
                  </div>
                  <div>
                    <p className="text-right text-xs font-bold text-rose-500">{p.amount} FCFA</p>
                  </div>
                </div>

                <button
                  onClick={() => handlePurchase(p.id, p.name, p.amount)}
                  disabled={isLoading !== null || isSubscribed}
                  className="w-full py-3 bg-slate-900 hover:bg-slate-800 active:bg-black text-white font-bold text-xs rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-40"
                >
                  {isLoading === p.id ? (
                    <Loader2 className="animate-spin" size={12} />
                  ) : (
                    <>
                      <ShoppingBag size={12} />
                      <span>Acheter ({p.amount} FCFA)</span>
                    </>
                  )}
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Transactions & Manual Verification Section */}
        {recentPayments.length > 0 && (
          <div className="bg-white border border-slate-150 rounded-3xl p-6 shadow-sm space-y-4">
            <div className="flex items-center space-x-2 border-b border-slate-100 pb-3">
              <ShoppingBag size={18} className="text-rose-500" />
              <div>
                <h4 className="font-extrabold text-slate-800 text-sm">
                  Suivi & vérification de vos paiements
                </h4>
                <p className="text-[10px] text-slate-400 font-medium">
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
                          <span className="bg-emerald-50 text-emerald-700 px-2.5 py-0.5 rounded-full font-bold text-[10px]">
                            Complété
                          </span>
                        ) : pay.statut === "failed" ? (
                          <span className="bg-red-50 text-red-700 px-2.5 py-0.5 rounded-full font-bold text-[10px]">
                            Échoué
                          </span>
                        ) : (
                          <span className="bg-amber-50 text-amber-700 px-2.5 py-0.5 rounded-full font-bold text-[10px] animate-pulse">
                            En attente
                          </span>
                        )}
                      </td>
                      <td className="py-3 text-right">
                        {pay.statut === "pending" ? (
                          <button
                            onClick={() => handleVerifyPayment(pay.reference)}
                            disabled={isVerifyingRef === pay.reference}
                            className="bg-rose-500 hover:bg-rose-600 text-white font-bold text-[10px] px-3 py-1.5 rounded-lg transition disabled:opacity-50 cursor-pointer shadow-sm"
                          >
                            {isVerifyingRef === pay.reference ? "Vérification..." : "Vérifier le statut"}
                          </button>
                        ) : (
                          <span className="text-[10px] text-slate-400 font-semibold">Aucune action requise</span>
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

      {/* Modern Billing Confirmation Modal */}
      {showPaymentConfirm && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl p-6 border border-slate-100 space-y-6 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
                <ShieldCheck className="text-rose-500 fill-rose-500/10" size={20} />
                <span>Paiement Sécurisé</span>
              </h3>
              <button 
                onClick={() => setShowPaymentConfirm(false)}
                className="text-slate-400 hover:text-slate-600 transition p-1"
              >
                <X size={18} />
              </button>
            </div>

            <div className="bg-rose-50/50 border border-rose-100 rounded-2xl p-4 space-y-2 text-center">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Achat sélectionné</p>
              <h4 className="text-md font-extrabold text-slate-900">{paymentForm.planName}</h4>
              <p className="text-3xl font-black text-rose-500">{paymentForm.amount} FCFA</p>
            </div>

            <form onSubmit={handleConfirmPaymentSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                  Nom Complet du Client
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Jean Dupont"
                  value={paymentForm.fullName}
                  onChange={(e) => setPaymentForm(p => ({ ...p, fullName: e.target.value }))}
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
                  value={paymentForm.phoneNumber}
                  onChange={(e) => setPaymentForm(p => ({ ...p, phoneNumber: e.target.value }))}
                  className="w-full bg-slate-50 border border-slate-200 focus:border-rose-500 focus:ring-1 focus:ring-rose-500 rounded-xl px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition font-medium"
                />
                <span className="text-[10px] text-slate-400 block font-medium">
                  Entrez le numéro associé à votre compte de paiement (Orange, MTN, Moov, Wave, etc.)
                </span>
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowPaymentConfirm(false)}
                  className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 bg-rose-500 hover:bg-rose-600 active:bg-rose-700 text-white font-extrabold text-xs rounded-xl shadow-lg shadow-rose-500/10 flex items-center justify-center gap-1.5 transition cursor-pointer"
                >
                  <span>Payer {paymentForm.amount} FCFA</span>
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
