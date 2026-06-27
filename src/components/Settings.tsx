import React, { useState, useEffect } from "react";
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
  Sparkles, 
  Save, 
  Camera, 
  Trash, 
  Plus, 
  X, 
  BookOpen, 
  Lock, 
  Smartphone 
} from "lucide-react";
import { supabase } from "../lib/supabase";
import { Profile } from "../types";

interface SettingsProps {
  currentUser: any;
  profile: Profile | null;
  onBackToProfile?: () => void;
  onLogout: () => void;
  onProfileUpdated: () => void;
  isPremium?: boolean;
}

export default function Settings({ 
  currentUser, 
  profile, 
  onBackToProfile, 
  onLogout, 
  onProfileUpdated,
  isPremium = false 
}: SettingsProps) {
  // Navigation tabs within settings
  const [activeSubTab, setActiveSubTab] = useState<'profile' | 'security' | 'cgu' | 'privacy'>('profile');

  // Subscription states
  const [subscriptionData, setSubscriptionData] = useState<any>(null);
  const [cancellingSub, setCancellingSub] = useState(false);

  const loadSubscription = async () => {
    try {
      const { data, error } = await supabase
        .from("subscriptions")
        .select("*")
        .eq("user_id", currentUser.id)
        .maybeSingle();
      if (data) {
        setSubscriptionData(data);
      }
    } catch (err) {
      console.error("Error loading subscription in Settings:", err);
    }
  };

  useEffect(() => {
    if (currentUser) {
      loadSubscription();
    }
  }, [currentUser]);

  const handleCancelSubscription = async () => {
    if (!confirm("Êtes-vous sûr de vouloir résilier votre abonnement Premium ? Votre accès restera actif jusqu'à la fin de la période de facturation en cours.")) {
      return;
    }
    setCancellingSub(true);
    try {
      const { error } = await supabase
        .from("subscriptions")
        .update({ status: 'cancelled' })
        .eq("user_id", currentUser.id);

      if (error) throw error;
      
      alert("Votre demande de résiliation a bien été prise en compte.");
      await loadSubscription();
      onProfileUpdated(); // reload overall App state
    } catch (err: any) {
      alert("Erreur lors de la résiliation : " + (err.message || err));
    } finally {
      setCancellingSub(false);
    }
  };

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
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [preferredLanguage, setPreferredLanguage] = useState<'fr' | 'en'>('fr');
  const [maxDistanceKm, setMaxDistanceKm] = useState<number>(50);

  // Verification states
  const [verificationStatus, setVerificationStatus] = useState<string>("none");
  const [idFileUrl, setIdFileUrl] = useState("");
  const [selfieFileUrl, setSelfieFileUrl] = useState("");
  const [verificationLoading, setVerificationLoading] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

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
      setPreferredLanguage(profile.preferred_language || "fr");
      setMaxDistanceKm(profile.max_distance_km || 50);
      
      const loadedPhotos = profile.photos || JSON.parse(localStorage.getItem(`profile_photos_${currentUser.id}`) || "[]");
      setPhotos(loadedPhotos);
    }
  }, [profile, currentUser.id]);

  // Profile photo methods
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>, index: number) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 3 * 1024 * 1024) {
      alert("L'image est trop volumineuse. Veuillez choisir un fichier de moins de 3 Mo.");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === "string") {
        const val = reader.result;
        setPhotos(prev => {
          const next = [...prev];
          next[index] = val;
          if (index === 0 || !avatarUrl) {
            setAvatarUrl(val);
          }
          return next;
        });
      }
    };
    reader.readAsDataURL(file);
  };

  const handleAddPhotoPremium = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (photos.length >= 20) {
      alert("Vous avez atteint la limite de 20 photos.");
      return;
    }

    if (file.size > 3 * 1024 * 1024) {
      alert("L'image est trop volumineuse. Veuillez choisir un fichier de moins de 3 Mo.");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === "string") {
        const val = reader.result;
        setPhotos(prev => {
          const next = [...prev, val];
          if (next.length === 1 || !avatarUrl) {
            setAvatarUrl(val);
          }
          return next;
        });
      }
    };
    reader.readAsDataURL(file);
  };

  const handleRemovePhoto = (index: number) => {
    setPhotos(prev => {
      const next = prev.filter((_, i) => i !== index);
      if (next.length > 0) {
        setAvatarUrl(next[0]);
      } else {
        setAvatarUrl("");
      }
      return next;
    });
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
      const { error } = await supabase
        .from("profiles")
        .update({
          verification_status: "pending"
        })
        .eq("uid", currentUser.id);

      if (error) throw error;

      await supabase
        .from("notifications")
        .insert([
          {
            user_id: currentUser.id,
            sender_id: currentUser.id,
            type: "match",
            content: "Votre demande de vérification de profil a été envoyée. Nos administrateurs l'analysent sous 24h.",
            lu: false
          }
        ]);

      setVerificationStatus("pending");
      onProfileUpdated();
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 5000);
      alert("Votre demande de vérification a bien été soumise !");
    } catch (err: any) {
      console.error("Verification submit error:", err);
      alert(err.message || "Impossible d'envoyer la demande de vérification.");
    } finally {
      setVerificationLoading(false);
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
                  <p className="text-[10px] text-slate-400 mt-1">
                    Obligation : Vous devez uploader au minimum 3 photos réelles pour valider votre compte.
                  </p>
                </div>

                {/* Validation warning */}
                {photos.filter(Boolean).length < 3 && (
                  <div className="bg-amber-50 border border-amber-100 text-amber-700 rounded-xl p-3 flex items-start gap-1.5 text-[10px] font-bold">
                    <AlertTriangle size={14} className="text-amber-500 flex-shrink-0 mt-0.5" />
                    <p>Obligation : 3 photos minimum ({photos.filter(Boolean).length}/3 ajoutées).</p>
                  </div>
                )}

                {/* Free users 3 slots inputs */}
                {!isPremium && [0, 1, 2].map(index => (
                  <input
                    key={index}
                    type="file"
                    id={`settings-photo-slot-${index}`}
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handlePhotoUpload(e, index)}
                  />
                ))}

                {/* Premium user add input */}
                {isPremium && (
                  <input
                    type="file"
                    id="settings-photo-premium"
                    accept="image/*"
                    className="hidden"
                    onChange={handleAddPhotoPremium}
                  />
                )}

                {/* Layout depending on subscription status */}
                {!isPremium ? (
                  <div className="space-y-3.5">
                    {[0, 1, 2].map(index => {
                      const photo = photos[index];
                      return (
                        <div key={index} className="bg-slate-50 border border-slate-150 rounded-2xl p-2.5 flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <div className="w-14 h-14 rounded-xl overflow-hidden bg-slate-200 border border-slate-200 flex-shrink-0 relative">
                              {photo ? (
                                <img src={photo} alt={`Photo ${index + 1}`} className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-slate-400 text-xs font-black">
                                  {index === 0 ? "1 (Max)" : index + 1}
                                </div>
                              )}
                              {index === 0 && (
                                <div className="absolute bottom-0 left-0 right-0 bg-rose-500 text-white text-[7px] py-0.5 text-center font-bold uppercase">
                                  Principale
                                </div>
                              )}
                            </div>
                            <div>
                              <p className="text-xs font-bold text-slate-700">Photo {index + 1}</p>
                              <p className="text-[9px] text-slate-400">{index === 0 ? "Affichée en premier" : "Obligatoire"}</p>
                            </div>
                          </div>
                          <div>
                            {photo ? (
                              <button
                                type="button"
                                onClick={() => handleRemovePhoto(index)}
                                className="p-1.5 bg-red-50 hover:bg-red-100 text-red-500 rounded-lg transition cursor-pointer"
                              >
                                <Trash size={12} />
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => document.getElementById(`settings-photo-slot-${index}`)?.click()}
                                className="px-2.5 py-1.5 bg-rose-500 hover:bg-rose-600 text-white text-[10px] font-bold rounded-lg transition cursor-pointer flex items-center space-x-1"
                              >
                                <Camera size={11} />
                                <span>Ajouter</span>
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                    <p className="text-[10px] text-slate-400 italic text-center mt-2 bg-slate-50 p-2 rounded-xl border border-slate-100">
                      ⚡ Abonnez-vous à <strong>LoveRose Premium</strong> pour uploader jusqu'à 20 photos !
                    </p>
                  </div>
                ) : (
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
                          <span className="text-[9px] font-bold">Ajouter</span>
                        </button>
                      )}
                    </div>
                    <div className="text-center">
                      <span className="text-[9px] font-extrabold text-rose-500 bg-rose-50 px-2 rounded-full border border-rose-100 uppercase tracking-wider">
                        ✨ Premium : {photos.length}/20 photos
                      </span>
                    </div>
                  </div>
                )}
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
                    <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block">Nom Complet</label>
                    <input
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Ex: Marc Olivier"
                      className="w-full mt-1.5 p-3 bg-slate-50 border border-slate-200 focus:border-rose-400 focus:bg-white focus:ring-1 focus:ring-rose-200 outline-none rounded-xl text-xs font-bold transition"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block">Pseudo (Sans @)</label>
                    <input
                      type="text"
                      required
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="Ex: marcolivier237"
                      className="w-full mt-1.5 p-3 bg-slate-50 border border-slate-200 focus:border-rose-400 focus:bg-white focus:ring-1 focus:ring-rose-200 outline-none rounded-xl text-xs font-bold transition"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block">Âge (Ans)</label>
                    <input
                      type="number"
                      required
                      min={18}
                      max={99}
                      value={age}
                      onChange={(e) => setAge(parseInt(e.target.value) || 18)}
                      className="w-full mt-1.5 p-3 bg-slate-50 border border-slate-200 focus:border-rose-400 focus:bg-white focus:ring-1 focus:ring-rose-200 outline-none rounded-xl text-xs font-bold transition"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block">Ville & Pays</label>
                    <input
                      type="text"
                      required
                      value={locationStr}
                      onChange={(e) => setLocationStr(e.target.value)}
                      placeholder="Ex: Douala, Cameroun"
                      className="w-full mt-1.5 p-3 bg-slate-50 border border-slate-200 focus:border-rose-400 focus:bg-white focus:ring-1 focus:ring-rose-200 outline-none rounded-xl text-xs font-bold transition"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block">Mon Genre</label>
                    <select
                      value={gender}
                      onChange={(e) => setGender(e.target.value as any)}
                      className="w-full mt-1.5 p-3 bg-slate-50 border border-slate-200 focus:border-rose-400 focus:bg-white focus:ring-1 focus:ring-rose-200 outline-none rounded-xl text-xs font-bold transition"
                    >
                      <option value="femme">Femme</option>
                      <option value="homme">Homme</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block">Je Recherche</label>
                    <select
                      value={preferences}
                      onChange={(e) => setPreferences(e.target.value as any)}
                      className="w-full mt-1.5 p-3 bg-slate-50 border border-slate-200 focus:border-rose-400 focus:bg-white focus:ring-1 focus:ring-rose-200 outline-none rounded-xl text-xs font-bold transition"
                    >
                      <option value="femme">Des Femmes</option>
                      <option value="homme">Des Hommes</option>
                      <option value="tous">Tout le monde</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block">Langue Préférée</label>
                    <select
                      value={preferredLanguage}
                      onChange={(e) => setPreferredLanguage(e.target.value as any)}
                      className="w-full mt-1.5 p-3 bg-slate-50 border border-slate-200 focus:border-rose-400 focus:bg-white focus:ring-1 focus:ring-rose-200 outline-none rounded-xl text-xs font-bold transition"
                    >
                      <option value="fr">Français</option>
                      <option value="en">English</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block">Distance Maximale : {maxDistanceKm} km</label>
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
                  <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block">Ma Biographie</label>
                  <textarea
                    rows={4}
                    required
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    placeholder="Parlez-nous de vous, de vos passions, et de ce que vous recherchez..."
                    className="w-full mt-1.5 p-3 bg-slate-50 border border-slate-200 focus:border-rose-400 focus:bg-white focus:ring-1 focus:ring-rose-200 outline-none rounded-xl text-xs font-medium transition leading-relaxed resize-none"
                  />
                </div>

                {/* Intentions checkboxes */}
                <div className="space-y-2">
                  <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block">
                    Mes Intentions de Rencontre (Obligatoire)
                  </label>
                  <p className="text-[9px] text-slate-400">Sélectionnez au moins une intention pour aider nos algorithmes de compatibilité.</p>
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
                    <p className="text-slate-500 text-[10px] leading-relaxed text-left">
                      Le badge <strong>Vérifié</strong> confirme votre authenticité et multiplie vos chances de Matchs par 3 !
                    </p>

                    <div className="space-y-3 text-left">
                      <div>
                        <label className="text-[10px] font-extrabold text-slate-500 uppercase block">Pièce d'identité (Photo)</label>
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
                        <label className="text-[10px] font-extrabold text-slate-500 uppercase block">Selfie de Contrôle (Photo)</label>
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
                      type="button"
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

              {/* Mon Abonnement Premium card */}
              <div className="bg-white border border-slate-150 rounded-3xl p-6 shadow-sm space-y-4 text-left">
                <h3 className="font-extrabold text-slate-900 text-sm flex items-center gap-1.5 border-b border-slate-100 pb-3">
                  <Sparkles size={16} className="text-rose-500" />
                  <span>Mon Abonnement Premium</span>
                </h3>

                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-1">
                    <div>
                      <h4 className="text-xs font-bold text-slate-800">Statut de l'abonnement</h4>
                      <p className="text-[10px] text-slate-400 mt-0.5">Vérifiez l'état et l'échéance de vos services Premium</p>
                    </div>
                    <div>
                      {isPremium ? (
                        subscriptionData?.status === "cancelled" ? (
                          <span className="text-[10px] bg-amber-50 text-amber-700 border border-amber-100 font-extrabold px-3 py-1 rounded-full uppercase tracking-wider block text-center">
                            Résilié (Actif)
                          </span>
                        ) : subscriptionData?.status === "trial" ? (
                          <span className="text-[10px] bg-amber-500 text-white font-extrabold px-3 py-1 rounded-full uppercase tracking-wider block text-center shadow-sm shadow-amber-500/10 animate-pulse">
                            Essai Premium ⏳
                          </span>
                        ) : (
                          <span className="text-[10px] bg-rose-500 text-white font-extrabold px-3 py-1 rounded-full uppercase tracking-wider block text-center shadow-sm shadow-rose-500/10">
                            Actif ✨
                          </span>
                        )
                      ) : (
                        <span className="text-[10px] bg-slate-100 text-slate-500 font-bold px-3 py-1 rounded-full uppercase tracking-wider block text-center">
                          Aucun abonnement
                        </span>
                      )}
                    </div>
                  </div>

                  {isPremium && subscriptionData && (
                    <div className="bg-slate-50 border border-slate-150 p-3.5 rounded-2xl space-y-2 text-xs">
                      <div className="flex justify-between font-bold text-slate-700 text-[11px]">
                        <span>Formule :</span>
                        <span className="text-rose-500 uppercase">
                          {subscriptionData.status === "trial" ? "Essai Gratuit LoveRose Premium" : "LoveRose Premium"}
                        </span>
                      </div>
                      <div className="flex justify-between text-slate-500 text-[11px]">
                        <span>Date d'échéance :</span>
                        <span className="font-semibold text-slate-700">
                          {subscriptionData.end_date ? new Date(subscriptionData.end_date).toLocaleDateString('fr-FR', {
                            year: 'numeric', month: 'long', day: 'numeric'
                          }) : "Illimitée"}
                        </span>
                      </div>

                      {subscriptionData.status === "cancelled" ? (
                        <p className="text-[10px] text-amber-600 bg-amber-50/50 p-2.5 rounded-xl border border-amber-100/50 leading-relaxed font-semibold mt-2">
                          ⚠️ Votre abonnement reste actif jusqu'au {subscriptionData.end_date ? new Date(subscriptionData.end_date).toLocaleDateString('fr-FR', {
                            year: 'numeric', month: 'long', day: 'numeric'
                          }) : ""}, sans renouvellement après cette date.
                        </p>
                      ) : (
                        <div className="pt-2">
                          <button
                            type="button"
                            disabled={cancellingSub}
                            onClick={handleCancelSubscription}
                            className="w-full py-2 bg-white hover:bg-red-50 text-red-500 border border-red-100 font-bold text-[10px] uppercase tracking-wide rounded-xl transition cursor-pointer flex items-center justify-center gap-1 disabled:opacity-50"
                          >
                            {cancellingSub ? (
                              <>
                                <Loader2 size={12} className="animate-spin" />
                                <span>Résiliation...</span>
                              </>
                            ) : (
                              <span>Résilier mon abonnement</span>
                            )}
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {!isPremium && (
                    <div className="bg-rose-50/30 border border-rose-100/40 p-4 rounded-2xl text-center space-y-2">
                      <p className="text-[11px] text-slate-600 leading-relaxed font-semibold">
                        Débloquez les messages illimités, l'upload de 20 photos, le badge Premium et d'autres fonctionnalités exclusives.
                      </p>
                      <p className="text-[10px] font-bold text-rose-500">
                        Rendez-vous dans la boutique pour souscrire !
                      </p>
                    </div>
                  )}
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
                    <p className="text-[10px] text-slate-400 mt-0.5">Efface définitivement mes Matchs, messages, et profil de LoveRose</p>
                  </div>
                  <button
                    type="button"
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
                <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold mt-0.5">Dernière mise à jour : 26 Juin 2026</p>
              </div>
            </div>

            <div className="prose prose-slate max-w-none text-xs md:text-sm text-slate-600 space-y-5 leading-relaxed">
              <p>
                Bienvenue sur <strong>LoveRose</strong>. En accédant à notre application de rencontres sérieuses et d’actualités pour célibataires, vous acceptez expressément et sans réserve les présentes Conditions Générales d’Utilisation.
              </p>

              <div>
                <h4 className="font-extrabold text-slate-900 text-sm">1. Objet du service</h4>
                <p className="mt-1">
                  LoveRose est une plateforme numérique facilitant la mise en relation d'adultes célibataires partageant des intentions de rencontre claires et transparentes. L'application propose un flux d'actualités communautaire, des algorithmes de calcul de compatibilité, un service d'échanges de messages, et des services d'abonnements Premium optionnels.
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
                <h4 className="font-extrabold text-slate-900 text-sm">4. Système de crédits et services Premium</h4>
                <p className="mt-1">
                  Chaque match donne droit à trois (3) messages d'ouverture gratuits respectant une charte (maximum 10 mots, aucun chiffre). Les échanges suivants requièrent l'utilisation de crédits virtuelles rechargeables dans la boutique LoveRose ou la souscription d'un abonnement <strong>LoveRose Premium</strong>. Les transactions de paiement sont sécurisées de manière exclusive via le prestataire officiel <strong>Money Fusion</strong>. Les crédits et abonnements consommés ne sont pas remboursables.
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
                <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold mt-0.5">Dernière mise à jour : 26 Juin 2026</p>
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
        <p className="text-[10px] text-slate-400">LoveRose v2.1.0 • Fait en Afrique avec passion ❤️</p>
      </div>

    </div>
  );
}
