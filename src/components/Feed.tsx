import React, { useState, useEffect, FormEvent } from "react";
import { supabase } from "../lib/supabase";
import { Post, Profile } from "../types";
import AdSlot from "./AdSlot";
import { Image, Send, MessageCircle, Heart, Share2, Sparkles, AlertCircle, Loader2 } from "lucide-react";
import ProfileDetailModal from "./ProfileDetailModal";

interface FeedProps {
  currentUser: any;
  currentUserProfile: Profile | null;
  isPremium?: boolean;
  onStartChat?: (partnerId: string) => void;
}

export default function Feed({ currentUser, currentUserProfile, isPremium = false, onStartChat }: FeedProps) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [inputText, setInputText] = useState("");
  const [mediaUrl, setMediaUrl] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isPosting, setIsPosting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [selectedViewProfile, setSelectedViewProfile] = useState<Profile | null>(null);

  const getAlphabeticCount = (text: string) => {
    const match = text.match(/[a-zA-ZÀ-ÿ]/g);
    return match ? match.length : 0;
  };

  const hasDigits = (text: string) => {
    return /[0-9]/.test(text);
  };

  const alphabeticCount = getAlphabeticCount(inputText);
  const containsNumbers = hasDigits(inputText);
  const isPostRestricted = !isPremium && (alphabeticCount > 100 || containsNumbers);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 3 * 1024 * 1024) {
      alert("L'image est trop volumineuse. Veuillez choisir un fichier de moins de 3 Mo.");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === "string") {
        setMediaUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const triggerImageUpload = () => {
    if (!isPremium) {
      setErrorMessage("L'upload de photos dans le fil d'actualité est réservé exclusivement aux membres abonnés Premium 🔒 ✨.");
      return;
    }
    setErrorMessage("");
    document.getElementById("feed-image-upload")?.click();
  };

  // Interactive local states synced with LocalStorage & Database
  const [likesState, setLikesState] = useState<Record<string, { count: number; userLiked: boolean }>>({});
  const [commentsState, setCommentsState] = useState<Record<string, Array<{ id: string; author_name: string; avatar_url: string; text: string; created_at: string }>>>({});
  const [sharesState, setSharesState] = useState<Record<string, number>>({});
  const [activeCommentsPostId, setActiveCommentsPostId] = useState<string | null>(null);
  const [newCommentText, setNewCommentText] = useState("");
  const [shareToastMessage, setShareToastMessage] = useState<string | null>(null);

  useEffect(() => {
    loadPosts();
  }, [currentUser]);

  const loadInteractionsForPosts = async (loadedPosts: Post[]) => {
    const postIds = loadedPosts.map(p => p.id);
    if (postIds.length === 0) return;

    // 1. Load Likes
    try {
      const { data: dbLikes, error: likesError } = await supabase
        .from("post_likes")
        .select("post_id, user_id");

      if (likesError) throw likesError;

      if (dbLikes) {
        const newLikesState: Record<string, { count: number; userLiked: boolean }> = {};
        loadedPosts.forEach(p => {
          const postLikes = dbLikes.filter(l => l.post_id === p.id);
          const userLiked = postLikes.some(l => l.user_id === currentUser?.id);
          newLikesState[p.id] = {
            count: postLikes.length,
            userLiked: userLiked
          };
        });
        setLikesState(newLikesState);
      }
    } catch (e) {
      console.warn("Could not load likes from DB, falling back to local simulation:", e);
      const storedLikes = localStorage.getItem(`feed_likes_${currentUser?.id || 'anon'}`);
      if (storedLikes) {
        try { setLikesState(JSON.parse(storedLikes)); } catch (err) {}
      } else {
        const initialLikes: Record<string, { count: number; userLiked: boolean }> = {};
        loadedPosts.forEach(p => {
          initialLikes[p.id] = { count: Math.floor(Math.random() * 8) + 2, userLiked: false };
        });
        setLikesState(initialLikes);
      }
    }

    // 2. Load Comments
    try {
      const { data: dbComments, error: commentsError } = await supabase
        .from("post_comments")
        .select(`
          id,
          post_id,
          user_id,
          text,
          created_at
        `);

      if (commentsError) throw commentsError;

      if (dbComments) {
        const newCommentsState: Record<string, any[]> = {};
        const uniqueUserIds = Array.from(new Set(dbComments.map(c => c.user_id)));
        
        let profileMap = new Map();
        if (uniqueUserIds.length > 0) {
          const { data: commentProfiles } = await supabase
            .from("profiles")
            .select("uid, full_name, avatar_url")
            .in("uid", uniqueUserIds);
          profileMap = new Map(commentProfiles?.map(p => [p.uid, p]) || []);
        }

        dbComments.forEach((c: any) => {
          const profile = profileMap.get(c.user_id);
          const formattedComment = {
            id: c.id,
            author_name: profile?.full_name || "Membre LoveRose",
            avatar_url: profile?.avatar_url || `https://api.dicebear.com/7.x/adventurer/svg?seed=${c.user_id}`,
            text: c.text,
            created_at: c.created_at
          };
          if (!newCommentsState[c.post_id]) {
            newCommentsState[c.post_id] = [];
          }
          newCommentsState[c.post_id].push(formattedComment);
        });

        // Initialize empty lists for posts with no comments
        loadedPosts.forEach(p => {
          if (!newCommentsState[p.id]) {
            newCommentsState[p.id] = [];
          }
        });

        setCommentsState(newCommentsState);
      }
    } catch (e) {
      console.warn("Could not load comments from DB, falling back to local simulation:", e);
      const storedComments = localStorage.getItem(`feed_comments_${currentUser?.id || 'anon'}`);
      if (storedComments) {
        try { setCommentsState(JSON.parse(storedComments)); } catch (err) {}
      } else {
        const emptyComments: Record<string, any[]> = {};
        loadedPosts.forEach(p => {
          emptyComments[p.id] = [];
        });
        setCommentsState(emptyComments);
      }
    }

    // 3. Load Shares
    try {
      const { data: dbShares, error: sharesError } = await supabase
        .from("post_shares")
        .select("post_id, user_id");

      if (sharesError) throw sharesError;

      if (dbShares) {
        const newSharesState: Record<string, number> = {};
        loadedPosts.forEach(p => {
          const postShares = dbShares.filter(s => s.post_id === p.id);
          newSharesState[p.id] = postShares.length;
        });
        setSharesState(newSharesState);
      }
    } catch (e) {
      console.warn("Could not load shares from DB, falling back to local simulation:", e);
      const newSharesState: Record<string, number> = {};
      loadedPosts.forEach(p => {
        const storedShareCount = localStorage.getItem(`feed_shares_${p.id}`);
        newSharesState[p.id] = storedShareCount ? parseInt(storedShareCount) : Math.floor(Math.random() * 3);
      });
      setSharesState(newSharesState);
    }
  };

  const handleLikeToggle = async (postId: string) => {
    if (!currentUser) return;

    const currentState = likesState[postId] || { count: 0, userLiked: false };
    const newUserLiked = !currentState.userLiked;
    const newCount = newUserLiked ? currentState.count + 1 : Math.max(0, currentState.count - 1);

    // Optimistic UI update
    const updated = {
      ...likesState,
      [postId]: { count: newCount, userLiked: newUserLiked }
    };
    setLikesState(updated);
    localStorage.setItem(`feed_likes_${currentUser?.id || 'anon'}`, JSON.stringify(updated));

    try {
      if (newUserLiked) {
        await supabase
          .from("post_likes")
          .insert({ post_id: postId, user_id: currentUser.id });
      } else {
        await supabase
          .from("post_likes")
          .delete()
          .eq("post_id", postId)
          .eq("user_id", currentUser.id);
      }
    } catch (e) {
      console.warn("Direct DB like sync error:", e);
    }
  };

  const handleAddComment = async (postId: string) => {
    if (!newCommentText.trim() || !currentUser) return;

    const commentText = newCommentText.trim();
    setNewCommentText("");

    const newCommentTemp = {
      id: `comment-temp-${Date.now()}`,
      author_name: currentUserProfile?.full_name || "Membre LoveRose",
      avatar_url: currentUserProfile?.avatar_url || `https://api.dicebear.com/7.x/adventurer/svg?seed=${currentUserProfile?.full_name || currentUser?.id}`,
      text: commentText,
      created_at: new Date().toISOString()
    };

    const currentPostComments = commentsState[postId] || [];
    const updated = {
      ...commentsState,
      [postId]: [...currentPostComments, newCommentTemp]
    };
    setCommentsState(updated);
    localStorage.setItem(`feed_comments_${currentUser?.id || 'anon'}`, JSON.stringify(updated));

    try {
      const { data, error } = await supabase
        .from("post_comments")
        .insert({
          post_id: postId,
          user_id: currentUser.id,
          text: commentText
        })
        .select()
        .single();

      if (error) throw error;

      if (data) {
        const realComment = {
          id: data.id,
          author_name: currentUserProfile?.full_name || "Membre LoveRose",
          avatar_url: currentUserProfile?.avatar_url || `https://api.dicebear.com/7.x/adventurer/svg?seed=${currentUserProfile?.full_name || currentUser?.id}`,
          text: data.text,
          created_at: data.created_at
        };
        setCommentsState(prev => {
          const list = prev[postId] || [];
          return {
            ...prev,
            [postId]: list.map(item => item.id === newCommentTemp.id ? realComment : item)
          };
        });
      }
    } catch (e) {
      console.warn("Direct DB comment insert error:", e);
    }
  };

  const handleSharePost = async (postId: string) => {
    const currentShares = sharesState[postId] || 0;
    const newShares = currentShares + 1;

    setSharesState({
      ...sharesState,
      [postId]: newShares
    });
    localStorage.setItem(`feed_shares_${postId}`, String(newShares));

    const postLink = `${window.location.origin}/?tab=feed&post=${postId}`;
    const triggerShareAction = () => {
      if (navigator.share) {
        navigator.share({
          title: 'Publication sur LoveRose',
          text: 'Regarde cette publication sympa sur LoveRose !',
          url: postLink,
        }).catch(() => {
          navigator.clipboard.writeText(postLink);
          triggerShareToast();
        });
      } else {
        navigator.clipboard.writeText(postLink);
        triggerShareToast();
      }
    };

    triggerShareAction();

    try {
      if (currentUser) {
        await supabase
          .from("post_shares")
          .insert({
            post_id: postId,
            user_id: currentUser.id
          });
      }
    } catch (e) {
      console.warn("Direct DB share insert error:", e);
    }
  };

  const triggerShareToast = () => {
    setShareToastMessage("Lien de la publication copié ! ✨");
    setTimeout(() => {
      setShareToastMessage(null);
    }, 3000);
  };

  const loadPosts = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("posts")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Populate author profiles in a single batch query to solve the N+1 query performance bottleneck
      const authorIds = Array.from(new Set((data || []).map(p => p.author_id).filter(Boolean)));
      const profilesMap: Record<string, any> = {};
      
      if (authorIds.length > 0) {
        const { data: profilesData } = await supabase
          .from("profiles")
          .select("*")
          .in("uid", authorIds);
        
        if (profilesData) {
          profilesData.forEach(prof => {
            profilesMap[prof.uid] = prof;
          });
        }
      }

      const populatedPosts = (data || []).map((p) => {
        return {
          ...p,
          author_profile: profilesMap[p.author_id] || { full_name: "Membre LoveRose" }
        } as Post;
      });

      setPosts(populatedPosts);
      // Load interactions for loaded posts
      await loadInteractionsForPosts(populatedPosts);
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
                  {/* Hidden file uploader for feed post media */}
            <input
              type="file"
              id="feed-image-upload"
              accept="image/*"
              className="hidden"
              onChange={handleFileSelect}
            />

            {/* Preview of the uploaded image if any */}
            {mediaUrl && (
              <div className="relative rounded-2xl overflow-hidden h-36 bg-slate-100 border border-slate-200 mt-2">
                <img src={mediaUrl} alt="Aperçu média" className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => setMediaUrl("")}
                  className="absolute top-2 right-2 bg-black/60 hover:bg-black/80 text-white rounded-full p-1.5 text-xs px-2.5 font-bold transition cursor-pointer"
                >
                  Effacer
                </button>
              </div>
            )}

            {/* Real-time pre-validation for non-Premium users */}
            {!isPremium && inputText.trim() && (
              <div className="space-y-1.5 pt-1">
                <div className="flex justify-between items-center text-[10px] font-bold">
                  <span className={`${alphabeticCount > 100 ? "text-red-500 font-extrabold animate-pulse" : "text-slate-500"}`}>
                    Lettres : {alphabeticCount} / 100 maximum
                  </span>
                  {containsNumbers && (
                    <span className="text-red-500 font-extrabold flex items-center gap-1 animate-pulse">
                      ⚠️ Contient des chiffres
                    </span>
                  )}
                </div>
                {alphabeticCount > 100 && (
                  <p className="text-[10px] text-red-500 font-semibold leading-normal bg-red-50 border border-red-100 p-2 rounded-xl">
                    Les utilisateurs non-Premium sont limités à 100 caractères alphabétiques par publication. Passez Premium pour lever cette limite.
                  </p>
                )}
                {containsNumbers && (
                  <p className="text-[10px] text-red-500 font-semibold leading-normal bg-red-50 border border-red-100 p-2 rounded-xl">
                    Les utilisateurs non-Premium ne peuvent pas publier de chiffres. Passez Premium pour lever cette limite.
                  </p>
                )}
              </div>
            )}

            {errorMessage && (
              <div className="bg-red-50 text-red-600 text-xs p-2 px-3 rounded-lg flex items-center gap-1">
                <AlertCircle size={14} />
                <p className="font-bold flex-1">{errorMessage}</p>
              </div>
            )}

            <div className="flex justify-between items-center pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={triggerImageUpload}
                className={`flex items-center gap-1.5 text-xs font-bold transition cursor-pointer px-2.5 py-1.5 rounded-xl ${
                  isPremium
                    ? "text-slate-500 hover:text-rose-500 hover:bg-slate-50"
                    : "text-amber-500 bg-amber-50/50 border border-amber-200/50 hover:bg-amber-50"
                }`}
              >
                <Image size={15} />
                <span>Ajouter une Photo</span>
                {!isPremium && <span className="text-[9px] font-black uppercase bg-amber-500 text-white px-1.5 py-0.5 rounded-md leading-none ml-1">🔒 PRO</span>}
              </button>
              <button
                id="create-post-btn"
                type="submit"
                disabled={isPosting || !inputText.trim() || isPostRestricted}
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
          posts.map((p, index) => {
            const author = p.author_profile;
            return (
              <React.Fragment key={p.id}>
                <div className="bg-white border border-slate-150 rounded-3xl p-5 shadow-xs space-y-4">
                  {/* Post Header */}
                  <div 
                    onClick={() => author && setSelectedViewProfile(author)}
                    className="flex items-center space-x-3 cursor-pointer hover:opacity-85 transition"
                    title="Visiter le profil public"
                  >
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
                  {shareToastMessage && (
                    <div className="bg-rose-500 text-white text-xs font-bold py-2 px-4 rounded-xl text-center animate-bounce">
                      {shareToastMessage}
                    </div>
                  )}

                  <div className="flex justify-between items-center pt-3 border-t border-slate-100 text-slate-400 text-xs font-semibold">
                    <button 
                      onClick={() => handleLikeToggle(p.id)}
                      className={`flex items-center space-x-1 hover:text-rose-500 transition cursor-pointer ${likesState[p.id]?.userLiked ? 'text-rose-500 font-bold' : ''}`}
                    >
                      <Heart size={16} fill={likesState[p.id]?.userLiked ? "currentColor" : "none"} className={likesState[p.id]?.userLiked ? "animate-pulse" : ""} />
                      <span>{likesState[p.id]?.count ?? (Math.floor(Math.random() * 8) + 2)} J'aime</span>
                    </button>
                    <button 
                      onClick={() => setActiveCommentsPostId(activeCommentsPostId === p.id ? null : p.id)}
                      className={`flex items-center space-x-1 hover:text-rose-500 transition cursor-pointer ${activeCommentsPostId === p.id ? 'text-rose-500 font-bold' : ''}`}
                    >
                      <MessageCircle size={16} />
                      <span>{(commentsState[p.id] || []).length} Commenter</span>
                    </button>
                    <button 
                      onClick={() => handleSharePost(p.id)}
                      className="flex items-center space-x-1 hover:text-rose-500 transition cursor-pointer"
                    >
                      <Share2 size={16} />
                      <span>{sharesState[p.id] ?? 0} Partager</span>
                    </button>
                  </div>

                  {/* Sub Comments Accordion */}
                  {activeCommentsPostId === p.id && (
                    <div className="bg-slate-50 rounded-2xl p-4 space-y-4 border border-slate-100 animate-fadeIn text-xs">
                      <h5 className="font-extrabold text-slate-800 flex items-center gap-1">
                        <MessageCircle size={14} className="text-rose-500" />
                        <span>Commentaires ({(commentsState[p.id] || []).length})</span>
                      </h5>

                      {/* Comments List */}
                      <div className="space-y-3 max-h-48 overflow-y-auto pr-1">
                        {(commentsState[p.id] || []).length > 0 ? (
                          (commentsState[p.id] || []).map((c: any) => (
                            <div key={c.id} className="flex gap-2.5 items-start bg-white p-2.5 rounded-xl border border-slate-100 shadow-3xs">
                              <img src={c.avatar_url} alt="User avatar" className="w-6 h-6 rounded-full object-cover" />
                              <div className="flex-1 space-y-1">
                                <div className="flex justify-between items-center">
                                  <span className="font-extrabold text-slate-800 text-[10px]">{c.author_name}</span>
                                  <span className="text-[8px] text-slate-400">{new Date(c.created_at).toLocaleDateString([], {hour: '2-digit', minute:'2-digit'})}</span>
                                </div>
                                <p className="text-slate-600 font-medium text-[11px] leading-normal">{c.text}</p>
                              </div>
                            </div>
                          ))
                        ) : (
                          <p className="text-[10px] text-slate-400 font-medium text-center py-2">Aucun commentaire pour le moment. Écrivez le premier ! ✨</p>
                        )}
                      </div>

                      {/* Input comment field */}
                      <div className="flex gap-2 items-center">
                        <input
                          type="text"
                          value={newCommentText}
                          onChange={(e) => setNewCommentText(e.target.value)}
                          placeholder="Écrire un commentaire doux..."
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              handleAddComment(p.id);
                            }
                          }}
                          className="flex-1 bg-white border border-slate-200 focus:border-rose-500 focus:outline-none rounded-xl px-3 py-2 text-[11px] font-medium"
                        />
                        <button
                          onClick={() => handleAddComment(p.id)}
                          disabled={!newCommentText.trim()}
                          className="bg-rose-500 hover:bg-rose-600 active:bg-rose-700 text-white p-2 rounded-xl transition cursor-pointer disabled:opacity-40"
                        >
                          <Send size={12} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Inline Feed AdSlot after every 3rd post */}
                {(index + 1) % 3 === 0 && (
                  <div className="w-full max-w-xl mx-auto py-1">
                    <AdSlot slot={`news_feed_${Math.floor(index / 3) + 1}`} userId={currentUser?.id} />
                  </div>
                )}
              </React.Fragment>
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

      {/* Render profile details modal for post author */}
      {selectedViewProfile && (
        <ProfileDetailModal
          profile={selectedViewProfile}
          currentUserProfile={currentUserProfile}
          isPremium={isPremium}
          onClose={() => setSelectedViewProfile(null)}
          onStartChat={() => {
            if (onStartChat) {
              onStartChat(selectedViewProfile.uid);
              setSelectedViewProfile(null);
            }
          }}
        />
      )}
    </div>
  );
}
