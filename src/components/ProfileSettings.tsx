import React, { useState, useEffect } from "react";
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
  Loader2 
} from "lucide-react";

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
          {/* Settings button shortcut top right */}
          {onGoToSettings && (
            <button
              onClick={onGoToSettings}
              className="absolute top-4 right-4 z-10 bg-white/20 hover:bg-white/35 text-white backdrop-blur-md px-3 py-2 rounded-xl text-xs font-black tracking-tight flex items-center gap-1.5 transition cursor-pointer border border-white/10"
            >
              <Settings size={14} />
              <span>Modifier Profil / Paramètres</span>
            </button>
          )}
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

    </div>
  );
}
