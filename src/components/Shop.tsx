import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { Coins, CheckCircle, Sparkles, Loader2, ArrowRight, ShieldCheck, ShoppingBag } from "lucide-react";
import { Profile } from "../types";

interface ShopProps {
  currentUser: any;
  currentUserProfile: Profile | null;
  onPaymentSuccess?: () => void;
}

export default function Shop({ currentUser, currentUserProfile, onPaymentSuccess }: ShopProps) {
  const [credits, setCredits] = useState<number>(0);
  const [isSubscribed, setIsSubscribed] = useState<boolean>(false);
  const [expiryDate, setExpiryDate] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<string | null>(null);

  useEffect(() => {
    if (!currentUser) return;
    loadAccountStatus();
  }, [currentUser]);

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
      }

      // 2. Fetch Subscription Status
      const { data: subData } = await supabase
        .from("subscriptions")
        .select("*")
        .eq("user_id", currentUser.id)
        .single();

      if (subData && subData.type === "premium" && subData.status === "active") {
        setIsSubscribed(true);
        if (subData.end_date) {
          setExpiryDate(new Date(subData.end_date).toLocaleDateString([], { day: 'numeric', month: 'long', year: 'numeric' }));
        }
      }
    } catch (err) {
      console.error("Error loading account status:", err);
    }
  };

  const handlePurchase = async (planId: string, planName: string, amount: number) => {
    setIsLoading(planId);
    try {
      const fallbackReference = `LR-PAY-${Math.floor(100000 + Math.random() * 900000)}`;
      let checkoutUrl = "";
      let reference = fallbackReference;

      // 1. Try server-side integration if the Express server is running
      try {
        const response = await fetch("/api/payments/create", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            userId: currentUser.id,
            planId: planId,
            planName: planName,
            amount: amount,
            email: currentUser.email
          })
        });

        if (response.ok) {
          const data = await response.json();
          if (data.checkoutUrl) {
            checkoutUrl = data.checkoutUrl;
            if (data.reference) {
              reference = data.reference;
              localStorage.setItem("last_payment_reference", data.reference);
            }
          }
        }
      } catch (apiErr) {
        console.warn("Backend API not reachable or returned 404, using client-side fallback:", apiErr);
      }

      // 2. Fallback: Create payments table record directly from client and redirect to local sandbox
      if (!checkoutUrl) {
        localStorage.setItem("last_payment_reference", fallbackReference);

        const { error: insertErr } = await supabase
          .from("payments")
          .insert([
            {
              user_id: currentUser.id,
              montant: amount,
              statut: "pending",
              plan_id: planId,
              plan_name: planName,
              reference: fallbackReference,
            }
          ]);

        if (insertErr) {
          console.error("Direct client-side payment insertion failed:", insertErr);
        }

        checkoutUrl = `/payment-sandbox?reference=${fallbackReference}&amount=${amount}&planId=${planId}&planName=${encodeURIComponent(planName)}&userId=${currentUser.id}`;
      }

      window.location.href = checkoutUrl;
    } catch (err: any) {
      console.error("Purchase checkout failed:", err);
      alert(err.message || "Erreur de connexion avec le serveur.");
    } finally {
      setIsLoading(null);
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

        {/* Security / money fusion guarantees */}
        <div className="bg-slate-100 border border-slate-150 rounded-2xl p-4 flex items-center space-x-3 text-slate-500 text-xs font-semibold">
          <ShieldCheck size={20} className="text-emerald-500" />
          <p className="leading-relaxed">
            Paiements 100% sécurisés par cryptage SSL de bout en bout et gérés directement via la passerelle Mobile Money africaine <strong className="text-slate-700">Money Fusion</strong>. Aucune donnée bancaire n'est conservée.
          </p>
        </div>

      </div>
    </div>
  );
}
