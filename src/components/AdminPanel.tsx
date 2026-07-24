import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { Profile } from "../types";
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
} from "lucide-react";

interface Report {
  id: string;
  reporter_id: string;
  reported_id: string;
  motif: string;
  created_at: string;
  status?: string;
}

interface AdminPanelProps {
  currentUser: any;
}

export default function AdminPanel({ currentUser }: AdminPanelProps) {
  const [tab, setTab] = useState<"users" | "reports">("users");
  const [users, setUsers] = useState<Profile[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [search, setSearch] = useState("");
  const [usersLoading, setUsersLoading] = useState(true);
  const [reportsLoading, setReportsLoading] = useState(true);
  const [usersError, setUsersError] = useState<string | null>(null);
  const [reportsError, setReportsError] = useState<string | null>(null);
  const [actionTarget, setActionTarget] = useState<Profile | null>(null);
  const [warningMessage, setWarningMessage] = useState("");
  const [toast, setToast] = useState<string | null>(null);

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

  const loadUsers = async (retryAttempt: number = 0) => {
    setUsersLoading(true);
    setUsersError(null);
    try {
      const { data, error } = await withTimeout(
        supabase
          .from("profiles")
          .select("*")
          .order("is_online", { ascending: false })
          .order("last_seen", { ascending: false })
          .limit(200)
      );
      if (error) throw error;
      setUsers((data as Profile[]) || []);
      setUsersLoading(false);
    } catch (err: any) {
      if (err?.message === "TIMEOUT" && retryAttempt < 1) {
        loadUsers(retryAttempt + 1);
        return;
      }
      setUsersError(
        err?.message === "TIMEOUT"
          ? "Connexion trop lente pour charger les utilisateurs."
          : "Impossible de charger les utilisateurs."
      );
      setUsersLoading(false);
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
      setReports((data as Report[]) || []);
      setReportsLoading(false);
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
    loadUsers();
    loadReports();

    // Live updates: any profile change (new signup, online status, etc.)
    const profileChannel = supabase
      .channel(`admin-profiles-${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "profiles" },
        () => loadUsers()
      )
      .subscribe();

    // Live updates: incoming reports
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
    const { error } = await supabase.from("admin_messages").insert({
      recipient_id: actionTarget.uid,
      title: "Avertissement de l'équipe LoveRose",
      content: warningMessage.trim(),
      sender_badge: "admin",
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
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-bold transition cursor-pointer ${
              tab === "users" ? "bg-rose-500 text-white" : "bg-slate-100 text-slate-600"
            }`}
          >
            <Users size={15} /> Utilisateurs ({users.length})
          </button>
          <button
            onClick={() => setTab("reports")}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-bold transition cursor-pointer relative ${
              tab === "reports" ? "bg-rose-500 text-white" : "bg-slate-100 text-slate-600"
            }`}
          >
            <Flag size={15} /> Signalements ({reports.length})
          </button>
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
                  {u.is_online && (
                    <Circle size={10} className="absolute bottom-0 right-0 text-emerald-500 fill-emerald-500" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm text-slate-800 truncate">
                    {u.full_name} {u.role === "admin" && <span className="text-rose-500">★</span>}
                  </p>
                  <p className="text-xs text-slate-400 truncate">
                    {u.age ? `${u.age} ans · ` : ""}{u.gender} · {u.is_online ? "En ligne" : "Hors ligne"}
                  </p>
                </div>
                <div className="flex gap-1.5 flex-shrink-0">
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
                    <button
                      onClick={() => deleteUser(u)}
                      title="Supprimer ce profil"
                      className="w-8 h-8 flex items-center justify-center bg-red-100 text-red-600 rounded-full cursor-pointer hover:bg-red-200"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
            ))}
            {filteredUsers.length === 0 && (
              <p className="text-center text-slate-400 text-sm pt-10">Aucun utilisateur trouvé.</p>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {reports.map((r) => {
              const reporter = users.find((u) => u.uid === r.reporter_id);
              const reported = users.find((u) => u.uid === r.reported_id);
              return (
                <div key={r.id} className="bg-white rounded-2xl p-3 shadow-sm">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-slate-800">
                        {reporter?.full_name || "Utilisateur"} → {reported?.full_name || "Utilisateur"}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">{r.motif}</p>
                      <p className="text-[10px] text-slate-400 mt-1">
                        {new Date(r.created_at).toLocaleString("fr-FR")}
                      </p>
                    </div>
                    {reported && (
                      <div className="flex gap-1.5 flex-shrink-0">
                        <button
                          onClick={() => setActionTarget(reported)}
                          className="w-8 h-8 flex items-center justify-center bg-amber-100 text-amber-600 rounded-full cursor-pointer hover:bg-amber-200"
                        >
                          <Send size={14} />
                        </button>
                        <button
                          onClick={() => deleteUser(reported)}
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
        )}
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
    </div>
  );
}
