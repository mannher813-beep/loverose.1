import { useState, useEffect } from "react";
import { CheckCircle2, XCircle, ArrowLeft, Landmark, CreditCard, Smartphone, Check, Loader2 } from "lucide-react";

export default function PaymentSandbox() {
  const [params, setParams] = useState({
    reference: "",
    amount: "0",
    planId: "",
    planName: "",
    userId: "",
    error: ""
  });

  const [phoneNumber, setPhoneNumber] = useState("");
  const [operator, setOperator] = useState("mtn");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<'idle' | 'success' | 'failed'>('idle');

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    setParams({
      reference: searchParams.get("reference") || "",
      amount: searchParams.get("amount") || "0",
      planId: searchParams.get("planId") || "",
      planName: searchParams.get("planName") || "Abonnement",
      userId: searchParams.get("userId") || "",
      error: searchParams.get("error") || ""
    });
  }, []);

  const handlePay = async (simulateSuccess: boolean) => {
    if (!phoneNumber && operator !== "card") {
      alert("Veuillez saisir votre numéro de téléphone.");
      return;
    }

    setIsSubmitting(true);
    try {
      // Send a request to our Express webhook endpoint to simulate Money Fusion response
      const response = await fetch("/api/payments/webhook", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          reference: params.reference,
          status: simulateSuccess ? "success" : "failed",
          amount: parseInt(params.amount),
          transaction_id: `MF-TX-${Date.now()}`
        })
      });

      const data = await response.json();
      
      if (response.ok && (data.status === "processed" || data.status === "already_processed")) {
        setPaymentStatus(simulateSuccess ? 'success' : 'failed');
      } else {
        setPaymentStatus('failed');
      }
    } catch (err) {
      console.error("Simulation error:", err);
      setPaymentStatus('failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (paymentStatus === 'success') {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-3xl p-8 shadow-xl border border-slate-100 text-center space-y-6">
          <div className="mx-auto bg-green-50 w-20 h-20 rounded-full flex items-center justify-center text-green-500">
            <CheckCircle2 size={48} />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-slate-900">Paiement Réussi !</h1>
            <p className="text-slate-500 text-sm">
              Votre paiement de <span className="font-semibold text-rose-500">{params.amount} FCFA</span> a été validé avec succès par Money Fusion.
            </p>
          </div>
          <div className="bg-slate-50 rounded-2xl p-4 text-left text-xs font-mono text-slate-500 space-y-1">
            <p>Réf: {params.reference}</p>
            <p>Plan: {params.planName}</p>
            <p>Statut: SUCCESS_CONFIRMED</p>
          </div>
          <button
            onClick={() => window.location.href = "/"}
            className="w-full py-3.5 bg-rose-500 hover:bg-rose-600 active:bg-rose-700 text-white font-semibold rounded-2xl transition shadow-lg shadow-rose-500/20 cursor-pointer"
          >
            Retourner sur LoveRose
          </button>
        </div>
      </div>
    );
  }

  if (paymentStatus === 'failed') {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-3xl p-8 shadow-xl border border-slate-100 text-center space-y-6">
          <div className="mx-auto bg-red-50 w-20 h-20 rounded-full flex items-center justify-center text-red-500">
            <XCircle size={48} />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-slate-900">Paiement Échoué</h1>
            <p className="text-slate-500 text-sm">La transaction a été rejetée ou annulée.</p>
          </div>
          <div className="bg-slate-50 rounded-2xl p-4 text-left text-xs font-mono text-slate-500 space-y-1">
            <p>Réf: {params.reference}</p>
            <p>Code: {params.error || "REJECTED_BY_USER"}</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setPaymentStatus('idle')}
              className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-2xl transition cursor-pointer"
            >
              Réessayer
            </button>
            <button
              onClick={() => window.location.href = "/"}
              className="flex-1 py-3 bg-rose-500 hover:bg-rose-600 text-white font-semibold rounded-2xl transition cursor-pointer"
            >
              Retour
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-slate-150 px-6 py-4 flex items-center justify-between sticky top-0">
        <div className="flex items-center space-x-3">
          <button
            onClick={() => window.location.href = "/"}
            className="p-2 hover:bg-slate-100 rounded-full text-slate-500 transition cursor-pointer"
          >
            <ArrowLeft size={20} />
          </button>
          <div className="flex items-center space-x-1">
            <span className="font-extrabold text-lg text-rose-500 tracking-tight">Money</span>
            <span className="font-extrabold text-lg text-slate-900 tracking-tight">Fusion</span>
            <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-1.5 py-0.5 rounded ml-2 uppercase tracking-wider">Sandbox</span>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs text-slate-400">Merchant ID</p>
          <p className="text-xs font-mono font-bold text-slate-700">LOVEROSE-PROD-M4</p>
        </div>
      </header>

      {/* Main Checkout Grid */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-4 md:p-8 grid md:grid-cols-5 gap-8 items-start">
        {/* Left Side: Order summary */}
        <div className="md:col-span-2 bg-white rounded-3xl p-6 border border-slate-150 space-y-6 shadow-sm">
          <h3 className="font-bold text-slate-800 border-b border-slate-100 pb-3 text-sm uppercase tracking-wider">Résumé de la commande</h3>
          <div className="space-y-4">
            <div>
              <p className="text-xs text-slate-400">Service / Produit</p>
              <p className="font-bold text-slate-800 text-lg">{params.planName}</p>
            </div>
            <div className="grid grid-cols-2 gap-4 pt-2">
              <div>
                <p className="text-xs text-slate-400">Montant</p>
                <p className="font-extrabold text-rose-500 text-xl">{params.amount} FCFA</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Devise</p>
                <p className="font-bold text-slate-700 text-lg">XOF (FCFA)</p>
              </div>
            </div>
            <div className="pt-4 border-t border-slate-100 space-y-2 text-xs font-mono text-slate-500">
              <p className="truncate">Ref: {params.reference}</p>
              <p>Client UID: {params.userId?.substring(0, 12)}...</p>
            </div>
          </div>
        </div>

        {/* Right Side: Payment methods selection */}
        <div className="md:col-span-3 bg-white rounded-3xl p-6 border border-slate-150 shadow-sm space-y-6">
          <h3 className="font-bold text-slate-800 border-b border-slate-100 pb-3 text-sm uppercase tracking-wider">Méthodes de paiement</h3>
          
          <div className="grid grid-cols-3 gap-3">
            <button
              onClick={() => setOperator("mtn")}
              className={`p-4 rounded-2xl border text-center transition flex flex-col items-center justify-center gap-1.5 cursor-pointer ${
                operator === "mtn" ? "border-rose-500 bg-rose-50/50 text-rose-600" : "border-slate-150 hover:border-slate-300 text-slate-600"
              }`}
            >
              <Smartphone size={24} />
              <span className="text-xs font-bold font-sans">MTN MoMo</span>
            </button>
            <button
              onClick={() => setOperator("moov")}
              className={`p-4 rounded-2xl border text-center transition flex flex-col items-center justify-center gap-1.5 cursor-pointer ${
                operator === "moov" ? "border-rose-500 bg-rose-50/50 text-rose-600" : "border-slate-150 hover:border-slate-300 text-slate-600"
              }`}
            >
              <Smartphone size={24} />
              <span className="text-xs font-bold">Moov Flooz</span>
            </button>
            <button
              onClick={() => setOperator("card")}
              className={`p-4 rounded-2xl border text-center transition flex flex-col items-center justify-center gap-1.5 cursor-pointer ${
                operator === "card" ? "border-rose-500 bg-rose-50/50 text-rose-600" : "border-slate-150 hover:border-slate-300 text-slate-600"
              }`}
            >
              <CreditCard size={24} />
              <span className="text-xs font-bold">Carte / Visa</span>
            </button>
          </div>

          <div className="space-y-4 pt-2">
            {operator !== "card" ? (
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Numéro de téléphone mobile money</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">+229 / +228 / +225</span>
                  <input
                    type="tel"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value.replace(/[^0-9]/g, ""))}
                    placeholder="97000000"
                    className="w-full pl-36 pr-4 py-3.5 bg-slate-50 border border-slate-200 focus:border-rose-500 focus:bg-white focus:outline-none rounded-2xl text-slate-800 font-bold transition"
                  />
                </div>
                <p className="text-[11px] text-slate-400">Saisissez votre numéro sans indicatif pays. Un message de validation de transaction USSD s'affichera sur votre écran mobile.</p>
              </div>
            ) : (
              <div className="space-y-3 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                <p className="text-sm font-medium text-slate-600">Formulaire Carte de Crédit Simulé</p>
                <input
                  type="text"
                  placeholder="Numéro de carte (4000 1234 5678 9010)"
                  className="w-full p-3 bg-white border border-slate-200 focus:border-rose-500 focus:outline-none rounded-xl text-xs font-bold"
                  disabled
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    placeholder="MM/AA"
                    className="p-3 bg-white border border-slate-200 focus:border-rose-500 focus:outline-none rounded-xl text-xs font-bold"
                    disabled
                  />
                  <input
                    type="text"
                    placeholder="CVC"
                    className="p-3 bg-white border border-slate-200 focus:border-rose-500 focus:outline-none rounded-xl text-xs font-bold"
                    disabled
                  />
                </div>
              </div>
            )}

            <div className="pt-4 border-t border-slate-100 space-y-3">
              <button
                onClick={() => handlePay(true)}
                disabled={isSubmitting}
                className="w-full py-4 bg-rose-500 hover:bg-rose-600 active:bg-rose-700 text-white font-extrabold text-sm rounded-2xl transition shadow-lg shadow-rose-500/10 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="animate-spin" size={16} />
                    <span>Traitement en cours...</span>
                  </>
                ) : (
                  <>
                    <Check size={16} />
                    <span>Simuler Paiement Succès ({params.amount} FCFA)</span>
                  </>
                )}
              </button>

              <button
                onClick={() => handlePay(false)}
                disabled={isSubmitting}
                className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-2xl transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                Simuler Échec / Annulation de transaction
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-slate-900 text-slate-400 text-center py-6 border-t border-slate-800 text-xs">
        <p className="flex items-center justify-center gap-1.5">
          <Landmark size={14} className="text-rose-400" />
          <span>Sécurisé par la passerelle de paiement Money Fusion de LoveRose</span>
        </p>
        <p className="text-slate-500 mt-1">© 2026 LoveRose Inc. Tous droits réservés.</p>
      </footer>
    </div>
  );
}
