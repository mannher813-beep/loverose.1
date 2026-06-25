import { useState, useEffect, FormEvent } from "react";
import { supabase } from "../lib/supabase";
import { Post, Profile } from "../types";
import { Image, Send, MessageCircle, Heart, Share2, Sparkles, AlertCircle, Loader2 } from "lucide-react";

interface FeedProps {
  currentUser: any;
  currentUserProfile: Profile | null;
}

export default function Feed({ currentUser, currentUserProfile }: FeedProps) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [inputText, setInputText] = useState("");
  const [mediaUrl, setMediaUrl] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isPosting, setIsPosting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    loadPosts();
  }, []);

  const loadPosts = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("posts")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Populate author profiles
      const populatedPosts = await Promise.all(
        (data || []).map(async (p) => {
          const { data: profile } = await supabase
            .from("profiles")
            .select("*")
            .eq("uid", p.author_id)
            .single();

          return {
            ...p,
            author_profile: profile || { full_name: "Membre LoveRose" }
          } as Post;
        })
      );

      setPosts(populatedPosts);
    } catch (err: any) {
      console.error("Failed to load posts:", err);
      setErrorMessage("Impossible de charger le fil d'actualité.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreatePost = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMessage("");

    if (!inputText.trim()) return;

    setIsPosting(true);
    try {
      const { data, error } = await supabase
        .from("posts")
        .insert([
          {
            author_id: currentUser.id,
            contenu: inputText.trim(),
            medias: mediaUrl ? [mediaUrl] : []
          }
        ])
        .select();

      if (error) throw error;

      setInputText("");
      setMediaUrl("");
      
      // Reload posts
      await loadPosts();
    } catch (err: any) {
      console.error("Post creation error:", err);
      setErrorMessage(err.message || "Erreur lors de la publication du post.");
    } finally {
      setIsPosting(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50 p-4 space-y-6 font-sans">
      
      {/* Create Post Card */}
      <div className="max-w-xl mx-auto bg-white border border-slate-150 rounded-3xl p-5 shadow-sm space-y-4">
        <div className="flex items-start space-x-3">
          <img
            src={currentUserProfile?.avatar_url || `https://api.dicebear.com/7.x/adventurer/svg?seed=${currentUserProfile?.full_name || currentUser.id}`}
            alt="Moi"
            referrerPolicy="no-referrer"
            className="w-10 h-10 rounded-full object-cover bg-slate-100 border border-slate-100"
          />
          <form onSubmit={handleCreatePost} className="flex-1 space-y-3">
            <textarea
              rows={3}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Partagez quelque chose avec la communauté LoveRose... ✨"
              className="w-full bg-slate-50 border border-slate-200 focus:border-rose-500 focus:bg-white focus:outline-none rounded-2xl p-3.5 text-xs font-medium transition resize-none leading-relaxed"
            />
            
            {/* Optional media input field for user upload */}
            <div className="flex flex-col gap-2">
              <input
                type="url"
                value={mediaUrl}
                onChange={(e) => setMediaUrl(e.target.value)}
                placeholder="Lien d'image optionnel (ex: https://images.unsplash.com/...)"
                className="w-full bg-slate-50 border border-slate-200 focus:border-rose-500 focus:outline-none rounded-xl p-2 px-3 text-[10px] font-medium transition"
              />
              {mediaUrl && (
                <div className="relative rounded-2xl overflow-hidden h-36 bg-slate-100 border border-slate-200">
                  <img src={mediaUrl} alt="Aperçu média" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => setMediaUrl("")}
                    className="absolute top-2 right-2 bg-black/60 text-white rounded-full p-1 text-[10px] px-2"
                  >
                    Effacer
                  </button>
                </div>
              )}
            </div>

            {errorMessage && (
              <div className="bg-red-50 text-red-600 text-xs p-2 px-3 rounded-lg flex items-center gap-1">
                <AlertCircle size={14} />
                <p className="font-bold flex-1">{errorMessage}</p>
              </div>
            )}

            <div className="flex justify-between items-center pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  const url = prompt("Veuillez entrer l'URL d'une image d'illustration :");
                  if (url) setMediaUrl(url);
                }}
                className="text-slate-500 hover:text-rose-500 flex items-center gap-1.5 text-xs font-bold transition cursor-pointer"
              >
                <Image size={16} />
                <span>Ajouter Image</span>
              </button>
              <button
                id="create-post-btn"
                type="submit"
                disabled={isPosting || !inputText.trim()}
                className="bg-rose-500 hover:bg-rose-600 text-white rounded-xl px-4 py-2 text-xs font-extrabold shadow-md shadow-rose-500/10 flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
              >
                {isPosting ? (
                  <Loader2 className="animate-spin" size={12} />
                ) : (
                  <>
                    <Send size={12} />
                    <span>Publier</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Feed Posts List */}
      <div className="max-w-xl mx-auto space-y-4">
        {isLoading ? (
          <div className="text-center p-12 text-slate-400 text-xs">
            <Loader2 className="animate-spin mx-auto mb-2 text-rose-500" size={24} />
            <span>Chargement des posts...</span>
          </div>
        ) : posts.length > 0 ? (
          posts.map(p => {
            const author = p.author_profile;
            return (
              <div key={p.id} className="bg-white border border-slate-150 rounded-3xl p-5 shadow-xs space-y-4">
                {/* Post Header */}
                <div className="flex items-center space-x-3">
                  <img
                    src={author?.avatar_url || `https://api.dicebear.com/7.x/adventurer/svg?seed=${author?.full_name || p.author_id}`}
                    alt={author?.full_name}
                    referrerPolicy="no-referrer"
                    className="w-10 h-10 rounded-full object-cover bg-slate-100 border border-slate-100"
                  />
                  <div>
                    <div className="flex items-center gap-1">
                      <span className="font-bold text-slate-800 text-sm">{author?.full_name || "Membre LoveRose"}</span>
                      {author?.verification_status === "verified" && (
                        <span className="bg-rose-50 text-rose-500 text-[9px] font-bold px-1.5 py-0.2 rounded uppercase tracking-wider">Vérifié</span>
                      )}
                    </div>
                    <p className="text-[10px] text-slate-400">
                      {new Date(p.created_at).toLocaleDateString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>

                {/* Post Content */}
                <div className="space-y-3">
                  <p className="text-slate-700 text-xs md:text-sm leading-relaxed whitespace-pre-wrap">{p.contenu}</p>
                  
                  {/* Post media */}
                  {p.medias && p.medias.length > 0 && p.medias[0] && (
                    <div className="rounded-2xl overflow-hidden max-h-72 bg-slate-150">
                      <img
                        src={p.medias[0]}
                        alt="Illustration post"
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover hover:scale-[1.01] transition duration-300"
                      />
                    </div>
                  )}
                </div>

                {/* Post Footer Actions */}
                <div className="flex justify-between items-center pt-3 border-t border-slate-100 text-slate-400 text-xs font-semibold">
                  <button className="flex items-center space-x-1 hover:text-rose-500 transition cursor-pointer">
                    <Heart size={16} />
                    <span>J'aime</span>
                  </button>
                  <button className="flex items-center space-x-1 hover:text-rose-500 transition cursor-pointer" onClick={() => alert("Fonctionnalité commentaire bientôt disponible dans votre pays !")}>
                    <MessageCircle size={16} />
                    <span>Commenter</span>
                  </button>
                  <button className="flex items-center space-x-1 hover:text-rose-500 transition cursor-pointer" onClick={() => { navigator.clipboard.writeText(window.location.origin); alert("Lien de l'actualité copié !"); }}>
                    <Share2 size={16} />
                    <span>Partager</span>
                  </button>
                </div>
              </div>
            );
          })
        ) : (
          <div className="text-center p-12 bg-white border border-slate-150 rounded-3xl space-y-3">
            <Sparkles className="mx-auto text-rose-400" size={32} />
            <h4 className="font-extrabold text-slate-800 text-sm">Le fil d'actualité est vide</h4>
            <p className="text-slate-400 text-xs max-w-xs mx-auto leading-relaxed">Soyez la première personne à publier un mot doux, une photo ou une pensée bienveillante sur LoveRose !</p>
          </div>
        )}
      </div>
    </div>
  );
}
