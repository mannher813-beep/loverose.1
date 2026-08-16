import React, { useState, useEffect, useRef } from "react";
import { supabase } from "../lib/supabase";
import { Post, Profile } from "../types";
import AdSlot from "./AdSlot";
import { Send, MessageCircle, Heart, Share2, Sparkles, Loader2, DollarSign, MessageSquare, MapPin, Tag, Boxes, Clock } from "lucide-react";
import { LISTING_CATEGORIES } from "../types";
import ProfileDetailModal from "./ProfileDetailModal";

interface FeedProps {
  currentUser: any;
  currentUserProfile: Profile | null;
  onAuthRequired?: () => void;
}

export default function Feed({ currentUser, currentUserProfile, onAuthRequired }: FeedProps) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [selectedViewProfile, setSelectedViewProfile] = useState<Profile | null>(null);

  // post_id -> true once the current visitor has paid for that annonce
  const [purchasedPostIds, setPurchasedPostIds] = useState<Set<string>>(new Set());
  const [payingPostId, setPayingPostId] = useState<string | null>(null);

  // When someone opens a link shared from the feed (/?tab=feed&post=ID),
  // scroll straight to that publication and highlight it briefly.
  const [highlightedPostId, setHighlightedPostId] = useState<string | null>(() =>
    new URLSearchParams(window.location.search).get("post")
  );
  const highlightedPostRef = useRef<HTMLDivElement | null>(null);

  // Interactive local states synced with LocalStorage & Database
  const [likesState, setLikesState] = useState<Record<string, { count: number; userLiked: boolean }>>({});
  const [commentsState, setCommentsState] = useState<Record<string, Array<{ id: string; author_name: string; avatar_url: string; text: string; created_at: string }>>>({});
  const [sharesState, setSharesState] = useState<Record<string, number>>({});
  const [activeCommentsPostId, setActiveCommentsPostId] = useState<string | null>(null);
  const [newCommentText, setNewCommentText] = useState("");
  const [shareToastMessage, setShareToastMessage] = useState<string | null>(null);

  useEffect(() => {
    // Posts are publicly readable (RLS allows anon SELECT), so the feed loads
    // for guests too — browsing the annonces never requires an account.
    loadPosts();
  }, []);

  useEffect(() => {
    if (!highlightedPostId || isLoading || posts.length === 0) return;
    highlightedPostRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    const clearTimer = setTimeout(() => setHighlightedPostId(null), 4000);
    return () => clearTimeout(clearTimer);
  }, [highlightedPostId, isLoading, posts.length]);

  // Which paid annonces has this visitor already unlocked (paid for)?
  useEffect(() => {
    if (!currentUser) {
      setPurchasedPostIds(new Set());
      return;
    }
    supabase
      .from("listing_purchases")
      .select("post_id")
      .eq("buyer_id", currentUser.id)
      .then(({ data, error }) => {
        if (error) {
          console.warn("Could not load purchased listings:", error);
          return;
        }
        setPurchasedPostIds(new Set((data || []).map((r: any) => r.post_id)));
      });
  }, [currentUser?.id]);

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
    if (!currentUser) {
      onAuthRequired?.();
      return;
    }

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
    if (!currentUser) {
      onAuthRequired?.();
      return;
    }
    if (!newCommentText.trim()) return;

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

    const longLink = `${window.location.origin}/?tab=feed&post=${postId}`;

    // On essaie d'obtenir un lien court via Cutt.ly (https://cutt.ly/xxxxx)
    // à la place du long lien ?tab=feed&post=<uuid>. En cas de lenteur ou
    // d'échec (réseau, quota Cutt.ly...), on retombe sur le long lien : le
    // partage ne casse jamais, il est juste moins court dans ce cas précis.
    let postLink = longLink;
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);
      const res = await fetch("/api/short-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      if (res.ok) {
        const data = (await res.json()) as { success: boolean; shortUrl?: string };
        if (data.success && data.shortUrl) {
          postLink = data.shortUrl;
        }
      }
    } catch (e) {
      console.warn("Short link creation failed, falling back to long link:", e);
    }

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

      // Fil non chronologique : mélangé aléatoirement à chaque chargement.
      const shuffle = <T,>(arr: T[]): T[] => {
        const a = [...arr];
        for (let i = a.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [a[i], a[j]] = [a[j], a[i]];
        }
        return a;
      };

      const orderedPosts = shuffle(populatedPosts);

      setPosts(orderedPosts);
      // Load interactions for loaded posts
      await loadInteractionsForPosts(orderedPosts);
    } catch (err: any) {
      console.warn("Could not query posts table (possibly offline or unmigrated):", err);
      setErrorMessage("Impossible de charger le fil d'actualité.");
    } finally {
      setIsLoading(false);
    }
  };

  const handlePayForListing = async (post: Post) => {
    if (!currentUser) {
      onAuthRequired?.();
      return;
    }
    if (!post.listing_price) return;

    // Already paid: skip straight to WhatsApp, no need to charge again.
    if (purchasedPostIds.has(post.id) && post.whatsapp_link) {
      window.open(post.whatsapp_link, "_blank", "noopener,noreferrer");
      return;
    }

    setPayingPostId(post.id);
    try {
      const response = await fetch("/api/payments/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: currentUser.id,
          planId: `listing_contact:${post.id}`,
          planName: (post.contenu || "Annonce LoveRose").slice(0, 60),
          amount: post.listing_price,
          email: currentUser.email,
        }),
      });

      if (!response.ok) throw new Error("Impossible de générer le lien de paiement.");

      const data = await response.json();
      if (data.checkoutUrl) {
        localStorage.setItem("last_payment_reference", data.reference);
        window.location.href = data.checkoutUrl;
      } else {
        throw new Error("Impossible de générer le lien de paiement.");
      }
    } catch (err: any) {
      console.error("Listing payment error:", err);
      setErrorMessage(err.message || "Erreur lors du paiement de l'annonce.");
    } finally {
      setPayingPostId(null);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50 p-4 space-y-6 font-sans">

      {errorMessage && (
        <div className="max-w-xl mx-auto bg-red-50 text-red-600 text-xs p-3 rounded-xl font-bold">
          {errorMessage}
        </div>
      )}

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
            const isSharedTarget = p.id === highlightedPostId;
            return (
              <React.Fragment key={p.id}>
                <div
                  ref={isSharedTarget ? highlightedPostRef : undefined}
                  className={`bg-white border rounded-3xl p-5 shadow-xs space-y-4 transition-all duration-700 ${
                    isSharedTarget ? "border-rose-400 ring-2 ring-rose-200" : "border-slate-150"
                  }`}
                >
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
                    {/* Badges d'annonce : type choisi par l'auteur + infos complémentaires */}
                    {p.listing_category && (
                      <div className="flex flex-wrap items-center gap-1.5">
                        {(() => {
                          const cat = LISTING_CATEGORIES.find((c) => c.value === p.listing_category);
                          return cat ? (
                            <span className="inline-flex items-center gap-1 bg-rose-50 text-rose-600 text-[10px] font-bold px-2 py-1 rounded-full">
                              <Tag size={10} />
                              {cat.emoji} {cat.label}
                            </span>
                          ) : null;
                        })()}
                        {p.listing_location && (
                          <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-600 text-[10px] font-bold px-2 py-1 rounded-full">
                            <MapPin size={10} />
                            {p.listing_location}
                          </span>
                        )}
                        {p.listing_condition && (
                          <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-600 text-[10px] font-bold px-2 py-1 rounded-full capitalize">
                            <Boxes size={10} />
                            {p.listing_condition}
                          </span>
                        )}
                        {p.listing_negotiable && (
                          <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-600 text-[10px] font-bold px-2 py-1 rounded-full">
                            <DollarSign size={10} />
                            Négociable
                          </span>
                        )}
                        {typeof p.listing_quantity === "number" && (
                          <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-600 text-[10px] font-bold px-2 py-1 rounded-full">
                            {p.listing_quantity > 0 ? `${p.listing_quantity} dispo.` : "Épuisé"}
                          </span>
                        )}
                        {p.listing_expires_at && (
                          <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-500 text-[10px] font-bold px-2 py-1 rounded-full">
                            <Clock size={10} />
                            {new Date(p.listing_expires_at) < new Date()
                              ? "Expirée"
                              : `Jusqu'au ${new Date(p.listing_expires_at).toLocaleDateString([], { day: "numeric", month: "short" })}`}
                          </span>
                        )}
                      </div>
                    )}
                    <p className="text-slate-700 text-xs md:text-sm leading-relaxed whitespace-pre-wrap">{p.contenu}</p>
                    
                    {/* Post media — single photo full-width, several photos as a grid */}
                    {p.medias && p.medias.length > 0 && (
                      p.medias.length === 1 ? (
                        <div className="rounded-2xl overflow-hidden bg-slate-950 border border-slate-100/5 flex items-center justify-center max-h-[80vh] w-full">
                          <img
                            src={p.medias[0]}
                            alt="Illustration post"
                            referrerPolicy="no-referrer"
                            style={{
                              width: '100%',
                              aspectRatio: p.media_dimensions && p.media_dimensions[0] ? `${p.media_dimensions[0].ratio}` : 'auto',
                              objectFit: 'contain',
                              maxHeight: '80vh',
                            }}
                            className="hover:scale-[1.005] transition duration-300"
                          />
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 gap-1.5 rounded-2xl overflow-hidden">
                          {p.medias.map((url, i) => (
                            <img
                              key={url + i}
                              src={url}
                              alt={`Photo ${i + 1}`}
                              referrerPolicy="no-referrer"
                              className="w-full aspect-square object-cover bg-slate-950"
                            />
                          ))}
                        </div>
                      )
                    )}

                    {/* Free-contact annonce: no payment, WhatsApp button opens directly */}
                    {p.is_free_listing && p.whatsapp_link && (
                      <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3.5 flex items-center justify-between gap-3">
                        <div>
                          <p className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">Annonce</p>
                          <p className="text-sm font-black text-slate-900">Contact gratuit</p>
                        </div>
                        <button
                          onClick={() => window.open(p.whatsapp_link!, "_blank", "noopener,noreferrer")}
                          className="bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-extrabold px-4 py-2.5 rounded-xl shadow-md transition cursor-pointer flex items-center gap-1.5 flex-shrink-0"
                        >
                          <MessageSquare size={13} />
                          <span>Contacter sur WhatsApp</span>
                        </button>
                      </div>
                    )}

                    {/* Paid annonce block: price + pay / contact button */}
                    {!p.is_free_listing && !!p.listing_price && (
                      <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3.5 flex items-center justify-between gap-3">
                        <div>
                          <p className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">Annonce</p>
                          <p className="text-sm font-black text-slate-900">{p.listing_price.toLocaleString("fr-FR")} FCFA</p>
                        </div>
                        <button
                          onClick={() => handlePayForListing(p)}
                          disabled={payingPostId === p.id}
                          className="bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-extrabold px-4 py-2.5 rounded-xl shadow-md transition cursor-pointer flex items-center gap-1.5 disabled:opacity-50 flex-shrink-0"
                        >
                          {payingPostId === p.id ? (
                            <Loader2 size={13} className="animate-spin" />
                          ) : purchasedPostIds.has(p.id) ? (
                            <MessageSquare size={13} />
                          ) : (
                            <DollarSign size={13} />
                          )}
                          <span>{purchasedPostIds.has(p.id) ? "Contacter sur WhatsApp" : "Payer & Contacter"}</span>
                        </button>
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
          onClose={() => setSelectedViewProfile(null)}
        />
      )}
    </div>
  );
}
