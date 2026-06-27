import React, { useState, useEffect, useRef } from "react";
import { supabase } from "../lib/supabase";
import { Profile } from "../types";
import { 
  User, 
  MapPin, 
  AlignLeft, 
  CheckCircle, 
  ShieldCheck, 
  Sparkles, 
  Camera, 
  Settings, 
  Eye, 
  Newspaper, 
  Trash2, 
  MessageCircle, 
  Heart,
  Loader2,
  Share2,
  Download,
  Copy,
  Check,
  X
} from "lucide-react";
import { toPng } from "html-to-image";

interface ProfileSettingsProps {
  currentUser: any;
  profile: Profile | null;
  isPremium?: boolean;
  onProfileUpdated: () => void;
  onGoToSettings?: () => void;
}

export default function ProfileSettings({ 
  currentUser, 
  profile, 
  isPremium = false, 
  onProfileUpdated, 
  onGoToSettings 
}: ProfileSettingsProps) {
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);
  const [userPosts, setUserPosts] = useState<any[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(false);

  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [generatingCard, setGeneratingCard] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const handleCopyLink = async () => {
    if (!profile) return;
    const url = `${window.location.origin}/profil/${profile.username}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy link:", err);
    }
  };

  const handleShare = async () => {
    if (!profile) return;
    const url = `${window.location.origin}/profil/${profile.username}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${profile.full_name} sur LoveRose`,
          text: `Découvrez mon profil sur LoveRose !`,
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
      await new Promise((resolve) => setTimeout(resolve, 500));
      const dataUrl = await toPng(cardRef.current, {
        quality: 0.98,
        pixelRatio: 2,
        style: {
          transform: 'scale(1)',
          transformOrigin: 'top left',
          width: '360px',
          height: '640px'
        }
      });

      const link = document.createElement('a');
      link.download = `loverose-invite-${profile?.username}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error("Error generating image:", err);
      alert("Une erreur est survenue lors de la génération de la carte d'invitation.");
    } finally {
      setGeneratingCard(false);
    }
  };

  // Load user's own posts
  useEffect(() => {
    const loadUserPosts = async () => {
      if (!currentUser) return;
      setLoadingPosts(true);
      try {
        const { data, error } = await supabase
          .from("posts")
          .select("*")
          .eq("author_id", currentUser.id)
          .order("created_at", { ascending: false });

        if (!error && data) {
          setUserPosts(data);
        }
      } catch (err) {
        console.error("Error loading own posts:", err);
      } finally {
        setLoadingPosts(false);
      }
    };

    loadUserPosts();
  }, [currentUser, profile]);

  // Method to delete a post
  const handleDeletePost = async (postId: string) => {
    if (!confirm("Voulez-vous vraiment supprimer définitivement cette publication ?")) return;
    
    try {
      const { error } = await supabase
        .from("posts")
        .delete()
        .eq("id", postId)
        .eq("author_id", currentUser.id);

      if (error) throw error;

      setUserPosts(prev => prev.filter(p => p.id !== postId));
      alert("Publication supprimée !");
    } catch (err: any) {
      alert(err.message || "Erreur lors de la suppression du post.");
    }
  };

  if (!profile) {
    return (
      <div className="flex-1 flex items-center justify-center bg-slate-50">
        <div className="text-center space-y-3">
          <Loader2 className="animate-spin text-rose-500 mx-auto" size={28} />
          <p className="text-xs text-slate-500 font-bold">Chargement de votre profil public...</p>
        </div>
      </div>
    );
  }

  // Get photos list safely
  const profilePhotos: string[] = Array.isArray(profile.photos) && profile.photos.length > 0 
    ? profile.photos 
    : [profile.avatar_url].filter(Boolean) as string[];

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50 font-sans max-w-4xl mx-auto w-full p-4 md:p-8 space-y-8 text-left">
      
      {/* Profil Header Card */}
      <div className="bg-white border border-slate-150 rounded-3xl overflow-hidden shadow-sm relative">
        <div className="h-44 bg-gradient-to-r from-rose-500 to-pink-600 relative">
          {/* Action buttons top right */}
          <div className="absolute top-4 right-4 z-10 flex flex-wrap justify-end gap-2">
            <button
              onClick={() => setIsShareModalOpen(true)}
              className="bg-white/25 hover:bg-white/35 text-white backdrop-blur-md px-3 py-2 rounded-xl text-xs font-black tracking-tight flex items-center gap-1.5 transition cursor-pointer border border-white/15 shadow-sm"
            >
              <Share2 size={14} />
              <span>Partager mon profil</span>
            </button>
            {onGoToSettings && (
              <button
                onClick={onGoToSettings}
                className="bg-white/20 hover:bg-white/35 text-white backdrop-blur-md px-3 py-2 rounded-xl text-xs font-black tracking-tight flex items-center gap-1.5 transition cursor-pointer border border-white/10"
              >
                <Settings size={14} />
                <span>Modifier Profil / Paramètres</span>
              </button>
            )}
          </div>
        </div>

        <div className="px-6 pb-6 relative">
          {/* Photo de profil (Large Avatar) container overlapping background */}
          <div className="absolute -top-16 left-6">
            <div className="relative w-28 h-28 rounded-full overflow-hidden border-4 border-white bg-slate-100 shadow-md">
              <img
                src={profile.avatar_url || `https://api.dicebear.com/7.x/adventurer/svg?seed=${profile.full_name || currentUser.id}`}
                alt={profile.full_name || "Moi"}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
            </div>
          </div>

          <div className="pt-14 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-2xl font-black text-slate-950 tracking-tight">
                  {profile.full_name || "Membre LoveRose"}
                </h2>
                {profile.age && <span className="text-xl font-bold text-slate-500">{profile.age} ans</span>}
                
                {/* Verification badge */}
                {profile.verification_status === "verified" && (
                  <span className="bg-emerald-50 text-emerald-700 border border-emerald-100 text-[10px] font-black uppercase px-2 py-0.5 rounded-full flex items-center gap-0.5" title="Profil vérifié officiellement">
                    <CheckCircle size={11} fill="white" className="text-emerald-500" />
                    <span>Vérifié</span>
                  </span>
                )}

                {/* Premium badge */}
                {isPremium && (
                  <span className="bg-amber-100 text-amber-800 border border-amber-200 text-[10px] font-black uppercase px-2 py-0.5 rounded-full flex items-center gap-0.5">
                    <Sparkles size={11} className="text-amber-500 fill-amber-500 animate-pulse" />
                    <span>Premium</span>
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 font-extrabold mt-0.5">
                @{profile.username || "username"}
              </p>
              {profile.location && (
                <p className="text-xs text-slate-500 flex items-center mt-2 font-semibold">
                  <MapPin size={13} className="text-rose-500 mr-1 flex-shrink-0" />
                  <span>{profile.location}</span>
                </p>
              )}
            </div>

            {/* Quick stats grid */}
            <div className="flex items-center gap-6 border-t border-slate-100 md:border-t-0 pt-4 md:pt-0">
              <div className="text-center">
                <p className="text-lg font-black text-slate-900">{profilePhotos.length}</p>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Photos</p>
              </div>
              <div className="w-px h-8 bg-slate-100"></div>
              <div className="text-center">
                <p className="text-lg font-black text-slate-900">{userPosts.length}</p>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Posts</p>
              </div>
              <div className="w-px h-8 bg-slate-100"></div>
              <div className="text-center">
                <p className="text-lg font-black text-rose-500">100%</p>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Intégrité</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-8">
        
        {/* Left column: Bio, Gallery, Intentions */}
        <div className="md:col-span-1 space-y-6">
          
          {/* Bio block */}
          <div className="bg-white border border-slate-150 rounded-3xl p-5 shadow-sm space-y-3">
            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2 flex items-center gap-1.5">
              <AlignLeft size={13} className="text-rose-500" />
              <span>Ma Biographie</span>
            </h4>
            {profile.bio ? (
              <p className="text-slate-600 text-xs md:text-sm leading-relaxed whitespace-pre-wrap">
                {profile.bio}
              </p>
            ) : (
              <p className="text-slate-400 text-xs italic">Vous n'avez pas encore rédigé de biographie. Allez dans les paramètres pour vous présenter !</p>
            )}
          </div>

          {/* Relationship Intents */}
          <div className="bg-white border border-slate-150 rounded-3xl p-5 shadow-sm space-y-3">
            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2">
              ❤️ Intentions Recherchées
            </h4>
            <div className="flex flex-wrap gap-1.5">
              {profile.relationship_intents && profile.relationship_intents.length > 0 ? (
                profile.relationship_intents.map(intent => (
                  <span key={intent} className="px-2.5 py-1 rounded-lg text-[11px] font-black bg-rose-50 border border-rose-100 text-rose-600">
                    {intent}
                  </span>
                ))
              ) : (
                <p className="text-slate-400 text-[10px] italic">Aucune intention de rencontre sélectionnée.</p>
              )}
            </div>
          </div>

          {/* Photos gallery block */}
          <div className="bg-white border border-slate-150 rounded-3xl p-5 shadow-sm space-y-3">
            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2 flex items-center gap-1.5">
              <Camera size={13} className="text-rose-500" />
              <span>Ma Galerie Photos</span>
            </h4>
            
            {profilePhotos.length > 0 ? (
              <div className="space-y-3">
                <div className="aspect-square rounded-2xl overflow-hidden bg-slate-100 border border-slate-200">
                  <img 
                    src={profilePhotos[activePhotoIndex]} 
                    alt="Zoom Galerie" 
                    className="w-full h-full object-cover" 
                  />
                </div>
                
                {profilePhotos.length > 1 && (
                  <div className="flex gap-1.5 overflow-x-auto pb-1">
                    {profilePhotos.map((photo, index) => (
                      <button
                        key={index}
                        onClick={() => setActivePhotoIndex(index)}
                        className={`w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 border-2 transition cursor-pointer ${
                          activePhotoIndex === index ? "border-rose-500 scale-105" : "border-transparent opacity-70"
                        }`}
                      >
                        <img src={photo} alt="" className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <p className="text-slate-400 text-[10px] italic">Aucune photo dans votre galerie.</p>
            )}
          </div>

        </div>

        {/* Right column: Own Posts */}
        <div className="md:col-span-2 space-y-6">
          <div className="bg-white border border-slate-150 rounded-3xl p-6 shadow-sm space-y-5">
            <h3 className="font-extrabold text-slate-900 text-sm flex items-center gap-1.5 border-b border-slate-100 pb-3">
              <Newspaper size={16} className="text-rose-500" />
              <span>Mes Publications ({userPosts.length})</span>
            </h3>

            {loadingPosts ? (
              <div className="py-8 text-center space-y-2">
                <Loader2 className="animate-spin text-rose-500 mx-auto" size={20} />
                <p className="text-slate-400 text-xs">Chargement de vos publications...</p>
              </div>
            ) : userPosts.length > 0 ? (
              <div className="space-y-4">
                {userPosts.map(post => (
                  <div key={post.id} className="border border-slate-100 rounded-2xl p-4 space-y-3 bg-slate-50 relative group">
                    <button
                      onClick={() => handleDeletePost(post.id)}
                      className="absolute top-4 right-4 text-slate-400 hover:text-red-500 transition cursor-pointer"
                      title="Supprimer la publication"
                    >
                      <Trash2 size={14} />
                    </button>

                    <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap pr-6">
                      {post.contenu}
                    </p>

                    {/* Media attachments */}
                    {Array.isArray(post.medias) && post.medias.length > 0 && (
                      <div className="grid grid-cols-2 gap-1.5 mt-2 max-h-48 overflow-hidden rounded-xl">
                        {post.medias.map((med: string, i: number) => (
                          <img key={i} src={med} alt="" className="w-full h-24 object-cover" />
                        ))}
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-[10px] text-slate-400 font-bold">
                      <span>Posté le {new Date(post.created_at).toLocaleDateString()} à {new Date(post.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 space-y-3">
                <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mx-auto text-slate-400">
                  <Newspaper size={20} />
                </div>
                <p className="text-xs text-slate-400 italic">Vous n'avez écrit aucune publication pour le moment.</p>
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Interactive Share Modal Popup Overlay */}
      {isShareModalOpen && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto animate-fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 flex flex-col space-y-4 text-center relative max-h-[90vh] overflow-y-auto">
            {/* Close button */}
            <button
              onClick={() => setIsShareModalOpen(false)}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-50 transition cursor-pointer"
            >
              <X size={18} />
            </button>

            <div className="space-y-1">
              <h3 className="text-lg font-black text-slate-950 tracking-tight flex items-center justify-center gap-1.5">
                <Share2 size={18} className="text-rose-500" />
                <span>Partager mon profil</span>
              </h3>
              <p className="text-slate-500 text-xs leading-normal max-w-sm mx-auto">
                Partagez votre carte officielle sur WhatsApp ou vos réseaux sociaux pour faire des rencontres avec des intentions claires !
              </p>
            </div>

            {/* Scale card container to fit perfectly inside the modal */}
            <div className="flex justify-center py-2">
              <div className="border border-slate-200 rounded-3xl overflow-hidden shadow-lg scale-[0.68] md:scale-[0.75] origin-center -my-14">
                
                {/* Vertical Invitation Card (360x640px format for perfect 1080x1920 high resolution output) */}
                <div
                  ref={cardRef}
                  style={{ width: "360px", height: "640px" }}
                  className="bg-slate-950 text-white relative p-6 flex flex-col justify-between overflow-hidden font-sans text-left select-none"
                >
                  {/* Premium backgrounds and gradients */}
                  <div className="absolute inset-0 bg-radial-at-t from-rose-500/35 via-transparent to-black pointer-events-none"></div>
                  <div className="absolute top-1/4 -right-12 w-48 h-48 bg-pink-500/10 rounded-full blur-3xl pointer-events-none"></div>
                  <div className="absolute bottom-1/4 -left-12 w-48 h-48 bg-rose-500/10 rounded-full blur-3xl pointer-events-none"></div>

                  {/* Header Branding */}
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

                  {/* Main user info details */}
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
                          <MapPin size={10} className="text-rose-500 mr-0.5 animate-pulse" />
                          <span>{profile.location}</span>
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Bio details panel */}
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

                  {/* Dynamic footer scan indicator */}
                  <div className="flex items-center justify-between relative z-10 pt-4 border-t border-white/10">
                    <div className="space-y-1">
                      <h4 className="text-[9px] font-black uppercase tracking-wider text-rose-400">Scannez pour me rejoindre</h4>
                      <p className="text-[8px] text-slate-400 font-bold">loverose.pages.dev/profil/{profile.username}</p>
                    </div>

                    {/* Styled Mock vector QR for high end visuals */}
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

            {/* Action buttons inside modal */}
            <div className="space-y-2 pt-2 relative z-20">
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
                      <span>Lien Copié !</span>
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
                  <span>Natif Partager</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
