import { useState } from "react";
import { supabase } from "../lib/supabase";
import { checkImageQuality } from "../lib/imageQuality";
import { uploadKycFile, upgradeAnonymousWithEmail, upgradeAnonymousWithGoogle, KycSlot } from "../lib/kycUpload";
import { Lock, LockOpen, Mail, Chrome, Camera, CheckCircle2, AlertTriangle, Loader2, X, ShieldCheck } from "lucide-react";

interface KycVerificationModalProps {
  currentUser: any;
  page: { id: string };
  verificationRequest: any | null;
  onClose: () => void;
  onSubmitted: () => void;
}

const SLOTS: { key: KycSlot; label: string; hint: string; capture: "user" | "environment" }[] = [
  { key: "photo_id_front", label: "Pièce d'identité — recto", hint: "CNI, passeport ou permis, bien lisible", capture: "environment" },
  { key: "photo_id_back",  label: "Pièce d'identité — verso", hint: "L'autre face du même document", capture: "environment" },
  { key: "selfie_face",    label: "Selfie — visage de face", hint: "Regardez l'objectif, sans lunettes de soleil", capture: "user" },
  { key: "selfie_left",    label: "Selfie — profil gauche", hint: "Tournez votre visage vers la gauche", capture: "user" },
  { key: "selfie_right",   label: "Selfie — profil droit", hint: "Tournez votre visage vers la droite", capture: "user" },
];

type SlotState = { previewUrl: string; blob: Blob; warning: string | null; uploading: boolean; uploaded: boolean };

export default function KycVerificationModal({ currentUser, page, verificationRequest, onClose, onSubmitted }: KycVerificationModalProps) {
  const isAnonymous = !!currentUser?.is_anonymous;
  const [step, setStep] = useState<"account" | "kyc">(isAnonymous ? "account" : "kyc");

  // --- Étape 1 : compte réel -------------------------------------------
  const [accountMethod, setAccountMethod] = useState<"email" | "google" | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLinking, setIsLinking] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [emailSent, setEmailSent] = useState(false);

  const handleLinkEmail = async () => {
    if (!email.trim() || password.length < 6) {
      setLinkError("Email valide et mot de passe d'au moins 6 caractères requis.");
      return;
    }
    setIsLinking(true);
    setLinkError(null);
    try {
      await upgradeAnonymousWithEmail(email.trim(), password);
      setEmailSent(true);
    } catch (err: any) {
      setLinkError(err.message || "Impossible de lier cet email.");
    } finally {
      setIsLinking(false);
    }
  };

  const handleLinkGoogle = async () => {
    setIsLinking(true);
    setLinkError(null);
    try {
      await upgradeAnonymousWithGoogle(window.location.origin + window.location.pathname);
      // La page redirige vers Google puis revient — rien d'autre à faire ici.
    } catch (err: any) {
      setLinkError(err.message || "Connexion Google impossible.");
      setIsLinking(false);
    }
  };

  const refreshAndContinue = async () => {
    const { data } = await supabase.auth.getUser();
    if (data?.user && !data.user.is_anonymous) {
      setStep("kyc");
    } else {
      setLinkError("Compte pas encore confirmé. Cliquez sur le lien reçu par email, puis réessayez.");
    }
  };

  // --- Étape 2 : documents KYC ------------------------------------------
  const [fullName, setFullName] = useState("");
  const [idNumber, setIdNumber] = useState("");
  const [city, setCity] = useState("");
  const [slots, setSlots] = useState<Partial<Record<KycSlot, SlotState>>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const handleFileSelect = async (slotKey: KycSlot, file: File) => {
    const result = await checkImageQuality(file);
    const previewUrl = URL.createObjectURL(result.blob);
    setSlots((prev) => ({
      ...prev,
      [slotKey]: { previewUrl, blob: result.blob, warning: result.warning, uploading: false, uploaded: false },
    }));
  };

  const allCaptured = SLOTS.every((s) => slots[s.key]);

  const handleSubmit = async () => {
    if (!fullName.trim() || !idNumber.trim()) {
      setSubmitError("Nom complet et numéro de pièce d'identité obligatoires.");
      return;
    }
    if (!allCaptured) {
      setSubmitError("Les 5 photos sont nécessaires (pièce recto/verso + 3 selfies).");
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);
    try {
      // Upload des 5 fichiers vers le bucket privé kyc-documents.
      const paths: Partial<Record<KycSlot, string>> = {};
      for (const s of SLOTS) {
        const slot = slots[s.key]!;
        paths[s.key] = await uploadKycFile(currentUser.id, s.key, slot.blob);
      }

      const { error } = await supabase.from("creator_verification_requests").insert([
        {
          user_id: currentUser.id,
          page_id: page.id,
          full_name: fullName.trim(),
          id_number: idNumber.trim(),
          city: city.trim(),
          photo_id_front: paths.photo_id_front,
          photo_id_back: paths.photo_id_back,
          selfie_face: paths.selfie_face,
          selfie_left: paths.selfie_left,
          selfie_right: paths.selfie_right,
          status: "pending",
        },
      ]);
      if (error) throw error;

      onSubmitted();
    } catch (err: any) {
      console.error("KYC submit error:", err);
      setSubmitError(err.message || "Erreur lors de l'envoi. Réessayez.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (verificationRequest?.status === "pending") {
    return (
      <div className="fixed inset-0 bg-black/80 backdrop-blur-xs z-50 flex items-center justify-center p-4">
        <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 text-center space-y-4">
          <Loader2 className="mx-auto text-amber-500 animate-spin" size={28} />
          <h3 className="text-base font-black text-white">Vérification en cours d'examen</h3>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            Votre dossier a été transmis à notre équipe. Vous recevrez une notification dès qu'il sera validé (généralement sous 24h).
          </p>
          <button onClick={onClose} className="w-full py-3 border border-slate-800 hover:bg-slate-800 text-slate-300 font-bold rounded-xl transition">
            Fermer
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 text-left space-y-5 shadow-2xl animate-fadeIn my-8">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-black text-white flex items-center gap-1.5 uppercase tracking-wide">
            {step === "account" ? <Lock className="text-amber-500" size={18} /> : <ShieldCheck className="text-amber-500" size={18} />}
            <span>Débloquer vos gains</span>
          </h3>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition"><X size={18} /></button>
        </div>

        {/* Repères des 2 clés */}
        <div className="flex items-center gap-2 text-[12px] font-bold">
          <div className={`flex items-center gap-1 px-2.5 py-1 rounded-full border ${!isAnonymous ? "border-emerald-500/40 text-emerald-400 bg-emerald-500/10" : "border-slate-700 text-slate-400"}`}>
            {!isAnonymous ? <CheckCircle2 size={12} /> : <Lock size={12} />}
            Compte réel
          </div>
          <div className="flex-1 h-px bg-slate-800" />
          <div className={`flex items-center gap-1 px-2.5 py-1 rounded-full border ${step === "kyc" && verificationRequest?.status !== "pending" ? "border-amber-500/40 text-amber-400 bg-amber-500/10" : "border-slate-700 text-slate-400"}`}>
            <Lock size={12} />
            Identité vérifiée
          </div>
        </div>

        {step === "account" && (
          <div className="space-y-4">
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Votre compte est pour l'instant anonyme. Pour retirer de l'argent réel, transformez-le en vrai compte — vos gains et votre historique restent intacts, rien n'est perdu.
            </p>

            {!accountMethod && (
              <div className="space-y-2">
                <button
                  onClick={() => setAccountMethod("google")}
                  className="w-full py-3 bg-white hover:bg-slate-100 text-slate-900 font-bold rounded-xl transition flex items-center justify-center gap-2"
                >
                  <Chrome size={16} /> Continuer avec Google
                </button>
                <button
                  onClick={() => setAccountMethod("email")}
                  className="w-full py-3 border border-slate-800 hover:bg-slate-800 text-slate-300 font-bold rounded-xl transition flex items-center justify-center gap-2"
                >
                  <Mail size={16} /> Utiliser un email
                </button>
              </div>
            )}

            {accountMethod === "google" && (
              <div className="space-y-3">
                <button
                  onClick={handleLinkGoogle}
                  disabled={isLinking}
                  className="w-full py-3 bg-white hover:bg-slate-100 text-slate-900 font-bold rounded-xl transition flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isLinking ? <Loader2 className="animate-spin" size={16} /> : <><Chrome size={16} /> Se connecter avec Google</>}
                </button>
                {linkError && <p className="text-[12px] text-rose-400 font-semibold">{linkError}</p>}
              </div>
            )}

            {accountMethod === "email" && !emailSent && (
              <div className="space-y-3 text-xs">
                <input
                  type="email"
                  placeholder="votre@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 focus:outline-none rounded-xl p-3 text-white font-semibold"
                />
                <input
                  type="password"
                  placeholder="Mot de passe (6+ caractères)"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 focus:outline-none rounded-xl p-3 text-white font-semibold"
                />
                {linkError && <p className="text-[12px] text-rose-400 font-semibold">{linkError}</p>}
                <button
                  onClick={handleLinkEmail}
                  disabled={isLinking}
                  className="w-full py-3 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black rounded-xl transition disabled:opacity-50"
                >
                  {isLinking ? <Loader2 className="animate-spin mx-auto" size={16} /> : "Valider mon email"}
                </button>
              </div>
            )}

            {emailSent && (
              <div className="space-y-3 text-center">
                <Mail className="mx-auto text-amber-500" size={28} />
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  Un lien de confirmation a été envoyé à <strong className="text-white">{email}</strong>. Ouvrez-le, puis revenez ici.
                </p>
                {linkError && <p className="text-[12px] text-rose-400 font-semibold">{linkError}</p>}
                <button onClick={refreshAndContinue} className="w-full py-3 border border-slate-800 hover:bg-slate-800 text-slate-300 font-bold rounded-xl transition">
                  J'ai confirmé, continuer
                </button>
              </div>
            )}
          </div>
        )}

        {step === "kyc" && (
          <div className="space-y-4 text-xs">
            <p className="text-[11px] text-slate-400 leading-relaxed">
              5 photos, transmises uniquement à notre équipe de vérification. Utilisez de bonnes photos nettes — ça évite un aller-retour.
            </p>

            <div className="space-y-1">
              <label className="text-[12px] font-bold text-slate-400 block uppercase">Nom complet (identique à la pièce)</label>
              <input value={fullName} onChange={(e) => setFullName(e.target.value)} className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 focus:outline-none rounded-xl p-3 text-white font-semibold" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[12px] font-bold text-slate-400 block uppercase">N° pièce d'identité</label>
                <input value={idNumber} onChange={(e) => setIdNumber(e.target.value)} className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 focus:outline-none rounded-xl p-3 text-white font-semibold" />
              </div>
              <div className="space-y-1">
                <label className="text-[12px] font-bold text-slate-400 block uppercase">Ville</label>
                <input value={city} onChange={(e) => setCity(e.target.value)} className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 focus:outline-none rounded-xl p-3 text-white font-semibold" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-1">
              {SLOTS.map((s) => {
                const state = slots[s.key];
                return (
                  <div key={s.key} className="space-y-1">
                    <input
                      type="file"
                      id={`kyc-${s.key}`}
                      accept="image/*"
                      capture={s.capture}
                      className="hidden"
                      onChange={(e) => e.target.files?.[0] && handleFileSelect(s.key, e.target.files[0])}
                    />
                    <label
                      htmlFor={`kyc-${s.key}`}
                      className="aspect-[3/4] w-full rounded-2xl border-2 border-dashed border-slate-800 bg-slate-950 hover:border-amber-500/50 transition cursor-pointer flex flex-col items-center justify-center overflow-hidden relative"
                    >
                      {state ? (
                        <img src={state.previewUrl} alt={s.label} className="w-full h-full object-cover" />
                      ) : (
                        <div className="text-center p-2 text-slate-500 space-y-1">
                          <Camera size={18} className="mx-auto" />
                        </div>
                      )}
                      {state && !state.warning && (
                        <div className="absolute top-1.5 right-1.5 bg-emerald-500 rounded-full p-0.5">
                          <CheckCircle2 size={12} className="text-slate-950" />
                        </div>
                      )}
                    </label>
                    <p className="text-[11px] font-bold text-slate-400 leading-tight">{s.label}</p>
                    {state?.warning && (
                      <p className="text-[11px] text-amber-400 font-semibold flex items-start gap-0.5">
                        <AlertTriangle size={10} className="flex-shrink-0 mt-px" /> {state.warning}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>

            {submitError && <p className="text-[12px] text-rose-400 font-semibold">{submitError}</p>}

            <button
              onClick={handleSubmit}
              disabled={isSubmitting || !allCaptured}
              className="w-full py-3 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black rounded-xl transition disabled:opacity-40 flex items-center justify-center gap-2"
            >
              {isSubmitting ? <Loader2 className="animate-spin" size={16} /> : <><LockOpen size={16} /> Envoyer pour vérification</>}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
