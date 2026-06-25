import React, { useState } from "react";
import { X, MapPin, Sparkles, CheckCircle, Heart, MessageCircle, Lock, Eye } from "lucide-react";
import { Profile } from "../types";

interface ProfileDetailModalProps {
  profile: Profile;
  currentUserProfile: Profile | null;
  isPremium?: boolean;
  onClose: () => void;
  onStartChat?: () => void; // Optional CTA to start chat from feed/discover
}

export default function ProfileDetailModal({ profile, currentUserProfile, isPremium = false, onClose, onStartChat }: ProfileDetailModalProps) {
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);

  // Calculate mutual compatibility score
  const calculateCompatibility = (): number => {
    if (!currentUserProfile || !currentUserProfile.relationship_intents || !profile.relationship_intents) {
      return 15; // baseline score
    }

    const myIntents = currentUserProfile.relationship_intents;
    const otherIntents = profile.relationship_intents;
    const intersection = myIntents.filter(x => otherIntents.includes(x));
    
    if (intersection.length > 0) {
      const maxLen = Math.max(myIntents.length, otherIntents.length);
      const ratio = intersection.length / maxLen;
      return Math.round(50 + (ratio * 45));
    }

    return 15;
  };

  const compatibilityScore = calculateCompatibility();
  
  // Safe extraction of profile photos
  const profilePhotos: string[] = Array.isArray(profile.photos) && profile.photos.length > 0 
    ? profile.photos 
    : [profile.avatar_url].filter(Boolean) as string[];

  return (
    <div id="profile-detail-modal" className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-55 animate-fade-in font-sans">
      <div className="bg-white rounded-3xl overflow-hidden w-full max-w-md shadow-2xl relative flex flex-col border border-slate-100 max-h-[90vh]">
        
        {/* Close Button absolute top right */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-30 bg-black/50 hover:bg-black/70 text-white rounded-full p-2 transition cursor-pointer shadow-sm"
          title="Fermer"
        >
          <X size={18} />
        </button>

        {/* Profile Header Image with gradient overlay */}
        <div className="relative h-72 bg-slate-100 flex-shrink-0">
          <img
            src={profilePhotos[activePhotoIndex] || `https://api.dicebear.com/7.x/adventurer/svg?seed=${profile.full_name || profile.uid}`}
            alt={profile.full_name || "Profil"}
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover"
          />
          
          {/* Compatibility badge */}
          <div className="absolute top-4 left-4 bg-white/95 backdrop-blur-sm px-3.5 py-1.5 rounded-full flex items-center space-x-1.5 z-10 shadow-sm border border-rose-500/10">
            <Sparkles size={13} className="text-rose-500 animate-pulse fill-rose-500" />
            <span className="text-xs font-bold text-slate-800">
              {compatibilityScore}% compatible
            </span>
          </div>

          {/* Certified verification badge */}
          {profile.verification_status === "verified" && (
            <div className="absolute top-4 right-14 bg-emerald-500 text-white px-2.5 py-1 rounded-full flex items-center space-x-1 text-[10px] font-bold shadow-md uppercase tracking-wider z-10">
              <CheckCircle size={10} fill="white" className="text-emerald-500" />
              <span>Vérifié</span>
            </div>
          )}

          {/* Gradient */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent"></div>

          {/* Quick Name / Location inside image bottom */}
          <div className="absolute bottom-4 left-5 right-5 text-white">
            <div className="flex items-baseline space-x-2">
              <h2 className="text-2xl font-black tracking-tight">{profile.full_name || "Membre LoveRose"}</h2>
              {profile.age && <span className="text-xl font-bold">{profile.age} ans</span>}
            </div>
            {profile.location && (
              <p className="text-xs text-slate-200 flex items-center mt-1">
                <MapPin size={12} className="mr-1 text-rose-400" />
                <span>{profile.location}</span>
              </p>
            )}
          </div>
        </div>

        {/* Multi-Photo Dots/Thumbnails list */}
        {profilePhotos.length > 1 && (
          <div className="bg-slate-900 px-4 py-2 flex items-center space-x-2 overflow-x-auto border-b border-slate-800 flex-shrink-0">
            {profilePhotos.map((photo, index) => {
              const isBlurred = !isPremium && index > 0;
              return (
                <button
                  key={index}
                  type="button"
                  disabled={isBlurred}
                  onClick={() => setActivePhotoIndex(index)}
                  className={`relative w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 border-2 transition cursor-pointer ${
                    activePhotoIndex === index 
                      ? "border-rose-500 scale-105 shadow-md shadow-rose-500/20" 
                      : "border-transparent opacity-75 hover:opacity-100"
                  }`}
                >
                  <img src={photo} alt="" className={`w-full h-full object-cover ${isBlurred ? "blur-md select-none pointer-events-none" : ""}`} />
                  {isBlurred && (
                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                      <Lock size={12} className="text-amber-400" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* Scrollable details view */}
        <div className="flex-1 p-5 space-y-5 overflow-y-auto min-h-0 bg-white">
          
          {/* About / Bio section */}
          <div className="space-y-1.5">
            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">À propos de moi</h4>
            {profile.bio ? (
              <p className={`text-slate-600 text-xs md:text-sm leading-relaxed whitespace-pre-wrap ${!isPremium ? "blur-xs select-none pointer-events-none opacity-50 max-h-12 overflow-hidden" : ""}`}>
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
            <div className={`flex flex-wrap gap-1.5 ${!isPremium ? "blur-xs select-none pointer-events-none opacity-40" : ""}`}>
              {profile.relationship_intents && profile.relationship_intents.length > 0 ? (
                profile.relationship_intents.map(intent => {
                  const isShared = currentUserProfile?.relationship_intents?.includes(intent);
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

          {/* Premium Lock Call-To-Action Overlay if not Premium */}
          {!isPremium && (
            <div className="bg-gradient-to-r from-amber-500 to-yellow-600 rounded-2xl p-4 text-white text-center shadow-lg shadow-amber-500/10 space-y-1.5 animate-pulse">
              <div className="flex items-center justify-center space-x-1">
                <Lock size={14} className="text-amber-200 fill-amber-200" />
                <span className="text-[10px] font-black uppercase tracking-wider">Abonnement Premium Requis 👑</span>
              </div>
              <p className="text-[10px] text-amber-50 font-medium leading-relaxed">
                Les photos secondaires (jusqu'à 20), la description et les intentions de rencontre précises de ce profil sont reservées aux abonnés Premium.
              </p>
            </div>
          )}

        </div>

        {/* Footer actions - Non-premium can still open discussions perfectly! */}
        {onStartChat && (
          <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center gap-3">
            <button
              onClick={onStartChat}
              className="w-full py-3 bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-600 hover:to-pink-700 text-white font-black text-xs rounded-xl shadow-md flex items-center justify-center gap-1.5 transition cursor-pointer"
            >
              <MessageCircle size={14} />
              <span>Ouvrir la Discussion</span>
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
