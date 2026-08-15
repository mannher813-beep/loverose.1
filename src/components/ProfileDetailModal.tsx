import React, { useState, useEffect } from "react";
import { ArrowLeft, MapPin, Sparkles, CheckCircle, Heart, X, Flag, ExternalLink, Star, Loader2 } from "lucide-react";
import { Profile, PostReview } from "../types";
import { supabase } from "../lib/supabase";

interface ProfileDetailModalProps {
  profile: Profile;
  currentUserProfile: Profile | null;
  currentUser?: any;
  onClose: () => void;
  onLikeBack?: () => void;
  onAuthRequired?: () => void;
  /** Optional: only Discover currently wires this up (its own report flow). */
  onReport?: () => void;
  /** Optional: lets the person pass directly from the full profile page, like Discover's swipe stack. */
  onPass?: () => void;
  /**
   * Whether this profile is already a mutual match. When true, the footer
   * simply confirms the match rather than offering to like again.
   */
  isMatch?: boolean;
}

export default function ProfileDetailModal({
  profile,
  currentUserProfile,
  currentUser,
  onClose,
  onLikeBack,
  onAuthRequired,
  onReport,
  onPass,
  isMatch = true,
}: ProfileDetailModalProps) {
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);
  const [showScoreInfo, setShowScoreInfo] = useState(false);

  // Avis / notation (achats confirmés uniquement — voir post_reviews RLS)
  const [reviews, setReviews] = useState<PostReview[]>([]);
  const [isLoadingReviews, setIsLoadingReviews] = useState(false);
  const [reviewablePostId, setReviewablePostId] = useState<string | null>(null);
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState("");
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [reviewError, setReviewError] = useState("");

  // Log this as a profile view (visible dans "Qui m'a aimé" / visiteurs du profil)
  // feature) — only for real logged-in visits to someone else's profile.
  // Best-effort: never blocks the UI or surfaces an error to the viewer.
  useEffect(() => {
    if (!currentUser || !profile?.uid || profile.uid === currentUser.id) return;
    supabase
      .from("profile_views")
      .upsert(
        { viewer_id: currentUser.id, viewed_id: profile.uid, created_at: new Date().toISOString() },
        { onConflict: "viewer_id,viewed_id" }
      )
      .then(({ error }) => {
        if (error) console.warn("Could not log profile view:", error);
      });
  }, [currentUser?.id, profile?.uid]);

  // Load public reviews left for this profile (as a seller) — hidden ones are
  // filtered server-side by RLS for anyone except the seller/reviewer/admin.
  useEffect(() => {
    if (!profile?.uid) return;
    let cancelled = false;
    setIsLoadingReviews(true);
    (async () => {
      const { data, error } = await supabase
        .from("post_reviews")
        .select("*")
        .eq("seller_id", profile.uid)
        .order("created_at", { ascending: false });
      if (cancelled) return;
      if (error) {
        console.warn("Could not load reviews:", error);
        setReviews([]);
      } else {
        const reviewerIds = Array.from(new Set((data || []).map((r) => r.reviewer_id)));
        let reviewerProfiles: Record<string, Profile> = {};
        if (reviewerIds.length > 0) {
          const { data: profs } = await supabase.from("profiles").select("*").in("uid", reviewerIds);
          (profs || []).forEach((p: any) => { reviewerProfiles[p.uid] = p; });
        }
        setReviews((data || []).map((r: any) => ({ ...r, reviewer_profile: reviewerProfiles[r.reviewer_id] })));
      }
      setIsLoadingReviews(false);
    })();
    return () => { cancelled = true; };
  }, [profile?.uid]);

  // Determine whether the visitor bought a service from this seller and
  // hasn't reviewed it yet — the DB itself enforces this (post_reviews
  // INSERT policy requires a matching listing_purchases row), this just
  // drives whether we show the "Laisser un avis" button.
  useEffect(() => {
    if (!currentUser?.id || !profile?.uid || currentUser.id === profile.uid) {
      setReviewablePostId(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const [{ data: purchases }, { data: myReviews }] = await Promise.all([
        supabase.from("listing_purchases").select("post_id").eq("buyer_id", currentUser.id).eq("seller_id", profile.uid),
        supabase.from("post_reviews").select("post_id").eq("reviewer_id", currentUser.id).eq("seller_id", profile.uid),
      ]);
      if (cancelled) return;
      const reviewedPostIds = new Set((myReviews || []).map((r: any) => r.post_id));
      const unreviewed = (purchases || []).find((p: any) => !reviewedPostIds.has(p.post_id));
      setReviewablePostId(unreviewed ? unreviewed.post_id : null);
    })();
    return () => { cancelled = true; };
  }, [currentUser?.id, profile?.uid]);

  const submitReview = async () => {
    if (!currentUser?.id || !reviewablePostId) return;
    setIsSubmittingReview(true);
    setReviewError("");
    try {
      const { data, error } = await supabase
        .from("post_reviews")
        .insert({
          post_id: reviewablePostId,
          reviewer_id: currentUser.id,
          seller_id: profile.uid,
          rating: reviewRating,
          comment: reviewComment.trim() || null,
        })
        .select()
        .single();
      if (error) throw error;
      setReviews((prev) => [{ ...data, reviewer_profile: undefined }, ...prev]);
      setReviewablePostId(null);
      setShowReviewForm(false);
      setReviewComment("");
      setReviewRating(5);
    } catch (err: any) {
      console.error("Error submitting review:", err);
      setReviewError(err.message || "Impossible d'enregistrer votre avis.");
    } finally {
      setIsSubmittingReview(false);
    }
  };

  const avgRating = reviews.length > 0 ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length : 0;

  // Lock body scroll while this full page is open, like a real screen push.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  const handleLikeBackClick = () => {
    if (!currentUser) {
      if (onAuthRequired) onAuthRequired();
      return;
    }
    if (onLikeBack) onLikeBack();
  };

  // Calculate mutual compatibility score
  const sharedIntents = (currentUserProfile?.relationship_intents || []).filter((x) =>
    (profile.relationship_intents || []).includes(x)
  );
  const calculateCompatibility = (): number => {
    if (!currentUserProfile?.relationship_intents?.length || !profile.relationship_intents?.length) {
      return 15; // baseline score
    }
    if (sharedIntents.length > 0) {
      const maxLen = Math.max(currentUserProfile.relationship_intents.length, profile.relationship_intents.length);
      const ratio = sharedIntents.length / maxLen;
      return Math.round(50 + ratio * 45);
    }
    return 15;
  };
  const compatibilityScore = calculateCompatibility();

  // Safe extraction of profile photos
  const profilePhotos: string[] = Array.isArray(profile.photos) && profile.photos.length > 0
    ? profile.photos
    : ([profile.avatar_url].filter(Boolean) as string[]);

  const goToPhoto = (delta: number) => {
    setActivePhotoIndex((i) => {
      const next = i + delta;
      if (next < 0) return 0;
      if (next >= profilePhotos.length) return profilePhotos.length - 1;
      return next;
    });
  };

  const mapsUrl = profile.location
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(profile.location)}`
    : null;

  return (
    <div id="profile-detail-page" className="fixed inset-0 bg-white z-55 flex flex-col font-sans overscroll-none">
      {/* Photo stage */}
      <div className="relative flex-shrink-0 bg-slate-900" style={{ height: "58vh", minHeight: 320 }}>
        <img
          key={activePhotoIndex}
          src={profilePhotos[activePhotoIndex] || `https://api.dicebear.com/7.x/adventurer/svg?seed=${profile.full_name || profile.uid}`}
          alt={profile.full_name || "Profil"}
          referrerPolicy="no-referrer"
          className="w-full h-full object-cover"
        />

        {/* Instagram/Tinder-style progress segments */}
        {profilePhotos.length > 1 && (
          <div className="absolute top-3 left-3 right-3 flex gap-1 z-20">
            {profilePhotos.map((_, i) => (
              <div key={i} className="flex-1 h-1 rounded-full bg-white/30 overflow-hidden">
                <div className={`h-full bg-white transition-all ${i <= activePhotoIndex ? "w-full" : "w-0"}`} />
              </div>
            ))}
          </div>
        )}

        {/* Tap zones to navigate photos (left = prev, right = next) */}
        {profilePhotos.length > 1 && (
          <>
            <button
              aria-label="Photo précédente"
              onClick={() => goToPhoto(-1)}
              className="absolute left-0 top-0 bottom-0 w-1/2 z-10 cursor-pointer"
            />
            <button
              aria-label="Photo suivante"
              onClick={() => goToPhoto(1)}
              className="absolute right-0 top-0 bottom-0 w-1/2 z-10 cursor-pointer"
            />
          </>
        )}

        {/* Gradient for legibility */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/5 to-black/40 pointer-events-none" />

        {/* Header bar: back + report */}
        <div className="absolute top-0 left-0 right-0 pt-7 px-3 flex items-center justify-between z-30">
          <button
            onClick={onClose}
            className="bg-black/40 hover:bg-black/60 text-white rounded-full p-2.5 transition cursor-pointer backdrop-blur-sm"
            title="Retour"
          >
            <ArrowLeft size={18} />
          </button>
          {onReport && (
            <button
              onClick={onReport}
              className="bg-black/40 hover:bg-black/60 text-white rounded-full p-2.5 transition cursor-pointer backdrop-blur-sm"
              title="Signaler"
            >
              <Flag size={16} />
            </button>
          )}
        </div>

        {/* Compatibility badge — tap for a quick explanation */}
        <div className="absolute top-16 left-3 z-30">
          <button
            onClick={() => setShowScoreInfo((v) => !v)}
            className="bg-white/95 backdrop-blur px-3 py-1.5 rounded-full flex items-center gap-1.5 shadow-sm border border-rose-500/10 cursor-pointer"
          >
            <Sparkles size={13} className="text-rose-500 fill-rose-500" />
            <span className="text-xs font-black text-slate-800">{compatibilityScore}% compatible</span>
          </button>
          {showScoreInfo && (
            <div className="mt-2 bg-white rounded-2xl shadow-xl border border-slate-100 p-3 w-56 text-[11px] text-slate-600 leading-relaxed">
              {sharedIntents.length > 0 ? (
                <>Vous partagez <strong className="text-rose-600">{sharedIntents.length}</strong> intention{sharedIntents.length > 1 ? "s" : ""} de rencontre avec {profile.full_name?.split(" ")[0] || "cette personne"}.</>
              ) : (
                <>Score de base — complétez vos intentions de rencontre pour affiner la compatibilité.</>
              )}
            </div>
          )}
        </div>

        {profile.verification_status === "verified" && (
          <div className="absolute top-16 right-3 bg-emerald-500 text-white px-2.5 py-1.5 rounded-full flex items-center gap-1 text-[10px] font-bold shadow-md uppercase tracking-wider z-30">
            <CheckCircle size={11} fill="white" className="text-emerald-500" />
            <span>Vérifié</span>
          </div>
        )}

        {/* Name / location on the photo, minimal like the card */}
        <div className="absolute bottom-5 left-5 right-5 text-white z-20 pointer-events-none">
          <div className="flex items-baseline gap-2">
            <h1 className="text-3xl font-black tracking-tight drop-shadow-md">{profile.full_name || "Membre LoveRose"}</h1>
            {profile.age && <span className="text-2xl font-bold drop-shadow-md">{profile.age}</span>}
          </div>
          {profile.location && (
            <p className="text-xs text-slate-200 flex items-center mt-1.5">
              <MapPin size={12} className="mr-1 text-rose-400 flex-shrink-0" />
              <span>{profile.location}</span>
            </p>
          )}
        </div>
      </div>

      {/* Scrollable details below the photo */}
      <div className="flex-1 overflow-y-auto min-h-0 bg-white">
        <div className="p-5 space-y-5 pb-28">

          {mapsUrl && (
            <a
              href={mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-[11px] font-bold text-rose-500 hover:text-rose-600 transition"
            >
              <MapPin size={13} />
              <span>Voir {profile.location} sur la carte</span>
              <ExternalLink size={11} />
            </a>
          )}

          {/* About / Bio section */}
          <div className="space-y-1.5">
            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">À propos de moi</h4>
            {profile.bio ? (
              <p className="text-slate-600 text-sm leading-relaxed whitespace-pre-wrap">
                {profile.bio}
              </p>
            ) : (
              <p className="text-slate-400 text-xs italic">Aucune biographie rédigée pour le moment.</p>
            )}
          </div>

          {/* Quick Info Attributes Grid */}
          <div className="grid grid-cols-2 gap-3.5 bg-slate-50 p-3.5 rounded-2xl border border-slate-100">
            <div className="text-left">
              <p className="text-[9px] font-extrabold text-slate-400 uppercase">Genre</p>
              <p className="text-xs font-bold text-slate-800 capitalize mt-0.5">{profile.gender || "Non spécifié"}</p>
            </div>
            <div className="text-left">
              <p className="text-[9px] font-extrabold text-slate-400 uppercase">Recherche</p>
              <p className="text-xs font-bold text-slate-800 capitalize mt-0.5">
                {profile.preferences === "homme" ? "Hommes" : profile.preferences === "femme" ? "Femmes" : "Tout le monde"}
              </p>
            </div>
          </div>

          {/* Relationship Intents tags */}
          <div className="space-y-2">
            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Intentions de rencontre</h4>
            <div className="flex flex-wrap gap-1.5">
              {profile.relationship_intents && profile.relationship_intents.length > 0 ? (
                profile.relationship_intents.map((intent) => {
                  const isShared = sharedIntents.includes(intent);
                  return (
                    <span
                      key={intent}
                      className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold border transition ${
                        isShared
                          ? "bg-rose-50 border-rose-200 text-rose-600 font-extrabold"
                          : "bg-white border-slate-150 text-slate-600"
                      }`}
                    >
                      {isShared && <span className="mr-1">❤️</span>}
                      <span>{intent}</span>
                    </span>
                  );
                })
              ) : (
                <span className="text-slate-400 text-xs italic">Aucune intention sélectionnée.</span>
              )}
            </div>
          </div>

          {/* Ratings & reviews — visible à tous, laissés uniquement par des acheteurs confirmés */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Avis</h4>
              {reviews.length > 0 && (
                <div className="flex items-center gap-1">
                  <Star size={13} className="text-amber-400 fill-amber-400" />
                  <span className="text-xs font-black text-slate-800">{avgRating.toFixed(1)}</span>
                  <span className="text-[10px] text-slate-400">({reviews.length})</span>
                </div>
              )}
            </div>

            {isLoadingReviews ? (
              <div className="flex items-center gap-2 text-slate-400 text-xs py-2">
                <Loader2 size={14} className="animate-spin" /> Chargement des avis...
              </div>
            ) : reviews.length === 0 ? (
              <p className="text-slate-400 text-xs italic">Aucun avis pour le moment.</p>
            ) : (
              <div className="space-y-2.5">
                {reviews.slice(0, 5).map((r) => (
                  <div key={r.id} className="bg-slate-50 border border-slate-100 rounded-2xl p-3 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-700">
                        {r.reviewer_profile?.full_name || "Acheteur"}
                      </span>
                      <div className="flex items-center gap-0.5">
                        {[1, 2, 3, 4, 5].map((n) => (
                          <Star key={n} size={11} className={n <= r.rating ? "text-amber-400 fill-amber-400" : "text-slate-200 fill-slate-200"} />
                        ))}
                      </div>
                    </div>
                    {r.comment && <p className="text-xs text-slate-600 leading-relaxed">{r.comment}</p>}
                  </div>
                ))}
              </div>
            )}

            {reviewablePostId && !showReviewForm && (
              <button
                onClick={() => setShowReviewForm(true)}
                className="w-full flex items-center justify-center gap-1.5 text-xs font-bold text-rose-500 border border-rose-200 hover:bg-rose-50 rounded-xl py-2.5 transition cursor-pointer"
              >
                <Star size={13} /> Laisser un avis sur ce vendeur
              </button>
            )}

            {reviewablePostId && showReviewForm && (
              <div className="bg-rose-50/50 border border-rose-100 rounded-2xl p-3.5 space-y-2.5">
                <div className="flex items-center justify-center gap-1.5">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button key={n} type="button" onClick={() => setReviewRating(n)} className="cursor-pointer">
                      <Star size={22} className={n <= reviewRating ? "text-amber-400 fill-amber-400" : "text-slate-200 fill-slate-200"} />
                    </button>
                  ))}
                </div>
                <textarea
                  value={reviewComment}
                  onChange={(e) => setReviewComment(e.target.value)}
                  placeholder="Votre commentaire (facultatif)"
                  rows={3}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-xs outline-none focus:border-rose-400 resize-none"
                />
                {reviewError && <p className="text-[10px] text-red-500 font-semibold">{reviewError}</p>}
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowReviewForm(false)}
                    className="flex-1 text-xs font-bold text-slate-500 py-2.5 rounded-xl cursor-pointer hover:bg-slate-100"
                  >
                    Annuler
                  </button>
                  <button
                    onClick={submitReview}
                    disabled={isSubmittingReview}
                    className="flex-1 bg-rose-500 hover:bg-rose-600 text-white text-xs font-extrabold py-2.5 rounded-xl transition cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
                  >
                    {isSubmittingReview && <Loader2 size={13} className="animate-spin" />}
                    <span>Publier l'avis</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Sticky footer actions */}
      <div className="p-4 border-t border-slate-100 bg-white flex items-center gap-3 flex-shrink-0" style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}>
        {onPass && (
          <button
            onClick={onPass}
            className="w-14 h-14 flex-shrink-0 bg-white hover:bg-red-50 text-red-500 border border-slate-200 rounded-full shadow-sm flex items-center justify-center transition cursor-pointer active:scale-95"
            title="Passer"
          >
            <X size={22} />
          </button>
        )}
        {onLikeBack && (
          <button
            onClick={handleLikeBackClick}
            className="flex-1 py-4 bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-600 hover:to-pink-700 text-white font-black text-xs rounded-2xl shadow-md flex items-center justify-center gap-1.5 transition cursor-pointer active:scale-[0.98]"
          >
            {isMatch ? <Sparkles size={16} /> : <Heart size={16} fill="currentColor" />}
            <span>
              {!currentUser
                ? "Se connecter avec Google"
                : isMatch
                ? "Vous vous plaisez mutuellement"
                : "Envoyer un like"}
            </span>
          </button>
        )}
      </div>
    </div>
  );
}
