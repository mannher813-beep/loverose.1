import React, { useEffect, useState } from "react";
import { CheckCircle2, Loader2, AlertCircle, Sparkles } from "lucide-react";
import { motion } from "motion/react";
import { supabase } from "../lib/supabase";

interface PaymentSuccessProps {
  onBackToApp: () => void;
  userId?: string;
  loadProfile?: (uid: string) => Promise<void>;
}

export default function PaymentSuccess({ onBackToApp, userId, loadProfile }: PaymentSuccessProps) {
  const [status, setStatus] = useState<"polling" | "success" | "timeout" | "not_found">("polling");
  const [attempts, setAttempts] = useState(0);
  const [planName, setPlanName] = useState<string | null>(null);
  const [amount, setAmount] = useState<number | null>(null);
  const [reference, setReference] = useState<string | null>(null);

  useEffect(() => {
    // 1. Retrieve payment reference from URL or localStorage fallback
    const urlParams = new URLSearchParams(window.location.search);
    const urlRef = urlParams.get("reference") || urlParams.get("ref");
    const storedRef = localStorage.getItem("last_payment_reference");
    const activeRef = urlRef || storedRef;

    if (!activeRef) {
      setStatus("not_found");
      return;
    }

    setReference(activeRef);

    let pollInterval: NodeJS.Timeout;
    const maxAttempts = 10; // Poll for up to 20 seconds (2s interval)

    const checkPaymentStatus = async () => {
      let verified = false;
      try {
        const res = await fetch(`/api/payments/verify?reference=${activeRef}`);
        if (res.ok) {
          const data = await res.json();
          if (data.payment) {
            setPlanName(data.payment.plan_name);
            setAmount(data.payment.montant);
          }
          if (data.status === "success") {
            setStatus("success");
            clearInterval(pollInterval);
            localStorage.removeItem("last_payment_reference");
            if (userId && loadProfile) {
              await loadProfile(userId);
            }
            verified = true;
          }
        }
      } catch (err) {
        console.warn("Express payment verification failed, trying client-side fallback:", err);
      }

      if (!verified) {
        try {
          const { data: dbPayment, error } = await supabase
            .from("payments")
            .select("*")
            .eq("reference", activeRef)
            .single();

          if (dbPayment) {
            setPlanName(dbPayment.plan_name);
            setAmount(dbPayment.montant);
            if (dbPayment.statut === "success") {
              setStatus("success");
              clearInterval(pollInterval);
              localStorage.removeItem("last_payment_reference");
              if (userId && loadProfile) {
                await loadProfile(userId);
              }
              verified = true;
            }
          }
        } catch (dbErr) {
          console.error("Direct Supabase verification fallback error:", dbErr);
        }
      }
    };

    // Initial check
    checkPaymentStatus();

    // Setup polling interval
    pollInterval = setInterval(() => {
      setAttempts((prev) => {
        const next = prev + 1;
        if (next >= maxAttempts) {
          setStatus("timeout");
          clearInterval(pollInterval);
        } else {
          checkPaymentStatus();
        }
        return next;
      });
    }, 2000);

    return () => clearInterval(pollInterval);
  }, [userId, loadProfile]);

  const handleReturn = () => {
    // Clean up url parameters so we don't reload success screens repeatedly
    window.history.replaceState({}, document.title, window.location.pathname);
    onBackToApp();
  };

  return (
    <div id="payment-success-screen" className="min-h-screen bg-rose-50/50 flex flex-col items-center justify-center p-4 font-sans">
      <div className="max-w-md w-full bg-white rounded-3xl p-8 shadow-xl border border-slate-100 text-center space-y-6 relative overflow-hidden">
        
        {/* Ambient Top Glow */}
        <div className="absolute top-0 inset-x-0 h-2 bg-gradient-to-r from-emerald-400 via-rose-500 to-pink-500" />

        {/* Polling State */}
        {status === "polling" && (
          <div className="space-y-6 py-6">
            <div className="relative mx-auto w-24 h-24 flex items-center justify-center">
              <div className="absolute inset-0 border-4 border-slate-100 rounded-full" />
              <Loader2 className="w-16 h-16 text-rose-500 animate-spin" />
            </div>
            <div className="space-y-2">
              <h1 className="text-xl font-bold text-slate-900">Vérification de votre paiement...</h1>
              <p className="text-slate-500 text-xs px-4 leading-relaxed">
                Nous interrogeons la passerelle de paiement <strong>Money Fusion</strong> pour confirmer votre transaction. Cela ne prend que quelques secondes.
              </p>
            </div>
            <div className="text-xs font-mono text-slate-400 bg-slate-50 py-2 rounded-xl mx-6">
              Réf : {reference || "..."}
            </div>
          </div>
        )}

        {/* Success State */}
        {status === "success" && (
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="space-y-6"
          >
            <div className="mx-auto bg-emerald-50 w-24 h-24 rounded-full flex items-center justify-center text-emerald-500 relative">
              <CheckCircle2 size={56} />
              <Sparkles className="absolute -top-1 -right-1 text-amber-400 w-6 h-6 animate-pulse" />
            </div>
            
            <div className="space-y-2">
              <h1 className="text-2xl font-bold text-slate-950">Paiement Validé !</h1>
              <p className="text-slate-500 text-xs px-2 leading-relaxed">
                Félicitations, votre achat a été traité avec succès par la passerelle <strong>Money Fusion</strong>. Votre compte a été mis à jour instantanément !
              </p>
            </div>

            {planName && amount !== null && (
              <div className="bg-emerald-50/50 rounded-2xl p-4 border border-emerald-100/50 text-left space-y-2.5 mx-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500">Produit</span>
                  <span className="font-semibold text-slate-900">{planName}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500">Montant</span>
                  <span className="font-bold text-emerald-600">{amount} FCFA</span>
                </div>
                {reference && (
                  <div className="flex justify-between items-center text-[10px] font-mono pt-1 border-t border-emerald-100/40 text-slate-400">
                    <span>Référence</span>
                    <span className="truncate max-w-[200px]">{reference}</span>
                  </div>
                )}
              </div>
            )}

            <button
              onClick={handleReturn}
              className="w-full py-3.5 bg-rose-500 hover:bg-rose-600 text-white font-bold rounded-2xl shadow-lg shadow-rose-100 transition cursor-pointer"
            >
              Aller au tableau de bord
            </button>
          </motion.div>
        )}

        {/* Timeout State */}
        {status === "timeout" && (
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="space-y-6"
          >
            <div className="mx-auto bg-amber-50 w-24 h-24 rounded-full flex items-center justify-center text-amber-500">
              <AlertCircle size={56} />
            </div>
            
            <div className="space-y-2">
              <h1 className="text-xl font-bold text-slate-950">Traitement en cours...</h1>
              <p className="text-slate-500 text-xs px-2 leading-relaxed">
                La passerelle <strong>Money Fusion</strong> finalise votre transaction. Votre compte sera crédité en arrière-plan d'une minute à l'autre !
              </p>
            </div>

            <div className="bg-amber-50/40 rounded-2xl p-4 border border-amber-100/40 text-left space-y-1 mx-2">
              <p className="text-[11px] text-amber-700 font-medium">
                Qu'est-ce que cela signifie ?
              </p>
              <p className="text-[10px] text-slate-500 leading-relaxed">
                Certains modes de paiement mobile money prennent un peu plus de temps à notifier notre serveur. Vous pouvez fermer cette page et retourner à l'application sans crainte.
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <button
                onClick={() => window.location.reload()}
                className="w-full py-3 bg-amber-500 hover:bg-amber-600 text-white font-semibold rounded-2xl transition cursor-pointer"
              >
                Actualiser la vérification
              </button>
              <button
                onClick={handleReturn}
                className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-2xl transition cursor-pointer"
              >
                Retourner sur LoveRose
              </button>
            </div>
          </motion.div>
        )}

        {/* Not Found State */}
        {status === "not_found" && (
          <div className="space-y-6">
            <div className="mx-auto bg-rose-50 w-24 h-24 rounded-full flex items-center justify-center text-rose-500">
              <AlertCircle size={56} />
            </div>
            <div className="space-y-2">
              <h1 className="text-xl font-bold text-slate-950">Transaction introuvable</h1>
              <p className="text-slate-500 text-xs px-2 leading-relaxed">
                Aucune référence de paiement active n'a pu être détectée pour cette session.
              </p>
            </div>
            <button
              onClick={handleReturn}
              className="w-full py-3.5 bg-rose-500 hover:bg-rose-600 text-white font-bold rounded-2xl transition cursor-pointer"
            >
              Retourner sur LoveRose
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
