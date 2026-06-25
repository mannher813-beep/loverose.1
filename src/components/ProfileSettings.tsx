import React, { useState, useEffect, FormEvent } from "react";
import { supabase } from "../lib/supabase";
import { Profile } from "../types";
import { User, MapPin, AlignLeft, CheckCircle, ShieldCheck, Loader2, Sparkles, Save, Camera, Trash, Settings, Plus, X, AlertTriangle } from "lucide-react";

interface ProfileSettingsProps {
  currentUser: any;
  profile: Profile | null;
  isPremium?: boolean;
  onProfileUpdated: () => void;
  onGoToSettings?: () => void;
}

export default function ProfileSettings({ currentUser, profile, isPremium = false, onProfileUpdated, onGoToSettings }: ProfileSettingsProps) {
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [age, setAge] = useState(18);
  const [location, setLocation] = useState("");
  const [gender, setGender] = useState<'homme' | 'femme' | 'autre'>('homme');
  const [preferences, setPreferences] = useState<'homme' | 'femme' | 'tous'>('femme');
  const [avatarUrl, setAvatarUrl] = useState("");
  const [selectedIntents, setSelectedIntents] = useState<string[]>([]);
  const [photos, setPhotos] = useState<string[]>([]);
  
  const [isLoading, setIsLoading] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const intentsList = [
    "Amitié",
    "Relation amoureuse",
    "Rencontre d'un soir",
    "Relation libertine",
    "Business / networking"
  ];

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || "");
      setUsername(profile.username || "");
      setBio(profile.bio || "");
      setAge(profile.age || 18);
      setLocation(profile.location || "");
      setGender(profile.gender || "homme");
      setPreferences(profile.preferences || "femme");
      setAvatarUrl(profile.avatar_url || "");
      setSelectedIntents(profile.relationship_intents || []);
      
      // Load photos from profile or local backup
      const loadedPhotos = profile.photos || JSON.parse(localStorage.getItem(`profile_photos_${currentUser.id}`) || "[]");
      setPhotos(loadedPhotos);
    }
  }, [profile, currentUser.id]);

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
          // Set primary avatar as the first photo
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
      // Update avatar if we removed the first one
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

  const handleSaveProfile = async (e: FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setSaveSuccess(false);

    try {
      if (selectedIntents.length === 0) {
        throw new Error("Veuillez sélectionner au moins un type de rencontre recherché (intention obligatoire).");
      }

      // Filter empty photos
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
        location: location.trim(),
        gender,
        preferences,
        avatar_url: avatarUrl || validPhotos[0] || "",
        relationship_intents: selectedIntents,
        photos: validPhotos,
        updated_at: new Date().toISOString()
      };

      // Store in localStorage backup first
      localStorage.setItem(`profile_backup_${currentUser.id}`, JSON.stringify(updatedProfileData));
      localStorage.setItem(`profile_photos_${currentUser.id}`, JSON.stringify(validPhotos));

      // Sync to Supabase
      const { error } = await supabase
        .from("profiles")
        .upsert(updatedProfileData);

      if (error) {
        // Fallback if profiles table doesn't have photos column yet
        if (error.message?.includes("photos") || error.code === "PGRST204" || error.code === "42703") {
          console.warn("Column 'photos' does not exist in profiles. Retrying save without 'photos' column.");
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
    } catch (err: any) {
      alert(err.message || "Erreur lors de l'enregistrement du profil.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50 p-4 md:p-8 space-y-8 font-sans max-w-4xl mx-auto w-full">
      
      {/* Hidden inputs for the 3 slots for free users */}
      {!isPremium && [0, 1, 2].map(index => (
        <input
          key={index}
          type="file"
          id={`photo-slot-${index}`}
          accept="image/*"
          className="hidden"
          onChange={(e) => handlePhotoUpload(e, index)}
        />
      ))}

      {/* Hidden input for premium adding */}
      {isPremium && (
        <input
          type="file"
          id="photo-premium-add"
          accept="image/*"
          className="hidden"
          onChange={handleAddPhotoPremium}
        />
      )}
      
      {/* Title Header */}
      <div className="border-b border-slate-200 pb-4 flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">Mon Profil</h2>
          <p className="text-slate-500 text-xs">Exprimez votre personnalité, vos intentions et attirez de nouveaux célibataires.</p>
        </div>
        {onGoToSettings && (
          <button
            onClick={onGoToSettings}
            className="flex items-center gap-1.5 text-xs bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold px-4 py-2.5 rounded-xl transition cursor-pointer"
          >
            <Settings size={14} />
            <span>Paramètres Sécurité</span>
          </button>
        )}
      </div>

      <div className="grid md:grid-cols-3 gap-8 items-start">
        
        {/* Left column: Photo Upload and Onboarding status */}
        <div className="md:col-span-1 space-y-6">
          
          {/* Photo Slots Management Card */}
          <div className="bg-white border border-slate-150 rounded-3xl p-5 shadow-xs space-y-4">
            <div>
              <h3 className="font-extrabold text-slate-800 text-xs uppercase tracking-wider flex items-center gap-1">
                <Camera size={14} className="text-rose-500" />
                <span>Mes Photos de Profil</span>
              </h3>
              <p className="text-[10px] text-slate-400 mt-1">Au moins 3 photos sont obligatoires pour tous les profils.</p>
            </div>

            {/* Validation warning */}
            {photos.filter(Boolean).length < 3 && (
              <div className="bg-amber-50 border border-amber-100 text-amber-700 rounded-xl p-3 flex items-start gap-1.5 text-[10px] font-bold">
                <AlertTriangle size={14} className="text-amber-500 flex-shrink-0 mt-0.5" />
                <p>Obligation : Veuillez uploader au minimum 3 photos pour pouvoir enregistrer votre profil ({photos.filter(Boolean).length}/3 ajoutées).</p>
              </div>
            )}

            {/* Multi-Photo Grid / Slots */}
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
                            <div className="absolute bottom-0 left-0 right-0 bg-rose-500 text-white text-[7px] py-0.5 text-center font-bold tracking-widest uppercase">
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
                            title="Supprimer la photo"
                          >
                            <Trash size={12} />
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => document.getElementById(`photo-slot-${index}`)?.click()}
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
                      <img src={photo} alt={`Photo ${index + 1}`} className="w-full h-full object-cover animate-fade-in" />
                      <button
                        type="button"
                        onClick={() => handleRemovePhoto(index)}
                        className="absolute top-1 right-1 bg-black/60 hover:bg-red-500 text-white rounded-full p-1 transition cursor-pointer shadow-sm"
                        title="Supprimer"
                      >
                        <X size={10} />
                      </button>
                      {index === 0 && (
                        <div className="absolute bottom-0 left-0 right-0 bg-rose-500 text-white text-[7px] py-0.5 text-center font-bold uppercase tracking-wider">
                          Principale
                        </div>
                      )}
                    </div>
                  ))}
                  {photos.length < 20 && (
                    <button
                      type="button"
                      onClick={() => document.getElementById("photo-premium-add")?.click()}
                      className="aspect-square bg-slate-50 border border-dashed border-slate-300 hover:border-rose-400 hover:bg-rose-50/10 rounded-xl flex flex-col items-center justify-center text-slate-400 hover:text-rose-500 transition cursor-pointer space-y-1"
                    >
                      <Plus size={16} />
                      <span className="text-[9px] font-bold">Ajouter</span>
                    </button>
                  )}
                </div>
                <div className="text-center pt-1">
                  <span className="text-[9px] font-extrabold text-rose-500 bg-rose-50 px-2.5 py-1 rounded-full border border-rose-100 uppercase tracking-wider">
                    ✨ Membre Premium : {photos.length}/20 photos
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Verification Call-To-Action Card */}
          <div className="bg-rose-50/20 border border-rose-500/10 rounded-3xl p-5 shadow-xs space-y-3.5">
            <h4 className="font-extrabold text-slate-800 text-xs uppercase tracking-wider flex items-center gap-1.5">
              <ShieldCheck className="text-rose-500" size={16} />
              <span>Certifier mon compte</span>
            </h4>
            <p className="text-slate-500 text-[10px] leading-relaxed">
              Pour obtenir le badge de confiance vert et prouver votre authenticité aux autres célibataires, rendez-vous dans vos paramètres pour soumettre vos pièces justificatives.
            </p>
            {onGoToSettings && (
              <button
                onClick={onGoToSettings}
                className="w-full py-2 bg-rose-500 hover:bg-rose-600 text-white font-extrabold text-[10px] uppercase tracking-wider rounded-xl transition cursor-pointer text-center block shadow-md shadow-rose-500/5"
              >
                Vérifier mon identité
              </button>
            )}
          </div>
        </div>

        {/* Right column: Form details */}
        <div className="md:col-span-2 bg-white border border-slate-150 rounded-3xl p-6 md:p-8 shadow-sm">
          
          {saveSuccess && (
            <div className="bg-emerald-50 border border-emerald-100 text-emerald-700 text-xs p-3.5 rounded-2xl flex items-center gap-2 mb-6 font-semibold animate-fade-in">
              <CheckCircle size={16} />
              <p>Votre profil public a été mis à jour avec succès ! ✨</p>
            </div>
          )}

          <form onSubmit={handleSaveProfile} className="space-y-6">
            <h3 className="font-extrabold text-slate-900 text-base flex items-center gap-1.5 border-b border-slate-100 pb-3">
              <User size={18} className="text-rose-500" />
              <span>Informations Générales</span>
            </h3>

            {/* Inputs Grid */}
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Nom Complet</label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Ex: David Mensah"
                  className="w-full p-3 bg-slate-50 border border-slate-200 focus:border-rose-500 focus:bg-white focus:outline-none rounded-xl text-xs font-semibold transition"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Nom d'utilisateur</label>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="david_mensah"
                  className="w-full p-3 bg-slate-50 border border-slate-200 focus:border-rose-500 focus:bg-white focus:outline-none rounded-xl text-xs font-semibold transition"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Âge</label>
                <input
                  type="number"
                  required
                  min={18}
                  max={100}
                  value={age}
                  onChange={(e) => setAge(parseInt(e.target.value))}
                  className="w-full p-3 bg-slate-50 border border-slate-200 focus:border-rose-500 focus:bg-white focus:outline-none rounded-xl text-xs font-bold transition"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Localisation (Ville, Pays)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                    <MapPin size={14} />
                  </span>
                  <input
                    type="text"
                    required
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="Cotonou, Bénin"
                    className="w-full pl-9 pr-4 p-3 bg-slate-50 border border-slate-200 focus:border-rose-500 focus:bg-white focus:outline-none rounded-xl text-xs font-semibold transition"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Mon Genre</label>
                <select
                  value={gender}
                  onChange={(e: any) => setGender(e.target.value)}
                  className="w-full p-3 bg-slate-50 border border-slate-200 focus:border-rose-500 focus:bg-white focus:outline-none rounded-xl text-xs font-bold transition"
                >
                  <option value="homme">Homme</option>
                  <option value="femme">Femme</option>
                  <option value="autre">Autre</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Mes préférences</label>
                <select
                  value={preferences}
                  onChange={(e: any) => setPreferences(e.target.value)}
                  className="w-full p-3 bg-slate-50 border border-slate-200 focus:border-rose-500 focus:bg-white focus:outline-none rounded-xl text-xs font-bold transition"
                >
                  <option value="femme">Femmes</option>
                  <option value="homme">Hommes</option>
                  <option value="tous">Tous</option>
                </select>
              </div>
            </div>

            {/* Bio */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Description / À propos de moi</label>
              <div className="relative">
                <span className="absolute left-3 top-4 text-slate-400">
                  <AlignLeft size={14} />
                </span>
                <textarea
                  rows={3}
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Décrivez votre personnalité, vos passe-temps..."
                  className="w-full pl-9 pr-4 py-3 bg-slate-50 border border-slate-200 focus:border-rose-500 focus:bg-white focus:outline-none rounded-xl text-xs font-medium transition resize-none leading-relaxed"
                />
              </div>
            </div>

            {/* CRITICAL INTENTIONS SELECTOR */}
            <div className="space-y-3 bg-rose-50/20 border border-rose-500/10 p-5 rounded-2xl">
              <div className="space-y-1">
                <h4 className="font-extrabold text-slate-900 text-sm flex items-center gap-1">
                  <Sparkles className="text-rose-500 fill-rose-500" size={16} />
                  <span>Intentions de rencontre (Obligatoire)</span>
                </h4>
                <p className="text-[10px] text-slate-400 leading-relaxed">
                  C'est la pièce maîtresse de LoveRose. Vos intentions nous permettent d'évaluer la compatibilité entre profils et de vous proposer des suggestions d'affinité extrêmement ciblées.
                </p>
              </div>

              <div className="flex flex-wrap gap-2 pt-1">
                {intentsList.map(intent => {
                  const isChecked = selectedIntents.includes(intent);
                  return (
                    <button
                      key={intent}
                      type="button"
                      onClick={() => handleIntentToggle(intent)}
                      className={`px-3 py-2 rounded-xl text-xs font-bold border transition cursor-pointer flex items-center space-x-1.5 ${
                        isChecked
                          ? "bg-rose-500 border-rose-500 text-white shadow-sm"
                          : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      {isChecked && <span className="text-white">✓</span>}
                      <span>{intent}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Save Button */}
            <button
              id="save-profile-btn"
              type="submit"
              disabled={isLoading || selectedIntents.length === 0}
              className="w-full py-4 bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-600 hover:to-pink-700 text-white font-extrabold text-xs uppercase tracking-wider rounded-xl shadow-lg shadow-rose-500/10 transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isLoading ? (
                <Loader2 className="animate-spin" size={14} />
              ) : (
                <>
                  <Save size={14} />
                  <span>Enregistrer mon profil</span>
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
