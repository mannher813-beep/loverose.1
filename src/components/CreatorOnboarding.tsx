import React, { useState } from "react";
import { supabase } from "../lib/supabase";
import { Sparkles, ArrowRight, ArrowLeft, Camera, Image as ImageIcon, Check, Loader2, Info } from "lucide-react";

interface CreatorOnboardingProps {
  currentUser: any;
  currentUserProfile: any;
  onPageCreated: (newPage: any) => void;
  onBack: () => void;
}

export default function CreatorOnboarding({ currentUser, currentUserProfile, onPageCreated, onBack }: CreatorOnboardingProps) {
  const [step, setStep] = useState<number>(1);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>("");

  // Page Form State
  const [pageName, setPageName] = useState("");
  const [category, setCategory] = useState("Art & Divertissement");
  const [avatarUrl, setAvatarUrl] = useState(currentUserProfile?.avatar_url || "");
  const [coverUrl, setCoverUrl] = useState("https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1200&q=80");
  const [bio, setBio] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState(currentUserProfile?.location || "");
  const [language, setLanguage] = useState("fr");
  const [interestsText, setInterestsText] = useState("");
  const [subscriptionPrice, setSubscriptionPrice] = useState("2500");
  const [tipsEnabled, setTipsEnabled] = useState(true);

  // File Upload states
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [coverUploading, setCoverUploading] = useState(false);

  // Upload to Supabase Storage
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: "avatar" | "cover") => {
    const file = e.target.files?.[0];
    if (!file || !currentUser) return;

    if (file.size > 3 * 1024 * 1024) {
      alert("La taille du fichier ne doit pas dépasser 3 Mo.");
      return;
    }

    if (type === "avatar") setAvatarUploading(true);
    else setCoverUploading(true);

    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${currentUser.id}/${type}-${Date.now()}.${fileExt}`;
      const filePath = `creator-pages/${fileName}`;

      // Upload file to 'avatars' bucket
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, file, { upsert: true });

      if (uploadError) {
        // Fallback to 'loverose' bucket if 'avatars' has issues
        const { error: fallbackError } = await supabase.storage
          .from("loverose")
          .upload(filePath, file, { upsert: true });
        
        if (fallbackError) throw fallbackError;
        
        const { data } = supabase.storage.from("loverose").getPublicUrl(filePath);
        if (type === "avatar") setAvatarUrl(data.publicUrl);
        else setCoverUrl(data.publicUrl);
      } else {
        const { data } = supabase.storage.from("avatars").getPublicUrl(filePath);
        if (type === "avatar") setAvatarUrl(data.publicUrl);
        else setCoverUrl(data.publicUrl);
      }
    } catch (err: any) {
      console.error("Storage upload error:", err);
      alert("Erreur lors du téléchargement de l'image. Utilisation d'un visuel par défaut.");
    } finally {
      setAvatarUploading(false);
      setCoverUploading(false);
    }
  };

  const handleNextStep = () => {
    setErrorMessage("");
    if (step === 1) {
      if (!pageName.trim()) {
        setErrorMessage("Le nom de votre page est obligatoire.");
        return;
      }
    }
    if (step === 3) {
      if (!bio.trim() || !description.trim()) {
        setErrorMessage("Veuillez renseigner une biographie courte et une description complète.");
        return;
      }
    }
    setStep((prev) => prev + 1);
  };

  const handlePrevStep = () => {
    setErrorMessage("");
    setStep((prev) => prev - 1);
  };

  const handleSubmitPage = async () => {
    setIsLoading(true);
    setErrorMessage("");

    try {
      // Clean and generate Slug
      const cleanName = pageName.trim();
      const slug = cleanName.toLowerCase()
        .replace(/[^a-z0-9 ]/g, "")
        .replace(/\s+/g, "-") + "-" + Math.floor(1000 + Math.random() * 9000);

      const interests = interestsText ? interestsText.split(",").map((i) => i.trim()).filter(Boolean) : [];

      // Create creator page
      const pagePayload = {
        owner_id: currentUser.id,
        page_name: cleanName,
        slug,
        bio: bio.substring(0, 150),
        description: description,
        avatar_url: avatarUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${cleanName}`,
        cover_url: coverUrl,
        category,
        location: location || "Afrique Francophone",
        language: language || "fr",
        interests: interests,
        subscription_price: parseInt(subscriptionPrice) || 0,
        tips_enabled: tipsEnabled,
        status: "active",
        activation_paid: true
      };

      const { data, error } = await supabase
        .from("creator_pages")
        .insert([pagePayload])
        .select()
        .single();

      if (error) throw error;

      onPageCreated(data);
    } catch (err: any) {
      console.error("Error creating creator page:", err);
      setErrorMessage(err.message || "Erreur lors de la création de votre page. Veuillez réessayer.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto bg-white border border-slate-150 rounded-3xl p-6 md:p-8 shadow-md text-left flex flex-col min-h-0 relative h-full">
      {/* Step Progress Header */}
      <div className="flex justify-between items-center border-b border-slate-100 pb-4 mb-6">
        <div className="space-y-0.5">
          <h3 className="font-extrabold text-slate-900 text-base flex items-center gap-1.5">
            <Sparkles className="text-rose-500 fill-rose-500 animate-pulse" size={18} />
            <span>Devenir Créateur LoveRose</span>
          </h3>
          <p className="text-[10px] font-bold text-rose-500 uppercase tracking-wider">
            Étape {step} sur 5
          </p>
        </div>
        
        {/* Progress Bar Indicators */}
        <div className="flex space-x-1">
          {[1, 2, 3, 4, 5].map((s) => (
            <div
              key={s}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                step >= s ? "w-4 bg-rose-500" : "w-1.5 bg-slate-200"
              }`}
            />
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto space-y-6 pr-1 min-h-0 pb-16">
        {errorMessage && (
          <div className="bg-rose-50 border border-rose-100 p-3 rounded-2xl text-xs font-semibold text-rose-600">
            {errorMessage}
          </div>
        )}

        {/* STEP 1: IDENTITY */}
        {step === 1 && (
          <div className="space-y-4 animate-fade-in">
            <div className="space-y-1.5">
              <h4 className="font-black text-slate-900 text-base">Étape 1 : Identité de votre page</h4>
              <p className="text-xs text-slate-400 font-medium">Définissez le nom public et la thématique de votre univers.</p>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Nom de votre Page Créateur</label>
                <input
                  type="text"
                  placeholder="Ex: Rose Secrets, DJ Max Mixes..."
                  value={pageName}
                  onChange={(e) => setPageName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 focus:border-rose-500 focus:bg-white focus:outline-none rounded-xl p-3 text-xs font-semibold transition"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Catégorie principale</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 focus:border-rose-500 focus:bg-white focus:outline-none rounded-xl p-3 text-xs font-semibold transition"
                >
                  <option value="Dating & Séduction">Dating & Séduction</option>
                  <option value="Art & Divertissement">Art & Divertissement</option>
                  <option value="Conseils de couple">Conseils de couple</option>
                  <option value="Mode & Beauté">Mode & Beauté</option>
                  <option value="Musique & Podcasts">Musique & Podcasts</option>
                  <option value="Lifestyle & Vlog">Lifestyle & Vlog</option>
                  <option value="Cuisine & Partages">Cuisine & Partages</option>
                </select>
              </div>

              <div className="bg-rose-50/50 border border-rose-100 p-4 rounded-2xl">
                <p className="text-xs text-rose-800 leading-relaxed font-semibold">
                  💡 <strong>Création gratuite :</strong> Votre page créateur est 100% gratuite. LoveRose prélève une commission de 20% uniquement sur vos revenus générés.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: VISUALS */}
        {step === 2 && (
          <div className="space-y-5 animate-fade-in">
            <div className="space-y-1.5">
              <h4 className="font-black text-slate-900 text-base">Étape 2 : Personnalisation Visuelle</h4>
              <p className="text-xs text-slate-400 font-medium">Téléchargez des visuels accrocheurs pour attirer de nouveaux abonnés.</p>
            </div>

            {/* Banner Cover Upload */}
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Photo de Couverture (Bannière)</label>
              <div className="relative h-32 rounded-2xl overflow-hidden border-2 border-dashed border-slate-200 flex items-center justify-center bg-slate-50 group">
                <img src={coverUrl} alt="Bannière" className="absolute inset-0 w-full h-full object-cover opacity-60 group-hover:opacity-70 transition" />
                <div className="relative z-10 flex flex-col items-center space-y-1 bg-black/40 p-3 rounded-xl backdrop-blur-xs text-white">
                  {coverUploading ? (
                    <Loader2 className="animate-spin" size={18} />
                  ) : (
                    <Camera size={18} />
                  )}
                  <span className="text-[10px] font-black uppercase">Changer la couverture</span>
                </div>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleFileUpload(e, "cover")}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                />
              </div>
            </div>

            {/* Avatar Upload */}
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Photo de Profil de la Page</label>
              <div className="flex items-center space-x-4">
                <div className="relative w-16 h-16 rounded-2xl overflow-hidden border-2 border-white shadow-md bg-slate-100 flex items-center justify-center">
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    <ImageIcon className="text-slate-400" size={24} />
                  )}
                  {avatarUploading && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center text-white">
                      <Loader2 className="animate-spin" size={14} />
                    </div>
                  )}
                </div>
                <div className="relative">
                  <button className="py-2 px-4 border border-slate-200 hover:border-rose-500 rounded-xl text-xs font-bold text-slate-700 transition flex items-center gap-1.5 cursor-pointer">
                    <Camera size={14} />
                    <span>Choisir une photo</span>
                  </button>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleFileUpload(e, "avatar")}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STEP 3: PRESENTATION */}
        {step === 3 && (
          <div className="space-y-4 animate-fade-in">
            <div className="space-y-1.5">
              <h4 className="font-black text-slate-900 text-base">Étape 3 : Présentez votre concept</h4>
              <p className="text-xs text-slate-400 font-medium">Décrivez votre activité pour donner envie de vous rejoindre.</p>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Courte Biographie (max 150 car.)</label>
                <input
                  type="text"
                  maxLength={150}
                  placeholder="Ex: Conseils quotidiens pour une vie de couple épanouie et passionnée."
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 focus:border-rose-500 focus:bg-white focus:outline-none rounded-xl p-3 text-xs font-semibold transition"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Description longue (max 1000 car.)</label>
                <textarea
                  rows={4}
                  maxLength={1000}
                  placeholder="Expliquez en détail votre concept, les bénéfices d'un abonnement et le contenu que vous proposez..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 focus:border-rose-500 focus:bg-white focus:outline-none rounded-xl p-3 text-xs font-semibold transition resize-none leading-relaxed"
                />
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Localisation</label>
                  <input
                    type="text"
                    placeholder="Ex: Douala, Cameroun"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 focus:border-rose-500 focus:bg-white focus:outline-none rounded-xl p-3 text-xs font-semibold transition"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Langue de partage</label>
                  <select
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 focus:border-rose-500 focus:bg-white focus:outline-none rounded-xl p-3 text-xs font-semibold transition"
                  >
                    <option value="fr">Français (Défaut)</option>
                    <option value="en">English</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Centres d'intérêt (séparés par des virgules)</label>
                <input
                  type="text"
                  placeholder="Ex: Amour, Romance, Musique, Conseil"
                  value={interestsText}
                  onChange={(e) => setInterestsText(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 focus:border-rose-500 focus:bg-white focus:outline-none rounded-xl p-3 text-xs font-semibold transition"
                />
              </div>
            </div>
          </div>
        )}

        {/* STEP 4: MONETIZATION */}
        {step === 4 && (
          <div className="space-y-4 animate-fade-in">
            <div className="space-y-1.5">
              <h4 className="font-black text-slate-900 text-base">Étape 4 : Choix de Monétisation</h4>
              <p className="text-xs text-slate-400 font-medium">Configurez vos options de tarification pour vos futurs abonnés.</p>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Prix d'Abonnement Mensuel (FCFA)</label>
                <input
                  type="number"
                  placeholder="Défaut: 2500 FCFA"
                  value={subscriptionPrice}
                  onChange={(e) => setSubscriptionPrice(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 focus:border-rose-500 focus:bg-white focus:outline-none rounded-xl p-3 text-xs font-semibold transition"
                />
                <p className="text-[10px] text-slate-400">Fixez 0 pour proposer un abonnement gratuit.</p>
              </div>

              <div className="flex items-center justify-between bg-slate-50 p-4 rounded-2xl border border-slate-150/50">
                <div className="space-y-0.5">
                  <span className="text-xs font-bold text-slate-800">Activer les pourboires (Tips)</span>
                  <p className="text-[10px] text-slate-400">Permet à vos abonnés de vous faire des dons libres.</p>
                </div>
                <input
                  type="checkbox"
                  checked={tipsEnabled}
                  onChange={(e) => setTipsEnabled(e.target.checked)}
                  className="w-5 h-5 accent-rose-500 rounded cursor-pointer"
                />
              </div>

              <div className="p-4 bg-slate-50 border border-slate-150 rounded-2xl space-y-2 text-xs text-slate-500">
                <h5 className="font-extrabold text-slate-700 flex items-center gap-1.5">
                  <Info size={14} className="text-rose-500" />
                  <span>Transparence financière</span>
                </h5>
                <p className="leading-normal">
                  Sur LoveRose, l'onboarding et l'outil de publication sont 100% gratuits à vie. LoveRose ne gagne de l'argent que si vous en gagnez : nous prélevons une commission fixe de <strong>20%</strong> sur tous vos abonnements payants, pourboires et déblocages de posts.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* STEP 5: CONFIRMATION */}
        {step === 5 && (
          <div className="space-y-5 animate-fade-in text-center">
            <div className="mx-auto w-16 h-16 bg-rose-50 rounded-full flex items-center justify-center text-rose-500">
              <Sparkles size={32} className="animate-spin" />
            </div>

            <div className="space-y-2 max-w-md mx-auto">
              <h4 className="font-black text-slate-900 text-lg">Prêt à lancer votre page ?</h4>
              <p className="text-xs text-slate-500 leading-relaxed">
                En confirmant la création, votre page sera mise en ligne instantanément. Les utilisateurs pourront s'y abonner, liker vos publications et vous envoyer des pourboires.
              </p>
            </div>

            <div className="bg-slate-50 border border-slate-200/50 rounded-2xl p-4 text-left space-y-2.5 max-w-md mx-auto">
              <p className="text-xs text-slate-600 flex justify-between">
                <span className="font-bold">Nom de la Page :</span>
                <span className="font-black text-slate-950">{pageName}</span>
              </p>
              <p className="text-xs text-slate-600 flex justify-between">
                <span className="font-bold">Abonnement :</span>
                <span className="font-black text-rose-500">
                  {parseInt(subscriptionPrice) > 0 ? `${subscriptionPrice} FCFA / mois` : "Gratuit"}
                </span>
              </p>
              <p className="text-xs text-slate-600 flex justify-between">
                <span className="font-bold">Catégorie :</span>
                <span className="font-semibold text-slate-700">{category}</span>
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Persistent Navigation Buttons at the Bottom */}
      <div className="absolute bottom-0 inset-x-0 bg-white border-t border-slate-100 p-4 flex items-center gap-4 z-20">
        {step > 1 ? (
          <button
            onClick={handlePrevStep}
            disabled={isLoading}
            className="flex-1 py-3 border border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700 font-extrabold text-xs rounded-xl flex items-center justify-center gap-1.5 transition cursor-pointer"
          >
            <ArrowLeft size={14} />
            <span>Retour</span>
          </button>
        ) : (
          <button
            onClick={onBack}
            className="flex-1 py-3 border border-slate-200 hover:bg-slate-50 text-slate-500 font-extrabold text-xs rounded-xl transition cursor-pointer"
          >
            Quitter
          </button>
        )}

        {step < 5 ? (
          <button
            onClick={handleNextStep}
            className="flex-1 py-3 bg-rose-500 hover:bg-rose-600 text-white font-extrabold text-xs rounded-xl flex items-center justify-center gap-1.5 shadow-md shadow-rose-500/10 transition cursor-pointer"
          >
            <span>Continuer</span>
            <ArrowRight size={14} />
          </button>
        ) : (
          <button
            onClick={handleSubmitPage}
            disabled={isLoading}
            className="flex-1 py-3 bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600 text-white font-extrabold text-xs rounded-xl flex items-center justify-center gap-1.5 shadow-lg shadow-rose-500/15 transition cursor-pointer"
          >
            {isLoading ? (
              <Loader2 className="animate-spin" size={14} />
            ) : (
              <>
                <Check size={14} />
                <span>Créer ma Page</span>
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
