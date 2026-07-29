import { useState, useEffect, FormEvent } from "react";
import { supabase } from "../lib/supabase";
import { Profile } from "../types";
import AdSlot from "./AdSlot";
import { Heart, X, Sparkles, MapPin, CheckCircle, ShieldAlert, Filter, Send, MessageCircle, Info, Star, Lock, RotateCcw } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import ProfileDetailModal from "./ProfileDetailModal";
import AdaptiveImage from "./AdaptiveImage";
import { isActuallyOnline } from "../lib/presence";

interface DiscoverProps {
  currentUser: any;
  currentUserProfile: Profile | null;
  isPremium?: boolean;
  onMatchDetected: (partner: Profile) => void;
  onAuthRequired?: () => void;
  onOpenShop?: () => void;
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
  if (isActuallyOnline(profile)) {
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

export default function Discover({ currentUser, currentUserProfile, isPremium = false, onMatchDetected, onAuthRequired, onOpenShop }: DiscoverProps) {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedIntentsFilter, setSelectedIntentsFilter] = useState<string[]>([]);
  // Advanced filters (Premium only — controls stay hidden/locked for free users)
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [ageFilterMin, setAgeFilterMin] = useState<number | null>(null);
  const [ageFilterMax, setAgeFilterMax] = useState<number | null>(null);
  const [verifiedOnlyFilter, setVerifiedOnlyFilter] = useState(false);
  // Rewind (Premium): remembers only the very last swipe, and only when it's
  // safely undoable — a like that produced an instant match is never stored
  // here, since unmatching is a much bigger action than a simple rewind.
  const [lastSwipe, setLastSwipe] = useState<{ profile: Profile; wasLiked: boolean } | null>(null);
  const [isRewinding, setIsRewinding] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [likedUids, setLikedUids] = useState<Set<string>>(new Set());
  const [premiumUids, setPremiumUids] = useState<Set<string>>(new Set());
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [reportSuccess, setReportSuccess] = useState(false);
  const [selectedViewProfile, setSelectedViewProfile] = useState<Profile | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [guestGenderPref, setGuestGenderPref] = useState<string | null>(() => {
    try {
      return localStorage.getItem("loverose_guest_gender_pref");
    } catch {
      return null;
    }
  });

  const intentsList = [
    "Amitié",
    "Relation amoureuse",
    "Rencontre d'un soir",
    "Relation libertine",
    "Business / networking"
  ];

  // Fetch profiles and liked profiles
  useEffect(() => {
    // Guests must pick a gender preference first; wait until they do.
    if (!currentUser && !guestGenderPref) return;
    loadProfiles();
  }, [currentUser, selectedIntentsFilter, currentUserProfile?.preferences, guestGenderPref, ageFilterMin, ageFilterMax, verifiedOnlyFilter]);

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

  const loadProfiles = async (retryAttempt: number = 0) => {
    setIsLoading(true);
    setLoadError(null);
    let isRetrying = false;
    try {
      // Safety net: on a slow/unstable connection, Supabase calls can hang
      // indefinitely with no error and no response, leaving the spinner stuck.
      // This forces the load to fail gracefully after 12s instead of hanging forever.
      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("TIMEOUT")), 12000)
      );

      // Build the profiles query (not executed yet)
      let query = supabase
        .from("profiles")
        .select("*");

      if (currentUser?.id) {
        query = query.neq("uid", currentUser.id); // Exclude self
      }
      query = query.limit(30); // Paginate profiles limit for lightning-fast network execution

      // Filtre par genre recherché (preferences de l'utilisateur courant, ou choix de l'invité)
      const myPreferences = currentUserProfile?.preferences || guestGenderPref || "tous";
      if (myPreferences === 'homme') {
        query = query.eq('gender', 'homme');
      } else if (myPreferences === 'femme') {
        query = query.eq('gender', 'femme');
      }
      // si myPreferences === 'tous', ne filtre pas sur le genre

      // Pour un invité (pas encore de compte), on ne filtre pas par centre d'intérêt :
      // cette donnée n'existe que pour un profil créé.
      if (currentUser && selectedIntentsFilter && selectedIntentsFilter.length > 0) {
        query = query.overlaps('relationship_intents', selectedIntentsFilter);
      }

      // Run all independent queries in parallel instead of one after another,
      // to cut total loading time down to the slowest single request instead
      // of the sum of all four.
      const safe = (p: PromiseLike<any>) =>
        Promise.resolve(p).catch((e) => ({ data: null, error: e }));

      const likesPromise = currentUser?.id
        ? safe(supabase.from("likes").select("to_uid").eq("from_uid", currentUser.id))
        : Promise.resolve({ data: null, error: null });

      const blockedPromise = currentUser?.id
        ? safe(
            supabase
              .from("blocked_users")
              .select("blocker_id, blocked_id")
              .or(`blocker_id.eq.${currentUser.id},blocked_id.eq.${currentUser.id}`)
          )
        : Promise.resolve({ data: null, error: null });

      const profilesPromise = query;

      const boostsPromise = safe(
        supabase
          .from("profile_boosts")
          .select("user_id")
          .gt("ends_at", new Date().toISOString())
      );

      // Which candidates currently have an active Premium subscription — used
      // to fulfil the "Mise en vedette de votre profil" perk promised in the
      // Boutique. RLS blocks reading other users' subscriptions directly, so
      // this goes through a SECURITY DEFINER RPC that only exposes the uid.
      const premiumPromise = safe(supabase.rpc("get_active_premium_user_ids"));

      const [
        { data: likesData, error: likesErr },
        { data: blockedData, error: blockedErr },
        { data: profilesData, error },
        { data: boostsData, error: boostsErr },
        { data: premiumData, error: premiumErr },
      ] = await Promise.race([
        Promise.all([likesPromise, blockedPromise, profilesPromise, boostsPromise, premiumPromise]),
        timeout,
      ]);

      // 1. Already liked profiles, to filter them out
      const likedSet = new Set<string>();
      if (!likesErr && likesData) {
        likesData.forEach((l: any) => likedSet.add(l.to_uid));
      } else if (likesErr) {
        console.warn("Could not load likes:", likesErr);
      }
      setLikedUids(likedSet);

      // 1.5 Blocked users, to exclude them completely
      const blockedSet = new Set<string>();
      if (!blockedErr && blockedData) {
        blockedData.forEach((b: any) => {
          blockedSet.add(b.blocker_id);
          blockedSet.add(b.blocked_id);
        });
      } else if (blockedErr) {
        console.warn("Could not load blocked_users, table may be missing:", blockedErr);
      }

      // 2. Profiles themselves
      if (error) throw error;

      // Active profile boosts, to prioritize boosted users absolutely
      const boostedUserIds = new Set<string>();
      if (!boostsErr && boostsData) {
        boostsData.forEach((b: any) => boostedUserIds.add(b.user_id));
      } else if (boostsErr) {
        console.warn("Could not load profile_boosts, table may be missing:", boostsErr);
      }

      // Active Premium subscribers, featured just below paid Boosts
      const premiumUserIds = new Set<string>();
      if (!premiumErr && premiumData) {
        premiumData.forEach((row: any) => premiumUserIds.add(row.user_id));
      } else if (premiumErr) {
        console.warn("Could not load premium user ids:", premiumErr);
      }
      setPremiumUids(premiumUserIds);

      let filteredProfiles = profilesData || [];

      // Filter out profiles already liked or with missing complete profiles or too far based on max_distance_km
      const maxDist = currentUserProfile?.max_distance_km || 50;
      const applyAdvancedFilters = isPremium;
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

        if (applyAdvancedFilters) {
          if (ageFilterMin != null && p.age != null && p.age < ageFilterMin) return false;
          if (ageFilterMax != null && p.age != null && p.age > ageFilterMax) return false;
          if (verifiedOnlyFilter && p.verification_status !== "verified") return false;
        }

        return true;
      });
      
      // Sort with boosted users at the absolute top.
      // Logged-in users: rank the rest by compatibility score.
      // Guests: no real profile to compare against, so shuffle randomly instead.
      const shuffle = <T,>(arr: T[]): T[] => {
        const a = [...arr];
        for (let i = a.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [a[i], a[j]] = [a[j], a[i]];
        }
        return a;
      };

      let scored: Profile[];
      if (currentUser) {
        scored = unswiped.map(p => {
          const isBoosted = boostedUserIds.has(p.uid);
          // Premium subscribers get featured placement too (marketed as "Mise
          // en vedette de votre profil"), just below users with an active
          // paid one-time Boost, which should always outrank it.
          const isFeatured = premiumUserIds.has(p.uid);
          const score = calculateCompatibility(currentUserProfile, p);
          return { profile: p, score, isBoosted, isFeatured };
        }).sort((a, b) => {
          if (a.isBoosted !== b.isBoosted) return a.isBoosted ? -1 : 1;
          if (a.isFeatured !== b.isFeatured) return a.isFeatured ? -1 : 1;
          return b.score - a.score;
        }).map(x => x.profile);
      } else {
        const boosted = unswiped.filter(p => boostedUserIds.has(p.uid));
        const featured = unswiped.filter(p => !boostedUserIds.has(p.uid) && premiumUserIds.has(p.uid));
        const rest = shuffle(unswiped.filter(p => !boostedUserIds.has(p.uid) && !premiumUserIds.has(p.uid)));
        scored = [...boosted, ...featured, ...rest];
      }

      setProfiles(scored);
      setCurrentIndex(0);
      setLastSwipe(null);
    } catch (err: any) {
      console.warn("Could not load profiles from database (possibly offline or unmigrated):", err);
      if (err?.message === "TIMEOUT" && retryAttempt < 1) {
        // Slow/cold connection on first try — give it one silent second chance
        // before bothering the user with an error message. Skip clearing
        // isLoading here so the spinner doesn't flicker off mid-retry.
        isRetrying = true;
        loadProfiles(retryAttempt + 1);
        return;
      }
      if (err?.message === "TIMEOUT") {
        setLoadError("Connexion trop lente. Vérifiez votre réseau et réessayez.");
      } else {
        setLoadError("Impossible de charger les profils. Réessayez.");
      }
    } finally {
      if (!isRetrying) setIsLoading(false);
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

    if (!currentUser) {
      if (liked) {
        if (onAuthRequired) onAuthRequired();
        return;
      } else {
        // Dislike / Next profile: allow unauthenticated browsing
        setCurrentIndex(prev => prev + 1);
        return;
      }
    }
    
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
          // It's a match! Inform parent component to show match popup.
          // No rewind offered here: undoing a like after an instant match
          // would mean unmatching, which is a bigger action than a rewind.
          setLastSwipe(null);
          onMatchDetected(candidate);
        } else {
          setLastSwipe({ profile: candidate, wasLiked: true });
        }
      } catch (err) {
        console.error("Error swiping like:", err);
      }
    } else {
      // A pass never writes anything to the database, so it's always safe
      // to rewind.
      setLastSwipe({ profile: candidate, wasLiked: false });
    }

    // Advance to next profile
    setCurrentIndex(prev => prev + 1);
  };

  // Rewind (Premium): undo the very last swipe and bring that profile back.
  const handleRewind = async () => {
    if (!currentUser) {
      if (onAuthRequired) onAuthRequired();
      return;
    }
    if (!isPremium) {
      alert("Le Rewind (annuler un swipe) est réservé aux membres Premium. Rendez-vous dans la Boutique pour en profiter !");
      if (onOpenShop) onOpenShop();
      return;
    }
    if (!lastSwipe || isRewinding) return;

    setIsRewinding(true);
    try {
      if (lastSwipe.wasLiked) {
        const { error } = await supabase
          .from("likes")
          .delete()
          .eq("from_uid", currentUser.id)
          .eq("to_uid", lastSwipe.profile.uid);
        if (error) throw error;
      }
      setCurrentIndex(prev => Math.max(0, prev - 1));
      setLastSwipe(null);
    } catch (err) {
      console.error("Error rewinding swipe:", err);
      alert("Impossible d'annuler ce swipe pour le moment.");
    } finally {
      setIsRewinding(false);
    }
  };

  const handleSuperLike = async () => {
    if (!currentUser) {
      if (onAuthRequired) onAuthRequired();
      return;
    }
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
        {currentUser ? (
          <>
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

            <div className="relative">
              <button
                onClick={() => setShowAdvancedFilters(v => !v)}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-full transition whitespace-nowrap cursor-pointer ${
                  ageFilterMin != null || ageFilterMax != null || verifiedOnlyFilter
                    ? "bg-amber-400 text-white shadow-sm"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {isPremium ? <Sparkles size={13} /> : <Lock size={13} />}
                <span>Filtres avancés</span>
              </button>

              {showAdvancedFilters && (
                <div className="absolute right-0 top-full mt-2 w-72 bg-white border border-slate-200 rounded-2xl shadow-xl p-4 z-30 space-y-4">
                  {!isPremium ? (
                    <div className="text-center space-y-3 py-2">
                      <Lock size={24} className="mx-auto text-rose-400" />
                      <p className="text-xs font-bold text-slate-700">Filtres avancés réservés aux membres Premium</p>
                      <p className="text-[11px] text-slate-400 leading-relaxed">
                        Filtrez par tranche d'âge et n'affichez que les profils vérifiés.
                      </p>
                    </div>
                  ) : (
                    <>
                      <div>
                        <p className="text-[10px] font-extrabold text-slate-500 uppercase mb-2">Tranche d'âge</p>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min={18}
                            max={99}
                            placeholder="Min"
                            value={ageFilterMin ?? ""}
                            onChange={(e) => setAgeFilterMin(e.target.value ? parseInt(e.target.value) : null)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-700 outline-none focus:border-rose-400"
                          />
                          <span className="text-slate-400 text-xs">—</span>
                          <input
                            type="number"
                            min={18}
                            max={99}
                            placeholder="Max"
                            value={ageFilterMax ?? ""}
                            onChange={(e) => setAgeFilterMax(e.target.value ? parseInt(e.target.value) : null)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-700 outline-none focus:border-rose-400"
                          />
                        </div>
                      </div>

                      <label className="flex items-center justify-between cursor-pointer">
                        <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                          <CheckCircle size={13} className="text-emerald-500" />
                          Profils vérifiés uniquement
                        </span>
                        <input
                          type="checkbox"
                          checked={verifiedOnlyFilter}
                          onChange={(e) => setVerifiedOnlyFilter(e.target.checked)}
                          className="w-4 h-4 accent-rose-500 cursor-pointer"
                        />
                      </label>

                      <button
                        onClick={() => {
                          setAgeFilterMin(null);
                          setAgeFilterMax(null);
                          setVerifiedOnlyFilter(false);
                        }}
                        className="w-full text-center text-[11px] font-bold text-slate-400 hover:text-slate-600 cursor-pointer pt-1"
                      >
                        Réinitialiser
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
            <Filter size={16} className="text-rose-500" />
            <span>
              Vous recherchez : <span className="text-rose-600 font-extrabold">{guestGenderPref === 'homme' ? 'des hommes' : guestGenderPref === 'femme' ? 'des femmes' : '...'}</span>
            </span>
            <button
              onClick={() => {
                try { localStorage.removeItem("loverose_guest_gender_pref"); } catch {}
                setGuestGenderPref(null);
              }}
              className="text-rose-500 underline font-bold cursor-pointer"
            >
              Changer
            </button>
          </div>
        )}
      </div>

      {/* Profile Card Stage */}
      <div className="flex-1 overflow-hidden flex flex-col justify-start md:justify-center items-center p-4 min-h-0 relative w-full">
        {!currentUser && !guestGenderPref ? (
          <div className="flex flex-col items-center justify-center space-y-5 text-center px-6 max-w-sm">
            <Heart size={40} className="text-rose-500 fill-rose-500" />
            <div>
              <p className="text-slate-800 font-extrabold text-lg mb-1">Vous recherchez qui ?</p>
              <p className="text-slate-400 text-xs font-medium">Dites-nous qui vous voulez rencontrer pour vous montrer les bons profils.</p>
            </div>
            <div className="flex gap-3 w-full">
              <button
                onClick={() => {
                  try { localStorage.setItem("loverose_guest_gender_pref", "homme"); } catch {}
                  setGuestGenderPref("homme");
                }}
                className="flex-1 bg-white border-2 border-rose-500 text-rose-600 font-bold py-3 rounded-2xl hover:bg-rose-50 transition cursor-pointer"
              >
                Des hommes
              </button>
              <button
                onClick={() => {
                  try { localStorage.setItem("loverose_guest_gender_pref", "femme"); } catch {}
                  setGuestGenderPref("femme");
                }}
                className="flex-1 bg-white border-2 border-rose-500 text-rose-600 font-bold py-3 rounded-2xl hover:bg-rose-50 transition cursor-pointer"
              >
                Des femmes
              </button>
            </div>
          </div>
        ) : isLoading ? (
          <div className="flex flex-col items-center justify-center space-y-3">
            <div className="w-10 h-10 border-4 border-rose-500 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-slate-400 text-xs font-medium">
              {currentUser ? "Recherche des profils compatibles..." : "Recherche des profils disponibles..."}
            </p>
          </div>
        ) : loadError ? (
          <div className="flex flex-col items-center justify-center space-y-3 text-center px-6">
            <p className="text-slate-500 text-sm font-medium">{loadError}</p>
            <button
              onClick={() => loadProfiles()}
              className="bg-rose-500 hover:bg-rose-600 text-white text-sm font-bold px-5 py-2 rounded-full transition"
            >
              Réessayer
            </button>
          </div>
        ) : activeProfile ? (
          <div className="w-full max-w-md h-full flex flex-col items-center justify-between gap-3 mx-auto min-h-0">
            
            {/* The Main Swing Card */}
            <AnimatePresence mode="wait">
              <motion.div
                key={activeProfile.uid}
                initial={{ scale: 0.95, opacity: 0, y: 15 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.95, opacity: 0, y: -15 }}
                transition={{ duration: 0.3 }}
                style={{
                  width: '100%',
                  maxWidth: '380px',
                  borderRadius: '24px',
                  overflow: 'hidden',
                  position: 'relative',
                }}
                className="bg-white border border-slate-150 shadow-xl flex flex-col relative flex-1 min-h-0"
              >
                {/* Photo underlay */}
                <AdaptiveImage
                  src={activeProfile.avatar_url}
                  fallbackSrc={`https://api.dicebear.com/7.x/adventurer/svg?seed=${activeProfile.full_name || activeProfile.uid}`}
                  alt={activeProfile.full_name || "Profil"}
                  referrerPolicy="no-referrer"
                  decoding="async"
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
                {currentUser && currentUserProfile && (
                  <div className="absolute top-4 left-4 bg-white/95 backdrop-blur shadow-sm px-3 py-1 rounded-full flex items-center space-x-1 z-10 border border-rose-500/10">
                    <Sparkles size={11} className="text-rose-500 animate-pulse fill-rose-500" />
                    <span className="text-[10px] font-black text-slate-800">
                      {compatibilityScore}% Compatibilité
                    </span>
                  </div>
                )}

                {/* Verification + Premium Status Badges */}
                <div className="absolute top-4 right-4 z-10 flex flex-col items-end gap-1.5">
                  {activeProfile.verification_status === "verified" && (
                    <div className="bg-emerald-500 text-white px-2.5 py-1 rounded-full flex items-center space-x-1 text-[9px] font-bold shadow-md uppercase tracking-wider">
                      <CheckCircle size={10} fill="white" className="text-emerald-500" />
                      <span>Vérifié</span>
                    </div>
                  )}
                  {premiumUids.has(activeProfile.uid) && (
                    <div className="bg-gradient-to-r from-amber-400 to-amber-500 text-white px-2.5 py-1 rounded-full flex items-center space-x-1 text-[9px] font-bold shadow-md uppercase tracking-wider">
                      <Sparkles size={10} fill="white" className="text-amber-500" />
                      <span>Premium</span>
                    </div>
                  )}
                </div>

                {/* Information Overlay Content — kept minimal so the photo stays the focus */}
                <div
                  onClick={() => setSelectedViewProfile(activeProfile)}
                  className="absolute bottom-0 left-0 right-0 p-5 text-white flex flex-col justify-end z-10 cursor-pointer"
                >
                  <div className="flex items-end justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-baseline gap-2 flex-wrap">
                        <h2 className="text-xl font-extrabold tracking-tight drop-shadow-md truncate">{activeProfile.full_name || "Anonyme"}</h2>
                        {activeProfile.age && <span className="text-base font-bold text-white/95 drop-shadow-md">{activeProfile.age}</span>}
                        {activeProfile.verification_status === "verified" && (
                          <CheckCircle size={15} className="text-emerald-400 fill-emerald-400/20 flex-shrink-0" />
                        )}
                        {renderOnlineStatus(activeProfile)}
                      </div>
                      {activeProfile.location && (
                        <p className="text-[11px] text-slate-200 flex items-center mt-1">
                          <MapPin size={11} className="mr-1 text-rose-400 flex-shrink-0" />
                          <span className="truncate">{activeProfile.location}</span>
                          {currentUserProfile?.latitude && currentUserProfile?.longitude && activeProfile.latitude && activeProfile.longitude && (
                            <span className="ml-2 bg-rose-950/60 border border-rose-500/25 px-1.5 py-0.2 rounded-full text-[9px] font-extrabold text-rose-300 flex-shrink-0">
                              {Math.round(calculateDistance(currentUserProfile.latitude, currentUserProfile.longitude, activeProfile.latitude, activeProfile.longitude))} km
                            </span>
                          )}
                        </p>
                      )}
                    </div>

                    {/* Tap-for-details affordance — opens the full profile page */}
                    <button
                      onClick={(e) => { e.stopPropagation(); setSelectedViewProfile(activeProfile); }}
                      className="flex-shrink-0 w-9 h-9 rounded-full bg-white/15 hover:bg-white/25 backdrop-blur-sm border border-white/20 flex items-center justify-center transition cursor-pointer"
                      title="Voir le profil complet"
                    >
                      <Info size={17} className="text-white" />
                    </button>
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>

            {/* Report action — kept accessible but out of the way of the photo */}
            <div className="w-full max-w-[380px] flex justify-end px-1 -mt-1 flex-shrink-0">
              <button
                onClick={() => {
                  if (!currentUser) {
                    if (onAuthRequired) onAuthRequired();
                    return;
                  }
                  setIsReportOpen(true);
                }}
                className="text-slate-400 hover:text-red-500 text-[10px] flex items-center gap-1 transition cursor-pointer font-bold"
              >
                <ShieldAlert size={12} />
                <span>Signaler ce profil</span>
              </button>
            </div>

            {/* Swipe Action Buttons */}
            <div className="flex justify-center items-center gap-6 pb-2 flex-shrink-0">
              <button
                id="swipe-rewind-btn"
                onClick={handleRewind}
                disabled={isRewinding || (isPremium && !lastSwipe)}
                className={`w-10 h-10 rounded-full shadow-md flex items-center justify-center transition cursor-pointer border border-slate-150 ${
                  isPremium && !lastSwipe
                    ? "bg-slate-50 text-slate-300 cursor-not-allowed"
                    : "bg-white hover:bg-amber-50 text-amber-500 hover:scale-105 active:scale-95"
                }`}
                title={isPremium ? "Annuler le dernier swipe" : "Rewind (Premium)"}
              >
                {isPremium ? <RotateCcw size={16} /> : <Lock size={14} />}
              </button>

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

            {/* AdSlot when active suggestions are shown — hidden for Premium (ad-free perk) */}
            {!isPremium && (
              <div className="w-full max-w-md mx-auto pt-1 pb-2 hidden sm:block flex-shrink-0">
                <AdSlot slot="discovery_feed_1" userId={currentUser?.id} />
              </div>
            )}
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

            {/* AdSlot when suggestions are finished — hidden for Premium (ad-free perk) */}
            {!isPremium && (
              <div className="w-full max-w-sm mx-auto">
                <AdSlot slot="discovery_feed_empty" userId={currentUser?.id} />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Report Modal */}
      {isReportOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-[60]">
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

      {/* Render full-page profile detail view */}
      {selectedViewProfile && (
        <ProfileDetailModal
          profile={selectedViewProfile}
          currentUserProfile={currentUserProfile}
          currentUser={currentUser}
          isPremium={isPremium}
          onClose={() => setSelectedViewProfile(null)}
          onAuthRequired={onAuthRequired}
          onReport={() => {
            if (!currentUser) {
              if (onAuthRequired) onAuthRequired();
              return;
            }
            setIsReportOpen(true);
          }}
          onPass={() => {
            handleSwipe(false);
            setSelectedViewProfile(null);
          }}
          onStartChat={() => {
            if (!currentUser) {
              if (onAuthRequired) onAuthRequired();
              return;
            }
            handleSwipe(true);
            setSelectedViewProfile(null);
          }}
        />
      )}
    </div>
  );
}
