import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { supabase } from "../lib/supabase";
import { Post, Profile, ListingCategory } from "../types";
import AdSlot from "./AdSlot";
import {
  Send, MessageCircle, Heart, Share2, Loader2, DollarSign, MessageSquare,
  MapPin, Tag, Boxes, Clock, Search, X, SlidersHorizontal, Compass, BadgeCheck,
} from "lucide-react";
import { LISTING_CATEGORIES } from "../types";
import ProfileDetailModal from "./ProfileDetailModal";
import AdaptiveImage from "./AdaptiveImage";
import { Button, Badge, EmptyState, PostSkeleton, cx } from "./ui";

// Nombre de publications chargées par page. Le fil récupérait auparavant toute
// la table `posts`, ce qui rendait le premier affichage de plus en plus lent au
// fur et à mesure que la plateforme grossissait.
const POSTS_PAGE_SIZE = 12;

/** Rend une date en libellé relatif court ("il y a 3 h"), plus lisible. */
function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.round(diff / 60000);
  if (min < 1) return "à l'instant";
  if (min < 60) return `il y a ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `il y a ${h} h`;
  const d = Math.round(h / 24);
  if (d < 7) return `il y a ${d} j`;
  return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

interface FeedProps {
  currentUser: any;
  currentUserProfile: Profile | null;
  onAuthRequired?: () => void;
}

export default function Feed({ currentUser, currentUserProfile, onAuthRequired }: FeedProps) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [selectedViewProfile, setSelectedViewProfile] = useState<Profile | null>(null);

  // Filtre de catégorie du fil : null = toutes les annonces confondues.
  const [categoryFilter, setCategoryFilter] = useState<ListingCategory | null>(null);
  // Recherche plein texte côté client sur le contenu et la localisation.
  const [searchQuery, setSearchQuery] = useState("");
  // Filtres complémentaires demandés par les utilisateurs du fil.
  const [priceFilter, setPriceFilter] = useState<"all" | "free" | "paid">("all");
  const [showFilters, setShowFilters] = useState(false);

  const visiblePosts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return posts.filter((p) => {
      if (categoryFilter && p.listing_category !== categoryFilter) return false;
      if (priceFilter === "free" && !p.is_free_listing) return false;
      if (priceFilter === "paid" && !p.listing_price) return false;
      if (!q) return true;
      return (
        (p.contenu || "").toLowerCase().includes(q) ||
        (p.listing_location || "").toLowerCase().includes(q) ||
        (p.author_profile?.full_name || "").toLowerCase().includes(q)
      );
    });
  }, [posts, categoryFilter, priceFilter, searchQuery]);

  const activeFilterCount =
    (categoryFilter ? 1 : 0) + (priceFilter !== "all" ? 1 : 0) + (searchQuery.trim() ? 1 : 0);

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

  // Charge likes / commentaires / partages UNIQUEMENT pour les posts affichés,
  // et en parallèle. Auparavant ces trois requêtes ramenaient l'INTÉGRALITÉ des
  // tables post_likes / post_comments / post_shares (aucun filtre), puis
  // filtraient en JavaScript — ce qui faisait grossir le temps de chargement
  // proportionnellement au nombre total d'interactions de toute la plateforme,
  // quelle que soit la vitesse de connexion.
  const loadInteractionsForPosts = useCallback(async (loadedPosts: Post[]) => {
    const postIds = loadedPosts.map((p) => p.id);
    if (postIds.length === 0) return;

    const [likesRes, commentsRes, sharesRes] = await Promise.all([
      supabase.from("post_likes").select("post_id, user_id").in("post_id", postIds),
      supabase
        .from("post_comments")
        .select("id, post_id, user_id, text, created_at")
        .in("post_id", postIds)
        .order("created_at", { ascending: true }),
      supabase.from("post_shares").select("post_id").in("post_id", postIds),
    ]);

    // 1. Likes
    if (!likesRes.error && likesRes.data) {
      const counts = new Map<string, number>();
      const liked = new Set<string>();
      for (const l of likesRes.data as any[]) {
        counts.set(l.post_id, (counts.get(l.post_id) || 0) + 1);
        if (currentUser?.id && l.user_id === currentUser.id) liked.add(l.post_id);
      }
      const newLikesState: Record<string, { count: number; userLiked: boolean }> = {};
      for (const id of postIds) {
        newLikesState[id] = { count: counts.get(id) || 0, userLiked: liked.has(id) };
      }
      setLikesState((prev) => ({ ...prev, ...newLikesState }));
    } else if (likesRes.error) {
      console.warn("Could not load likes from DB:", likesRes.error);
      const newLikesState: Record<string, { count: number; userLiked: boolean }> = {};
      for (const id of postIds) newLikesState[id] = { count: 0, userLiked: false };
      setLikesState((prev) => ({ ...prev, ...newLikesState }));
    }

    // 3. Partages (indépendant des commentaires, on l'applique tout de suite)
    if (!sharesRes.error && sharesRes.data) {
      const shareCounts = new Map<string, number>();
      for (const s of sharesRes.data as any[]) {
        shareCounts.set(s.post_id, (shareCounts.get(s.post_id) || 0) + 1);
      }
      const newSharesState: Record<string, number> = {};
      for (const id of postIds) newSharesState[id] = shareCounts.get(id) || 0;
      setSharesState((prev) => ({ ...prev, ...newSharesState }));
    } else if (sharesRes.error) {
      console.warn("Could not load shares from DB:", sharesRes.error);
      const newSharesState: Record<string, number> = {};
      for (const id of postIds) newSharesState[id] = 0;
      setSharesState((prev) => ({ ...prev, ...newSharesState }));
    }

    // 2. Commentaires (+ profils des auteurs de commentaires, en une seule requête)
    if (!commentsRes.error && commentsRes.data) {
      const dbComments = commentsRes.data as any[];
      const uniqueUserIds = Array.from(new Set(dbComments.map((c) => c.user_id).filter(Boolean)));

      let profileMap = new Map<string, any>();
      if (uniqueUserIds.length > 0) {
        const { data: commentProfiles } = await supabase
          .from("profiles")
          .select("uid, full_name, avatar_url")
          .in("uid", uniqueUserIds);
        profileMap = new Map((commentProfiles || []).map((pr: any) => [pr.uid, pr]));
      }

      const newCommentsState: Record<string, any[]> = {};
      for (const id of postIds) newCommentsState[id] = [];
      for (const c of dbComments) {
        const prof = profileMap.get(c.user_id);
        (newCommentsState[c.post_id] ||= []).push({
          id: c.id,
          author_name: prof?.full_name || "Membre LoveRose",
          avatar_url: prof?.avatar_url || `https://api.dicebear.com/7.x/adventurer/svg?seed=${c.user_id}`,
          text: c.text,
          created_at: c.created_at,
        });
      }
      setCommentsState((prev) => ({ ...prev, ...newCommentsState }));
    } else if (commentsRes.error) {
      console.warn("Could not load comments from DB:", commentsRes.error);
      const emptyComments: Record<string, any[]> = {};
      for (const id of postIds) emptyComments[id] = [];
      setCommentsState((prev) => ({ ...prev, ...emptyComments }));
    }
  }, [currentUser?.id]);

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

    // On essaie d'obtenir un lien court natif Loverose (/p/xxxxx) à la
    // place du long lien ?tab=feed&post=<uuid>. En cas de lenteur ou
    // d'échec (réseau...), on retombe sur le long lien : le partage ne
    // casse jamais, il est juste moins court dans ce cas précis.
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

  const POST_COLUMNS =
    "id, author_id, contenu, medias, media_types, media_dimensions, created_at, listing_price, whatsapp_link, is_free_listing, listing_category, listing_location, listing_condition, listing_negotiable, listing_expires_at, listing_quantity";

  /** Attache le profil auteur à un lot de posts, en une seule requête. */
  const attachAuthors = useCallback(async (rows: any[]): Promise<Post[]> => {
    const authorIds = Array.from(new Set(rows.map((p) => p.author_id).filter(Boolean)));
    const profilesMap: Record<string, any> = {};

    if (authorIds.length > 0) {
      const { data: profilesData } = await supabase
        .from("profiles")
        .select("uid, full_name, avatar_url, verification_status, age, ville, pays, bio")
        .in("uid", authorIds);
      for (const prof of profilesData || []) profilesMap[prof.uid] = prof;
    }

    return rows.map(
      (p) =>
        ({
          ...p,
          author_profile: profilesMap[p.author_id] || { full_name: "Membre LoveRose" },
        }) as Post
    );
  }, []);

  const loadPosts = useCallback(async () => {
    setIsLoading(true);
    try {
      // Seules les colonnes affichées sont demandées, et par page : un
      // `select("*")` sans limite téléchargeait tout l'historique du fil.
      const { data, error } = await supabase
        .from("posts")
        .select(POST_COLUMNS)
        .order("created_at", { ascending: false })
        .range(0, POSTS_PAGE_SIZE - 1);

      if (error) throw error;

      const rows = data || [];
      const populated = await attachAuthors(rows);

      // Les posts s'affichent immédiatement : les compteurs de likes /
      // commentaires / partages arrivent ensuite en arrière-plan au lieu de
      // retarder l'affichage de tout le fil.
      setPosts(populated);
      setHasMore(rows.length === POSTS_PAGE_SIZE);
      setIsLoading(false);
      loadInteractionsForPosts(populated).catch((e) =>
        console.warn("Could not load post interactions:", e)
      );
    } catch (err: any) {
      console.warn("Could not query posts table (possibly offline or unmigrated):", err);
      setErrorMessage("Impossible de charger le fil d'annonces.");
      setIsLoading(false);
    }
  }, [attachAuthors, loadInteractionsForPosts]);

  /** Pagination : charge la page suivante sans perdre celles déjà affichées. */
  const loadMorePosts = useCallback(async () => {
    if (isLoadingMore || !hasMore || isLoading) return;
    setIsLoadingMore(true);
    try {
      const from = posts.length;
      const { data, error } = await supabase
        .from("posts")
        .select(POST_COLUMNS)
        .order("created_at", { ascending: false })
        .range(from, from + POSTS_PAGE_SIZE - 1);

      if (error) throw error;

      const rows = data || [];
      const populated = await attachAuthors(rows);

      // On dédoublonne : une publication créée entre deux pages pourrait
      // sinon apparaître deux fois et casser les clés React.
      setPosts((prev) => {
        const seen = new Set(prev.map((p) => p.id));
        return [...prev, ...populated.filter((p) => !seen.has(p.id))];
      });
      setHasMore(rows.length === POSTS_PAGE_SIZE);
      loadInteractionsForPosts(populated).catch(() => {});
    } catch (err) {
      console.warn("Could not load more posts:", err);
      setHasMore(false);
    } finally {
      setIsLoadingMore(false);
    }
  }, [attachAuthors, hasMore, isLoading, isLoadingMore, loadInteractionsForPosts, posts.length]);

  useEffect(() => {
    // Posts are publicly readable (RLS allows anon SELECT), so the feed loads
    // for guests too — browsing the annonces never requires an account.
    loadPosts();
  }, [loadPosts]);

  // Défilement infini : on observe une sentinelle en bas de liste plutôt que
  // d'écouter l'évènement scroll (moins coûteux, pas de throttling à gérer).
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || !hasMore) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) loadMorePosts();
      },
      { rootMargin: "600px 0px" }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore, loadMorePosts]);

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
    <div className="flex-1 overflow-y-auto bg-slate-50">
      {/* ============ EN-TÊTE ÉDITORIAL DU FIL ============ */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-2xl mx-auto px-4 pt-6 pb-4 space-y-5">
          <div className="flex items-end justify-between gap-4">
            <div>
              <span className="u-kicker text-rose-600">Le fil</span>
              <h1 className="u-display text-3xl sm:text-4xl text-slate-950 mt-1.5">
                Annonces
              </h1>
            </div>
            <p className="text-xs text-slate-500 font-medium text-right pb-1.5 hidden sm:block">
              {posts.length} publication{posts.length > 1 ? "s" : ""}
              <br />
              chargée{posts.length > 1 ? "s" : ""}
            </p>
          </div>

          {/* Recherche */}
          <div className="relative">
            <Search
              size={17}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
            />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher une annonce, une ville, un vendeur…"
              aria-label="Rechercher une annonce"
              className="w-full h-12 pl-11 pr-11 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium text-slate-900 placeholder:text-slate-400 placeholder:font-normal focus:bg-white focus:border-slate-900 focus:outline-none transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                aria-label="Effacer la recherche"
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-900 rounded cursor-pointer transition"
              >
                <X size={16} />
              </button>
            )}
          </div>

          {/* Rail de catégories + bouton filtres */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowFilters((v) => !v)}
              aria-expanded={showFilters}
              className={cx(
                "flex items-center gap-1.5 h-9 px-3 rounded-lg border text-[13px] font-bold whitespace-nowrap cursor-pointer transition-colors flex-shrink-0",
                showFilters || activeFilterCount > 0
                  ? "bg-slate-900 border-slate-900 text-white"
                  : "bg-white border-slate-300 text-slate-700 hover:border-slate-900"
              )}
            >
              <SlidersHorizontal size={14} />
              Filtres
              {activeFilterCount > 0 && (
                <span className="ml-0.5 bg-rose-500 text-white text-[12px] font-black w-4.5 h-4.5 rounded-full flex items-center justify-center">
                  {activeFilterCount}
                </span>
              )}
            </button>

            <div className="flex-1 overflow-x-auto u-scrollbar-none u-fade-x">
              <div className="flex items-center gap-1.5 w-max pr-6">
                <button
                  onClick={() => setCategoryFilter(null)}
                  className={cx(
                    "h-9 px-3.5 rounded-lg border text-[13px] font-bold whitespace-nowrap cursor-pointer transition-colors",
                    categoryFilter === null
                      ? "bg-rose-50 border-rose-500 text-rose-700"
                      : "bg-white border-slate-200 text-slate-600 hover:border-slate-400"
                  )}
                >
                  Toutes
                </button>
                {LISTING_CATEGORIES.map((cat) => (
                  <button
                    key={cat.value}
                    onClick={() =>
                      setCategoryFilter((prev) => (prev === cat.value ? null : cat.value))
                    }
                    className={cx(
                      "flex items-center gap-1.5 h-9 px-3.5 rounded-lg border text-[13px] font-bold whitespace-nowrap cursor-pointer transition-colors",
                      categoryFilter === cat.value
                        ? "bg-rose-50 border-rose-500 text-rose-700"
                        : "bg-white border-slate-200 text-slate-600 hover:border-slate-400"
                    )}
                  >
                    <span aria-hidden>{cat.emoji}</span>
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Panneau de filtres complémentaires */}
          {showFilters && (
            <div className="animate-rise flex flex-wrap items-center gap-2 pt-1">
              <span className="u-kicker text-slate-400">Prix</span>
              {([
                { id: "all", label: "Tout" },
                { id: "free", label: "Contact gratuit" },
                { id: "paid", label: "Payant" },
              ] as const).map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => setPriceFilter(opt.id)}
                  className={cx(
                    "h-8 px-3 rounded-lg border text-xs font-bold cursor-pointer transition-colors",
                    priceFilter === opt.id
                      ? "bg-slate-900 border-slate-900 text-white"
                      : "bg-white border-slate-200 text-slate-600 hover:border-slate-400"
                  )}
                >
                  {opt.label}
                </button>
              ))}
              {activeFilterCount > 0 && (
                <button
                  onClick={() => {
                    setCategoryFilter(null);
                    setPriceFilter("all");
                    setSearchQuery("");
                  }}
                  className="h-8 px-3 text-xs font-bold text-rose-600 hover:text-rose-700 underline underline-offset-2 cursor-pointer"
                >
                  Tout réinitialiser
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ============ CORPS DU FIL ============ */}
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        {errorMessage && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm p-4 rounded-lg font-semibold">
            {errorMessage}
          </div>
        )}

        {isLoading ? (
          // Squelettes plutôt qu'un spinner : la page garde sa structure et
          // l'attente paraît nettement plus courte.
          <>
            <PostSkeleton />
            <PostSkeleton />
            <PostSkeleton />
          </>
        ) : visiblePosts.length > 0 ? (
          visiblePosts.map((p, index) => {
            const author = p.author_profile;
            const isSharedTarget = p.id === highlightedPostId;
            const likes = likesState[p.id];
            const comments = commentsState[p.id] || [];
            const isCommentsOpen = activeCommentsPostId === p.id;

            return (
              <React.Fragment key={p.id}>
                <article
                  ref={isSharedTarget ? highlightedPostRef : undefined}
                  className={cx(
                    "bg-white border rounded-xl overflow-hidden transition-colors duration-500",
                    isSharedTarget ? "border-rose-500 ring-2 ring-rose-100" : "border-slate-200"
                  )}
                >
                  {/* --- En-tête auteur --- */}
                  <header className="flex items-center gap-3 px-5 pt-5">
                    <button
                      onClick={() => author && setSelectedViewProfile(author)}
                      className="flex items-center gap-3 min-w-0 flex-1 text-left cursor-pointer group"
                      title="Visiter le profil public"
                    >
                      <AdaptiveImage
                        src={author?.avatar_url}
                        fallbackSrc={`https://api.dicebear.com/7.x/adventurer/svg?seed=${author?.full_name || p.author_id}`}
                        alt=""
                        referrerPolicy="no-referrer"
                        loading="lazy"
                        decoding="async"
                        width={44}
                        height={44}
                        className="w-11 h-11 rounded-full object-cover bg-slate-100 border border-slate-200 flex-shrink-0"
                      />
                      <span className="min-w-0">
                        <span className="flex items-center gap-1.5">
                          <span className="font-bold text-[15px] text-slate-900 truncate group-hover:underline underline-offset-2">
                            {author?.full_name || "Membre LoveRose"}
                          </span>
                          {author?.verification_status === "verified" && (
                            <BadgeCheck
                              size={15}
                              className="text-rose-500 flex-shrink-0"
                              aria-label="Profil vérifié"
                            />
                          )}
                        </span>
                        <span className="block text-xs text-slate-500 font-medium mt-0.5">
                          {timeAgo(p.created_at)}
                        </span>
                      </span>
                    </button>
                  </header>

                  {/* --- Corps --- */}
                  <div className="px-5 pt-3.5 space-y-3.5">
                    {p.contenu && (
                      <p className="text-[15px] text-slate-800 leading-relaxed whitespace-pre-wrap">
                        {p.contenu}
                      </p>
                    )}

                    {/* Métadonnées de l'annonce */}
                    {p.listing_category && (
                      <div className="flex flex-wrap items-center gap-1.5">
                        {(() => {
                          const cat = LISTING_CATEGORIES.find((c) => c.value === p.listing_category);
                          return cat ? (
                            <Badge tone="brand" icon={<Tag size={11} />}>
                              {cat.emoji} {cat.label}
                            </Badge>
                          ) : null;
                        })()}
                        {p.listing_location && (
                          <Badge icon={<MapPin size={11} />}>{p.listing_location}</Badge>
                        )}
                        {p.listing_condition && (
                          <Badge icon={<Boxes size={11} />} className="capitalize">
                            {p.listing_condition}
                          </Badge>
                        )}
                        {p.listing_negotiable && (
                          <Badge tone="warning" icon={<DollarSign size={11} />}>
                            Négociable
                          </Badge>
                        )}
                        {typeof p.listing_quantity === "number" && (
                          <Badge>
                            {p.listing_quantity > 0 ? `${p.listing_quantity} dispo.` : "Épuisé"}
                          </Badge>
                        )}
                        {p.listing_expires_at && (
                          <Badge icon={<Clock size={11} />}>
                            {new Date(p.listing_expires_at) < new Date()
                              ? "Expirée"
                              : `Jusqu'au ${new Date(p.listing_expires_at).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}`}
                          </Badge>
                        )}
                      </div>
                    )}
                  </div>

                  {/* --- Médias, pleine largeur pour un rendu éditorial --- */}
                  {p.medias && p.medias.length > 0 && (
                    <div className="mt-4">
                      {p.medias.length === 1 ? (
                        <div className="bg-slate-100 border-y border-slate-200 flex items-center justify-center max-h-[70vh] overflow-hidden">
                          <AdaptiveImage
                            src={p.medias[0]}
                            alt=""
                            referrerPolicy="no-referrer"
                            loading={index === 0 ? "eager" : "lazy"}
                            decoding="async"
                            style={{
                              width: "100%",
                              aspectRatio:
                                p.media_dimensions && p.media_dimensions[0]
                                  ? `${p.media_dimensions[0].ratio}`
                                  : undefined,
                              objectFit: "contain",
                              maxHeight: "70vh",
                            }}
                          />
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 gap-0.5 border-y border-slate-200">
                          {p.medias.map((url, i) => (
                            <AdaptiveImage
                              key={url + i}
                              src={url}
                              alt=""
                              referrerPolicy="no-referrer"
                              loading={index === 0 && i < 2 ? "eager" : "lazy"}
                              decoding="async"
                              className="w-full aspect-square object-cover bg-slate-100"
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* --- Bloc transaction --- */}
                  {(p.is_free_listing && p.whatsapp_link) ||
                  (!p.is_free_listing && !!p.listing_price) ? (
                    <div className="mx-5 mt-4 flex items-center justify-between gap-3 bg-slate-50 border border-slate-200 rounded-lg px-4 py-3">
                      <div className="min-w-0">
                        <span className="u-kicker text-slate-400">
                          {p.is_free_listing ? "Contact" : "Prix"}
                        </span>
                        <p className="u-display text-xl text-slate-950 mt-0.5">
                          {p.is_free_listing
                            ? "Gratuit"
                            : `${p.listing_price!.toLocaleString("fr-FR")} FCFA`}
                        </p>
                      </div>
                      {p.is_free_listing ? (
                        <Button
                          size="sm"
                          variant="ink"
                          icon={<MessageSquare size={14} />}
                          onClick={() =>
                            window.open(p.whatsapp_link!, "_blank", "noopener,noreferrer")
                          }
                        >
                          Contacter
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          loading={payingPostId === p.id}
                          icon={
                            purchasedPostIds.has(p.id) ? (
                              <MessageSquare size={14} />
                            ) : (
                              <DollarSign size={14} />
                            )
                          }
                          onClick={() => handlePayForListing(p)}
                        >
                          {purchasedPostIds.has(p.id) ? "Contacter" : "Payer & contacter"}
                        </Button>
                      )}
                    </div>
                  ) : null}

                  {/* --- Actions --- */}
                  <div className="mt-4 mx-5 border-t border-slate-100 flex items-stretch">
                    <button
                      onClick={() => handleLikeToggle(p.id)}
                      aria-pressed={!!likes?.userLiked}
                      className={cx(
                        "flex-1 flex items-center justify-center gap-2 py-3 text-[13px] font-bold rounded-lg cursor-pointer transition-colors",
                        likes?.userLiked
                          ? "text-rose-600"
                          : "text-slate-500 hover:text-slate-900 hover:bg-slate-50"
                      )}
                    >
                      <Heart size={17} fill={likes?.userLiked ? "currentColor" : "none"} />
                      {likes?.count ?? 0}
                      <span className="hidden xs:inline">J'aime</span>
                    </button>
                    <button
                      onClick={() =>
                        setActiveCommentsPostId(isCommentsOpen ? null : p.id)
                      }
                      aria-expanded={isCommentsOpen}
                      className={cx(
                        "flex-1 flex items-center justify-center gap-2 py-3 text-[13px] font-bold rounded-lg cursor-pointer transition-colors",
                        isCommentsOpen
                          ? "text-rose-600"
                          : "text-slate-500 hover:text-slate-900 hover:bg-slate-50"
                      )}
                    >
                      <MessageCircle size={17} />
                      {comments.length}
                      <span className="hidden xs:inline">Commenter</span>
                    </button>
                    <button
                      onClick={() => handleSharePost(p.id)}
                      className="flex-1 flex items-center justify-center gap-2 py-3 text-[13px] font-bold text-slate-500 hover:text-slate-900 hover:bg-slate-50 rounded-lg cursor-pointer transition-colors"
                    >
                      <Share2 size={17} />
                      {sharesState[p.id] ?? 0}
                      <span className="hidden xs:inline">Partager</span>
                    </button>
                  </div>

                  {/* --- Commentaires --- */}
                  {isCommentsOpen && (
                    <div className="animate-rise bg-slate-50 border-t border-slate-200 px-5 py-4 space-y-3.5">
                      <div className="space-y-2.5 max-h-64 overflow-y-auto">
                        {comments.length > 0 ? (
                          comments.map((c: any) => (
                            <div key={c.id} className="flex gap-2.5">
                              <AdaptiveImage
                                src={c.avatar_url}
                                alt=""
                                loading="lazy"
                                decoding="async"
                                width={28}
                                height={28}
                                className="w-7 h-7 rounded-full object-cover bg-slate-200 flex-shrink-0"
                              />
                              <div className="flex-1 min-w-0 bg-white border border-slate-200 rounded-lg px-3 py-2">
                                <div className="flex items-baseline justify-between gap-2">
                                  <span className="font-bold text-[13px] text-slate-900 truncate">
                                    {c.author_name}
                                  </span>
                                  <span className="text-[11px] text-slate-400 flex-shrink-0">
                                    {timeAgo(c.created_at)}
                                  </span>
                                </div>
                                <p className="text-[13px] text-slate-700 leading-relaxed mt-0.5">
                                  {c.text}
                                </p>
                              </div>
                            </div>
                          ))
                        ) : (
                          <p className="text-[13px] text-slate-500 text-center py-3">
                            Aucun commentaire. Lancez la conversation.
                          </p>
                        )}
                      </div>

                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={newCommentText}
                          onChange={(e) => setNewCommentText(e.target.value)}
                          placeholder="Votre commentaire…"
                          aria-label="Écrire un commentaire"
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleAddComment(p.id);
                          }}
                          className="flex-1 h-10 px-3.5 bg-white border border-slate-300 rounded-lg text-[13px] font-medium focus:border-slate-900 focus:outline-none transition-colors"
                        />
                        <Button
                          size="sm"
                          className="h-10 px-3.5"
                          disabled={!newCommentText.trim()}
                          onClick={() => handleAddComment(p.id)}
                          aria-label="Envoyer le commentaire"
                        >
                          <Send size={14} />
                        </Button>
                      </div>
                    </div>
                  )}
                </article>

                {/* Encart publicitaire toutes les 4 annonces */}
                {(index + 1) % 4 === 0 && (
                  <AdSlot slot={`news_feed_${Math.floor(index / 4) + 1}`} userId={currentUser?.id} />
                )}
              </React.Fragment>
            );
          })
        ) : activeFilterCount > 0 ? (
          <EmptyState
            icon={<Search size={20} />}
            title="Aucun résultat"
            description="Aucune annonce ne correspond à votre recherche. Essayez d'élargir vos critères."
            action={
              <Button
                variant="outline"
                onClick={() => {
                  setCategoryFilter(null);
                  setPriceFilter("all");
                  setSearchQuery("");
                }}
              >
                Réinitialiser les filtres
              </Button>
            }
          />
        ) : (
          <EmptyState
            icon={<Compass size={20} />}
            title="Le fil est encore vide"
            description="Soyez la première personne à publier une annonce sur LoveRose."
          />
        )}

        {/* Sentinelle de défilement infini + états de pagination */}
        {!isLoading && visiblePosts.length > 0 && (
          <div ref={sentinelRef} className="py-6 text-center">
            {isLoadingMore ? (
              <span className="inline-flex items-center gap-2 text-sm text-slate-500 font-semibold">
                <Loader2 size={15} className="animate-spin" />
                Chargement…
              </span>
            ) : hasMore ? (
              <Button variant="outline" onClick={loadMorePosts}>
                Afficher plus d'annonces
              </Button>
            ) : (
              <span className="u-kicker text-slate-400">Fin du fil</span>
            )}
          </div>
        )}
      </div>

      {/* Toast de partage */}
      {shareToastMessage && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 animate-rise bg-slate-900 text-white text-[13px] font-bold px-4 py-2.5 rounded-lg shadow-lg">
          {shareToastMessage}
        </div>
      )}

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
