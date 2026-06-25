import React, { useState, useEffect, FormEvent } from "react";
import { supabase } from "../lib/supabase";
import { Profile } from "../types";
import { User, MapPin, AlignLeft, CheckCircle, ShieldCheck, Loader2, Sparkles, Save, Camera, Trash, Settings } from "lucide-react";

interface ProfileSettingsProps {
  currentUser: any;
  profile: Profile | null;
  onProfileUpdated: () => void;
  onGoToSettings?: () => void;
}

export default function ProfileSettings({ currentUser, profile, onProfileUpdated, onGoToSettings }: ProfileSettingsProps) {
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [age, setAge] = useState(18);
  const [location, setLocation] = useState("");
  const [gender, setGender] = useState<'homme' | 'femme' | 'autre'>('homme');
  const [preferences, setPreferences] = useState<'homme' | 'femme' | 'tous'>('femme');
  const [avatarUrl, setAvatarUrl] = useState("");
  const [selectedIntents, setSelectedIntents] = useState<string[]>([]);
  
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

  const triggerAvatarUpload = () => {
    document.getElementById("avatar-file-input")?.click();
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

      const updatedProfileData = {
        uid: currentUser.id,
        full_name: fullName.trim(),
        username: username.trim(),
        bio: bio.trim(),
        age,
        location: location.trim(),
        gender,
        preferences,
        avatar_url: avatarUrl.trim(),
        relationship_intents: selectedIntents,
        updated_at: new Date().toISOString()
      };

      // Store in localStorage first
      localStorage.setItem(`profile_backup_${currentUser.id}`, JSON.stringify(updatedProfileData));

      // Sync to Supabase
      const { error } = await supabase
        .from("profiles")
        .upsert(updatedProfileData);

      if (error) throw error;

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
      
      {/* Hidden file input for avatar */}
      <input
        type="file"
        id="avatar-file-input"
        accept="image/*"
        className="hidden"
        onChange={(e) => handleLocalFileChange(e, setAvatarUrl)}
      />
      
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
          
          {/* Avatar Settings Card */}
          <div className="bg-white border border-slate-150 rounded-3xl p-5 text-center shadow-xs space-y-4">
            <div className="relative w-32 h-32 mx-auto">
              <img
                src={avatarUrl || `https://api.dicebear.com/7.x/adventurer/svg?seed=${fullName || currentUser.id}`}
                alt="Avatar"
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover rounded-full bg-slate-100 border-2 border-rose-500/10 shadow-inner"
              />
              <button
                type="button"
                onClick={triggerAvatarUpload}
                className="absolute bottom-1 right-1 bg-rose-500 hover:bg-rose-600 text-white rounded-full p-2.5 shadow-md cursor-pointer transition active:scale-95 animate-pulse"
                title="Prendre / Choisir une photo"
              >
                <Camera size={16} />
              </button>
            </div>

            <div>
              <h3 className="font-bold text-slate-800 text-sm leading-tight">{fullName || "Membre LoveRose"}</h3>
              <p className="text-[10px] text-slate-400 mt-1">Édition de votre photo officielle</p>
            </div>

            {avatarUrl ? (
              <button
                onClick={() => setAvatarUrl("")}
                className="text-[10px] text-slate-400 hover:text-red-500 font-bold transition flex items-center justify-center gap-1 mx-auto cursor-pointer"
              >
                <Trash size={12} />
                <span>Réinitialiser la photo</span>
              </button>
            ) : null}
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
