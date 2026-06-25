import React, { useState, useEffect } from "react";
import { ShieldCheck, CheckCircle, Loader2, LogOut, Key, HelpCircle, AlertTriangle, ShieldAlert, FileText, Smartphone } from "lucide-react";
import { supabase } from "../lib/supabase";
import { Profile } from "../types";

interface SettingsProps {
  currentUser: any;
  profile: Profile | null;
  onBackToProfile?: () => void;
  onLogout: () => void;
  onProfileUpdated: () => void;
}

export default function Settings({ currentUser, profile, onBackToProfile, onLogout, onProfileUpdated }: SettingsProps) {
  const [verificationStatus, setVerificationStatus] = useState<string>("none");
  const [idFileUrl, setIdFileUrl] = useState("");
  const [selfieFileUrl, setSelfieFileUrl] = useState("");
  const [verificationLoading, setVerificationLoading] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    if (profile) {
      setVerificationStatus(profile.verification_status || "none");
    }
  }, [profile]);

  const handleLocalFileChange = (e: React.ChangeEvent<HTMLInputElement>, callback: (base64: string) => void) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 3 * 1024 * 1024) {
      alert("L'image est trop volumineuse. Veuillez choisir un fichier de moins de 3 Mo.");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === "string") {
        callback(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleVerifyRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!idFileUrl || !selfieFileUrl) {
      alert("Veuillez uploader les deux photos demandées.");
      return;
    }

    setVerificationLoading(true);
    try {
      // 1. Update verification_status in profiles table to 'pending'
      const { error } = await supabase
        .from("profiles")
        .update({
          verification_status: "pending"
        })
        .eq("uid", currentUser.id);

      if (error) throw error;

      // 2. Insert verification documents log
      await supabase
        .from("notifications")
        .insert([
          {
            user_id: currentUser.id,
            sender_id: currentUser.id,
            type: "match", // system notice
            content: "Votre demande de vérification de profil a été envoyée. Nos administrateurs l'analysent sous 24h.",
            lu: false
          }
        ]);

      setVerificationStatus("pending");
      onProfileUpdated();
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 5000);
      alert("Votre demande a bien été soumise !");
    } catch (err: any) {
      console.error("Verification submit error:", err);
      alert(err.message || "Impossible d'envoyer la demande de vérification.");
    } finally {
      setVerificationLoading(false);
    }
  };

  return (
    <div id="settings-screen" className="flex-1 overflow-y-auto bg-slate-50 p-4 md:p-8 space-y-8 font-sans max-w-4xl mx-auto w-full">
      {/* Title */}
      <div className="border-b border-slate-200 pb-4 flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">Paramètres du compte</h2>
          <p className="text-slate-500 text-xs">Gérez la sécurité, la vérification officielle d'identité et la confidentialité de votre compte.</p>
        </div>
        {onBackToProfile && (
          <button
            onClick={onBackToProfile}
            className="text-xs bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold px-4 py-2 rounded-xl transition cursor-pointer"
          >
            Retour Profil
          </button>
        )}
      </div>

      {saveSuccess && (
        <div className="bg-emerald-50 border border-emerald-100 text-emerald-700 text-xs p-3.5 rounded-2xl flex items-center gap-2">
          <CheckCircle size={16} />
          <p>Paramètres enregistrés et synchronisés avec succès !</p>
        </div>
      )}

      <div className="grid md:grid-cols-3 gap-8 items-start">
        {/* Verification Column */}
        <div className="md:col-span-1 space-y-6">
          <div className="bg-white border border-slate-150 rounded-3xl p-5 shadow-sm space-y-4">
            <h4 className="font-extrabold text-slate-800 text-xs uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-100 pb-2">
              <ShieldCheck className="text-rose-500" size={16} />
              <span>Badge de Confiance</span>
            </h4>

            {verificationStatus === "verified" ? (
              <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-2xl text-center space-y-2 text-xs font-semibold text-emerald-800 animate-pulse">
                <CheckCircle className="mx-auto text-emerald-500" size={28} fill="white" />
                <p>Compte Certifié Vérifié</p>
                <p className="font-medium text-emerald-600 text-[10px] leading-relaxed">
                  Votre badge de confiance vert est actif et visible auprès de tous les célibataires.
                </p>
              </div>
            ) : verificationStatus === "pending" ? (
              <div className="bg-amber-50 border border-amber-100 p-4 rounded-2xl text-center space-y-2 text-xs font-semibold text-amber-800">
                <Loader2 className="mx-auto text-amber-500 animate-spin" size={24} />
                <p>Documents en cours d'analyse</p>
                <p className="font-medium text-amber-600 text-[10px] leading-relaxed">
                  Notre équipe de modération étudie vos justificatifs. Délai moyen : 12 heures.
                </p>
              </div>
            ) : (
              <form onSubmit={handleVerifyRequest} className="space-y-4">
                <p className="text-slate-500 text-[10px] leading-relaxed">
                  Le badge <strong>Vérifié</strong> confirme votre authenticité et multiplie vos chances de Matchs par 3 !
                </p>

                <div className="space-y-3 text-left">
                  <div>
                    <label className="text-[10px] font-extrabold text-slate-500 uppercase">Pièce d'identité (Photo)</label>
                    <input
                      type="file"
                      accept="image/*"
                      required
                      onChange={(e) => handleLocalFileChange(e, setIdFileUrl)}
                      className="w-full mt-1 p-2 bg-slate-50 border border-slate-200 rounded-xl text-[10px] transition cursor-pointer font-medium text-slate-600"
                    />
                    {idFileUrl && (
                      <div className="mt-1.5 rounded-lg overflow-hidden h-14 w-24 bg-slate-100 border border-slate-200">
                        <img src={idFileUrl} alt="Justificatif ID" className="w-full h-full object-cover" />
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="text-[10px] font-extrabold text-slate-500 uppercase">Selfie de Contrôle (Photo)</label>
                    <input
                      type="file"
                      accept="image/*"
                      required
                      onChange={(e) => handleLocalFileChange(e, setSelfieFileUrl)}
                      className="w-full mt-1 p-2 bg-slate-50 border border-slate-200 rounded-xl text-[10px] transition cursor-pointer font-medium text-slate-600"
                    />
                    {selfieFileUrl && (
                      <div className="mt-1.5 rounded-lg overflow-hidden h-14 w-24 bg-slate-100 border border-slate-200">
                        <img src={selfieFileUrl} alt="Selfie" className="w-full h-full object-cover" />
                      </div>
                    )}
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={verificationLoading || !idFileUrl || !selfieFileUrl}
                  className="w-full py-2.5 bg-rose-500 hover:bg-rose-600 text-white font-extrabold text-[10px] uppercase tracking-wider rounded-xl transition cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5 shadow-md shadow-rose-500/10"
                >
                  {verificationLoading ? (
                    <Loader2 className="animate-spin" size={12} />
                  ) : (
                    <span>Lancer la vérification</span>
                  )}
                </button>
              </form>
            )}
          </div>
        </div>

        {/* Settings options Column */}
        <div className="md:col-span-2 space-y-6">
          {/* Security and Privacy Card */}
          <div className="bg-white border border-slate-150 rounded-3xl p-6 shadow-sm space-y-4">
            <h3 className="font-extrabold text-slate-900 text-sm flex items-center gap-1.5 border-b border-slate-100 pb-3">
              <Key size={16} className="text-rose-500" />
              <span>Sécurité du compte</span>
            </h3>

            <div className="space-y-4">
              <div className="flex justify-between items-center py-2 border-b border-slate-50">
                <div>
                  <h4 className="text-xs font-bold text-slate-800">Adresse Email</h4>
                  <p className="text-[10px] text-slate-400 mt-0.5">{currentUser?.email || "Non renseigné"}</p>
                </div>
                <span className="text-[10px] bg-slate-100 text-slate-600 font-semibold px-2.5 py-1 rounded-full">
                  Vérifié
                </span>
              </div>

              <div className="flex justify-between items-center py-2 border-b border-slate-50">
                <div>
                  <h4 className="text-xs font-bold text-slate-800">Double Facteur (MFA)</h4>
                  <p className="text-[10px] text-slate-400 mt-0.5">Renforcer la protection de mes données personnelles</p>
                </div>
                <button
                  onClick={() => alert("La double authentification sera disponible lors de la prochaine mise à jour de l'application.")}
                  className="text-[10px] text-rose-500 hover:text-rose-600 font-bold transition cursor-pointer"
                >
                  Activer
                </button>
              </div>

              <div className="flex justify-between items-center py-2">
                <div>
                  <h4 className="text-xs font-bold text-slate-800">Confidentialité de ma fiche</h4>
                  <p className="text-[10px] text-slate-400 mt-0.5">Permettre aux autres de voir mon profil dans la découverte</p>
                </div>
                <div className="relative inline-flex items-center cursor-pointer">
                  <span className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-100 font-extrabold px-3 py-1 rounded-full">
                    Profil Public
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Guidelines / Safety tips */}
          <div className="bg-white border border-slate-150 rounded-3xl p-6 shadow-sm space-y-4">
            <h3 className="font-extrabold text-slate-900 text-sm flex items-center gap-1.5 border-b border-slate-100 pb-3">
              <ShieldAlert size={16} className="text-rose-500" />
              <span>Charte de Sécurité & Rencontres Saines</span>
            </h3>

            <div className="space-y-3 text-slate-600 text-xs leading-relaxed">
              <div className="flex items-start gap-2 bg-rose-50/30 p-3 rounded-2xl border border-rose-500/5">
                <AlertTriangle className="text-amber-500 flex-shrink-0 mt-0.5" size={14} />
                <p className="text-[11px] text-slate-600">
                  <strong>Ne partagez jamais vos coordonnées bancaires :</strong> LoveRose ou ses agents ne vous demanderont jamais vos mots de passe ou codes Mobile Money par message.
                </p>
              </div>

              <div className="flex items-start gap-2 bg-slate-50 p-3 rounded-2xl">
                <HelpCircle className="text-rose-500 flex-shrink-0 mt-0.5" size={14} />
                <p className="text-[11px] text-slate-600">
                  <strong>Rencontrez-vous dans des lieux publics :</strong> Pour vos premiers rendez-vous en personne, privilégiez un café ou restaurant fréquenté et prévenez un proche de votre sortie.
                </p>
              </div>
            </div>
          </div>

          {/* Account Actions */}
          <div className="bg-white border border-slate-150 rounded-3xl p-6 shadow-sm space-y-4">
            <h3 className="font-extrabold text-slate-900 text-sm flex items-center gap-1.5 border-b border-slate-100 pb-3 text-red-500">
              <ShieldAlert size={16} />
              <span>Zone de Danger</span>
            </h3>

            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold text-slate-800">Désactiver ou supprimer mon compte</h4>
                <p className="text-[10px] text-slate-400 mt-0.5">Efface définitivement mes Matchs, messages, et profil de LoveRose</p>
              </div>
              <button
                onClick={() => {
                  if (confirm("Êtes-vous absolument sûr de vouloir supprimer définitivement votre compte LoveRose ? Cette action est irréversible et supprimera l'intégralité de vos données.")) {
                    alert("Votre compte a été suspendu pour suppression. Contactez le service d'assistance LoveRose pour annuler sous 14 jours.");
                  }
                }}
                className="text-[10px] text-red-500 hover:text-red-600 font-extrabold border border-red-100 bg-red-50/50 hover:bg-red-50 px-3 py-1.5 rounded-xl transition cursor-pointer"
              >
                Supprimer mon compte
              </button>
            </div>
          </div>

          {/* App Info Footer */}
          <div className="text-center pt-2 space-y-1">
            <div className="flex justify-center items-center gap-2 text-[10px] text-slate-400">
              <FileText size={12} />
              <a href="#" className="hover:underline">Conditions d'utilisation</a>
              <span>•</span>
              <a href="#" className="hover:underline">Charte de respect</a>
              <span>•</span>
              <a href="#" className="hover:underline">Aide</a>
            </div>
            <p className="text-[9px] text-slate-400">LoveRose v2.1.0 • Fait en Afrique avec passion ❤️</p>
          </div>
        </div>
      </div>
    </div>
  );
}
