import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { Profile } from "../types";
import ProfileDetailModal from "./ProfileDetailModal";
import { Heart, Star, Sparkles, Lock, Loader2, MapPin, MessageCircle } from "lucide-react";

interface WhoLikedMeProps {
  currentUser: any;
  currentUserProfile: Profile | null;
  isPremium: boolean;
  onStartChat: (uid: string) => void;
  onAuthRequired: () => void;
  onGoToShop: () => void;
}

interface LikeRow {
  from_uid: string;
  type: "like" | "super_like";
  created_at: string;
}

interface MatchRow {
  id: string;
  users: string[];
  created_at: string;
}

// Slow/unstable connections can leave a request hanging with no response and
// no error, freezing the screen forever. This races the request against a
// timeout so the UI always settles one way or another.
const withTimeout = <T,>(promise: PromiseLike<T>, ms = 12000): Promise<T> =>
  Promise.race([
    Promise.resolve(promise),
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error("TIMEOUT")), ms)),
  ]);

export default function WhoLikedMe({
  currentUser,
  currentUserProfile,
  isPremium,
  onStartChat,
  onAuthRequired,
  onGoToShop,
}: WhoLikedMeProps) {
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [superLikers, setSuperLikers] = useState<(Profile & { likedAt: string })[]>([]);
  const [likers, setLikers] = useState<(Profile & { likedAt: string })[]>([]);
  const [matches, setMatches] = useState<(Profile & { matchedAt: string })[]>([]);
  const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null);

  useEffect(() => {
    if (!currentUser || !isPremium) {
      setLoading(false);
      return;
    }

    const load = async () => {
      setLoading(true);
      setErrorMsg("");
      try {
        const [likesRes, matchesRes] = await withTimeout(
          Promise.all([
            supabase
              .from("likes")
              .select("from_uid, type, created_at")
              .eq("to_uid", currentUser.id)
              .order("created_at", { ascending: false }),
            supabase
              .from("matches")
              .select("id, users, created_at")
              .contains("users", [currentUser.id])
              .order("created_at", { ascending: false }),
          ])
        );

        if (likesRes.error) throw likesRes.error;
        if (matchesRes.error) throw matchesRes.error;

        const likeRows = (likesRes.data || []) as LikeRow[];
        const matchRows = (matchesRes.data || []) as MatchRow[];

        const matchedUids = new Set(
          matchRows.map((m) => m.users.find((u) => u !== currentUser.id)).filter(Boolean) as string[]
        );

        // Don't show someone in "likes received" if they're already a match —
        // that belongs in the Matches section instead, not duplicated.
        const pendingLikeRows = likeRows.filter((l) => !matchedUids.has(l.from_uid));
        const uniqueLikerUids = Array.from(new Set(pendingLikeRows.map((l) => l.from_uid)));
        const allProfileUids = Array.from(new Set([...uniqueLikerUids, ...matchedUids]));

        let profilesByUid = new Map<string, Profile>();
        if (allProfileUids.length > 0) {
          const { data: profilesData, error: profilesErr } = await withTimeout(
            supabase.from("profiles").select("*").in("uid", allProfileUids)
          );
          if (profilesErr) throw profilesErr;
          for (const p of profilesData || []) profilesByUid.set(p.uid, p as Profile);
        }

        const superLikeList: (Profile & { likedAt: string })[] = [];
        const likeList: (Profile & { likedAt: string })[] = [];
        for (const l of pendingLikeRows) {
          const p = profilesByUid.get(l.from_uid);
          if (!p) continue;
          const entry = { ...p, likedAt: l.created_at };
          if (l.type === "super_like") superLikeList.push(entry);
          else likeList.push(entry);
        }

        const matchList: (Profile & { matchedAt: string })[] = [];
        for (const m of matchRows) {
          const partnerUid = m.users.find((u) => u !== currentUser.id);
          if (!partnerUid) continue;
          const p = profilesByUid.get(partnerUid);
          if (!p) continue;
          matchList.push({ ...p, matchedAt: m.created_at });
        }

        setSuperLikers(superLikeList);
        setLikers(likeList);
        setMatches(matchList);
      } catch (err: any) {
        console.error("Error loading likes/matches:", err);
        setErrorMsg(
          err.message === "TIMEOUT"
            ? "Le chargement prend trop de temps. Vérifiez votre connexion et réessayez."
            : "Impossible de charger cette page pour le moment."
        );
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [currentUser?.id, isPremium]);

  if (!currentUser) {
    return (
      <div className="max-w-md mx-auto my-12 p-8 bg-white border border-slate-200 rounded-3xl shadow-sm text-center space-y-4">
        <div className="w-14 h-14 bg-rose-50 text-rose-500 rounded-2xl flex items-center justify-center mx-auto">
          <Heart size={28} />
        </div>
        <h2 className="text-xl font-black text-slate-900">Qui vous a aimé</h2>
        <p className="text-xs text-slate-500">Connectez-vous pour voir qui s'intéresse à vous.</p>
        <button
          onClick={onAuthRequired}
          className="w-full py-3 bg-rose-500 hover:bg-rose-600 text-white font-black text-xs rounded-xl shadow-md transition cursor-pointer"
        >
          Se connecter / S'inscrire
        </button>
      </div>
    );
  }

  if (!isPremium) {
    return (
      <div className="max-w-md mx-auto my-12 p-8 bg-white border border-rose-100 rounded-3xl shadow-sm text-center space-y-4">
        <div className="w-16 h-16 bg-rose-50 text-rose-500 rounded-2xl flex items-center justify-center mx-auto">
          <Lock size={30} />
        </div>
        <div className="space-y-1">
          <h2 className="text-xl font-black text-slate-900 flex items-center justify-center gap-1.5">
            <Sparkles size={18} className="text-rose-500" />
            Réservé aux membres Premium
          </h2>
          <p className="text-xs text-slate-500 leading-relaxed">
            Découvrez qui vous a aimé, super liké, et retrouvez tous vos matchs en un seul endroit.
          </p>
        </div>
        <button
          onClick={onGoToShop}
          className="w-full py-3.5 bg-rose-500 hover:bg-rose-600 text-white font-black text-xs rounded-xl shadow-md transition cursor-pointer"
        >
          Passer Premium
        </button>
      </div>
    );
  }

  const timeAgo = (iso: string) => {
    const diffMs = Date.now() - new Date(iso).getTime();
    const h = Math.floor(diffMs / 3600000);
    if (h < 1) return "à l'instant";
    if (h < 24) return `il y a ${h}h`;
    const d = Math.floor(h / 24);
    return `il y a ${d}j`;
  };

  const PersonCard = ({
    profile,
    subtitle,
    badge,
    onOpenProfile,
  }: {
    profile: Profile & { likedAt?: string; matchedAt?: string };
    subtitle: string;
    badge?: React.ReactNode;
    onOpenProfile: () => void;
  }) => {
    const photo = profile.avatar_url || (profile.photos && profile.photos[0]) || "";
    return (
      <button
        onClick={onOpenProfile}
        className="w-full flex items-center gap-3 bg-white border border-slate-100 rounded-2xl p-3 shadow-sm hover:shadow-md hover:border-rose-200 transition text-left cursor-pointer"
      >
        <div className="relative flex-shrink-0">
          {photo ? (
            <img src={photo} alt={profile.full_name || ""} className="w-14 h-14 rounded-xl object-cover" />
          ) : (
            <div className="w-14 h-14 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 font-black">
              {(profile.full_name || "?").charAt(0)}
            </div>
          )}
          {badge && <div className="absolute -top-1.5 -right-1.5">{badge}</div>}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-extrabold text-slate-900 text-sm truncate">
            {profile.full_name}
            {profile.age ? `, ${profile.age}` : ""}
          </p>
          {profile.location && (
            <p className="text-[11px] text-slate-400 flex items-center gap-1 truncate">
              <MapPin size={11} className="flex-shrink-0" />
              {profile.location}
            </p>
          )}
          <p className="text-[11px] text-slate-400">{subtitle}</p>
        </div>
        <div className="flex-shrink-0 text-rose-400">
          <MessageCircle size={18} />
        </div>
      </button>
    );
  };

  const Section = ({
    title,
    icon,
    color,
    people,
    field,
  }: {
    title: string;
    icon: React.ReactNode;
    color: string;
    people: (Profile & { likedAt?: string; matchedAt?: string })[];
    field: "likedAt" | "matchedAt";
  }) => (
    <div className="space-y-3">
      <h3 className={`text-xs font-extrabold uppercase tracking-wider flex items-center gap-1.5 ${color}`}>
        {icon}
        {title} ({people.length})
      </h3>
      {people.length === 0 ? (
        <p className="text-xs text-slate-400 italic px-1">Rien pour le moment.</p>
      ) : (
        <div className="space-y-2">
          {people.map((p) => (
            <PersonCard
              key={p.uid}
              profile={p}
              subtitle={
                field === "likedAt"
                  ? `Il y a ${timeAgo(p.likedAt!).replace("il y a ", "")}`
                  : `Match ${timeAgo(p.matchedAt!)}`
              }
              onOpenProfile={() => setSelectedProfile(p)}
            />
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-6">
      <div className="space-y-1">
        <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
          <Heart size={22} className="text-rose-500" fill="currentColor" />
          Qui vous a aimé
        </h2>
        <p className="text-xs text-slate-500">Tapez sur un profil pour le voir ou lui envoyer un message.</p>
      </div>

      {loading ? (
        <div className="py-16 text-center space-y-3">
          <Loader2 className="animate-spin text-rose-500 mx-auto" size={24} />
          <p className="text-xs text-slate-400">Chargement...</p>
        </div>
      ) : errorMsg ? (
        <div className="bg-red-50 border border-red-100 text-red-600 text-xs p-4 rounded-xl text-center">
          {errorMsg}
        </div>
      ) : (
        <div className="space-y-8">
          <Section
            title="Super Likes reçus"
            icon={<Star size={14} fill="currentColor" />}
            color="text-amber-500"
            people={superLikers}
            field="likedAt"
          />
          <Section
            title="Likes reçus"
            icon={<Heart size={14} fill="currentColor" />}
            color="text-rose-500"
            people={likers}
            field="likedAt"
          />
          <Section
            title="Vos Matchs"
            icon={<Sparkles size={14} />}
            color="text-violet-500"
            people={matches}
            field="matchedAt"
          />
        </div>
      )}

      {selectedProfile && (
        <ProfileDetailModal
          profile={selectedProfile}
          currentUserProfile={currentUserProfile}
          currentUser={currentUser}
          isPremium={isPremium}
          onClose={() => setSelectedProfile(null)}
          onStartChat={() => {
            const uid = selectedProfile.uid;
            setSelectedProfile(null);
            onStartChat(uid);
          }}
          onAuthRequired={onAuthRequired}
        />
      )}
    </div>
  );
}
