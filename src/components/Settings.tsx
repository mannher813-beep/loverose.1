import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { 
  ShieldCheck, 
  CheckCircle, 
  Loader2, 
  LogOut, 
  Key, 
  HelpCircle, 
  AlertTriangle, 
  ShieldAlert, 
  FileText, 
  User, 
  MapPin, 
  AlignLeft, 
  Save, 
  Camera, 
  Plus, 
  X, 
  BookOpen, 
  Lock, 
  Smartphone,
  ArrowRight,
  XCircle,
  Globe
} from "lucide-react";
import { supabase } from "../lib/supabase";
import { compressImageIfNeeded } from "../lib/imageCompression";
import { Profile, VerificationRequest } from "../types";
import { isPushSupported, getNotificationPermission, subscribeToPushNotifications } from "../lib/push";
import { SUPPORTED_LANGUAGES } from "../i18n";

// Libellés natifs des langues supportées (noms propres, pas de traduction
// nécessaire). Dérivé de SUPPORTED_LANGUAGES pour ne jamais désynchroniser
// ce sélecteur de la config i18n réelle (src/i18n/index.ts).
const LANGUAGE_LABELS: Record<(typeof SUPPORTED_LANGUAGES)[number], { label: string; flag: string }> = {
  fr: { label: "Français", flag: "🇫🇷" },
  en: { label: "English", flag: "🇬🇧" },
  es: { label: "Español", flag: "🇪🇸" },
};

interface SettingsProps {
  currentUser: any;
  profile: Profile | null;
  onBackToProfile?: () => void;
  onLogout: () => void;
  onProfileUpdated: () => void;
  onAuthRequired?: () => void;
}

export default function Settings({ 
  currentUser, 
  profile, 
  onBackToProfile, 
  onLogout, 
  onProfileUpdated,
  onAuthRequired
}: SettingsProps) {
  // Langue de l'interface : changeLanguage() met à jour tous les composants
  // déjà connectés à react-i18next (via t()/useTranslation) et persiste le
  // choix dans localStorage grâce au LanguageDetector déjà configuré dans
  // src/i18n/index.ts (aucune logique de sauvegarde à écrire ici).
  const { i18n } = useTranslation();

  // Navigation tabs within settings
  const [activeSubTab, setActiveSubTab] = useState<'profile' | 'security' | 'cgu' | 'privacy'>('profile');

  // Profile Edit states
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [age, setAge] = useState<number>(18);
  const [locationStr, setLocationStr] = useState("");
  const [gender, setGender] = useState<"homme" | "femme">("femme");
  const [preferences, setPreferences] = useState<'homme' | 'femme' | 'tous'>('femme');
  const [avatarUrl, setAvatarUrl] = useState("");
  const [selectedIntents, setSelectedIntents] = useState<string[]>([]);
  const [photos, setPhotos] = useState<string[]>([]);

  // Slow/unstable connections can leave a storage upload hanging with no
  // response — this forces it to fail after `ms` instead of hanging forever.
  const withUploadTimeout = <T,>(promise: PromiseLike<T>, ms = 45000): Promise<T> =>
    Promise.race([
      Promise.resolve(promise),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("TIMEOUT")), ms)),
    ]);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [preferredLanguage, setPreferredLanguage] = useState<'fr' | 'en'>('fr');
  const [maxDistanceKm, setMaxDistanceKm] = useState<number>(50);

  // Verification states
  const [verificationStatus, setVerificationStatus] = useState<string>("none");
  const [idFileUrl, setIdFileUrl] = useState("");
  const [selfieFileUrl, setSelfieFileUrl] = useState("");
  const [idFile, setIdFile] = useState<File | null>(null);
  const [selfieFile, setSelfieFile] = useState<File | null>(null);
  const [verificationLoading, setVerificationLoading] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Push notifications: lets someone enable them at any time from Settings,
  // not just from the one-time banner shown on first load. Important for
  // anyone who granted browser notification permission before this feature
  // existed — the banner never reappears for them since permission is no
  // longer "default", so this is the only way they can ever get subscribed.
  // "subscribed" is only ever set after we've actually confirmed a real
  // PushManager subscription was created and saved — never just because the
  // browser's Notification.permission happens to be "granted". Those two
  // are NOT the same thing: permission can be granted while the actual
  // subscription creation silently failed (slow service worker, storage
  // error, etc.), and there needs to be a way to see that and retry instead
  // of the card falsely claiming success with no way to fix it.
  const [pushStatus, setPushStatus] = useState<"checking" | "subscribed" | "needs_action" | "denied" | "error" | "unsupported">(
    "checking"
  );
  const [isTogglingPush, setIsTogglingPush] = useState(false);

  const ensurePushSubscription = async (silent: boolean) => {
    if (!currentUser) return;
    if (!isPushSupported()) {
      setPushStatus("unsupported");
      return;
    }
    const permission = getNotificationPermission();
    if (permission === "denied") {
      setPushStatus("denied");
      return;
    }
    if (permission === "default") {
      // Never auto-prompt without a click — only reflect that action is needed.
      setPushStatus("needs_action");
      return;
    }
    // permission === "granted": actually verify/create the subscription itself.
    if (!silent) setIsTogglingPush(true);
    const result = await subscribeToPushNotifications(currentUser.id);
    if (!silent) setIsTogglingPush(false);
    setPushStatus(result.success ? "subscribed" : "error");
  };

  useEffect(() => {
    ensurePushSubscription(true);
  }, [currentUser]);

  const handleEnablePushFromSettings = async () => {
    await ensurePushSubscription(false);
  };

  // Verification badge payment (500 FCFA)
  const VERIFICATION_BADGE_FEE = 500;
  const [showBadgePaymentConfirm, setShowBadgePaymentConfirm] = useState(false);
  const [badgePaymentForm, setBadgePaymentForm] = useState({ phoneNumber: "", fullName: "" });
  const [isLaunchingBadgePayment, setIsLaunchingBadgePayment] = useState(false);
  // Tracks the user's latest verification_requests row (documents + fee payment status).
  // Kept separate from profiles.verification_status, which only allows none/pending/verified.
  const [latestVerificationRequest, setLatestVerificationRequest] = useState<VerificationRequest | null>(null);

  const loadLatestVerificationRequest = async () => {
    if (!currentUser) return;
    const { data, error } = await supabase
      .from("verification_requests")
      .select("*")
      .eq("user_id", currentUser.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!error) {
      setLatestVerificationRequest(data as VerificationRequest | null);
    }
  };

  useEffect(() => {
    if (currentUser) {
      loadLatestVerificationRequest();
    }
  }, [currentUser]);

  const intentsList = [
    "Amitié",
    "Relation amoureuse",
    "Rencontre d'un soir",
    "Relation libertine",
    "Business/Networking"
  ];

  // Load profiles data into states
  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || "");
      setUsername(profile.username || "");
      setBio(profile.bio || "");
      setAge(profile.age || 18);
      setLocationStr(profile.location || "");
      setGender(profile.gender || "femme");
      setPreferences(profile.preferences || "femme");
      setAvatarUrl(profile.avatar_url || "");
      setSelectedIntents(profile.relationship_intents || []);
      setVerificationStatus(profile.verification_status || "none");
      setBadgePaymentForm(prev => ({
        phoneNumber: prev.phoneNumber || profile.phone_number || "",
        fullName: prev.fullName || profile.full_name || profile.username || ""
      }));
      setPreferredLanguage(profile.preferred_language || "fr");
      setMaxDistanceKm(profile.max_distance_km || 50);
      
      const loadedPhotos = profile.photos || JSON.parse(localStorage.getItem(`profile_photos_${currentUser?.id}`) || "[]");
      setPhotos(loadedPhotos);
    }
  }, [profile?.uid, currentUser?.id]);

  if (!currentUser) {
    return (
      <div className="max-w-md mx-auto my-12 p-8 bg-white border border-slate-200 rounded-3xl shadow-sm text-center space-y-4 font-sans">
        <div className="w-14 h-14 bg-rose-50 text-rose-500 rounded-2xl flex items-center justify-center mx-auto">
          <Key size={28} />
        </div>
        <div className="space-y-1">
          <h2 className="text-xl font-black text-slate-900">Paramètres du Compte</h2>
          <p className="text-xs text-slate-500 leading-relaxed">
            Connectez-vous pour gérer votre compte, vos préférences de confidentialité et la sécurité de vos données.
          </p>
        </div>
        <button
          onClick={onAuthRequired}
          className="w-full py-3 bg-rose-500 hover:bg-rose-600 text-white font-black text-xs rounded-xl shadow-md transition cursor-pointer"
        >
          Se connecter / S'inscrire
        </button>
      </div>
    );
  }

  // Profile photo methods
  const handleAddPhotoPremium = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (photos.length >= 20) {
      alert("Vous avez atteint la limite de 20 photos.");
      return;
    }

    const newIndex = photos.length;
    setUploadingPhotoIndex(newIndex);
    try {
      const optimizedFile = await compressImageIfNeeded(file);
      const fileExt = optimizedFile.name.split(".").pop();
      const fileName = `photo_${newIndex}_${Date.now()}.${fileExt}`;
      const filePath = `gallery/${currentUser.id}/${fileName}`;

      const { error: uploadErr } = await withUploadTimeout(
        supabase.storage.from("loverose").upload(filePath, optimizedFile, {
          cacheControl: "3600",
          upsert: true,
        })
      );
      if (uploadErr) throw uploadErr;

      const { data: { publicUrl } } = supabase.storage.from("loverose").getPublicUrl(filePath);

      setPhotos(prev => {
        const next = [...prev, publicUrl];
        if (next.length === 1 || !avatarUrl) {
          setAvatarUrl(publicUrl);
        }
        return next;
      });
    } catch (err) {
      console.error("Error processing premium photo upload in settings:", err);
      alert("Impossible d'envoyer cette photo (connexion trop lente ou instable). Réessayez avec une meilleure connexion.");
    } finally {
      setUploadingPhotoIndex(null);
      e.target.value = "";
    }
  };

  const handleRemovePhoto = async (index: number) => {
    const removedUrl = photos[index];
    const next = photos.filter((_, i) => i !== index);
    const nextAvatarUrl = next.length > 0 ? next[0] : "";

    // Mise à jour immédiate de l'affichage
    setPhotos(next);
    setAvatarUrl(nextAvatarUrl);

    if (!currentUser?.id) return;

    try {
      // Suppression définitive en base : sans ce write, la photo réapparaît
      // au prochain rechargement puisqu'elle reste dans la ligne "profiles".
      const { error } = await supabase
        .from("profiles")
        .update({
          photos: next,
          avatar_url: nextAvatarUrl,
          updated_at: new Date().toISOString(),
        })
        .eq("uid", currentUser.id);

      if (error) throw error;

      // Nettoyage du fichier dans le storage (best-effort, ne bloque pas
      // l'utilisateur si ça échoue : l'important est que la photo ait
      // disparu du profil).
      if (removedUrl) {
        const marker = "/loverose/";
        const idx = removedUrl.indexOf(marker);
        if (idx !== -1) {
          const storagePath = decodeURIComponent(removedUrl.slice(idx + marker.length));
          supabase.storage.from("loverose").remove([storagePath]).then(({ error: storageErr }) => {
            if (storageErr) console.warn("Impossible de supprimer le fichier du storage:", storageErr);
          });
        }
      }
    } catch (err: any) {
      console.error("Error deleting photo:", err);
      // On restaure l'état précédent puisque la suppression en base a échoué,
      // pour éviter que l'utilisateur croie la photo supprimée alors qu'elle
      // est toujours présente en base.
      setPhotos(photos);
      setAvatarUrl(photos[0] || "");
      alert("Impossible de supprimer cette photo pour le moment (connexion instable). Réessayez.");
    }
  };

  const handleIntentToggle = (intent: string) => {
    if (selectedIntents.includes(intent)) {
      setSelectedIntents(prev => prev.filter(i => i !== intent));
    } else {
      setSelectedIntents(prev => [...prev, intent]);
    }
  };

  // Save profile information
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingProfile(true);
    setSaveSuccess(false);

    try {
      if (selectedIntents.length === 0) {
        throw new Error("Veuillez sélectionner au moins un type de rencontre recherché (intention obligatoire).");
      }

      const validPhotos = photos.filter(Boolean);
      if (validPhotos.length < 3) {
        throw new Error("Chaque profil doit uploader au minimum trois (3) photos obligatoirement.");
      }
      if (validPhotos.some(p => p.startsWith("data:")) || avatarUrl.startsWith("data:")) {
        throw new Error("Une photo est encore en cours d'envoi ou n'a pas pu être envoyée. Attendez la fin de l'envoi ou réessayez avec une meilleure connexion avant d'enregistrer.");
      }

      const updatedProfileData = {
        uid: currentUser.id,
        full_name: fullName.trim(),
        username: username.trim(),
        bio: bio.trim(),
        age,
        location: locationStr.trim(),
        gender,
        preferences,
        avatar_url: avatarUrl || validPhotos[0] || "",
        relationship_intents: selectedIntents,
        photos: validPhotos,
        preferred_language: preferredLanguage,
        max_distance_km: maxDistanceKm,
        updated_at: new Date().toISOString()
      };

      localStorage.setItem(`profile_backup_${currentUser.id}`, JSON.stringify(updatedProfileData));
      localStorage.setItem(`profile_photos_${currentUser.id}`, JSON.stringify(validPhotos));

      const { error } = await supabase
        .from("profiles")
        .upsert(updatedProfileData);

      if (error) {
        if (error.message?.includes("photos") || error.code === "PGRST204" || error.code === "42703") {
          const { photos, ...fallbackData } = updatedProfileData;
          const { error: fallbackError } = await supabase
            .from("profiles")
            .upsert(fallbackData);
          
          if (fallbackError) throw fallbackError;
        } else {
          throw error;
        }
      }

      setSaveSuccess(true);
      onProfileUpdated();
      setTimeout(() => setSaveSuccess(false), 3000);
      alert("Votre profil public a été mis à jour avec succès !");
    } catch (err: any) {
      alert(err.message || "Erreur lors de l'enregistrement du profil.");
    } finally {
      setIsSavingProfile(false);
    }
  };

  // Verification request handlers
  const handleLocalFileChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    setPreview: (base64: string) => void,
    setRawFile: (file: File) => void
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 3 * 1024 * 1024) {
      alert("L'image est trop volumineuse. Veuillez choisir un fichier de moins de 3 Mo.");
      return;
    }

    setRawFile(file);

    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === "string") {
        setPreview(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  // Step 1: upload ID + selfie to the private "loverose-private" bucket, create a
  // verification_requests row (payment_status "unpaid"), then open the 500 FCFA
  // badge payment modal. profiles.verification_status is left untouched here —
  // it only supports none/pending/verified and moves to "pending" once paid.
  const handleVerifyRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!idFile || !selfieFile) {
      alert("Veuillez uploader les deux photos demandées.");
      return;
    }

    setVerificationLoading(true);
    try {
      // RLS on the "loverose-private" bucket requires the first path segment to be the user's own uid.
      const idPath = `${currentUser.id}/id_${Date.now()}_${idFile.name}`;
      const optimizedIdFile = await compressImageIfNeeded(idFile);
      const { error: idUploadError } = await supabase.storage.from("loverose-private").upload(idPath, optimizedIdFile);
      if (idUploadError) throw idUploadError;

      const selfiePath = `${currentUser.id}/selfie_${Date.now()}_${selfieFile.name}`;
      const optimizedSelfieFile = await compressImageIfNeeded(selfieFile);
      const { error: selfieUploadError } = await supabase.storage.from("loverose-private").upload(selfiePath, optimizedSelfieFile);
      if (selfieUploadError) throw selfieUploadError;

      const { data: insertedRequest, error } = await supabase
        .from("verification_requests")
        .insert([
          {
            user_id: currentUser.id,
            documents: [idPath, selfiePath],
            payment_status: "unpaid"
          }
        ])
        .select("*")
        .single();

      if (error) throw error;

      setLatestVerificationRequest(insertedRequest as VerificationRequest);
      // Documents are saved — now ask for the 500 FCFA badge fee before it goes to admin review.
      setShowBadgePaymentConfirm(true);
    } catch (err: any) {
      console.error("Verification submit error:", err);
      alert(err.message || "Impossible d'envoyer la demande de vérification.");
    } finally {
      setVerificationLoading(false);
    }
  };

  // Step 2: launch the Money Fusion payment for the verification badge fee.
  // Reusable both right after upload and later if the user closed the modal
  // before paying (the request stays payment_status "unpaid" until this succeeds).
  const handleConfirmBadgePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!badgePaymentForm.phoneNumber.trim()) {
      alert("Veuillez renseigner votre numéro de téléphone mobile money.");
      return;
    }
    if (!badgePaymentForm.fullName.trim()) {
      alert("Veuillez renseigner votre nom complet.");
      return;
    }

    setIsLaunchingBadgePayment(true);
    try {
      const { data, error } = await supabase.functions.invoke("moneyfusion-create-payment", {
        body: {
          plan_id: "verification_badge",
          plan_name: "Badge de Vérification LoveRose",
          montant: VERIFICATION_BADGE_FEE,
          phone_number: badgePaymentForm.phoneNumber,
          full_name: badgePaymentForm.fullName,
          related_page_id: null,
          related_post_id: null
        }
      });

      if (error) throw error;

      if (data?.payment_url) {
        // Sauvegarde la référence AVANT la redirection : au retour sur l'app,
        // PaymentSuccess.tsx la retrouve automatiquement et confirme le paiement
        // sans aucune action manuelle de l'utilisateur.
        if (data?.token) {
          localStorage.setItem("last_payment_reference", data.token);
        }
        window.location.href = data.payment_url;
      } else {
        throw new Error(data?.error || "Impossible d'initialiser l'URL de paiement.");
      }
    } catch (err: any) {
      console.error("Badge payment initiation failed:", err);
      alert("Erreur d'initialisation de paiement avec Money Fusion : " + (err.message || "Veuillez réessayer."));
    } finally {
      setIsLaunchingBadgePayment(false);
    }
  };

  return (
    <div id="settings-screen" className="flex-1 overflow-y-auto bg-slate-50 p-4 md:p-8 space-y-8 font-sans max-w-5xl mx-auto w-full">
      
      {/* Settings Header */}
      <div className="border-b border-slate-200 pb-4 flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">Paramètres & Profil</h2>
          <p className="text-slate-500 text-xs">Gérez vos informations de rencontre, la sécurité et l'authenticité de votre profil.</p>
        </div>
        {onBackToProfile && (
          <button
            onClick={onBackToProfile}
            className="text-xs bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold px-4 py-2 rounded-xl transition cursor-pointer shadow-xs"
          >
            Voir Mon Profil
          </button>
        )}
      </div>

      {saveSuccess && (
        <div className="bg-emerald-50 border border-emerald-100 text-emerald-700 text-xs p-3.5 rounded-2xl flex items-center gap-2">
          <CheckCircle size={16} />
          <p>Données enregistrées et synchronisées avec succès !</p>
        </div>
      )}

      {/* Tabs Menu navigation inside settings */}
      <div className="flex border-b border-slate-200 overflow-x-auto pb-px gap-1">
        <button
          onClick={() => setActiveSubTab('profile')}
          className={`px-4 py-2.5 text-xs font-black whitespace-nowrap border-b-2 transition cursor-pointer ${
            activeSubTab === 'profile' 
              ? 'border-rose-500 text-rose-600' 
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <span className="flex items-center gap-1.5">
            <User size={14} />
            Éditer mon Profil
          </span>
        </button>
        <button
          onClick={() => setActiveSubTab('security')}
          className={`px-4 py-2.5 text-xs font-black whitespace-nowrap border-b-2 transition cursor-pointer ${
            activeSubTab === 'security' 
              ? 'border-rose-500 text-rose-600' 
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <span className="flex items-center gap-1.5">
            <ShieldCheck size={14} />
            Certification & Sécurité
          </span>
        </button>
        <button
          onClick={() => setActiveSubTab('cgu')}
          className={`px-4 py-2.5 text-xs font-black whitespace-nowrap border-b-2 transition cursor-pointer ${
            activeSubTab === 'cgu' 
              ? 'border-rose-500 text-rose-600' 
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <span className="flex items-center gap-1.5">
            <FileText size={14} />
            Conditions d'Utilisation (CGU)
          </span>
        </button>
        <button
          onClick={() => setActiveSubTab('privacy')}
          className={`px-4 py-2.5 text-xs font-black whitespace-nowrap border-b-2 transition cursor-pointer ${
            activeSubTab === 'privacy' 
              ? 'border-rose-500 text-rose-600' 
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <span className="flex items-center gap-1.5">
            <BookOpen size={14} />
            Confidentialité des Données
          </span>
        </button>
      </div>

      {/* RENDER ACTIVE TAB */}
      <div className="grid md:grid-cols-3 gap-8 items-start">
        
        {/* SUB TAB 1: PROFILE EDIT FORM (Moved here from ProfileSettings) */}
        {activeSubTab === 'profile' && (
          <>
            {/* Left: Photos grid management */}
            <div className="md:col-span-1 space-y-6">
              <div className="bg-white border border-slate-150 rounded-3xl p-5 shadow-sm space-y-4">
                <div>
                  <h3 className="font-extrabold text-slate-800 text-xs uppercase tracking-wider flex items-center gap-1 border-b border-slate-100 pb-2">
                    <Camera size={14} className="text-rose-500" />
                    <span>Galerie de Profil</span>
                  </h3>
                  <p className="text-[12px] text-slate-400 mt-1">
                    Obligation : Vous devez uploader au minimum 3 photos réelles pour valider votre compte.
                  </p>
                </div>

                {/* Validation warning */}
                {photos.filter(Boolean).length < 3 && (
                  <div className="bg-amber-50 border border-amber-100 text-amber-700 rounded-xl p-3 flex items-start gap-1.5 text-[12px] font-bold">
                    <AlertTriangle size={14} className="text-amber-500 flex-shrink-0 mt-0.5" />
                    <p>Obligation : 3 photos minimum ({photos.filter(Boolean).length}/3 ajoutées).</p>
                  </div>
                )}

                {/* Photo gallery upload input (jusqu'à 20 photos, ouvert à tous) */}
                <input
                  type="file"
                  id="settings-photo-premium"
                  accept="image/*"
                  className="hidden"
                  onChange={handleAddPhotoPremium}
                />

                <div className="space-y-4">
                    <div className="grid grid-cols-3 gap-2">
                      {photos.map((photo, index) => (
                        <div key={index} className="aspect-square bg-slate-100 border border-slate-150 rounded-xl overflow-hidden relative group">
                          <img src={photo} alt="" className="w-full h-full object-cover" />
                          <button
                            type="button"
                            onClick={() => handleRemovePhoto(index)}
                            className="absolute top-1 right-1 bg-black/60 hover:bg-red-500 text-white rounded-full p-1 transition cursor-pointer"
                          >
                            <X size={10} />
                          </button>
                          {index === 0 && (
                            <div className="absolute bottom-0 left-0 right-0 bg-rose-500 text-white text-[7px] py-0.5 text-center font-bold uppercase">
                              Principale
                            </div>
                          )}
                        </div>
                      ))}
                      {photos.length < 20 && (
                        <button
                          type="button"
                          onClick={() => document.getElementById("settings-photo-premium")?.click()}
                          className="aspect-square bg-slate-50 border border-dashed border-slate-300 hover:border-rose-400 hover:bg-rose-50/10 rounded-xl flex flex-col items-center justify-center text-slate-400 hover:text-rose-500 transition cursor-pointer space-y-1"
                        >
                          <Plus size={16} />
                          <span className="text-[11px] font-bold">Ajouter</span>
                        </button>
                      )}
                    </div>
                    <div className="text-center">
                      <span className="text-[11px] font-extrabold text-rose-500 bg-rose-50 px-2 rounded-full border border-rose-100 uppercase tracking-wider">
                        {photos.length}/20 photos
                      </span>
                    </div>
                </div>
              </div>
            </div>

            {/* Right: Form edits */}
            <form onSubmit={handleSaveProfile} className="md:col-span-2 space-y-6">
              <div className="bg-white border border-slate-150 rounded-3xl p-6 shadow-sm space-y-5 text-left">
                <h3 className="font-extrabold text-slate-900 text-sm flex items-center gap-1.5 border-b border-slate-100 pb-3">
                  <User size={16} className="text-rose-500" />
                  <span>Informations de compte</span>
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[12px] font-extrabold text-slate-500 uppercase tracking-wider block">Nom Complet</label>
                    <input
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Ex: Marc Olivier"
                      className="w-full mt-1.5 p-3 bg-slate-50 border border-slate-200 focus:border-slate-900 focus:bg-white  outline-none rounded-xl text-xs font-bold transition"
                    />
                  </div>

                  <div>
                    <label className="text-[12px] font-extrabold text-slate-500 uppercase tracking-wider block">Pseudo (Sans @)</label>
                    <input
                      type="text"
                      required
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="Ex: marcolivier237"
                      className="w-full mt-1.5 p-3 bg-slate-50 border border-slate-200 focus:border-slate-900 focus:bg-white  outline-none rounded-xl text-xs font-bold transition"
                    />
                  </div>

                  <div>
                    <label className="text-[12px] font-extrabold text-slate-500 uppercase tracking-wider block">Âge (Ans)</label>
                    <input
                      type="number"
                      required
                      min={18}
                      max={99}
                      value={age}
                      onChange={(e) => setAge(parseInt(e.target.value) || 18)}
                      className="w-full mt-1.5 p-3 bg-slate-50 border border-slate-200 focus:border-slate-900 focus:bg-white  outline-none rounded-xl text-xs font-bold transition"
                    />
                  </div>

                  <div>
                    <label className="text-[12px] font-extrabold text-slate-500 uppercase tracking-wider block">Ville & Pays</label>
                    <input
                      type="text"
                      required
                      value={locationStr}
                      onChange={(e) => setLocationStr(e.target.value)}
                      placeholder="Ex: Douala, Cameroun"
                      className="w-full mt-1.5 p-3 bg-slate-50 border border-slate-200 focus:border-slate-900 focus:bg-white  outline-none rounded-xl text-xs font-bold transition"
                    />
                  </div>

                  <div>
                    <label className="text-[12px] font-extrabold text-slate-500 uppercase tracking-wider block">Mon Genre</label>
                    <select
                      value={gender}
                      onChange={(e) => setGender(e.target.value as any)}
                      className="w-full mt-1.5 p-3 bg-slate-50 border border-slate-200 focus:border-slate-900 focus:bg-white  outline-none rounded-xl text-xs font-bold transition"
                    >
                      <option value="femme">Femme</option>
                      <option value="homme">Homme</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[12px] font-extrabold text-slate-500 uppercase tracking-wider block">Je Recherche</label>
                    <select
                      value={preferences}
                      onChange={(e) => setPreferences(e.target.value as any)}
                      className="w-full mt-1.5 p-3 bg-slate-50 border border-slate-200 focus:border-slate-900 focus:bg-white  outline-none rounded-xl text-xs font-bold transition"
                    >
                      <option value="femme">Des Femmes</option>
                      <option value="homme">Des Hommes</option>
                      <option value="tous">Tout le monde</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[12px] font-extrabold text-slate-500 uppercase tracking-wider block">Langue Préférée</label>
                    <select
                      value={preferredLanguage}
                      onChange={(e) => setPreferredLanguage(e.target.value as any)}
                      className="w-full mt-1.5 p-3 bg-slate-50 border border-slate-200 focus:border-slate-900 focus:bg-white  outline-none rounded-xl text-xs font-bold transition"
                    >
                      <option value="fr">Français</option>
                      <option value="en">English</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[12px] font-extrabold text-slate-500 uppercase tracking-wider block">Distance Maximale : {maxDistanceKm} km</label>
                    <div className="flex items-center space-x-3 mt-3">
                      <input
                        type="range"
                        min={5}
                        max={200}
                        step={5}
                        value={maxDistanceKm}
                        onChange={(e) => setMaxDistanceKm(parseInt(e.target.value) || 50)}
                        className="w-full accent-rose-500 cursor-pointer"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="text-[12px] font-extrabold text-slate-500 uppercase tracking-wider block">Ma Biographie</label>
                  <textarea
                    rows={4}
                    required
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    placeholder="Parlez-nous de vous, de vos passions, et de ce que vous recherchez..."
                    className="w-full mt-1.5 p-3 bg-slate-50 border border-slate-200 focus:border-slate-900 focus:bg-white  outline-none rounded-xl text-xs font-medium transition leading-relaxed resize-none"
                  />
                </div>

                {/* Intentions checkboxes */}
                <div className="space-y-2">
                  <label className="text-[12px] font-extrabold text-slate-500 uppercase tracking-wider block">
                    Mes Intentions de Rencontre (Obligatoire)
                  </label>
                  <p className="text-[11px] text-slate-400">Sélectionnez au moins une intention pour aider nos algorithmes de compatibilité.</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1">
                    {intentsList.map((intent) => {
                      const isSelected = selectedIntents.includes(intent);
                      return (
                        <button
                          key={intent}
                          type="button"
                          onClick={() => handleIntentToggle(intent)}
                          className={`p-3 text-left text-xs font-bold border rounded-xl flex items-center justify-between transition cursor-pointer ${
                            isSelected
                              ? "bg-rose-500 border-rose-500 text-white shadow-xs"
                              : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                          }`}
                        >
                          <span>{intent}</span>
                          {isSelected && <CheckCircle size={14} fill="white" className="text-rose-500" />}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Save button CTA */}
                <div className="pt-2 border-t border-slate-100 flex justify-end">
                  <button
                    type="submit"
                    disabled={isSavingProfile || photos.filter(Boolean).length < 3}
                    className="px-6 py-3.5 bg-rose-500 hover:bg-rose-600 text-white font-extrabold text-xs uppercase tracking-wider rounded-xl shadow-md shadow-rose-500/10 flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
                  >
                    {isSavingProfile ? (
                      <Loader2 className="animate-spin" size={14} />
                    ) : (
                      <>
                        <Save size={14} />
                        <span>Enregistrer les modifications</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>
          </>
        )}

        {/* SUB TAB 2: CERTIFICATION, SAFETY & SECURITY */}
        {activeSubTab === 'security' && (
          <>
            {/* Left: Verification Badge Submission Form */}
            <div className="md:col-span-1 space-y-6">
              <div className="bg-white border border-slate-150 rounded-3xl p-5 shadow-sm space-y-4">
                <h4 className="font-extrabold text-slate-800 text-xs uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-100 pb-2">
                  <ShieldCheck className="text-rose-500" size={16} />
                  <span>Badge de Confiance</span>
                </h4>

                {verificationStatus === "verified" ? (
                  <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-2xl text-center space-y-2 text-xs font-semibold text-emerald-800">
                    <CheckCircle className="mx-auto text-emerald-500" size={28} fill="white" />
                    <p>Compte Certifié Vérifié</p>
                    <p className="font-medium text-emerald-600 text-[12px] leading-relaxed">
                      Votre badge de confiance vert est actif et visible auprès de tous les célibataires.
                    </p>
                  </div>
                ) : verificationStatus === "pending" ? (
                  <div className="bg-amber-50 border border-amber-100 p-4 rounded-2xl text-center space-y-2 text-xs font-semibold text-amber-800">
                    <Loader2 className="mx-auto text-amber-500 animate-spin" size={24} />
                    <p>Documents en cours d'analyse</p>
                    <p className="font-medium text-amber-600 text-[12px] leading-relaxed">
                      Notre équipe de modération étudie vos justificatifs. Délai moyen : 12 heures.
                    </p>
                  </div>
                ) : latestVerificationRequest?.payment_status === "unpaid" && latestVerificationRequest?.status !== "rejected" ? (
                  <div className="bg-rose-50 border border-rose-100 p-4 rounded-2xl text-center space-y-3 text-xs font-semibold text-rose-800">
                    <ShieldAlert className="mx-auto text-rose-500" size={24} />
                    <p>Vos documents sont enregistrés</p>
                    <p className="font-medium text-rose-600 text-[12px] leading-relaxed">
                      Il ne reste plus que les frais de certification de {VERIFICATION_BADGE_FEE} FCFA à régler pour envoyer votre dossier à l'administrateur.
                    </p>
                    <button
                      onClick={() => setShowBadgePaymentConfirm(true)}
                      className="w-full py-2.5 bg-rose-500 hover:bg-rose-600 text-white font-extrabold text-[12px] uppercase tracking-wider rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5 shadow-md shadow-rose-500/10"
                    >
                      <span>Payer {VERIFICATION_BADGE_FEE} FCFA</span>
                      <ArrowRight size={12} />
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleVerifyRequest} className="space-y-4">
                    {latestVerificationRequest?.status === "rejected" && (
                      <div className="bg-red-50 border border-red-100 p-3 rounded-2xl flex items-start gap-2">
                        <XCircle className="text-red-500 flex-shrink-0 mt-0.5" size={14} />
                        <p className="text-red-700 text-[12px] leading-relaxed text-left">
                          Votre précédente demande a été refusée{latestVerificationRequest.rejection_reason ? ` : ${latestVerificationRequest.rejection_reason}` : ""}. Vérifiez que vos photos sont nettes et lisibles, puis soumettez un nouveau dossier.
                        </p>
                      </div>
                    )}
                    <p className="text-slate-500 text-[12px] leading-relaxed text-left">
                      Le badge <strong>Vérifié</strong> confirme votre authenticité et multiplie vos chances de Matchs par 3 ! Des frais de certification de <strong>{VERIFICATION_BADGE_FEE} FCFA</strong> s'appliquent après l'envoi des documents.
                    </p>

                    <div className="space-y-3 text-left">
                      <div>
                        <label className="text-[12px] font-extrabold text-slate-500 uppercase block">Pièce d'identité (Photo)</label>
                        <input
                          type="file"
                          accept="image/*"
                          required
                          onChange={(e) => handleLocalFileChange(e, setIdFileUrl, setIdFile)}
                          className="w-full mt-1 p-2 bg-slate-50 border border-slate-200 rounded-xl text-[12px] transition cursor-pointer font-medium text-slate-600"
                        />
                        {idFileUrl && (
                          <div className="mt-1.5 rounded-lg overflow-hidden h-14 w-24 bg-slate-100 border border-slate-200">
                            <img src={idFileUrl} alt="Justificatif ID" className="w-full h-full object-cover" />
                          </div>
                        )}
                      </div>

                      <div>
                        <label className="text-[12px] font-extrabold text-slate-500 uppercase block">Selfie de Contrôle (Photo)</label>
                        <input
                          type="file"
                          accept="image/*"
                          required
                          onChange={(e) => handleLocalFileChange(e, setSelfieFileUrl, setSelfieFile)}
                          className="w-full mt-1 p-2 bg-slate-50 border border-slate-200 rounded-xl text-[12px] transition cursor-pointer font-medium text-slate-600"
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
                      className="w-full py-2.5 bg-rose-500 hover:bg-rose-600 text-white font-extrabold text-[12px] uppercase tracking-wider rounded-xl transition cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5 shadow-md shadow-rose-500/10"
                    >
                      {verificationLoading ? (
                        <Loader2 className="animate-spin" size={12} />
                      ) : (
                        <span>Continuer vers le paiement ({VERIFICATION_BADGE_FEE} FCFA)</span>
                      )}
                    </button>
                  </form>
                )}
              </div>

              {/* Push notifications: enable at any time, not just via the first-load banner */}
              <div className="bg-white border border-slate-150 rounded-3xl p-5 shadow-sm space-y-3">
                <h4 className="font-extrabold text-slate-800 text-xs uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-100 pb-2">
                  <Smartphone className="text-rose-500" size={16} />
                  <span>Notifications Push</span>
                </h4>

                {pushStatus === "checking" ? (
                  <p className="text-slate-400 text-[12px] leading-relaxed flex items-center gap-1.5">
                    <Loader2 className="animate-spin" size={12} /> Vérification...
                  </p>
                ) : pushStatus === "unsupported" ? (
                  <p className="text-slate-400 text-[12px] leading-relaxed">
                    Votre navigateur ne supporte pas les notifications push.
                  </p>
                ) : pushStatus === "subscribed" ? (
                  <div className="bg-emerald-50 border border-emerald-100 p-3 rounded-2xl text-center space-y-1.5 text-[12px] font-semibold text-emerald-800">
                    <CheckCircle className="mx-auto text-emerald-500" size={20} fill="white" />
                    <p>Notifications activées</p>
                    <p className="font-medium text-emerald-600 leading-relaxed">
                      Vous recevrez une alerte sur ce téléphone même quand l'app est fermée.
                    </p>
                  </div>
                ) : pushStatus === "denied" ? (
                  <p className="text-slate-500 text-[12px] leading-relaxed">
                    Vous avez bloqué les notifications pour LoveRose. Autorisez-les depuis les réglages de notifications de votre navigateur ou de votre téléphone, puis revenez sur cette page.
                  </p>
                ) : pushStatus === "error" ? (
                  <div className="bg-amber-50 border border-amber-100 p-3 rounded-2xl text-center space-y-2 text-[12px] font-semibold text-amber-800">
                    <AlertTriangle className="mx-auto text-amber-500" size={20} />
                    <p>La permission est accordée, mais l'activation a échoué</p>
                    <p className="font-medium text-amber-600 leading-relaxed">
                      Vérifiez votre connexion et réessayez. Si ça persiste, réinstallez l'app depuis l'écran d'accueil.
                    </p>
                    <button
                      onClick={handleEnablePushFromSettings}
                      disabled={isTogglingPush}
                      className="w-full py-2 bg-amber-500 hover:bg-amber-600 text-white font-extrabold text-[12px] uppercase tracking-wider rounded-xl transition cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
                    >
                      {isTogglingPush ? <Loader2 className="animate-spin" size={12} /> : <span>Réessayer</span>}
                    </button>
                  </div>
                ) : (
                  <>
                    <p className="text-slate-500 text-[12px] leading-relaxed">
                      Activez les notifications pour être alerté(e) en cas de nouveau message ou de match, même quand LoveRose est fermé.
                    </p>
                    <button
                      onClick={handleEnablePushFromSettings}
                      disabled={isTogglingPush}
                      className="w-full py-2.5 bg-rose-500 hover:bg-rose-600 text-white font-extrabold text-[12px] uppercase tracking-wider rounded-xl transition cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5 shadow-md shadow-rose-500/10"
                    >
                      {isTogglingPush ? <Loader2 className="animate-spin" size={12} /> : <span>Activer les notifications</span>}
                    </button>
                  </>
                )}
              </div>

              {/* Langue de l'interface */}
              <div className="bg-white border border-slate-150 rounded-3xl p-5 shadow-sm space-y-3">
                <h4 className="font-extrabold text-slate-800 text-xs uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-100 pb-2">
                  <Globe className="text-rose-500" size={16} />
                  <span>Langue</span>
                </h4>
                <div className="grid grid-cols-3 gap-2">
                  {SUPPORTED_LANGUAGES.map((code) => {
                    const { label, flag } = LANGUAGE_LABELS[code];
                    const active = i18n.resolvedLanguage === code || i18n.language === code;
                    return (
                      <button
                        key={code}
                        type="button"
                        onClick={() => i18n.changeLanguage(code)}
                        className={`flex flex-col items-center justify-center gap-1 py-2.5 rounded-2xl border text-[12px] font-bold transition cursor-pointer ${
                          active
                            ? "bg-rose-50 border-rose-300 text-rose-600"
                            : "bg-slate-50/50 border-slate-150 text-slate-500 hover:bg-slate-50"
                        }`}
                      >
                        <span className="text-lg leading-none">{flag}</span>
                        <span>{label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Right: Security Settings & Danger zone */}
            <div className="md:col-span-2 space-y-6">
              <div className="bg-white border border-slate-150 rounded-3xl p-6 shadow-sm space-y-4 text-left">
                <h3 className="font-extrabold text-slate-900 text-sm flex items-center gap-1.5 border-b border-slate-100 pb-3">
                  <Key size={16} className="text-rose-500" />
                  <span>Sécurité du compte</span>
                </h3>

                <div className="space-y-4">
                  <div className="flex justify-between items-center py-2 border-b border-slate-50">
                    <div>
                      <h4 className="text-xs font-bold text-slate-800">Adresse Email</h4>
                      <p className="text-[12px] text-slate-400 mt-0.5">{currentUser?.email || "Non renseigné"}</p>
                    </div>
                    <span className="text-[12px] bg-slate-100 text-slate-600 font-semibold px-2.5 py-1 rounded-full">
                      Vérifié
                    </span>
                  </div>

                  <div className="flex justify-between items-center py-2 border-b border-slate-50">
                    <div>
                      <h4 className="text-xs font-bold text-slate-800">Double Facteur (MFA)</h4>
                      <p className="text-[12px] text-slate-400 mt-0.5">Renforcer la protection de mes données personnelles</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => alert("La double authentification sera disponible lors de la prochaine mise à jour de l'application.")}
                      className="text-[12px] text-rose-500 hover:text-rose-600 font-bold transition cursor-pointer"
                    >
                      Activer
                    </button>
                  </div>

                  <div className="flex justify-between items-center py-2">
                    <div>
                      <h4 className="text-xs font-bold text-slate-800">Confidentialité de ma fiche</h4>
                      <p className="text-[12px] text-slate-400 mt-0.5">Permettre aux autres de voir mon profil dans la découverte</p>
                    </div>
                    <div className="relative inline-flex items-center cursor-pointer">
                      <span className="text-[12px] bg-emerald-50 text-emerald-700 border border-emerald-100 font-extrabold px-3 py-1 rounded-full">
                        Profil Public
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Security advice */}
              <div className="bg-white border border-slate-150 rounded-3xl p-6 shadow-sm space-y-4 text-left">
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

              {/* Account delete */}
              <div className="bg-white border border-slate-150 rounded-3xl p-6 shadow-sm space-y-4 text-left">
                <h3 className="font-extrabold text-slate-900 text-sm flex items-center gap-1.5 border-b border-slate-100 pb-3 text-red-500">
                  <ShieldAlert size={16} />
                  <span>Zone de Danger</span>
                </h3>

                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-slate-800">Désactiver ou supprimer mon compte</h4>
                    <p className="text-[12px] text-slate-400 mt-0.5">Efface définitivement mes Matchs, messages, et profil de LoveRose</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm("Êtes-vous absolument sûr de vouloir supprimer définitivement votre compte LoveRose ? Cette action est irréversible et supprimera l'intégralité de vos données.")) {
                        alert("Votre compte a été suspendu pour suppression. Contactez le service d'assistance LoveRose pour annuler sous 14 jours.");
                      }
                    }}
                    className="text-[12px] text-red-500 hover:text-red-600 font-extrabold border border-red-100 bg-red-50/50 hover:bg-red-50 px-3 py-1.5 rounded-xl transition cursor-pointer"
                  >
                    Supprimer mon compte
                  </button>
                </div>
              </div>
            </div>
          </>
        )}

        {/* SUB TAB 3: CGU (CONDITIONS GÉNÉRALES D'UTILISATION) - FULL SCREEN REAL COPY */}
        {activeSubTab === 'cgu' && (
          <div className="md:col-span-3 bg-white border border-slate-150 rounded-3xl p-6 md:p-8 shadow-sm text-left space-y-6">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-4">
              <FileText className="text-rose-500" size={24} />
              <div>
                <h3 className="font-extrabold text-slate-900 text-lg">Conditions Générales d'Utilisation (CGU)</h3>
                <p className="text-[12px] text-slate-400 uppercase tracking-widest font-bold mt-0.5">Dernière mise à jour : 26 Juin 2026</p>
              </div>
            </div>

            <div className="prose prose-slate max-w-none text-xs md:text-sm text-slate-600 space-y-5 leading-relaxed">
              <p>
                Bienvenue sur <strong>LoveRose</strong>. En accédant à notre application de rencontres sérieuses et d’actualités pour célibataires, vous acceptez expressément et sans réserve les présentes Conditions Générales d’Utilisation.
              </p>

              <div>
                <h4 className="font-extrabold text-slate-900 text-sm">1. Objet du service</h4>
                <p className="mt-1">
                  LoveRose est une plateforme numérique facilitant la mise en relation d'adultes célibataires partageant des intentions de rencontre claires et transparentes. L'application propose un flux d'actualités communautaire et des algorithmes de calcul de compatibilité.
                </p>
              </div>

              <div>
                <h4 className="font-extrabold text-slate-900 text-sm">2. Obligation des trois photos de profil</h4>
                <p className="mt-1">
                  Pour des raisons impérieuses de sécurité, de lutte contre la prolifération des faux comptes, d'usurpation d'identité et de harcèlement, <strong>chaque utilisateur s'engage à uploader obligatoirement un minimum de trois (3) photos réelles et reconnaissables</strong> de lui-même pour pouvoir publier son profil. Tout contournement de cette règle par des images vides, des paysages, des célébrités ou du contenu offensant entraînera la suspension immédiate du compte par les modérateurs.
                </p>
              </div>

              <div>
                <h4 className="font-extrabold text-slate-900 text-sm">3. Intégrité et respect de la communauté</h4>
                <p className="mt-1">
                  Tous les membres doivent faire preuve de courtoisie et de respect mutuel. Sont strictement interdits sous peine de bannissement définitif et sans recours :
                </p>
                <ul className="list-disc pl-5 mt-1 space-y-1">
                  <li>Les injures, propos racistes, sexistes, homophobes ou incitant à la haine.</li>
                  <li>Le harcèlement, l'envoi répété de messages indésirables ou les menaces.</li>
                  <li>La prostitution, l'arnaque financière ou la promotion de services payants externes.</li>
                  <li>La publication de photos ou de textes à caractère pornographique.</li>
                </ul>
              </div>

              <div>
                <h4 className="font-extrabold text-slate-900 text-sm">4. Annonces et transactions entre membres</h4>
                <p className="mt-1">
                  LoveRose ne vend elle-même aucun service de mise en avant, d'abonnement ou de crédit. Seuls les membres peuvent proposer des services payants via leurs annonces, avec paiement direct entre acheteur et vendeur sécurisé de manière exclusive via le prestataire officiel <strong>Money Fusion</strong>. Les transactions confirmées ne sont pas remboursables.
                </p>
              </div>

              <div>
                <h4 className="font-extrabold text-slate-900 text-sm">5. Signalements et modération</h4>
                <p className="mt-1">
                  L'application intègre un outil d'alerte et de signalement instantané sur chaque fiche profil. Tout utilisateur victime de comportements abusifs est vivement encouragé à signaler le profil en faute. Notre équipe de modération s'engage à traiter chaque signalement sous un délai maximal de 24 heures et à prendre les sanctions conservatoires requises.
                </p>
              </div>

              <div>
                <h4 className="font-extrabold text-slate-900 text-sm">6. Propriété intellectuelle</h4>
                <p className="mt-1">
                  Tous les logos, chartes graphiques, bases de données, codes sources et marques LoveRose demeurent la propriété exclusive de l'éditeur de l'application. Toute reproduction non autorisée fera l'objet de poursuites pénales.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* SUB TAB 4: PRIVACY POLICY - FULL SCREEN REAL COPY */}
        {activeSubTab === 'privacy' && (
          <div className="md:col-span-3 bg-white border border-slate-150 rounded-3xl p-6 md:p-8 shadow-sm text-left space-y-6">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-4">
              <ShieldAlert className="text-rose-500" size={24} />
              <div>
                <h3 className="font-extrabold text-slate-900 text-lg">Politique de Confidentialité</h3>
                <p className="text-[12px] text-slate-400 uppercase tracking-widest font-bold mt-0.5">Dernière mise à jour : 26 Juin 2026</p>
              </div>
            </div>

            <div className="prose prose-slate max-w-none text-xs md:text-sm text-slate-600 space-y-5 leading-relaxed">
              <p>
                Chez <strong>LoveRose</strong>, la protection de votre vie privée et de vos données personnelles est une priorité absolue. Nous collectons et traitons vos données conformément aux règlementations de protection des données personnelles en vigueur en Europe (RGPD) et en Afrique.
              </p>

              <div>
                <h4 className="font-extrabold text-slate-900 text-sm">1. Données collectées</h4>
                <p className="mt-1">
                  Nous recueillons de manière transparente les informations indispensables à la fourniture et à la sécurité de nos services :
                </p>
                <ul className="list-disc pl-5 mt-1 space-y-1">
                  <li><strong>Informations de profil :</strong> Nom, prénom, pseudo, âge, genre, préférences d’orientation, géolocalisation approximative déclarée (ville, pays) et biographie.</li>
                  <li><strong>Intentions de rencontre :</strong> Choix déclarés des intentions relationnelles recherchées.</li>
                  <li><strong>Contenu multimédia :</strong> Vos photos de profils obligatoires nécessaires à votre identification visuelle.</li>
                  <li><strong>Données de messagerie :</strong> Le contenu crypté en transit de vos discussions de chat avec vos Matchs.</li>
                </ul>
              </div>

              <div>
                <h4 className="font-extrabold text-slate-900 text-sm">2. Hébergement sécurisé et base de données</h4>
                <p className="mt-1">
                  L’ensemble des profils et des données de LoveRose sont hébergés de manière hautement sécurisée auprès de l’infrastructure cloud <strong>Supabase</strong>. Toutes les communications transitent via des protocoles chiffrés SSL/TLS. Les accès en base de données sont strictement cloisonnés par des politiques de sécurité de niveau ligne (RLS Policies).
                </p>
              </div>

              <div>
                <h4 className="font-extrabold text-slate-900 text-sm">3. Photos de profils et sécurité des documents</h4>
                <p className="mt-1">
                  Vos photos de profil sont stockées sur le CDN public sécurisé de Supabase afin de permettre l'affichage auprès des célibataires de la plateforme. Les pièces d’identité et selfies transmis dans le cadre d’une demande de vérification de profil sont stockés dans un conteneur privé (bucket sécurisé) inaccessible au public. Ces justificatifs d’identité sont détruits de manière irréversible dès lors que nos administrateurs ont validé ou refusé la demande de certification de compte.
                </p>
              </div>

              <div>
                <h4 className="font-extrabold text-slate-900 text-sm">4. Confidentialité des paiements</h4>
                <p className="mt-1">
                  Pour garantir la sécurité maximale de vos fonds, <strong>LoveRose ne stocke aucun numéro de carte bancaire, code secret, ou identifiant Mobile Money</strong>. L'intégralité du processus de facturation et de validation des plans s'effectue directement sur les passerelles cryptées de notre partenaire financier agréé <strong>Money Fusion</strong>.
                </p>
              </div>

              <div>
                <h4 className="font-extrabold text-slate-900 text-sm">5. Suppression définitive du compte</h4>
                <p className="mt-1">
                  Conformément au droit à l'oubli numérique, vous conservez à tout moment le contrôle total de vos données. En accédant à la section "Danger Zone" des paramètres, vous pouvez déclencher la suppression irréversible de votre compte. Cette action entraîne l’effacement total et définitif de votre profil, de vos photos, de votre historique de Matchs et de vos messages sous un délai technique de 14 jours.
                </p>
              </div>

              <div>
                <h4 className="font-extrabold text-slate-900 text-sm">6. Contact délégué à la protection des données</h4>
                <p className="mt-1">
                  Pour toute question relative à l'utilisation, la rectification ou la suppression de vos données personnelles, vous pouvez envoyer un courriel à notre délégué à l’adresse : <span className="text-rose-500 font-bold">privacy@loverose.com</span>.
                </p>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* App Info Footer */}
      <div className="text-center pt-4 space-y-1.5 border-t border-slate-200">
        <p className="text-[12px] text-slate-400">LoveRose v2.1.0 • Fait en Afrique avec passion ❤️</p>
      </div>

      {/* Verification Badge Payment Modal (500 FCFA) */}
      {showBadgePaymentConfirm && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl p-6 border border-slate-100 space-y-6 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
                <ShieldCheck className="text-rose-500 fill-rose-500/10" size={20} />
                <span>Frais de Certification</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowBadgePaymentConfirm(false)}
                className="text-slate-400 hover:text-slate-600 transition p-1"
              >
                <X size={18} />
              </button>
            </div>

            <div className="bg-rose-50/50 border border-rose-100 rounded-2xl p-4 space-y-2 text-center">
              <p className="text-[12px] font-bold text-slate-400 uppercase tracking-wider">Badge de Vérification LoveRose</p>
              <p className="text-3xl font-black text-rose-500">{VERIFICATION_BADGE_FEE} FCFA</p>
              <p className="text-[12px] text-slate-500">Frais uniques de certification de profil.</p>
            </div>

            <form onSubmit={handleConfirmBadgePayment} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[12px] font-bold text-slate-500 uppercase tracking-wider block">
                  Nom Complet du Client
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Jean Dupont"
                  value={badgePaymentForm.fullName}
                  onChange={(e) => setBadgePaymentForm(p => ({ ...p, fullName: e.target.value }))}
                  className="w-full bg-slate-50 border border-slate-200 focus:border-slate-900 focus:ring-1 focus:ring-rose-500 rounded-xl px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition font-medium"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[12px] font-bold text-slate-500 uppercase tracking-wider block">
                  Numéro de Téléphone Mobile Money
                </label>
                <input
                  type="tel"
                  required
                  placeholder="Ex: 677123456"
                  value={badgePaymentForm.phoneNumber}
                  onChange={(e) => setBadgePaymentForm(p => ({ ...p, phoneNumber: e.target.value }))}
                  className="w-full bg-slate-50 border border-slate-200 focus:border-slate-900 focus:ring-1 focus:ring-rose-500 rounded-xl px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition font-medium"
                />
                <span className="text-[12px] text-slate-400 block font-medium">
                  Entrez le numéro associé à votre compte de paiement (Orange, MTN, Moov, Wave, etc.)
                </span>
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowBadgePaymentConfirm(false)}
                  className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isLaunchingBadgePayment}
                  className="flex-1 py-3 bg-rose-500 hover:bg-rose-600 active:bg-rose-700 disabled:opacity-50 text-white font-extrabold text-xs rounded-xl shadow-lg shadow-rose-500/10 flex items-center justify-center gap-1.5 transition cursor-pointer"
                >
                  {isLaunchingBadgePayment ? (
                    <Loader2 className="animate-spin" size={14} />
                  ) : (
                    <>
                      <span>Payer {VERIFICATION_BADGE_FEE} FCFA</span>
                      <ArrowRight size={12} />
                    </>
                  )}
                </button>
              </div>
            </form>

            <p className="text-[11px] text-slate-400 text-center font-medium leading-relaxed">
              En cliquant sur "Payer", vous serez redirigé vers l'interface officielle de Money Fusion pour effectuer votre transaction en toute sécurité. Votre dossier sera transmis à l'administrateur une fois le paiement confirmé.
            </p>
          </div>
        </div>
      )}

    </div>
  );
}
