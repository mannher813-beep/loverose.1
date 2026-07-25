import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { Profile } from "../types";
import ProfileDetailModal from "./ProfileDetailModal";
import { isActuallyOnline } from "../lib/presence";
import {
  ShieldAlert,
  Users,
  Flag,
  Search,
  Trash2,
  Gift,
  Send,
  X,
  Circle,
  Eye,
  Clock,
  ShieldOff,
  ShieldCheck,
  BadgeCheck,
  Pencil,
  MessageSquare,
  Megaphone,
  BarChart3,
  CheckCircle2,
  XCircle,
  Loader2,
} from "lucide-react";

interface Report {
  id: string;
  reporter_id: string;
  reported_id: string;
  motif: string;
  created_at: string;
  status?: string;
  reviewed_at?: string | null;
}

interface Message {
  id: string;
  match_id: string;
  sender_id: string;
  contenu: string;
  created_at: string;
  message_type?: string;
}

interface AdminStats {
  total_users: number;
  online_now: number;
  new_users_7d: number;
  suspended: number;
  verified: number;
  pending_verification: number;
  premium_active: number;
  total_matches: number;
  messages_24h: number;
  reports_pending: number;
  reports_total: number;
}

interface AdminPanelProps {
  currentUser: any;
}

export default function AdminPanel({ currentUser }: AdminPanelProps) {
  const [tab, setTab] = useState<"users" | "reports" | "stats">("users");
  const [users, setUsers] = useState<Profile[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [reportProfiles, setReportProfiles] = useState<Record<string, Profile>>({});
  const [viewProfile, setViewProfile] = useState<Profile | null>(null);
  const [search, setSearch] = useState("");
  const [usersLoading, setUsersLoading] = useState(true);
  const [reportsLoading, setReportsLoading] = useState(true);
  const [usersError, setUsersError] = useState<string | null>(null);
  const [reportsError, setReportsError] = useState<string | null>(null);
  const [actionTarget, setActionTarget] = useState<Profile | null>(null);
  const [warningMessage, setWarningMessage] = useState("");
  const [suspendTarget, setSuspendTarget] = useState<Profile | null>(null);
  const [suspendDuration, setSuspendDuration] = useState<"24h" | "7d" | "30d" | "perm">("7d");
  const [suspendReason, setSuspendReason] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const [editTarget, setEditTarget] = useState<Profile | null>(null);
  const [editForm, setEditForm] = useState<Partial<Profile>>({});
  const [convoTarget, setConvoTarget] = useState<Profile | null>(null);
  const [convoMessages, setConvoMessages] = useState<(Message & { senderName?: string })[]>([]);
  const [convoLoading, setConvoLoading] = useState(false);
  const [broadcastOpen, setBroadcastOpen] = useState(false);
  const [broadcastMessage, setBroadcastMessage] = useState("");
  const [broadcastSending, setBroadcastSending] = useState(false);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsError, setStatsError] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  // Slow/unstable connections can leave a request hanging with no response
  // and no error, freezing the spinner forever. This races the request
  // against a timeout so the UI always settles one way or another.
  const withTimeout = <T,>(promise: PromiseLike<T>, ms = 12000): Promise<T> =>
    Promise.race([
      Promise.resolve(promise),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("TIMEOUT")), ms)),
    ]);

  const USERS_PAGE_SIZE = 15;
  const [usersHasMore, setUsersHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  // Loads users a small page at a time instead of one big 200-row request.
  // The first page shows up fast (much less likely to time out on a slow
  // connection), and the rest streams in quietly in the background — instead
  // of the whole list living or dying on a single slow request.
  const loadUsersPage = async (offset: number, retryAttempt: number = 0): Promise<Profile[] | null> => {
    try {
      const { data, error } = await withTimeout(
        supabase
          .from("profiles")
          .select("*")
          .order("is_online", { ascending: false })
          .order("last_seen", { ascending: false })
          .range(offset, offset + USERS_PAGE_SIZE - 1)
      );
      if (error) throw error;
      return (data as Profile[]) || [];
    } catch (err: any) {
      if (retryAttempt < 2) {
        // Short backoff, then retry just this page (not the whole list).
        await new Promise((r) => setTimeout(r, 1000));
        return loadUsersPage(offset, retryAttempt + 1);
      }
      throw err;
    }
  };

  const loadUsers = async () => {
    setUsersLoading(true);
    setUsersError(null);
    setUsersHasMore(true);
    try {
      const first = await loadUsersPage(0);
      setUsers(first || []);
      setUsersLoading(false);
      if (!first || first.length < USERS_PAGE_SIZE) {
        setUsersHasMore(false);
        return;
      }
      // Keep streaming the rest in quietly — failures here don't wipe out
      // what's already showing, they just stop the background stream.
      loadMoreUsers(first.length);
    } catch (err: any) {
      setUsersError(
        err?.message === "TIMEOUT"
          ? "Connexion trop lente pour charger les utilisateurs."
          : "Impossible de charger les utilisateurs."
      );
      setUsersLoading(false);
    }
  };

  const loadMoreUsers = async (offset: number) => {
    setLoadingMore(true);
    try {
      const next = await loadUsersPage(offset);
      setUsers((prev) => {
        const existingIds = new Set(prev.map((u) => u.uid));
        return [...prev, ...(next || []).filter((u) => !existingIds.has(u.uid))];
      });
      if (!next || next.length < USERS_PAGE_SIZE) {
        setUsersHasMore(false);
        setLoadingMore(false);
      } else {
        loadMoreUsers(offset + next.length);
      }
    } catch {
      // Background page failed after its own retries: stop silently, what's
      // already loaded stays visible. The user can pull-to-refresh (Réessayer)
      // to try again from the top.
      setLoadingMore(false);
    }
  };

  const loadReports = async (retryAttempt: number = 0) => {
    setReportsLoading(true);
    setReportsError(null);
    try {
      const { data, error } = await withTimeout(
        supabase
          .from("reports")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(200)
      );
      if (error) throw error;
      const reportRows = (data as Report[]) || [];
      setReports(reportRows);
      setReportsLoading(false);

      // Fetch the reporter/reported profiles directly by id, instead of relying
      // on whatever subset of users happens to already be loaded (limit 200).
      // This guarantees real names show up even for users outside that window.
      const ids = Array.from(
        new Set(
          reportRows.flatMap((r) => [r.reporter_id, r.reported_id]).filter(Boolean)
        )
      );
      if (ids.length > 0) {
        const { data: profileRows, error: profileError } = await supabase
          .from("profiles")
          .select("*")
          .in("uid", ids);
        if (!profileError && profileRows) {
          const map: Record<string, Profile> = {};
          (profileRows as Profile[]).forEach((p) => {
            map[p.uid] = p;
          });
          setReportProfiles(map);
        }
      }
    } catch (err: any) {
      if (err?.message === "TIMEOUT" && retryAttempt < 1) {
        loadReports(retryAttempt + 1);
        return;
      }
      setReportsError(
        err?.message === "TIMEOUT"
          ? "Connexion trop lente pour charger les signalements."
          : "Impossible de charger les signalements."
      );
      setReportsLoading(false);
    }
  };

  useEffect(() => {
    supabase.rpc("sync_stale_presence").catch(() => {});
    loadUsers();
    loadReports();

    // Live updates: any profile change (new signup, online status, GPS ping...).
    // We used to call loadUsers() on every single event here, but with several
    // users online at once (each heartbeating every 60s, plus GPS pings every
    // few minutes) there's almost always a pending change, so a full reload
    // kept re-triggering before the previous one could even render — the list
    // looked permanently stuck on "Chargement...". Patching the affected row
    // directly from the realtime payload is both cheaper and never flickers.
    const profileChannel = supabase
      .channel(`admin-profiles-${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "profiles" },
        (payload: any) => {
          const sortUsers = (list: Profile[]) =>
            [...list].sort((a, b) => {
              if (!!a.is_online !== !!b.is_online) return a.is_online ? -1 : 1;
              return (b.last_seen || "").localeCompare(a.last_seen || "");
            });
          if (payload.eventType === "INSERT") {
            setUsers((prev) =>
              prev.some((u) => u.uid === payload.new.uid) ? prev : sortUsers([payload.new as Profile, ...prev])
            );
          } else if (payload.eventType === "UPDATE") {
            setUsers((prev) =>
              sortUsers(prev.map((u) => (u.uid === payload.new.uid ? { ...u, ...payload.new } : u)))
            );
          } else if (payload.eventType === "DELETE") {
            setUsers((prev) => prev.filter((u) => u.uid !== payload.old.uid));
          }
        }
      )
      .subscribe();

    // Live updates: incoming reports (rare enough that a full reload is fine)
    const reportChannel = supabase
      .channel(`admin-reports-${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "reports" },
        () => loadReports()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(profileChannel);
      supabase.removeChannel(reportChannel);
    };
  }, []);

  const filteredUsers = users.filter((u) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      u.full_name?.toLowerCase().includes(q) ||
      u.username?.toLowerCase().includes(q) ||
      u.uid?.toLowerCase().includes(q)
    );
  });

  const sendWarning = async () => {
    if (!actionTarget || !warningMessage.trim()) return;
    const { error } = await supabase.rpc("admin_send_notification", {
      content: `⚠️ Avertissement de l'équipe LoveRose : ${warningMessage.trim()}`,
      target_uid: actionTarget.uid,
    });
    if (error) {
      showToast("Erreur : " + error.message);
    } else {
      showToast(`Avertissement envoyé à ${actionTarget.full_name}`);
      setWarningMessage("");
      setActionTarget(null);
    }
  };

  const deleteUser = async (user: Profile) => {
    if (!confirm(`Supprimer définitivement le profil de ${user.full_name} ? Cette action est irréversible.`)) return;
    const { error } = await supabase.from("profiles").delete().eq("uid", user.uid);
    if (error) {
      showToast("Erreur : " + error.message);
    } else {
      showToast(`Profil de ${user.full_name} supprimé`);
      setUsers((prev) => prev.filter((u) => u.uid !== user.uid));
    }
  };

  const grantBonus = async (user: Profile, days: number) => {
    // Grant `days` of premium by inserting/extending a boost — simplest cross-cutting bonus
    const endsAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
    const { error } = await supabase.from("profile_boosts").insert({
      user_id: user.uid,
      ends_at: endsAt,
    });
    if (error) {
      showToast("Erreur : " + error.message);
    } else {
      showToast(`Boost de ${days} jour(s) offert à ${user.full_name}`);
    }
  };
  const durationToUntil = (duration: "24h" | "7d" | "30d" | "perm"): string | null => {
    if (duration === "perm") return null;
    const hours = duration === "24h" ? 24 : duration === "7d" ? 24 * 7 : 24 * 30;
    return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
  };

  const confirmSuspend = async () => {
    if (!suspendTarget) return;
    const until = durationToUntil(suspendDuration);
    const { error } = await supabase.rpc("admin_set_suspension", {
      target_uid: suspendTarget.uid,
      suspend: true,
      until,
      reason: suspendReason.trim() || null,
    });
    if (error) {
      showToast("Erreur : " + error.message);
    } else {
      showToast(`Compte de ${suspendTarget.full_name} suspendu`);
      setUsers((prev) =>
        prev.map((u) =>
          u.uid === suspendTarget.uid
            ? { ...u, is_suspended: true, suspended_until: until, suspension_reason: suspendReason.trim() || null }
            : u
        )
      );
      setSuspendTarget(null);
      setSuspendReason("");
      setSuspendDuration("7d");
    }
  };

  const reactivateUser = async (user: Profile) => {
    const { error } = await supabase.rpc("admin_set_suspension", {
      target_uid: user.uid,
      suspend: false,
      until: null,
      reason: null,
    });
    if (error) {
      showToast("Erreur : " + error.message);
    } else {
      showToast(`Compte de ${user.full_name} réactivé`);
      setUsers((prev) =>
        prev.map((u) =>
          u.uid === user.uid ? { ...u, is_suspended: false, suspended_until: null, suspension_reason: null } : u
        )
      );
    }
  };


  const toggleVerification = async (user: Profile) => {
    const next = user.verification_status === "verified" ? "none" : "verified";
    const { error } = await supabase.from("profiles").update({ verification_status: next }).eq("uid", user.uid);
    if (error) {
      showToast("Erreur : " + error.message);
    } else {
      showToast(
        next === "verified" ? `${user.full_name} est maintenant vérifié(e) ✓` : `Badge vérifié retiré à ${user.full_name}`
      );
      setUsers((prev) => prev.map((u) => (u.uid === user.uid ? { ...u, verification_status: next } : u)));
    }
  };

  const openEdit = (user: Profile) => {
    setEditTarget(user);
    setEditForm({
      full_name: user.full_name,
      bio: user.bio,
      age: user.age,
      location: user.location,
      gender: user.gender,
    });
  };

  const saveProfileEdit = async () => {
    if (!editTarget) return;
    const { error } = await supabase.from("profiles").update(editForm).eq("uid", editTarget.uid);
    if (error) {
      showToast("Erreur : " + error.message);
    } else {
      showToast(`Profil de ${editTarget.full_name} mis à jour`);
      setUsers((prev) => prev.map((u) => (u.uid === editTarget.uid ? { ...u, ...editForm } : u)));
      setEditTarget(null);
    }
  };

  const resolveReport = async (report: Report, status: "reviewed" | "dismissed") => {
    const { error } = await supabase
      .from("reports")
      .update({ status, reviewed_at: new Date().toISOString(), reviewed_by: currentUser?.id })
      .eq("id", report.id);
    if (error) {
      showToast("Erreur : " + error.message);
    } else {
      showToast(status === "reviewed" ? "Signalement marqué comme traité" : "Signalement classé sans suite");
      setReports((prev) => prev.map((r) => (r.id === report.id ? { ...r, status } : r)));
    }
  };

  const openConversations = async (user: Profile) => {
    setConvoTarget(user);
    setConvoLoading(true);
    setConvoMessages([]);
    try {
      const { data: matches, error: matchError } = await supabase
        .from("matches")
        .select("id")
        .contains("users", [user.uid]);
      if (matchError) throw matchError;
      const matchIds = (matches || []).map((m: any) => m.id);
      if (matchIds.length === 0) {
        setConvoLoading(false);
        return;
      }
      const { data: msgs, error: msgError } = await supabase
        .from("messages")
        .select("*")
        .in("match_id", matchIds)
        .order("created_at", { ascending: false })
        .limit(100);
      if (msgError) throw msgError;
      const senderIds = Array.from(new Set((msgs || []).map((m: any) => m.sender_id)));
      const namesById: Record<string, string> = {};
      if (senderIds.length > 0) {
        const { data: senders } = await supabase.from("profiles").select("uid, full_name").in("uid", senderIds);
        (senders || []).forEach((s: any) => (namesById[s.uid] = s.full_name));
      }
      setConvoMessages(
        ((msgs || []) as Message[]).map((m) => ({ ...m, senderName: namesById[m.sender_id] || "Utilisateur" }))
      );
    } catch (err: any) {
      showToast("Erreur : " + (err?.message || "impossible de charger les conversations"));
    } finally {
      setConvoLoading(false);
    }
  };

  const sendBroadcast = async () => {
    if (!broadcastMessage.trim()) return;
    setBroadcastSending(true);
    const { data, error } = await supabase.rpc("admin_send_notification", {
      content: broadcastMessage.trim(),
      target_uid: null,
    });
    setBroadcastSending(false);
    if (error) {
      showToast("Erreur : " + error.message);
    } else {
      showToast(`Annonce envoyée à ${data ?? "tous les"} utilisateur(s)`);
      setBroadcastMessage("");
      setBroadcastOpen(false);
    }
  };

  const loadStats = async () => {
    setStatsLoading(true);
    setStatsError(null);
    try {
      const { data, error } = await supabase.rpc("admin_get_stats");
      if (error) throw error;
      setStats(data as AdminStats);
    } catch (err: any) {
      setStatsError(err?.message || "Impossible de charger les statistiques.");
    } finally {
      setStatsLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-100 p-4 sticky top-0 z-20">
        <div className="flex items-center gap-2 mb-3">
          <ShieldAlert size={20} className="text-rose-500" />
          <h1 className="font-extrabold text-lg text-slate-800">Panel Admin</h1>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setTab("users")}
            className={`flex-1 flex items-center justify-center gap-1 py-2 rounded-xl text-xs sm:text-sm font-bold transition cursor-pointer ${
              tab === "users" ? "bg-rose-500 text-white" : "bg-slate-100 text-slate-600"
            }`}
          >
            <Users size={15} /> Utilisateurs ({users.length})
          </button>
          <button
            onClick={() => setTab("reports")}
            className={`flex-1 flex items-center justify-center gap-1 py-2 rounded-xl text-xs sm:text-sm font-bold transition cursor-pointer relative ${
              tab === "reports" ? "bg-rose-500 text-white" : "bg-slate-100 text-slate-600"
            }`}
          >
            <Flag size={15} /> Signalements ({reports.length})
          </button>
          <button
            onClick={() => {
              setTab("stats");
              if (!stats) loadStats();
            }}
            className={`flex-1 flex items-center justify-center gap-1 py-2 rounded-xl text-xs sm:text-sm font-bold transition cursor-pointer ${
              tab === "stats" ? "bg-rose-500 text-white" : "bg-slate-100 text-slate-600"
            }`}
          >
            <BarChart3 size={15} /> Stats
          </button>
          <button
            onClick={() => setBroadcastOpen(true)}
            title="Envoyer une annonce à tous les utilisateurs"
            className="flex items-center justify-center px-3 rounded-xl bg-indigo-100 text-indigo-600 hover:bg-indigo-200 cursor-pointer"
          >
            <Megaphone size={16} />
          </button>
        </div>
        <div className="flex items-center gap-3 mt-2.5 text-[11px] font-semibold text-slate-500">
          <span className="flex items-center gap-1">
            <Circle size={8} className="text-emerald-500 fill-emerald-500" />
            {users.filter((u) => isActuallyOnline(u)).length} connecté(s)
          </span>
          <span className="text-slate-300">·</span>
          <span>{users.length} inscrit(s)</span>
          <span className="text-slate-300">·</span>
          <span className="flex items-center gap-1 text-red-500">
            <ShieldOff size={11} />
            {users.filter((u) => u.is_suspended).length} suspendu(s)
          </span>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-xs font-semibold px-4 py-2 rounded-full z-50 shadow-lg">
          {toast}
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4">
        {tab === "users" && usersLoading ? (
          <div className="flex flex-col items-center justify-center pt-10 gap-2">
            <div className="w-8 h-8 border-4 border-rose-500 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-slate-400 text-xs font-medium">Chargement des utilisateurs...</p>
          </div>
        ) : tab === "users" && usersError ? (
          <div className="flex flex-col items-center justify-center pt-10 gap-3 text-center px-6">
            <p className="text-slate-500 text-sm font-medium">{usersError}</p>
            <button
              onClick={() => loadUsers()}
              className="bg-rose-500 hover:bg-rose-600 text-white text-sm font-bold px-5 py-2 rounded-full transition cursor-pointer"
            >
              Réessayer
            </button>
          </div>
        ) : tab === "reports" && reportsLoading ? (
          <div className="flex flex-col items-center justify-center pt-10 gap-2">
            <div className="w-8 h-8 border-4 border-rose-500 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-slate-400 text-xs font-medium">Chargement des signalements...</p>
          </div>
        ) : tab === "reports" && reportsError ? (
          <div className="flex flex-col items-center justify-center pt-10 gap-3 text-center px-6">
            <p className="text-slate-500 text-sm font-medium">{reportsError}</p>
            <button
              onClick={() => loadReports()}
              className="bg-rose-500 hover:bg-rose-600 text-white text-sm font-bold px-5 py-2 rounded-full transition cursor-pointer"
            >
              Réessayer
            </button>
          </div>
        ) : tab === "users" ? (
          <div className="space-y-3">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher un utilisateur..."
                className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-sm outline-none focus:border-rose-400"
              />
            </div>
            {filteredUsers.map((u) => (
              <div key={u.uid} className="bg-white rounded-2xl p-3 flex items-center gap-3 shadow-sm">
                <div className="relative flex-shrink-0">
                  <img
                    src={u.avatar_url || "https://via.placeholder.com/48"}
                    alt={u.full_name}
                    className="w-12 h-12 rounded-full object-cover"
                  />
                  {isActuallyOnline(u) && (
                    <Circle size={10} className="absolute bottom-0 right-0 text-emerald-500 fill-emerald-500" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm text-slate-800 truncate flex items-center gap-1.5">
                    {u.full_name} {u.role === "admin" && <span className="text-rose-500">★</span>}
                    {u.verification_status === "verified" && (
                      <BadgeCheck size={13} className="text-sky-500 flex-shrink-0" />
                    )}
                    {u.is_suspended && (
                      <span className="text-[9px] font-bold uppercase bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full">
                        Suspendu
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-slate-400 truncate">
                    {u.age ? `${u.age} ans · ` : ""}{u.gender} · {isActuallyOnline(u) ? "En ligne" : "Hors ligne"}
                  </p>
                </div>
                <div className="flex gap-1.5 flex-shrink-0 flex-wrap justify-end max-w-[160px]">
                  <button
                    onClick={() => toggleVerification(u)}
                    title={u.verification_status === "verified" ? "Retirer le badge vérifié" : "Vérifier ce profil"}
                    className={`w-8 h-8 flex items-center justify-center rounded-full cursor-pointer ${
                      u.verification_status === "verified"
                        ? "bg-sky-500 text-white hover:bg-sky-600"
                        : "bg-sky-100 text-sky-600 hover:bg-sky-200"
                    }`}
                  >
                    <BadgeCheck size={14} />
                  </button>
                  <button
                    onClick={() => openEdit(u)}
                    title="Modifier ce profil"
                    className="w-8 h-8 flex items-center justify-center bg-violet-100 text-violet-600 rounded-full cursor-pointer hover:bg-violet-200"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={() => openConversations(u)}
                    title="Voir ses conversations"
                    className="w-8 h-8 flex items-center justify-center bg-cyan-100 text-cyan-600 rounded-full cursor-pointer hover:bg-cyan-200"
                  >
                    <MessageSquare size={14} />
                  </button>
                  <button
                    onClick={() => setActionTarget(u)}
                    title="Envoyer un avertissement"
                    className="w-8 h-8 flex items-center justify-center bg-amber-100 text-amber-600 rounded-full cursor-pointer hover:bg-amber-200"
                  >
                    <Send size={14} />
                  </button>
                  <button
                    onClick={() => grantBonus(u, 7)}
                    title="Offrir 7 jours de boost"
                    className="w-8 h-8 flex items-center justify-center bg-emerald-100 text-emerald-600 rounded-full cursor-pointer hover:bg-emerald-200"
                  >
                    <Gift size={14} />
                  </button>
                  {u.uid !== currentUser?.id && (
                    <>
                      {u.is_suspended ? (
                        <button
                          onClick={() => reactivateUser(u)}
                          title="Réactiver ce compte"
                          className="w-8 h-8 flex items-center justify-center bg-blue-100 text-blue-600 rounded-full cursor-pointer hover:bg-blue-200"
                        >
                          <ShieldCheck size={14} />
                        </button>
                      ) : (
                        <button
                          onClick={() => setSuspendTarget(u)}
                          title="Suspendre ce compte"
                          className="w-8 h-8 flex items-center justify-center bg-orange-100 text-orange-600 rounded-full cursor-pointer hover:bg-orange-200"
                        >
                          <Clock size={14} />
                        </button>
                      )}
                      <button
                        onClick={() => deleteUser(u)}
                        title="Supprimer ce profil"
                        className="w-8 h-8 flex items-center justify-center bg-red-100 text-red-600 rounded-full cursor-pointer hover:bg-red-200"
                      >
                        <Trash2 size={14} />
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
            {filteredUsers.length === 0 && !loadingMore && (
              <p className="text-center text-slate-400 text-sm pt-10">Aucun utilisateur trouvé.</p>
            )}
            {filteredUsers.length === 0 && loadingMore && (
              <p className="text-center text-slate-400 text-sm pt-10">Recherche parmi les utilisateurs restants...</p>
            )}
            {loadingMore && (
              <div className="flex items-center justify-center gap-2 py-3 text-slate-400 text-xs font-medium">
                <Loader2 size={14} className="animate-spin" />
                Chargement des utilisateurs suivants...
              </div>
            )}
            {!loadingMore && usersHasMore && filteredUsers.length > 0 && (
              <button
                onClick={() => loadMoreUsers(users.length)}
                className="w-full text-center text-rose-500 text-xs font-bold py-3 cursor-pointer"
              >
                Charger plus d'utilisateurs
              </button>
            )}
          </div>
        ) : tab === "reports" ? (
          <div className="space-y-3">
            {reports.map((r) => {
              const reporter = reportProfiles[r.reporter_id] || users.find((u) => u.uid === r.reporter_id);
              const reported = reportProfiles[r.reported_id] || users.find((u) => u.uid === r.reported_id);
              return (
                <div key={r.id} className="bg-white rounded-2xl p-3 shadow-sm">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-slate-800 flex items-center gap-1 flex-wrap">
                        <span
                          onClick={() => reporter && setViewProfile(reporter)}
                          className={reporter ? "cursor-pointer hover:text-rose-500 hover:underline" : ""}
                          title={reporter ? "Voir le profil complet" : undefined}
                        >
                          {reporter?.full_name || "Utilisateur inconnu"}
                        </span>
                        <span className="text-slate-400">→</span>
                        <span
                          onClick={() => reported && setViewProfile(reported)}
                          className={reported ? "cursor-pointer hover:text-rose-500 hover:underline" : ""}
                          title={reported ? "Voir le profil complet" : undefined}
                        >
                          {reported?.full_name || "Utilisateur inconnu"}
                        </span>
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">{r.motif}</p>
                      <p className="text-[10px] text-slate-400 mt-1">
                        {new Date(r.created_at).toLocaleString("fr-FR")}
                        {r.status && r.status !== "pending" && (
                          <span
                            className={`ml-2 uppercase font-bold ${
                              r.status === "reviewed" ? "text-emerald-500" : "text-slate-400"
                            }`}
                          >
                            {r.status === "reviewed" ? "Traité" : "Classé sans suite"}
                          </span>
                        )}
                      </p>
                      {(!r.status || r.status === "pending") && (
                        <div className="flex gap-2 mt-2">
                          <button
                            onClick={() => resolveReport(r, "reviewed")}
                            className="flex items-center gap-1 text-[11px] font-bold text-emerald-600 bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1 rounded-full cursor-pointer"
                          >
                            <CheckCircle2 size={12} /> Marquer traité
                          </button>
                          <button
                            onClick={() => resolveReport(r, "dismissed")}
                            className="flex items-center gap-1 text-[11px] font-bold text-slate-500 bg-slate-100 hover:bg-slate-200 px-2.5 py-1 rounded-full cursor-pointer"
                          >
                            <XCircle size={12} /> Classer sans suite
                          </button>
                        </div>
                      )}
                    </div>
                    {reported && (
                      <div className="flex gap-1.5 flex-shrink-0">
                        <button
                          onClick={() => setViewProfile(reported)}
                          title="Voir le profil complet"
                          className="w-8 h-8 flex items-center justify-center bg-slate-100 text-slate-600 rounded-full cursor-pointer hover:bg-slate-200"
                        >
                          <Eye size={14} />
                        </button>
                        <button
                          onClick={() => openConversations(reported)}
                          title="Voir ses conversations"
                          className="w-8 h-8 flex items-center justify-center bg-cyan-100 text-cyan-600 rounded-full cursor-pointer hover:bg-cyan-200"
                        >
                          <MessageSquare size={14} />
                        </button>
                        <button
                          onClick={() => setActionTarget(reported)}
                          title="Envoyer un avertissement"
                          className="w-8 h-8 flex items-center justify-center bg-amber-100 text-amber-600 rounded-full cursor-pointer hover:bg-amber-200"
                        >
                          <Send size={14} />
                        </button>
                        {reported.is_suspended ? (
                          <button
                            onClick={() => reactivateUser(reported)}
                            title="Réactiver ce compte"
                            className="w-8 h-8 flex items-center justify-center bg-blue-100 text-blue-600 rounded-full cursor-pointer hover:bg-blue-200"
                          >
                            <ShieldCheck size={14} />
                          </button>
                        ) : (
                          <button
                            onClick={() => setSuspendTarget(reported)}
                            title="Suspendre ce compte"
                            className="w-8 h-8 flex items-center justify-center bg-orange-100 text-orange-600 rounded-full cursor-pointer hover:bg-orange-200"
                          >
                            <Clock size={14} />
                          </button>
                        )}
                        <button
                          onClick={() => deleteUser(reported)}
                          title="Supprimer ce profil"
                          className="w-8 h-8 flex items-center justify-center bg-red-100 text-red-600 rounded-full cursor-pointer hover:bg-red-200"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            {reports.length === 0 && (
              <p className="text-center text-slate-400 text-sm pt-10">Aucun signalement pour l'instant.</p>
            )}
          </div>
        ) : statsLoading ? (
          <div className="flex flex-col items-center justify-center pt-10 gap-2">
            <div className="w-8 h-8 border-4 border-rose-500 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-slate-400 text-xs font-medium">Chargement des statistiques...</p>
          </div>
        ) : statsError ? (
          <div className="flex flex-col items-center justify-center pt-10 gap-3 text-center px-6">
            <p className="text-slate-500 text-sm font-medium">{statsError}</p>
            <button
              onClick={loadStats}
              className="bg-rose-500 hover:bg-rose-600 text-white text-sm font-bold px-5 py-2 rounded-full transition cursor-pointer"
            >
              Réessayer
            </button>
          </div>
        ) : stats ? (
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Inscrits", value: stats.total_users, color: "text-slate-800" },
              { label: "Connectés maintenant", value: stats.online_now, color: "text-emerald-500" },
              { label: "Nouveaux (7 j)", value: stats.new_users_7d, color: "text-indigo-500" },
              { label: "Suspendus", value: stats.suspended, color: "text-red-500" },
              { label: "Vérifiés ✓", value: stats.verified, color: "text-sky-500" },
              { label: "Vérif. en attente", value: stats.pending_verification, color: "text-amber-500" },
              { label: "Premium actifs", value: stats.premium_active, color: "text-fuchsia-500" },
              { label: "Matches créés", value: stats.total_matches, color: "text-rose-500" },
              { label: "Messages (24h)", value: stats.messages_24h, color: "text-cyan-500" },
              { label: "Signalements en attente", value: stats.reports_pending, color: "text-orange-500" },
              { label: "Signalements (total)", value: stats.reports_total, color: "text-slate-500" },
            ].map((card) => (
              <div key={card.label} className="bg-white rounded-2xl p-4 shadow-sm">
                <p className={`text-2xl font-extrabold ${card.color}`}>{card.value}</p>
                <p className="text-[11px] font-semibold text-slate-400 mt-0.5">{card.label}</p>
              </div>
            ))}
          </div>
        ) : null}
      </div>

      {/* Warning modal */}
      {actionTarget && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-5 w-full max-w-sm">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-bold text-slate-800">Avertir {actionTarget.full_name}</h2>
              <button onClick={() => setActionTarget(null)} className="cursor-pointer">
                <X size={18} className="text-slate-400" />
              </button>
            </div>
            <textarea
              value={warningMessage}
              onChange={(e) => setWarningMessage(e.target.value)}
              placeholder="Ex: Merci de respecter les règles de la communauté..."
              rows={4}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm outline-none focus:border-rose-400 resize-none"
            />
            <button
              onClick={sendWarning}
              disabled={!warningMessage.trim()}
              className="w-full mt-3 bg-rose-500 hover:bg-rose-600 disabled:opacity-40 text-white font-bold py-2.5 rounded-xl cursor-pointer transition"
            >
              Envoyer l'avertissement
            </button>
          </div>
        </div>
      )}
      {/* Suspension modal */}
      {suspendTarget && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-5 w-full max-w-sm">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-bold text-slate-800">Suspendre {suspendTarget.full_name}</h2>
              <button onClick={() => setSuspendTarget(null)} className="cursor-pointer">
                <X size={18} className="text-slate-400" />
              </button>
            </div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Durée</p>
            <div className="grid grid-cols-4 gap-1.5 mb-3">
              {([
                { key: "24h", label: "24h" },
                { key: "7d", label: "7 j" },
                { key: "30d", label: "30 j" },
                { key: "perm", label: "Permanent" },
              ] as const).map((opt) => (
                <button
                  key={opt.key}
                  onClick={() => setSuspendDuration(opt.key)}
                  className={`py-2 rounded-xl text-xs font-bold cursor-pointer transition ${
                    suspendDuration === opt.key ? "bg-orange-500 text-white" : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <textarea
              value={suspendReason}
              onChange={(e) => setSuspendReason(e.target.value)}
              placeholder="Motif de la suspension (visible par l'utilisateur)..."
              rows={3}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm outline-none focus:border-orange-400 resize-none"
            />
            <button
              onClick={confirmSuspend}
              className="w-full mt-3 bg-orange-500 hover:bg-orange-600 text-white font-bold py-2.5 rounded-xl cursor-pointer transition"
            >
              Confirmer la suspension
            </button>
          </div>
        </div>
      )}
      {/* Edit profile modal */}
      {editTarget && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-5 w-full max-w-sm max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-bold text-slate-800">Modifier {editTarget.full_name}</h2>
              <button onClick={() => setEditTarget(null)} className="cursor-pointer">
                <X size={18} className="text-slate-400" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Nom complet</label>
                <input
                  value={editForm.full_name || ""}
                  onChange={(e) => setEditForm((f) => ({ ...f, full_name: e.target.value }))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-sm outline-none focus:border-violet-400 mt-1"
                />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Bio</label>
                <textarea
                  value={editForm.bio || ""}
                  onChange={(e) => setEditForm((f) => ({ ...f, bio: e.target.value }))}
                  rows={3}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-sm outline-none focus:border-violet-400 mt-1 resize-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Âge</label>
                  <input
                    type="number"
                    value={editForm.age ?? ""}
                    onChange={(e) => setEditForm((f) => ({ ...f, age: e.target.value ? Number(e.target.value) : undefined }))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-sm outline-none focus:border-violet-400 mt-1"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Genre</label>
                  <select
                    value={editForm.gender || ""}
                    onChange={(e) => setEditForm((f) => ({ ...f, gender: e.target.value as any }))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-sm outline-none focus:border-violet-400 mt-1"
                  >
                    <option value="">—</option>
                    <option value="homme">Homme</option>
                    <option value="femme">Femme</option>
                    <option value="autre">Autre</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Ville</label>
                <input
                  value={editForm.location || ""}
                  onChange={(e) => setEditForm((f) => ({ ...f, location: e.target.value }))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-sm outline-none focus:border-violet-400 mt-1"
                />
              </div>
            </div>
            <button
              onClick={saveProfileEdit}
              className="w-full mt-4 bg-violet-500 hover:bg-violet-600 text-white font-bold py-2.5 rounded-xl cursor-pointer transition"
            >
              Enregistrer
            </button>
          </div>
        </div>
      )}

      {/* Conversations modal (moderation) */}
      {convoTarget && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-5 w-full max-w-sm max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between mb-3 flex-shrink-0">
              <h2 className="font-bold text-slate-800">Conversations de {convoTarget.full_name}</h2>
              <button onClick={() => setConvoTarget(null)} className="cursor-pointer">
                <X size={18} className="text-slate-400" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto space-y-2">
              {convoLoading ? (
                <div className="flex flex-col items-center justify-center pt-8 gap-2">
                  <Loader2 size={24} className="text-cyan-500 animate-spin" />
                  <p className="text-slate-400 text-xs">Chargement...</p>
                </div>
              ) : convoMessages.length === 0 ? (
                <p className="text-center text-slate-400 text-sm pt-8">Aucun message trouvé.</p>
              ) : (
                convoMessages.map((m) => (
                  <div
                    key={m.id}
                    className={`p-2.5 rounded-xl text-sm ${
                      m.sender_id === convoTarget.uid ? "bg-cyan-50 text-slate-700" : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    <p className="text-[10px] font-bold text-slate-400 mb-0.5">
                      {m.senderName} · {new Date(m.created_at).toLocaleString("fr-FR")}
                    </p>
                    <p>{m.contenu || (m.message_type ? `[${m.message_type}]` : "")}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Broadcast modal */}
      {broadcastOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-5 w-full max-w-sm">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-bold text-slate-800 flex items-center gap-1.5">
                <Megaphone size={16} className="text-indigo-500" /> Annonce à tous les utilisateurs
              </h2>
              <button onClick={() => setBroadcastOpen(false)} className="cursor-pointer">
                <X size={18} className="text-slate-400" />
              </button>
            </div>
            <textarea
              value={broadcastMessage}
              onChange={(e) => setBroadcastMessage(e.target.value)}
              placeholder="Ex: Nouvelle fonctionnalité disponible, maintenance prévue..."
              rows={4}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm outline-none focus:border-indigo-400 resize-none"
            />
            <p className="text-[10px] text-slate-400 mt-1.5">
              Sera envoyé à {users.length} utilisateur(s) inscrit(s), sous forme de notification.
            </p>
            <button
              onClick={sendBroadcast}
              disabled={!broadcastMessage.trim() || broadcastSending}
              className="w-full mt-3 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-40 text-white font-bold py-2.5 rounded-xl cursor-pointer transition flex items-center justify-center gap-2"
            >
              {broadcastSending && <Loader2 size={14} className="animate-spin" />}
              {broadcastSending ? "Envoi en cours..." : "Envoyer à tous"}
            </button>
          </div>
        </div>
      )}

      {/* Full profile view - opened from a report (reporter or reported party) */}
      {viewProfile && (
        <ProfileDetailModal
          profile={viewProfile}
          currentUserProfile={null}
          currentUser={currentUser}
          isPremium={true}
          onClose={() => setViewProfile(null)}
        />
      )}
    </div>
  );
}
