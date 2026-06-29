import { useState, useEffect, FormEvent } from "react";
import { supabase } from "../lib/supabase";
import { Profile } from "../types";
import AdSlot from "./AdSlot";
import { Heart, X, Sparkles, MapPin, CheckCircle, ShieldAlert, Filter, Send, MessageCircle, Eye, Star } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import ProfileDetailModal from "./ProfileDetailModal";

interface DiscoverProps {
  currentUser: any;
  currentUserProfile: Profile | null;
  isPremium?: boolean;
  onMatchDetected: (partner: Profile) => void;
}

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Radius of the earth in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function renderOnlineStatus(profile: Profile) {
  if (profile.is_online) {
    return (
      <div className="flex items-center space-x-1 text-emerald-400 font-extrabold text-[10px] uppercase tracking-wider animate-pulse bg-emerald-950/40 border border-emerald-500/20 px-2 py-0.5 rounded-full">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
        <span>En ligne</span>
      </div>
    );
  }

  if (profile.last_seen) {
    const lastSeenDate = new Date(profile.last_seen);
    const now = new Date();
    const diffMs = now.getTime() - lastSeenDate.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    let text = "";
    if (diffMins < 1) {
      text = "En ligne";
    } else if (diffMins < 60) {
      text = `Il y a ${diffMins}m`;
    } else if (diffHours < 24) {
      text = `Il y a ${diffHours}h`;
    } else {
      text = `Il y a ${diffDays}j`;
    }

    return (
      <div className="flex items-center space-x-1 text-slate-300 font-extrabold text-[9px] uppercase tracking-wider bg-slate-900/50 border border-slate-700/30 px-2 py-0.5 rounded-full">
        <span className="w-1 h-1 rounded-full bg-slate-400"></span>
        <span>{text}</span>
      </div>
    );
  }

  return null;
}

export default function Discover({ currentUser, currentUserProfile, isPremium = false, onMatchDetected }: DiscoverProps) {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedIntentsFilter, setSelectedIntentsFilter] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [likedUids, setLikedUids] = useState<Set<string>>(new Set());
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [reportSuccess, setReportSuccess] = useState(false);
  const [selectedViewProfile, setSelectedViewProfile] = useState<Profile | null>(null);

  const intentsList = [
    "Amitié",
    "Relation amoureuse",
    "Rencontre d'un soir",
    "Relation libertine",
    "Business / networking"
  ];

  // Fetch profiles and liked profiles
  useEffect(() => {
    if (!currentUser) return;
    loadProfiles();
  }, [currentUser, selectedIntentsFilter, currentUserProfile?.preferences]);

  // Real-time subscription to update profile cards instantly when people go online/offline or change info
  useEffect(() => {
    const channelName = `discover-profiles-realtime-${Math.random().toString(36).substring(2, 11)}`;
    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "profiles"
        },
        (payload) => {
          const updated = payload.new as Profile;
          setProfiles(prev => prev.map(p => p.uid === updated.uid ? { ...p, ...updated } : p));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const loadProfiles = async () => {
    if (!currentUser || !currentUser.id) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      // 1. Get already liked profiles to filter them out
      const likedSet = new Set<string>();
      try {
        const { data: likesData, error: likesErr } = await supabase
          .from("likes")
          .select("to_uid")
          .eq("from_uid", currentUser.id);
        
        if (!likesErr && likesData) {
          likesData.forEach(l => likedSet.add(l.to_uid));
        }
      } catch (likesCatchErr) {
        console.warn("Could not load likes:", likesCatchErr);
      }
      setLikedUids(likedSet);

      // 1.5 Get blocked users to exclude them completely
      const blockedSet = new Set<string>();
      try {
        const { data: blockedData, error: blockedErr } = await supabase
          .from("blocked_users")
          .select("blocker_id, blocked_id")
          .or(`blocker_id.eq.${currentUser.id},blocked_id.eq.${currentUser.id}`);

        if (!blockedErr && blockedData) {
          blockedData.forEach(b => {
            blockedSet.add(b.blocker_id);
            blockedSet.add(b.blocked_id);
          });
        }
      } catch (blockedCatchErr) {
        console.warn("Could not load blocked_users, table may be missing:", blockedCatchErr);
      }

      // 2. Query profiles
      let query = supabase
        .from("profiles")
        .select("*")
        .neq("uid", currentUser.id) // Exclude self
        .limit(30); // Paginate profiles limit for lightning-fast network execution

      // Filtre par genre recherché (preferences de l'utilisateur courant)
      const myPreferences = currentUserProfile?.preferences || "tous";
      if (myPreferences === 'homme') {
        query = query.eq('gender', 'homme');
      } else if (myPreferences === 'femme') {
        query = query.eq('gender', 'femme');
      }
      // si myPreferences === 'tous', ne filtre pas sur le genre

      // Filtre par type(s) de rencontre recherché(s) — overlaps
      if (selectedIntentsFilter && selectedIntentsFilter.length > 0) {
        query = query.overlaps('relationship_intents', selectedIntentsFilter);
      }

      const { data: profilesData, error } = await query;
      if (error) throw error;

      // Fetch active profile boosts to prioritize boosted users absolutely
      const boostedUserIds = new Set<string>();
      try {
        const { data: boostsData, error: boostsErr } = await supabase
          .from("profile_boosts")
          .select("user_id")
          .gt("ends_at", new Date().toISOString());
        
        if (!boostsErr && boostsData) {
          boostsData.forEach(b => boostedUserIds.add(b.user_id));
        }
      } catch (boostsCatchErr) {
        console.warn("Could not load profile_boosts, table may be missing:", boostsCatchErr);
      }

      let filteredProfiles = profilesData || [];

      // Filter out profiles already liked or with missing complete profiles or too far based on max_distance_km
      const maxDist = currentUserProfile?.max_distance_km || 50;
      const unswiped = filteredProfiles.filter(p => {
        if (likedSet.has(p.uid)) return false;
        if (blockedSet.has(p.uid)) return false;

        if (currentUserProfile?.latitude && currentUserProfile?.longitude && p.latitude && p.longitude) {
          const dist = calculateDistance(
            currentUserProfile.latitude,
            currentUserProfile.longitude,
            p.latitude,
            p.longitude
          );
          if (dist > maxDist) return false;
        }
        return true;
      });
      
      // Sort with boosted users at the absolute top, then by compatibility score
      const scored = unswiped.map(p => {
        const isBoosted = boostedUserIds.has(p.uid);
        const score = calculateCompatibility(currentUserProfile, p);
        return { profile: p, score, isBoosted };
      }).sort((a, b) => {
        if (a.isBoosted && !b.isBoosted) return -1;
        if (!a.isBoosted && b.isBoosted) return 1;
        return b.score - a.score;
      }).map(x => x.profile);

      setProfiles(scored);
      setCurrentIndex(0);
    } catch (err) {
      console.error("Error loading profiles:", err);
    } finally {
      setIsLoading(false);
    }
  };

  // Helper to calculate compatibility score
  const calculateCompatibility = (user: Profile | null, candidate: Profile): number => {
    if (!user || !user.relationship_intents || !candidate.relationship_intents) {
      return 15; // friendly baseline score
    }

    const userIntents = user.relationship_intents;
    const candidateIntents = candidate.relationship_intents;

    const intersection = userIntents.filter(x => candidateIntents.includes(x));
    
    if (intersection.length > 0) {
      // Base score on proportion of matching intents
      const maxLen = Math.max(userIntents.length, candidateIntents.length);
      const ratio = intersection.length / maxLen;
      return Math.round(50 + (ratio * 45)); // 50% to 95%
    }

    // Complementary check
    return 15;
  };

  const handleSwipe = async (liked: boolean) => {
    if (profiles.length === 0 || currentIndex >= profiles.length) return;
    
    const candidate = profiles[currentIndex];
    
    if (liked) {
      try {
        // Create the like
        const { error } = await supabase
          .from("likes")
          .insert([{ from_uid: currentUser.id, to_uid: candidate.uid }]);

        if (error) throw error;

        // Immediately check if they already liked us back
        const { data: reciprocalLike } = await supabase
          .from("likes")
          .select("*")
          .eq("from_uid", candidate.uid)
          .eq("to_uid", currentUser.id)
          .single();

        if (reciprocalLike) {
          // It's a match! Inform parent component to show match popup
          onMatchDetected(candidate);

          // We can also double check that a match row is inserted.
          // Since we have a trigger, it will auto-insert into matches.
          // Let's make sure we alert the user of this gorgeous match!
        }
      } catch (err) {
        console.error("Error swiping like:", err);
      }
    }

    // Advance to next profile
    setCurrentIndex(prev => prev + 1);
  };

  const handleSuperLike = async () => {
    if (profiles.length === 0 || currentIndex >= profiles.length) return;
    const candidate = profiles[currentIndex];

    try {
      if (!isPremium) {
        // Fetch current credits
        const { data: creditData } = await supabase
          .from("user_credits")
          .select("balance")
          .eq("user_id", currentUser.id)
          .single();

        const balance = creditData?.balance || 0;
        if (balance < 5) {
          alert("Le Super Like coûte 5 crédits pour les membres gratuits. Vous n'avez pas assez de crédits. Veuillez recharger votre solde dans la boutique !");
          return;
        }

        // Deduct 5 credits
        const { error: deductErr } = await supabase
          .from("user_credits")
          .update({ balance: balance - 5 })
          .eq("user_id", currentUser.id);

        if (deductErr) throw deductErr;
      }

      // Create the super_like
      const { error: insertErr } = await supabase
        .from("likes")
        .insert([{ from_uid: currentUser.id, to_uid: candidate.uid, type: "super_like" }]);

      if (insertErr) throw insertErr;

      // Check if they already liked us back
      const { data: reciprocalLike } = await supabase
        .from("likes")
        .select("*")
        .eq("from_uid", candidate.uid)
        .eq("to_uid", currentUser.id)
        .single();

      if (reciprocalLike) {
        onMatchDetected(candidate);
      } else {
        alert(`⭐ Super Like envoyé à ${candidate.full_name} !`);
      }

      // Advance to next profile
      setCurrentIndex(prev => prev + 1);
    } catch (err: any) {
      console.error("Error sending super like:", err);
      alert("Une erreur s'est produite lors de l'envoi du Super Like : " + err.message);
    }
  };

  const handleReport = async (e: FormEvent) => {
    e.preventDefault();
    if (!reportReason.trim() || profiles.length === 0 || currentIndex >= profiles.length) return;

    const candidate = profiles[currentIndex];
    try {
      const { error } = await supabase
        .from("reports")
        .insert([
          {
            reporter_id: currentUser.id,
            reported_id: candidate.uid,
            motif: reportReason
          }
        ]);

      if (error) throw error;

      setReportSuccess(true);
      setTimeout(() => {
        setIsReportOpen(false);
        setReportReason("");
        setReportSuccess(false);
        // Skip current profile after report
        setCurrentIndex(prev => prev + 1);
      }, 2000);
    } catch (err) {
      console.error("Report insertion failed:", err);
      alert("Une erreur s'est produite lors de l'envoi du signalement.");
    }
  };

  const activeProfile = profiles[currentIndex];
  const compatibilityScore = activeProfile ? calculateCompatibility(currentUserProfile, activeProfile) : 0;

  const toggleIntentFilter = (intent: string) => {
    setSelectedIntentsFilter(prev => {
      if (prev.includes(intent)) {
        return prev.filter(i => i !== intent);
      } else {
        return [...prev, intent];
      }
    });
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-50 relative">
      {/* Filter Header */}
      <div className="bg-white border-b border-slate-100 p-4 sticky top-0 z-20 flex flex-wrap gap-2 items-center justify-between">
        <div className="flex items-center gap-2">
          <Filter size={16} className="text-rose-500" />
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Filtres (Multi-sélection) :</span>
        </div>
        <div className="flex gap-1.5 overflow-x-auto max-w-full pb-1 md:pb-0 scrollbar-none">
          <button
            onClick={() => setSelectedIntentsFilter([])}
            className={`px-3 py-1.5 text-xs font-semibold rounded-full transition whitespace-nowrap cursor-pointer ${
              selectedIntentsFilter.length === 0
                ? "bg-rose-500 text-white shadow-sm font-extrabold"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            Tous les profils
          </button>
          {intentsList.map(intent => {
            const isActive = selectedIntentsFilter.includes(intent);
            return (
              <button
                key={intent}
                onClick={() => toggleIntentFilter(intent)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-full transition whitespace-nowrap cursor-pointer ${
                  isActive
                    ? "bg-rose-500 text-white shadow-sm font-extrabold"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {intent}
              </button>
            );
          })}
        </div>
      </div>

      {/* Profile Card Stage */}
      <div className="flex-1 overflow-y-auto flex flex-col justify-start md:justify-center items-center p-4 min-h-0 relative w-full">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center space-y-3">
            <div className="w-10 h-10 border-4 border-rose-500 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-slate-400 text-xs font-medium">Recherche des profils compatibles...</p>
          </div>
        ) : activeProfile ? (
          <div className="w-full max-w-md flex flex-col items-center justify-between space-y-4 mx-auto">
            
            {/* The Main Swing Card */}
            <AnimatePresence mode="wait">
              <motion.div
                key={activeProfile.uid}
                initial={{ scale: 0.95, opacity: 0, y: 15 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.95, opacity: 0, y: -15 }}
                transition={{ duration: 0.3 }}
                style={{
                  aspectRatio: '9/16',
                  width: '100%',
                  maxWidth: '380px',
                  borderRadius: '24px',
                  overflow: 'hidden',
                  position: 'relative',
                }}
                className="bg-white border border-slate-150 shadow-xl flex flex-col relative"
              >
                {/* Photo underlay */}
                <img
                  src={activeProfile.avatar_url || `https://api.dicebear.com/7.x/adventurer/svg?seed=${activeProfile.full_name || activeProfile.uid}`}
                  alt={activeProfile.full_name || "Profil"}
                  referrerPolicy="no-referrer"
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    objectPosition: 'center top',
                  }}
                  className="absolute inset-0"
                />
                
                {/* Shading overlay (black gradient for clear text contrast) */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent z-1"></div>

                {/* Compatibility Badge */}
                <div className="absolute top-4 left-4 bg-white/95 backdrop-blur shadow-sm px-3 py-1 rounded-full flex items-center space-x-1 z-10 border border-rose-500/10">
                  <Sparkles size={11} className="text-rose-500 animate-pulse fill-rose-500" />
                  <span className="text-[10px] font-black text-slate-800">
                    {compatibilityScore}% Compatibilité
                  </span>
                </div>

                {/* Verification Status Badge */}
                {activeProfile.verification_status === "verified" && (
                  <div className="absolute top-4 right-4 bg-emerald-500 text-white px-2.5 py-1 rounded-full flex items-center space-x-1 text-[9px] font-bold shadow-md uppercase tracking-wider z-10">
                    <CheckCircle size={10} fill="white" className="text-emerald-500" />
                    <span>Vérifié</span>
                  </div>
                )}

                {/* Information Overlay Content */}
                <div className="absolute bottom-0 left-0 right-0 p-5 text-white space-y-2.5 flex flex-col justify-end z-10">
                  <div className="flex items-center justify-between">
                    <div className="flex items-baseline space-x-2">
                      <h2 className="text-xl font-extrabold tracking-tight drop-shadow-md">{activeProfile.full_name || "Anonyme"}</h2>
                      {activeProfile.age && <span className="text-base font-bold text-white/95 drop-shadow-md">{activeProfile.age} ans</span>}
                    </div>
                    {renderOnlineStatus(activeProfile)}
                  </div>

                  {activeProfile.location && (
                    <p className="text-[11px] text-slate-200 flex items-center">
                      <MapPin size={11} className="mr-1 text-rose-400 flex-shrink-0" />
                      <span className="truncate">{activeProfile.location}</span>
                      {currentUserProfile?.latitude && currentUserProfile?.longitude && activeProfile.latitude && activeProfile.longitude && (
                        <span className="ml-2 bg-rose-950/60 border border-rose-500/25 px-1.5 py-0.2 rounded-full text-[9px] font-extrabold text-rose-300">
                          {Math.round(calculateDistance(currentUserProfile.latitude, currentUserProfile.longitude, activeProfile.latitude, activeProfile.longitude))} km
                        </span>
                      )}
                    </p>
                  )}

                  {activeProfile.bio ? (
                    <p className="text-white/85 text-[11px] leading-snug line-clamp-2 drop-shadow-sm font-medium">
                      {activeProfile.bio}
                    </p>
                  ) : (
                    <p className="text-white/60 text-[11px] italic">Cet utilisateur n'a pas encore rédigé sa biographie.</p>
                  )}

                  {/* Intents tags */}
                  {activeProfile.relationship_intents && activeProfile.relationship_intents.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-0.5">
                      {activeProfile.relationship_intents.slice(0, 3).map(intent => {
                        const isShared = currentUserProfile?.relationship_intents?.includes(intent);
                        return (
                          <span
                            key={intent}
                            className={`text-[9px] px-2 py-0.5 rounded-lg font-bold ${
                              isShared
                                ? "bg-rose-500 text-white border border-rose-400"
                                : "bg-black/55 text-slate-300 border border-white/10"
                            }`}
                          >
                            {intent}
                          </span>
                        );
                      })}
                    </div>
                  )}

                  {/* Report and View actions */}
                  <div className="pt-2.5 flex justify-between items-center border-t border-white/10 mt-1">
                    <button
                      onClick={() => setSelectedViewProfile(activeProfile)}
                      className="text-white hover:text-rose-200 text-[10px] flex items-center gap-1 transition cursor-pointer font-extrabold bg-rose-500/80 hover:bg-rose-500 px-2.5 py-1.5 rounded-lg border border-rose-400/20"
                    >
                      <Eye size={12} />
                      <span>Détails & Photos</span>
                    </button>
                    <button
                      onClick={() => setIsReportOpen(true)}
                      className="text-white/60 hover:text-red-400 text-[10px] flex items-center gap-1 transition cursor-pointer font-bold"
                    >
                      <ShieldAlert size={12} />
                      <span>Signaler</span>
                    </button>
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>

            {/* Swipe Action Buttons */}
            <div className="flex justify-center items-center gap-6 pb-2">
              <button
                id="swipe-dislike-btn"
                onClick={() => handleSwipe(false)}
                className="w-14 h-14 bg-white hover:bg-red-50 text-red-500 hover:scale-105 active:scale-95 border border-slate-150 rounded-full shadow-md flex items-center justify-center transition cursor-pointer"
                title="Passer"
              >
                <X size={24} />
              </button>
              
              <button
                id="swipe-super-like-btn"
                onClick={handleSuperLike}
                className="w-12 h-12 bg-white hover:bg-amber-50 text-amber-500 hover:scale-105 active:scale-95 border border-slate-150 rounded-full shadow-md flex items-center justify-center transition cursor-pointer"
                title="Super Like"
              >
                <Star size={20} fill="currentColor" />
              </button>

              <button
                id="swipe-like-btn"
                onClick={() => handleSwipe(true)}
                className="w-16 h-16 bg-gradient-to-br from-rose-500 to-pink-600 text-white hover:scale-105 active:scale-95 rounded-full shadow-lg shadow-rose-500/20 flex items-center justify-center transition cursor-pointer"
                title="Liker"
              >
                <Heart size={28} fill="currentColor" />
              </button>
            </div>

            {/* AdSlot when active suggestions are shown */}
            <div className="w-full max-w-md mx-auto pt-1 pb-2">
              <AdSlot slot="discovery_feed_1" userId={currentUser?.id} />
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center space-y-4">
            <div className="text-center p-8 bg-white border border-slate-150 rounded-3xl max-w-sm space-y-4 shadow-sm">
              <div className="mx-auto w-12 h-12 bg-rose-50 rounded-full flex items-center justify-center text-rose-500">
                <Sparkles size={24} />
              </div>
              <h3 className="text-lg font-bold text-slate-800">Fin des suggestions !</h3>
              <p className="text-slate-500 text-xs leading-relaxed">
                Vous avez fait le tour des profils disponibles dans votre secteur géographique pour le filtre sélectionné.
              </p>
              <button
                onClick={() => { setSelectedIntentsFilter([]); loadProfiles(); }}
                className="px-4 py-2 bg-rose-500 hover:bg-rose-600 text-white font-semibold rounded-xl text-xs transition cursor-pointer"
              >
                Réinitialiser le filtre
              </button>
            </div>

            {/* AdSlot when suggestions are finished */}
            <div className="w-full max-w-sm mx-auto">
              <AdSlot slot="discovery_feed_empty" userId={currentUser?.id} />
            </div>
          </div>
        )}
      </div>

      {/* Report Modal */}
      {isReportOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full border border-slate-100 shadow-2xl space-y-4">
            <h3 className="font-extrabold text-slate-900 text-lg flex items-center gap-2">
              <ShieldAlert className="text-red-500" />
              <span>Signaler un comportement</span>
            </h3>
            
            {reportSuccess ? (
              <div className="bg-green-50 border border-green-100 text-green-700 p-4 rounded-2xl text-center space-y-1 text-xs font-semibold">
                <p>Signalement enregistré !</p>
                <p className="font-medium text-green-600/80">L'équipe de modération de LoveRose va examiner ce profil.</p>
              </div>
            ) : (
              <form onSubmit={handleReport} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Motif du signalement</label>
                  <textarea
                    rows={4}
                    required
                    value={reportReason}
                    onChange={(e) => setReportReason(e.target.value)}
                    placeholder="Pourquoi signalez-vous cet utilisateur ? (Ex: Contenu inapproprié, faux profil, harcèlement...)"
                    className="w-full p-3 bg-slate-50 border border-slate-200 focus:border-red-500 focus:bg-white focus:outline-none rounded-2xl text-xs font-medium transition"
                  />
                </div>
                <div className="flex gap-2 justify-end text-xs font-bold">
                  <button
                    type="button"
                    onClick={() => { setIsReportOpen(false); setReportReason(""); }}
                    className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition cursor-pointer"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-xl transition cursor-pointer"
                  >
                    Envoyer le signalement
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Render profile detail view modal */}
      {selectedViewProfile && (
        <ProfileDetailModal
          profile={selectedViewProfile}
          currentUserProfile={currentUserProfile}
          isPremium={isPremium}
          onClose={() => setSelectedViewProfile(null)}
          onStartChat={() => {
            // Start discussion by swiping like to create the match row, and close modal
            handleSwipe(true);
            setSelectedViewProfile(null);
          }}
        />
      )}
    </div>
  );
}
