import { useState, useEffect, FormEvent } from "react";
import { supabase } from "../lib/supabase";
import { Profile } from "../types";
import { Heart, X, Sparkles, MapPin, CheckCircle, ShieldAlert, Filter, Send, MessageCircle, Eye } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import ProfileDetailModal from "./ProfileDetailModal";

interface DiscoverProps {
  currentUser: any;
  currentUserProfile: Profile | null;
  isPremium?: boolean;
  onMatchDetected: (partner: Profile) => void;
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

  const loadProfiles = async () => {
    setIsLoading(true);
    try {
      // 1. Get already liked profiles to filter them out
      const { data: likesData } = await supabase
        .from("likes")
        .select("to_uid")
        .eq("from_uid", currentUser.id);
      
      const likedSet = new Set<string>((likesData || []).map(l => l.to_uid));
      setLikedUids(likedSet);

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

      let filteredProfiles = profilesData || [];

      // Filter out profiles already liked or with missing complete profiles
      const unswiped = filteredProfiles.filter(p => !likedSet.has(p.uid));
      
      // Shuffle slightly or sort by compatibility score for a richer discovery feel
      const scored = unswiped.map(p => {
        const score = calculateCompatibility(currentUserProfile, p);
        return { profile: p, score };
      }).sort((a, b) => b.score - a.score).map(x => x.profile);

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
      <div className="flex-1 flex flex-col justify-center items-center p-4 min-h-0 relative">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center space-y-3">
            <div className="w-10 h-10 border-4 border-rose-500 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-slate-400 text-xs font-medium">Recherche des profils compatibles...</p>
          </div>
        ) : activeProfile ? (
          <div className="w-full max-w-md flex flex-col h-full md:max-h-[600px] justify-between space-y-4">
            
            {/* The Main Swing Card */}
            <AnimatePresence mode="wait">
              <motion.div
                key={activeProfile.uid}
                initial={{ scale: 0.95, opacity: 0, y: 15 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.95, opacity: 0, y: -15 }}
                transition={{ duration: 0.3 }}
                className="flex-1 bg-white border border-slate-150 rounded-3xl overflow-hidden shadow-md flex flex-col relative"
              >
                {/* Photo and compatibility overlay */}
                <div className="relative h-72 md:h-80 bg-slate-100 flex-shrink-0">
                  <img
                    src={activeProfile.avatar_url || `https://api.dicebear.com/7.x/adventurer/svg?seed=${activeProfile.full_name || activeProfile.uid}`}
                    alt={activeProfile.full_name || "Profil"}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                  
                  {/* Compatibility Badge */}
                  <div className="absolute top-4 left-4 bg-white/95 backdrop-blur shadow-sm px-3.5 py-1.5 rounded-full flex items-center space-x-1.5 z-10 border border-rose-500/10">
                    <Sparkles size={14} className="text-rose-500 animate-pulse fill-rose-500" />
                    <span className="text-xs font-bold text-slate-800">
                      {compatibilityScore}% de compatibilité
                    </span>
                  </div>

                  {/* Verification Status Badge */}
                  {activeProfile.verification_status === "verified" && (
                    <div className="absolute top-4 right-4 bg-emerald-500 text-white px-2.5 py-1 rounded-full flex items-center space-x-1 text-[10px] font-bold shadow-md uppercase tracking-wider">
                      <CheckCircle size={10} fill="white" className="text-emerald-500" />
                      <span>Vérifié</span>
                    </div>
                  )}

                  {/* Shading overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent"></div>

                  {/* Basic Info Absolute Bottom inside the image */}
                  <div className="absolute bottom-4 left-6 right-6 text-white space-y-1">
                    <div className="flex items-baseline space-x-2">
                      <h2 className="text-2xl font-bold tracking-tight">{activeProfile.full_name || "Anonyme"}</h2>
                      {activeProfile.age && <span className="text-xl font-medium">{activeProfile.age} ans</span>}
                    </div>
                    {activeProfile.location && (
                      <p className="text-xs text-slate-200 flex items-center">
                        <MapPin size={12} className="mr-1 text-rose-400" />
                        <span>{activeProfile.location}</span>
                      </p>
                    )}
                  </div>
                </div>

                {/* Profile Details Content */}
                <div className="flex-1 p-6 space-y-4 overflow-y-auto">
                  {/* Bio */}
                  {activeProfile.bio ? (
                    <p className="text-slate-600 text-sm leading-relaxed">{activeProfile.bio}</p>
                  ) : (
                    <p className="text-slate-400 text-xs italic">Cet utilisateur n'a pas encore rédigé sa biographie.</p>
                  )}

                  {/* Intents tags */}
                  <div className="space-y-2">
                    <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Recherche :</h4>
                    <div className="flex flex-wrap gap-1.5">
                      {activeProfile.relationship_intents && activeProfile.relationship_intents.length > 0 ? (
                        activeProfile.relationship_intents.map(intent => {
                          const isShared = currentUserProfile?.relationship_intents?.includes(intent);
                          return (
                            <span
                              key={intent}
                              className={`text-xs px-2.5 py-1 rounded-lg font-medium border ${
                                isShared
                                  ? "bg-rose-50 border-rose-200 text-rose-700 font-bold"
                                  : "bg-slate-50 border-slate-100 text-slate-500"
                              }`}
                            >
                              {intent} {isShared && "✓"}
                            </span>
                          );
                        })
                      ) : (
                        <span className="text-xs text-slate-400 italic">Aucune intention sélectionnée</span>
                      )}
                    </div>
                  </div>

                  {/* Report and View actions */}
                  <div className="pt-2 flex justify-between items-center border-t border-slate-100 mt-2">
                    <button
                      onClick={() => setSelectedViewProfile(activeProfile)}
                      className="text-rose-500 hover:text-rose-600 text-xs flex items-center gap-1 transition cursor-pointer font-bold bg-rose-50 px-3 py-1.5 rounded-lg border border-rose-100"
                    >
                      <Eye size={14} />
                      <span>Détails & Photos</span>
                    </button>
                    <button
                      onClick={() => setIsReportOpen(true)}
                      className="text-slate-400 hover:text-red-500 text-xs flex items-center gap-1 transition cursor-pointer font-medium"
                    >
                      <ShieldAlert size={14} />
                      <span>Signaler ce profil</span>
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
              >
                <X size={24} />
              </button>
              <button
                id="swipe-like-btn"
                onClick={() => handleSwipe(true)}
                className="w-16 h-16 bg-gradient-to-br from-rose-500 to-pink-600 text-white hover:scale-105 active:scale-95 rounded-full shadow-lg shadow-rose-500/20 flex items-center justify-center transition cursor-pointer"
              >
                <Heart size={28} fill="currentColor" />
              </button>
            </div>
          </div>
        ) : (
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
