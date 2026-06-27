import { useState, useEffect, useRef } from "react";
import { supabase } from "../lib/supabase";
import { Profile } from "../types";
import { Heart, MapPin, CheckCircle, Sparkles, Share2, Download, ArrowRight, Home, Loader2, Copy, Check } from "lucide-react";
import { motion } from "motion/react";
import { toPng } from "html-to-image";

interface PublicProfileProps {
  username: string;
  onGoHome: () => void;
}

export default function PublicProfile({ username, onGoHome }: PublicProfileProps) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [generatingCard, setGeneratingCard] = useState(false);
  const [isPremiumUser, setIsPremiumUser] = useState(false);
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);

  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function loadPublicProfile() {
      setLoading(true);
      setError(null);
      try {
        const { data, error: fetchErr } = await supabase
          .from("profiles")
          .select("*")
          .eq("username", username)
          .maybeSingle();

        if (fetchErr) throw fetchErr;

        if (!data) {
          setError("Ce profil n'existe pas ou a été désactivé.");
        } else {
          setProfile(data);
          
          // Check if this profile's user is premium
          const { data: premiumActive } = await supabase.rpc('is_user_premium', { check_user_id: data.uid });
          setIsPremiumUser(!!premiumActive);
        }
      } catch (err: any) {
        console.error("Error loading public profile:", err);
        setError("Impossible de charger ce profil.");
      } finally {
        setLoading(false);
      }
    }

    if (username) {
      loadPublicProfile();
    }
  }, [username]);

  const handleCopyLink = async () => {
    const url = `${window.location.origin}/profil/${username}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy link:", err);
    }
  };

  const handleShare = async () => {
    const url = `${window.location.origin}/profil/${username}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${profile?.full_name || "Membre"} sur LoveRose`,
          text: `Découvrez le profil de ${profile?.full_name || "Membre"} sur LoveRose !`,
          url: url,
        });
      } catch (err) {
        console.log("Share cancelled or failed", err);
      }
    } else {
      handleCopyLink();
    }
  };

  const handleDownloadCard = async () => {
    if (!cardRef.current) return;
    setGeneratingCard(true);
    try {
      // Ensure images are fully loaded before rendering
      await new Promise((resolve) => setTimeout(resolve, 500));
      
      const dataUrl = await toPng(cardRef.current, {
        quality: 0.98,
        pixelRatio: 2, // Retinal high resolution
        style: {
          transform: 'scale(1)',
          transformOrigin: 'top left',
          width: '360px',
          height: '640px'
        }
      });

      const link = document.createElement('a');
      link.download = `loverose-invite-${username}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error("Error generating image:", err);
      alert("Une erreur est survenue lors de la génération de la carte d'invitation.");
    } finally {
      setGeneratingCard(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center font-sans">
        <div className="text-center space-y-3">
          <Loader2 className="animate-spin text-rose-500 mx-auto" size={32} />
          <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider">Chargement du profil...</p>
        </div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center p-4 font-sans">
        <div className="max-w-md w-full bg-white rounded-3xl p-8 shadow-xl border border-slate-100 text-center space-y-6">
          <div className="mx-auto bg-rose-50 w-20 h-20 rounded-full flex items-center justify-center text-rose-500">
            <Heart size={44} className="animate-pulse" />
          </div>
          <div className="space-y-2">
            <h1 className="text-xl font-black text-slate-900">Profil introuvable</h1>
            <p className="text-slate-500 text-xs leading-relaxed">{error || "Ce membre n'existe pas."}</p>
          </div>
          <button
            onClick={onGoHome}
            className="w-full py-3 bg-rose-500 hover:bg-rose-600 text-white font-extrabold text-xs uppercase tracking-wider rounded-2xl transition cursor-pointer flex items-center justify-center gap-1.5 shadow-md shadow-rose-500/10"
          >
            <Home size={14} />
            <span>Retour à l'accueil</span>
          </button>
        </div>
      </div>
    );
  }

  const photos = Array.isArray(profile.photos) && profile.photos.length > 0 
    ? profile.photos 
    : [profile.avatar_url].filter(Boolean) as string[];

  return (
    <div className="min-h-screen bg-slate-50 font-sans pb-16 text-slate-800">
      {/* Top Floating Navigation Header */}
      <header className="bg-white/80 backdrop-blur-md border-b border-slate-200/60 sticky top-0 z-40 px-4 py-3 flex items-center justify-between">
        <button
          onClick={onGoHome}
          className="flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-rose-500 transition cursor-pointer"
        >
          <Home size={15} />
          <span>Accueil</span>
        </button>
        <div className="flex items-center gap-1">
          <span className="font-black text-sm tracking-tight text-slate-900">Love</span>
          <span className="font-black text-sm tracking-tight text-rose-500">Rose</span>
        </div>
        <button
          onClick={handleShare}
          className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-full transition cursor-pointer"
          title="Partager le profil"
        >
          <Share2 size={15} />
        </button>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-6 md:py-10 grid md:grid-cols-12 gap-8 text-left">
        
        {/* Left Column: Public interactive profile details */}
        <div className="md:col-span-7 space-y-6">
          
          {/* Main card */}
          <div className="bg-white border border-slate-150 rounded-3xl overflow-hidden shadow-sm relative">
            <div className="h-32 bg-gradient-to-r from-rose-500 to-pink-600"></div>
            
            <div className="px-6 pb-6 relative">
              <div className="absolute -top-12 left-6">
                <div className="relative w-24 h-24 rounded-full overflow-hidden border-4 border-white bg-slate-150 shadow-md">
                  <img
                    src={profile.avatar_url || `https://api.dicebear.com/7.x/adventurer/svg?seed=${profile.full_name}`}
                    alt={profile.full_name || "Membre"}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>

              <div className="pt-14 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-xl md:text-2xl font-black text-slate-950 tracking-tight">
                    {profile.full_name}
                  </h1>
                  {profile.age && <span className="text-lg font-bold text-slate-400">{profile.age} ans</span>}
                  
                  {profile.verification_status === "verified" && (
                    <span className="bg-emerald-50 text-emerald-700 border border-emerald-100 text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full flex items-center gap-0.5">
                      <CheckCircle size={10} fill="white" className="text-emerald-500" />
                      <span>Vérifié</span>
                    </span>
                  )}

                  {isPremiumUser && (
                    <span className="bg-amber-100 text-amber-800 border border-amber-200 text-[10px] font-black uppercase px-2 py-0.5 rounded-full flex items-center gap-0.5">
                      <Sparkles size={11} className="text-amber-500 fill-amber-500" />
                      <span>Premium</span>
                    </span>
                  )}
                </div>

                <p className="text-xs text-rose-500 font-extrabold">@{profile.username}</p>

                {profile.location && (
                  <p className="text-xs text-slate-500 flex items-center font-bold">
                    <MapPin size={13} className="text-rose-500 mr-1" />
                    <span>{profile.location}</span>
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Biography */}
          {profile.bio && (
            <div className="bg-white border border-slate-150 rounded-3xl p-6 shadow-sm space-y-3">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2">
                Biographie
              </h3>
              <p className="text-slate-600 text-xs md:text-sm leading-relaxed whitespace-pre-wrap font-medium">
                {profile.bio}
              </p>
            </div>
          )}

          {/* Relationship Intents */}
          {profile.relationship_intents && profile.relationship_intents.length > 0 && (
            <div className="bg-white border border-slate-150 rounded-3xl p-6 shadow-sm space-y-3">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2">
                Ses Intentions de rencontres
              </h3>
              <div className="flex flex-wrap gap-2">
                {profile.relationship_intents.map((intent, idx) => (
                  <span
                    key={idx}
                    className="bg-rose-50 text-rose-600 border border-rose-100 px-3 py-1.5 rounded-2xl text-[10px] md:text-xs font-bold uppercase tracking-wide"
                  >
                    ❤️ {intent}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Photo Gallery */}
          {photos.length > 0 && (
            <div className="bg-white border border-slate-150 rounded-3xl p-6 shadow-sm space-y-4">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2">
                Galerie de photos
              </h3>

              <div className="space-y-3">
                <div className="aspect-video w-full rounded-2xl overflow-hidden bg-slate-100 border border-slate-150 relative">
                  <img
                    src={photos[activePhotoIndex]}
                    alt={`Galerie ${activePhotoIndex + 1}`}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute bottom-3 right-3 bg-black/60 text-white text-[10px] font-bold px-2 py-1 rounded-full">
                    {activePhotoIndex + 1} / {photos.length}
                  </div>
                </div>

                {photos.length > 1 && (
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {photos.map((p, idx) => (
                      <button
                        key={idx}
                        onClick={() => setActivePhotoIndex(idx)}
                        className={`w-14 h-14 rounded-xl overflow-hidden flex-shrink-0 border-2 transition ${activePhotoIndex === idx ? "border-rose-500 scale-105" : "border-transparent"}`}
                      >
                        <img src={p} alt="Miniature" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* CTA Card for Registration */}
          <div className="bg-gradient-to-r from-rose-500 to-pink-500 rounded-3xl p-6 md:p-8 text-white text-center space-y-6 shadow-xl shadow-rose-500/10">
            <div className="space-y-2">
              <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center mx-auto text-white">
                <Heart size={24} className="fill-white" />
              </div>
              <h2 className="text-lg md:text-xl font-black tracking-tight">Prêt à rencontrer {profile.full_name} ?</h2>
              <p className="text-xs text-white/90 leading-relaxed max-w-sm mx-auto font-semibold">
                LoveRose réunit des célibataires avec des intentions de rencontres 100% transparentes et authentiques. Inscrivez-vous gratuitement dès maintenant !
              </p>
            </div>

            <button
              onClick={onGoHome}
              className="w-full py-3.5 bg-white hover:bg-rose-50 text-rose-600 font-extrabold text-xs uppercase tracking-widest rounded-2xl flex items-center justify-center gap-2 transition cursor-pointer shadow-md shadow-black/10"
            >
              <span>Créer mon profil gratuit</span>
              <ArrowRight size={14} />
            </button>
          </div>
        </div>

        {/* Right Column: Download invitation card preview */}
        <div className="md:col-span-5 space-y-6">
          <div className="bg-white border border-slate-150 rounded-3xl p-6 shadow-sm text-center space-y-4 sticky top-24">
            <div className="space-y-1">
              <h3 className="font-extrabold text-slate-900 text-sm">Carte d'Invitation LoveRose</h3>
              <p className="text-slate-400 text-[10px] leading-relaxed">
                Voici la carte officielle de {profile.full_name}. Téléchargez-la pour la partager sur WhatsApp, Instagram ou Facebook !
              </p>
            </div>

            {/* Scale card display with custom wrapper to preview properly */}
            <div className="flex justify-center py-2">
              <div className="border border-slate-200 rounded-3xl overflow-hidden shadow-xl scale-[0.8] origin-top md:scale-[0.85] lg:scale-100">
                
                {/* Visual Card component styled specifically for vertical story formats */}
                <div
                  ref={cardRef}
                  id="profile-card-export"
                  style={{ width: "360px", height: "640px" }}
                  className="bg-slate-950 text-white relative p-6 flex flex-col justify-between overflow-hidden font-sans select-none"
                >
                  {/* Premium glowing background overlay */}
                  <div className="absolute inset-0 bg-radial-at-t from-rose-500/35 via-transparent to-black pointer-events-none"></div>
                  <div className="absolute top-1/4 -right-12 w-48 h-48 bg-pink-500/10 rounded-full blur-3xl pointer-events-none"></div>
                  <div className="absolute bottom-1/4 -left-12 w-48 h-48 bg-rose-500/10 rounded-full blur-3xl pointer-events-none"></div>

                  {/* Top Branding Section */}
                  <div className="flex items-center justify-between relative z-10 border-b border-white/10 pb-4">
                    <div className="flex items-center space-x-1.5">
                      <div className="bg-rose-500 p-1.5 rounded-lg text-white">
                        <Heart size={14} fill="currentColor" />
                      </div>
                      <span className="font-black text-xs uppercase tracking-widest">LoveRose</span>
                    </div>
                    <div className="bg-white/10 backdrop-blur-md px-2 py-0.5 rounded-full border border-white/10">
                      <span className="text-[8px] font-black tracking-wider uppercase text-rose-300">Intentions Claires</span>
                    </div>
                  </div>

                  {/* Main Avatar Section with glowing circular border */}
                  <div className="flex flex-col items-center justify-center py-6 relative z-10 space-y-3">
                    <div className="relative">
                      <div className="absolute -inset-1 bg-gradient-to-r from-rose-500 to-pink-500 rounded-full blur-sm opacity-70 animate-pulse"></div>
                      <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-white relative bg-slate-800 shadow-xl">
                        <img
                          src={profile.avatar_url || `https://api.dicebear.com/7.x/adventurer/svg?seed=${profile.full_name}`}
                          alt={profile.full_name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      
                      {profile.verification_status === "verified" && (
                        <div className="absolute -bottom-1 -right-1 bg-emerald-500 text-white rounded-full p-1 border-2 border-slate-950">
                          <CheckCircle size={12} fill="white" className="text-emerald-500" />
                        </div>
                      )}
                    </div>

                    <div className="text-center space-y-1">
                      <h2 className="text-xl font-black tracking-tight flex items-center justify-center gap-1">
                        <span>{profile.full_name}</span>
                        {profile.age && <span className="text-sm font-bold text-slate-400">, {profile.age}</span>}
                      </h2>
                      {profile.location && (
                        <p className="text-[10px] text-slate-400 flex items-center justify-center font-bold">
                          <MapPin size={10} className="text-rose-500 mr-0.5" />
                          <span>{profile.location}</span>
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Bio & Intentions content panel */}
                  <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-3 relative z-10 backdrop-blur-sm">
                    {profile.bio ? (
                      <p className="text-[10px] text-slate-300 line-clamp-3 leading-relaxed text-center italic font-semibold">
                        "{profile.bio}"
                      </p>
                    ) : (
                      <p className="text-[10px] text-slate-400 text-center italic font-semibold">
                        "Rejoignez-moi sur LoveRose pour discuter !"
                      </p>
                    )}

                    {profile.relationship_intents && profile.relationship_intents.length > 0 && (
                      <div className="flex flex-wrap justify-center gap-1.5 pt-1 border-t border-white/5">
                        {profile.relationship_intents.slice(0, 2).map((intent, idx) => (
                          <span
                            key={idx}
                            className="bg-rose-500/10 text-rose-300 border border-rose-500/20 px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wide"
                          >
                            ❤️ {intent}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Footer Actionable QR details & invite CTA */}
                  <div className="flex items-center justify-between relative z-10 pt-4 border-t border-white/10 text-left">
                    <div className="space-y-1">
                      <h4 className="text-[9px] font-black uppercase tracking-wider text-rose-400">Scannez pour me rejoindre</h4>
                      <p className="text-[8px] text-slate-400 font-bold">loverose.pages.dev/profil/{username}</p>
                    </div>

                    {/* Faux QR Code Vector representation for perfect high fidelity aesthetics */}
                    <div className="w-12 h-12 bg-white rounded-xl p-1 shadow-md border border-white/20 flex flex-col justify-between">
                      <div className="flex justify-between h-4">
                        <div className="w-4 h-4 bg-slate-950 rounded-sm"></div>
                        <div className="w-4 h-4 bg-slate-950 rounded-sm"></div>
                      </div>
                      <div className="flex justify-between h-4 items-end">
                        <div className="w-4 h-4 bg-slate-950 rounded-sm"></div>
                        <div className="w-3 h-3 bg-rose-500 rounded-sm flex items-center justify-center">
                          <Heart size={6} className="text-white fill-white" />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

              </div>
            </div>

            {/* Action controls */}
            <div className="space-y-2 pt-2">
              <button
                onClick={handleDownloadCard}
                disabled={generatingCard}
                className="w-full py-3 bg-rose-500 hover:bg-rose-600 active:bg-rose-700 text-white font-extrabold text-xs uppercase tracking-wider rounded-2xl flex items-center justify-center gap-1.5 transition cursor-pointer shadow-md shadow-rose-500/15 disabled:opacity-50"
              >
                {generatingCard ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    <span>Génération de l'image...</span>
                  </>
                ) : (
                  <>
                    <Download size={14} />
                    <span>Télécharger ma carte (PNG)</span>
                  </>
                )}
              </button>

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={handleCopyLink}
                  className="py-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 font-bold text-[10px] uppercase tracking-wide rounded-xl transition cursor-pointer flex items-center justify-center gap-1"
                >
                  {copied ? (
                    <>
                      <Check size={12} className="text-emerald-500" />
                      <span>Copié !</span>
                    </>
                  ) : (
                    <>
                      <Copy size={12} />
                      <span>Copier le lien</span>
                    </>
                  )}
                </button>

                <button
                  onClick={handleShare}
                  className="py-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 font-bold text-[10px] uppercase tracking-wide rounded-xl transition cursor-pointer flex items-center justify-center gap-1"
                >
                  <Share2 size={12} />
                  <span>Partager</span>
                </button>
              </div>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}
