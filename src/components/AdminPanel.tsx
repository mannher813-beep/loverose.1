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
  Send,
  X,
  Circle,
  Eye,
  Clock,
  ShieldOff,
  ShieldCheck,
  BadgeCheck,
  Pencil,
  Megaphone,
  BarChart3,
  CheckCircle2,
  XCircle,
  Loader2,
  Mail,
  HeartHandshake,
  Link2,
  DollarSign,
  Navigation,
  Star,
  EyeOff,
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

interface ContactMessage {
  id: string;
  name?: string | null;
  email: string;
  subject?: string | null;
  message: string;
  status: "new" | "read" | "resolved";
  created_at: string;
}

interface PostReviewAdmin {
  id: string;
  post_id: string;
  reviewer_id: string;
  seller_id: string;
  rating: number;
  comment?: string | null;
  created_at: string;
  is_hidden?: boolean;
  hidden_reason?: string | null;
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
  pwa_install_clicks: number;
  pwa_installs_confirmed: number;
}

interface AdminPanelProps {
  currentUser: any;
}

export default function AdminPanel({ currentUser }: AdminPanelProps) {
  const [tab, setTab] = useState<"users" | "reports" | "stats" | "messages" | "campaign" | "announce" | "reviews" | "kyc">("users");
  const [users, setUsers] = useState<Profile[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [reviews, setReviews] = useState<PostReviewAdmin[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [reviewProfiles, setReviewProfiles] = useState<Record<string, Profile>>({});

  // Vérifications KYC + retraits en attente
  const [kycRequests, setKycRequests] = useState<any[]>([]);
  const [payoutRequests, setPayoutRequests] = useState<any[]>([]);
  const [kycPayoutProfiles, setKycPayoutProfiles] = useState<Record<string, Profile>>({});
  const [kycLoading, setKycLoading] = useState(false);
  const [kycDocUrls, setKycDocUrls] = useState<Record<string, Record<string, string | null>>>({});
  const [loadingDocsFor, setLoadingDocsFor] = useState<string | null>(null);
  const [reviewingId, setReviewingId] = useState<string | null>(null);
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
  // Éditeur d'annonces admin (texte + cible + bouton optionnel gratuit/payant)
  const [annMessage, setAnnMessage] = useState("");
  const [annTargetGender, setAnnTargetGender] = useState<"all" | "homme" | "femme">("all");
  const [annCtaEnabled, setAnnCtaEnabled] = useState(false);
  const [annCtaLabel, setAnnCtaLabel] = useState("");
  const [annCtaType, setAnnCtaType] = useState<"route" | "url" | "paid">("route");
  const [annCtaRoute, setAnnCtaRoute] = useState<"discover" | "dashboard" | "profile" | "settings" | "notifications" | "likes">("discover");
  const [annCtaUrl, setAnnCtaUrl] = useState("");
  const [annPriceAmount, setAnnPriceAmount] = useState("");
  const [annPaidPlanName, setAnnPaidPlanName] = useState("");
  const [annSuccessRedirectUrl, setAnnSuccessRedirectUrl] = useState("");
  const [annSending, setAnnSending] = useState(false);
  const [annConfirmText, setAnnConfirmText] = useState("");
  const [annLastResult, setAnnLastResult] = useState<{ recipients: number } | null>(null);
  const [campaignLoading, setCampaignLoading] = useState(false);
  const [campaignResult, setCampaignResult] = useState<any>(null);
  const [campaignTestEmail, setCampaignTestEmail] = useState("");
  const [campaignConfirmText, setCampaignConfirmText] = useState("");

  const invokeCampaign = async (payload: { dryRun?: boolean; testEmail?: string }) => {
    setCampaignLoading(true);
    setCampaignResult(null);
    try {
      const { data, error } = await withTimeout(
        supabase.functions.invoke("send-reengagement-campaign", { body: payload }),
        30000
      );
      if (error) throw error;
      setCampaignResult(data);
    } catch (err: any) {
      setCampaignResult({
        error: err.message === "TIMEOUT"
          ? "La requête a pris trop de temps (connexion lente ou trop d'utilisateurs à traiter). Réessayez, ou vérifiez la boîte mail malgré tout : l'envoi a peut-être quand même abouti côté serveur."
          : (err.message || "Erreur inconnue lors de l'envoi."),
      });
    } finally {
      setCampaignLoading(false);
    }
  };
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [contactMessages, setContactMessages] = useState<ContactMessage[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [messagesError, setMessagesError] = useState<string | null>(null);

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
    (async () => {
      try {
        await supabase.rpc("sync_stale_presence");
      } catch {
        // Non-critical: ignore failures silently, as before.
      }
    })();
    loadUsers();
    loadReports();
    loadContactMessages();

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


  const loadReviews = async () => {
    setReviewsLoading(true);
    try {
      // Admin's post_reviews SELECT policy (is_admin()) also returns hidden
      // reviews, which is what we want here for moderation.
      const { data, error } = await supabase
        .from("post_reviews")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      setReviews(data || []);

      const profileIds = Array.from(
        new Set((data || []).flatMap((r: PostReviewAdmin) => [r.reviewer_id, r.seller_id]))
      );
      if (profileIds.length > 0) {
        const { data: profs } = await supabase.from("profiles").select("*").in("uid", profileIds);
        const map: Record<string, Profile> = {};
        (profs || []).forEach((p: any) => { map[p.uid] = p; });
        setReviewProfiles(map);
      }
    } catch (err: any) {
      showToast("Erreur chargement des avis : " + err.message);
    } finally {
      setReviewsLoading(false);
    }
  };

  const toggleReviewHidden = async (review: PostReviewAdmin) => {
    const next = !review.is_hidden;
    let reason: string | null = review.hidden_reason || null;
    if (next) {
      reason = prompt("Motif de la censure de cet avis (optionnel) :", "") || null;
    }
    const { error } = await supabase
      .from("post_reviews")
      .update({
        is_hidden: next,
        hidden_by: next ? currentUser?.id : null,
        hidden_at: next ? new Date().toISOString() : null,
        hidden_reason: next ? reason : null,
      })
      .eq("id", review.id);
    if (error) {
      showToast("Erreur : " + error.message);
    } else {
      showToast(next ? "Avis masqué" : "Avis réaffiché");
      setReviews((prev) =>
        prev.map((r) => (r.id === review.id ? { ...r, is_hidden: next, hidden_reason: next ? reason : null } : r))
      );
    }
  };

  const loadKycQueue = async () => {
    setKycLoading(true);
    try {
      const [kycRes, payoutRes] = await Promise.all([
        supabase
          .from("creator_verification_requests")
          .select("*")
          .eq("status", "pending")
          .order("created_at", { ascending: true }),
        supabase
          .from("payout_requests")
          .select("*")
          .eq("status", "pending")
          .order("created_at", { ascending: true }),
      ]);

      if (kycRes.error) throw kycRes.error;
      if (payoutRes.error) throw payoutRes.error;

      setKycRequests(kycRes.data || []);
      setPayoutRequests(payoutRes.data || []);

      const userIds = Array.from(
        new Set([
          ...(kycRes.data || []).map((r: any) => r.user_id),
          ...(payoutRes.data || []).map((r: any) => r.user_id),
        ])
      );
      if (userIds.length > 0) {
        const { data: profs } = await supabase.from("profiles").select("*").in("uid", userIds);
        const map: Record<string, Profile> = {};
        (profs || []).forEach((p: any) => { map[p.uid] = p; });
        setKycPayoutProfiles(map);
      }
    } catch (err: any) {
      showToast("Erreur chargement des vérifications : " + err.message);
    } finally {
      setKycLoading(false);
    }
  };

  // Charge les 5 photos d'une demande KYC via URLs signées temporaires
  // (jamais de bucket public — voir functions/api/admin/kyc-signed-urls.ts).
  const viewKycDocuments = async (request: any) => {
    setLoadingDocsFor(request.id);
    try {
      const paths = [request.photo_id_front, request.photo_id_back, request.selfie_face, request.selfie_left, request.selfie_right].filter(Boolean);
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) throw new Error("Session admin invalide");

      const res = await fetch("/api/admin/kyc-signed-urls", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ paths }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Erreur serveur");
      setKycDocUrls((prev) => ({ ...prev, [request.id]: data.urls }));
    } catch (err: any) {
      showToast("Erreur chargement des documents : " + err.message);
    } finally {
      setLoadingDocsFor(null);
    }
  };

  const reviewKyc = async (request: any, decision: "approved" | "rejected") => {
    let reason: string | null = null;
    if (decision === "rejected") {
      reason = prompt("Motif du rejet (visible par le créateur) :", "") || null;
      if (reason === null) return; // annulé
    }
    setReviewingId(request.id);
    try {
      const { error } = await supabase.rpc("admin_review_kyc", { request_id: request.id, decision, reason });
      if (error) throw error;
      showToast(decision === "approved" ? "✅ Identité validée" : "Identité rejetée");
      setKycRequests((prev) => prev.filter((r) => r.id !== request.id));
    } catch (err: any) {
      showToast("Erreur : " + err.message);
    } finally {
      setReviewingId(null);
    }
  };

  const reviewPayout = async (payout: any, decision: "approved" | "rejected") => {
    let reason: string | null = null;
    if (decision === "rejected") {
      reason = prompt("Motif du rejet (les fonds seront recrédités) :", "") || null;
      if (reason === null) return;
    }
    setReviewingId(payout.id);
    try {
      const { error } = await supabase.rpc("admin_review_payout", { payout_id: payout.id, decision, reason });
      if (error) throw error;
      showToast(decision === "approved" ? "✅ Retrait validé" : "Retrait rejeté, fonds recrédités");
      setPayoutRequests((prev) => prev.filter((p) => p.id !== payout.id));
    } catch (err: any) {
      showToast("Erreur : " + err.message);
    } finally {
      setReviewingId(null);
    }
  };

  const toggleShadowBan = async (user: Profile) => {
    const next = !user.is_hidden_from_feed;
    const { error } = await supabase.from("profiles").update({ is_hidden_from_feed: next }).eq("uid", user.uid);
    if (error) {
      showToast("Erreur : " + error.message);
    } else {
      showToast(next ? `Annonces de ${user.full_name} masquées du fil` : `Annonces de ${user.full_name} de nouveau visibles`);
      setUsers((prev) => prev.map((u) => (u.uid === user.uid ? { ...u, is_hidden_from_feed: next } : u)));
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

  const annRecipientCount = () => {
    if (annTargetGender === "all") return users.length;
    return users.filter((u) => u.gender === annTargetGender).length;
  };

  const resetAnnouncementForm = () => {
    setAnnMessage("");
    setAnnTargetGender("all");
    setAnnCtaEnabled(false);
    setAnnCtaLabel("");
    setAnnCtaType("route");
    setAnnCtaRoute("discover");
    setAnnCtaUrl("");
    setAnnPriceAmount("");
    setAnnPaidPlanName("");
    setAnnSuccessRedirectUrl("");
    setAnnConfirmText("");
  };

  const sendAnnouncement = async () => {
    if (!annMessage.trim()) return;
    if (annConfirmText.trim() !== "ENVOYER") return;

    // Validation minimale du bouton avant envoi, pour éviter une annonce cassée
    if (annCtaEnabled) {
      if (!annCtaLabel.trim()) {
        showToast("Erreur : donnez un libellé au bouton.");
        return;
      }
      if (annCtaType === "url" && !annCtaUrl.trim()) {
        showToast("Erreur : renseignez le lien externe du bouton.");
        return;
      }
      if (annCtaType === "paid") {
        if (!annPriceAmount || Number(annPriceAmount) <= 0) {
          showToast("Erreur : renseignez un prix valide (FCFA).");
          return;
        }
        if (!annPaidPlanName.trim()) {
          showToast("Erreur : donnez un nom au produit payant (affiché sur l'écran de paiement).");
          return;
        }
        if (!annSuccessRedirectUrl.trim()) {
          showToast("Erreur : renseignez le lien de redirection après paiement.");
          return;
        }
      }
    }

    setAnnSending(true);
    try {
      const { data: created, error: createErr } = await supabase
        .from("admin_announcements")
        .insert({
          message: annMessage.trim(),
          target_gender: annTargetGender,
          cta_enabled: annCtaEnabled,
          cta_label: annCtaEnabled ? annCtaLabel.trim() : null,
          cta_type: annCtaEnabled ? annCtaType : null,
          cta_route: annCtaEnabled && annCtaType === "route" ? annCtaRoute : null,
          cta_url: annCtaEnabled && annCtaType === "url" ? annCtaUrl.trim() : null,
          is_paid: annCtaEnabled && annCtaType === "paid",
          price_amount: annCtaEnabled && annCtaType === "paid" ? Number(annPriceAmount) : null,
          paid_plan_name: annCtaEnabled && annCtaType === "paid" ? annPaidPlanName.trim() : null,
          success_redirect_url: annCtaEnabled && annCtaType === "paid" ? annSuccessRedirectUrl.trim() : null,
        })
        .select()
        .single();

      if (createErr) throw createErr;

      const { data: recipients, error: sendErr } = await supabase.rpc("admin_send_announcement", {
        p_announcement_id: created.id,
      });

      if (sendErr) throw sendErr;

      setAnnLastResult({ recipients: recipients ?? 0 });
      showToast(`Annonce envoyée à ${recipients ?? 0} utilisateur(s)`);
      resetAnnouncementForm();
    } catch (err: any) {
      showToast("Erreur : " + (err?.message || "envoi impossible"));
    } finally {
      setAnnSending(false);
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

  const loadContactMessages = async () => {
    setMessagesLoading(true);
    setMessagesError(null);
    try {
      const { data, error } = await supabase
        .from("contact_messages")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      setContactMessages((data as ContactMessage[]) || []);
    } catch (err: any) {
      setMessagesError(err?.message || "Impossible de charger les messages.");
    } finally {
      setMessagesLoading(false);
    }
  };

  const updateMessageStatus = async (msg: ContactMessage, status: "read" | "resolved") => {
    const { error } = await supabase.from("contact_messages").update({ status }).eq("id", msg.id);
    if (error) {
      showToast("Erreur : " + error.message);
    } else {
      setContactMessages((prev) => prev.map((m) => (m.id === msg.id ? { ...m, status } : m)));
    }
  };

  const tabButtonClass = (isActive: boolean) =>
    `flex-shrink-0 flex items-center justify-center gap-1.5 py-2.5 px-1 text-xs sm:text-sm font-bold transition-colors cursor-pointer whitespace-nowrap border-b-2 ${
      isActive ? "text-white border-indigo-400" : "text-slate-400 border-transparent hover:text-slate-200"
    }`;

  const countBadgeClass = (isActive: boolean) =>
    `font-mono text-[10px] px-1.5 py-0.5 rounded-md ${
      isActive ? "bg-indigo-400/20 text-indigo-200" : "bg-white/5 text-slate-500"
    }`;

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-50">
      {/* Console header — deliberately distinct from the app's rose consumer
          chrome, so it's unmistakable which surface you're on. */}
      <div className="bg-gradient-to-b from-slate-900 to-slate-950 sticky top-0 z-20 shadow-lg shadow-slate-900/10">
        <div className="p-4 pb-0">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 rounded-lg bg-indigo-500/15 border border-indigo-400/20 flex items-center justify-center">
              <ShieldAlert size={14} className="text-indigo-300" />
            </div>
            <h1 className="font-extrabold text-base text-white tracking-tight">Panel Admin</h1>
            <span className="flex items-center gap-1.5 ml-auto font-mono text-[10px] text-slate-500">
              <Circle size={6} className="text-emerald-400 fill-emerald-400 animate-pulse" />
              {users.filter((u) => isActuallyOnline(u)).length} en ligne
            </span>
          </div>

          <div className="flex items-center gap-4 overflow-x-auto -mx-1 px-1 [scrollbar-width:none]">
            <button onClick={() => setTab("users")} className={tabButtonClass(tab === "users")}>
              <Users size={14} /> Utilisateurs
              <span className={countBadgeClass(tab === "users")}>{users.length}</span>
            </button>
            <button onClick={() => setTab("reports")} className={tabButtonClass(tab === "reports")}>
              <Flag size={14} /> Signalements
              <span className={countBadgeClass(tab === "reports")}>{reports.length}</span>
            </button>
            <button
              onClick={() => {
                setTab("messages");
                if (contactMessages.length === 0) loadContactMessages();
              }}
              className={tabButtonClass(tab === "messages")}
            >
              <Mail size={14} /> Messages
              {contactMessages.filter((m) => m.status === "new").length > 0 && (
                <span className="font-mono text-[10px] px-1.5 py-0.5 rounded-md bg-rose-500/20 text-rose-300">
                  {contactMessages.filter((m) => m.status === "new").length}
                </span>
              )}
            </button>
            <button
              onClick={() => {
                setTab("stats");
                if (!stats) loadStats();
              }}
              className={tabButtonClass(tab === "stats")}
            >
              <BarChart3 size={14} /> Stats
            </button>
            <button onClick={() => setTab("campaign")} className={tabButtonClass(tab === "campaign")}>
              <HeartHandshake size={14} /> Campagne
            </button>
            <button
              onClick={() => {
                setTab("kyc");
                if (kycRequests.length === 0 && payoutRequests.length === 0) loadKycQueue();
              }}
              className={tabButtonClass(tab === "kyc")}
            >
              <ShieldCheck size={14} /> Vérifications
              {kycRequests.length + payoutRequests.length > 0 && (
                <span className={countBadgeClass(tab === "kyc")}>{kycRequests.length + payoutRequests.length}</span>
              )}
            </button>
            <button
              onClick={() => {
                setTab("reviews");
                if (reviews.length === 0) loadReviews();
              }}
              className={tabButtonClass(tab === "reviews")}
            >
              <Star size={14} /> Avis
              {reviews.filter((r) => r.is_hidden).length > 0 && (
                <span className={countBadgeClass(tab === "reviews")}>{reviews.filter((r) => r.is_hidden).length}</span>
              )}
            </button>

            <button
              onClick={() => setTab("announce")}
              className={`flex-shrink-0 flex items-center gap-1.5 py-1.5 px-3 my-1.5 sm:ml-auto rounded-full border text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
                tab === "announce"
                  ? "border-indigo-400/60 text-indigo-200 bg-indigo-400/15"
                  : "border-indigo-400/30 text-indigo-300 hover:bg-indigo-400/10 hover:border-indigo-400/50"
              }`}
            >
              <Megaphone size={13} /> Annonce
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3 mt-2 px-4 py-2 text-[11px] font-mono text-slate-500 border-t border-white/5">
          <span>{users.length} inscrit(s)</span>
          <span className="text-slate-700">·</span>
          <span className="flex items-center gap-1 text-rose-400">
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
                    {u.is_hidden_from_feed && (
                      <span className="text-[9px] font-bold uppercase bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded-full">
                        Masqué du fil
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
                    onClick={() => setActionTarget(u)}
                    title="Envoyer un avertissement"
                    className="w-8 h-8 flex items-center justify-center bg-amber-100 text-amber-600 rounded-full cursor-pointer hover:bg-amber-200"
                  >
                    <Send size={14} />
                  </button>
                  {u.uid !== currentUser?.id && (
                    <>
                      <button
                        onClick={() => toggleShadowBan(u)}
                        title={u.is_hidden_from_feed ? "Réafficher ses annonces dans le fil" : "Masquer ses annonces du fil (censure légère)"}
                        className={`w-8 h-8 flex items-center justify-center rounded-full cursor-pointer ${
                          u.is_hidden_from_feed
                            ? "bg-slate-700 text-white hover:bg-slate-800"
                            : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                        }`}
                      >
                        {u.is_hidden_from_feed ? <Eye size={14} /> : <ShieldOff size={14} />}
                      </button>
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
        ) : tab === "messages" ? (
          messagesLoading ? (
            <div className="flex flex-col items-center justify-center pt-10 gap-2">
              <div className="w-8 h-8 border-4 border-rose-500 border-t-transparent rounded-full animate-spin"></div>
              <p className="text-slate-400 text-xs font-medium">Chargement des messages...</p>
            </div>
          ) : messagesError ? (
            <div className="flex flex-col items-center justify-center pt-10 gap-3 text-center px-6">
              <p className="text-slate-500 text-sm font-medium">{messagesError}</p>
              <button
                onClick={loadContactMessages}
                className="bg-rose-500 hover:bg-rose-600 text-white text-sm font-bold px-5 py-2 rounded-full transition cursor-pointer"
              >
                Réessayer
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {contactMessages.map((m) => (
                <div key={m.id} className="bg-white rounded-2xl p-3.5 shadow-sm space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-slate-800 truncate">
                        {m.name || "Anonyme"} <span className="text-slate-400 font-medium">· {m.email}</span>
                      </p>
                      {m.subject && <p className="text-xs text-rose-500 font-semibold mt-0.5">{m.subject}</p>}
                    </div>
                    <span
                      className={`flex-shrink-0 text-[9px] font-bold uppercase px-2 py-1 rounded-full ${
                        m.status === "new"
                          ? "bg-red-100 text-red-600"
                          : m.status === "read"
                          ? "bg-amber-100 text-amber-600"
                          : "bg-emerald-100 text-emerald-600"
                      }`}
                    >
                      {m.status === "new" ? "Nouveau" : m.status === "read" ? "Lu" : "Résolu"}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 whitespace-pre-wrap">{m.message}</p>
                  <div className="flex items-center justify-between pt-1">
                    <p className="text-[10px] text-slate-400">{new Date(m.created_at).toLocaleString("fr-FR")}</p>
                    <div className="flex gap-1.5">
                      <a
                        href={`mailto:${m.email}`}
                        className="flex items-center gap-1 text-[11px] font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 px-2.5 py-1 rounded-full cursor-pointer"
                      >
                        <Send size={11} /> Répondre
                      </a>
                      {m.status !== "resolved" && (
                        <button
                          onClick={() => updateMessageStatus(m, m.status === "new" ? "read" : "resolved")}
                          className="flex items-center gap-1 text-[11px] font-bold text-emerald-600 bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1 rounded-full cursor-pointer"
                        >
                          <CheckCircle2 size={11} /> {m.status === "new" ? "Marquer lu" : "Marquer résolu"}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              {contactMessages.length === 0 && (
                <p className="text-center text-slate-400 text-sm pt-10">Aucun message pour l'instant.</p>
              )}
            </div>
          )
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
              { label: "Matches créés", value: stats.total_matches, color: "text-rose-500" },
              { label: "Signalements en attente", value: stats.reports_pending, color: "text-orange-500" },
              { label: "Signalements (total)", value: stats.reports_total, color: "text-slate-500" },
              { label: "Clics sur \"Installer l'app\"", value: stats.pwa_install_clicks, color: "text-teal-500" },
              { label: "Installations confirmées", value: stats.pwa_installs_confirmed, color: "text-green-600" },
            ].map((card) => (
              <div key={card.label} className="bg-white rounded-2xl p-4 shadow-sm">
                <p className={`text-2xl font-extrabold ${card.color}`}>{card.value}</p>
                <p className="text-[11px] font-semibold text-slate-400 mt-0.5">{card.label}</p>
              </div>
            ))}
          </div>
        ) : tab === "campaign" ? (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl p-4 shadow-sm space-y-2">
              <div className="flex items-center gap-2">
                <HeartHandshake size={18} className="text-rose-500" />
                <h2 className="font-extrabold text-slate-800">Campagne de relance par email</h2>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                Envoie un email personnalisé (likes reçus avec photos, matchs en attente, nouveautés) à tous les
                utilisateurs inscrits qui ont un email confirmé et n'ont pas demandé à se désinscrire.
              </p>
            </div>

            <div className="bg-white rounded-2xl p-4 shadow-sm space-y-3">
              <p className="text-xs font-extrabold text-slate-500 uppercase tracking-wider">1. Aperçu (aucun email envoyé)</p>
              <button
                onClick={() => invokeCampaign({ dryRun: true })}
                disabled={campaignLoading}
                className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {campaignLoading ? <Loader2 size={14} className="animate-spin" /> : null}
                Voir combien de personnes seraient contactées
              </button>
            </div>

            <div className="bg-white rounded-2xl p-4 shadow-sm space-y-3">
              <p className="text-xs font-extrabold text-slate-500 uppercase tracking-wider">2. Recevoir un email de test</p>
              <div className="flex gap-2">
                <input
                  type="email"
                  value={campaignTestEmail}
                  onChange={(e) => setCampaignTestEmail(e.target.value)}
                  placeholder="votre@email.com"
                  className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-medium outline-none focus:border-rose-400"
                />
                <button
                  onClick={() => invokeCampaign({ testEmail: campaignTestEmail, dryRun: false })}
                  disabled={campaignLoading || !campaignTestEmail.trim()}
                  className="px-4 bg-slate-800 hover:bg-slate-900 disabled:opacity-40 text-white font-bold text-xs rounded-xl transition cursor-pointer whitespace-nowrap flex items-center gap-2"
                >
                  {campaignLoading ? <Loader2 size={14} className="animate-spin" /> : null}
                  {campaignLoading ? "Envoi..." : "Envoyer le test"}
                </button>
              </div>
              <p className="text-[11px] text-slate-400">Reprend les vraies données du premier utilisateur éligible, envoyées uniquement à cette adresse.</p>
            </div>

            <div className="bg-white rounded-2xl p-4 shadow-sm space-y-3 border-2 border-rose-100">
              <p className="text-xs font-extrabold text-rose-500 uppercase tracking-wider">3. Envoyer à tous les utilisateurs</p>
              <p className="text-[11px] text-slate-500">
                Tapez <span className="font-mono font-bold">ENVOYER</span> pour confirmer, puis cliquez sur le bouton. Cette action envoie un vrai email à chaque utilisateur éligible.
              </p>
              <input
                type="text"
                value={campaignConfirmText}
                onChange={(e) => setCampaignConfirmText(e.target.value)}
                placeholder="ENVOYER"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold outline-none focus:border-rose-400"
              />
              <button
                onClick={() => {
                  if (campaignConfirmText.trim() !== "ENVOYER") return;
                  invokeCampaign({ dryRun: false });
                  setCampaignConfirmText("");
                }}
                disabled={campaignLoading || campaignConfirmText.trim() !== "ENVOYER"}
                className="w-full py-3 bg-rose-500 hover:bg-rose-600 disabled:opacity-40 text-white font-extrabold text-xs rounded-xl transition cursor-pointer flex items-center justify-center gap-2"
              >
                {campaignLoading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                Envoyer la campagne à tous les utilisateurs
              </button>
            </div>

            {campaignResult && (
              <div className="bg-white rounded-2xl p-4 shadow-sm space-y-2">
                {campaignResult.error ? (
                  <p className="text-xs font-bold text-red-500">{campaignResult.error}</p>
                ) : (
                  <>
                    <p className="text-xs font-bold text-slate-700">
                      {campaignResult.dryRun ? "Aperçu" : "Résultat de l'envoi"} — {campaignResult.totalEligible} éligible(s)
                      {typeof campaignResult.sent === "number" && `, ${campaignResult.sent} envoyé(s)`}
                      {typeof campaignResult.failed === "number" && campaignResult.failed > 0 && `, ${campaignResult.failed} échec(s)`}
                    </p>
                    {(campaignResult.results || [])
                      .filter((r: any) => r.status === "failed")
                      .slice(0, 5)
                      .map((r: any, i: number) => (
                        <p key={i} className="text-[10px] text-red-400">{r.email}: {r.error}</p>
                      ))}
                  </>
                )}
              </div>
            )}
          </div>
        ) : tab === "kyc" ? (
          <div className="space-y-5">
            {kycLoading ? (
              <div className="flex items-center gap-2 text-slate-400 text-sm pt-10 justify-center">
                <Loader2 size={16} className="animate-spin" /> Chargement...
              </div>
            ) : (
              <>
                {/* Demandes de vérification d'identité */}
                <div className="space-y-2">
                  <h3 className="text-xs font-black text-slate-500 uppercase tracking-wide px-1">
                    Identités à vérifier ({kycRequests.length})
                  </h3>
                  {kycRequests.length === 0 ? (
                    <p className="text-center text-slate-400 text-sm py-6 bg-white rounded-2xl">Aucune demande en attente.</p>
                  ) : (
                    kycRequests.map((r) => {
                      const profile = kycPayoutProfiles[r.user_id];
                      const docs = kycDocUrls[r.id];
                      const docSlots: { key: string; label: string }[] = [
                        { key: r.photo_id_front, label: "ID recto" },
                        { key: r.photo_id_back, label: "ID verso" },
                        { key: r.selfie_face, label: "Selfie face" },
                        { key: r.selfie_left, label: "Selfie gauche" },
                        { key: r.selfie_right, label: "Selfie droite" },
                      ].filter((d) => d.key);
                      return (
                        <div key={r.id} className="bg-white rounded-2xl p-3.5 shadow-sm space-y-2.5">
                          <div className="flex items-center justify-between gap-2">
                            <div>
                              <p className="text-xs font-bold text-slate-800">{r.full_name} <span className="text-slate-400 font-normal">— {profile?.username || "?"}</span></p>
                              <p className="text-[10px] text-slate-400">Pièce n° {r.id_number} · {r.city}</p>
                            </div>
                            <span className="text-[9px] font-bold uppercase bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full flex-shrink-0">En attente</span>
                          </div>

                          {!docs ? (
                            <button
                              onClick={() => viewKycDocuments(r)}
                              disabled={loadingDocsFor === r.id}
                              className="text-[11px] font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
                            >
                              {loadingDocsFor === r.id ? <Loader2 size={12} className="animate-spin" /> : <Eye size={12} />}
                              Voir les {docSlots.length} documents
                            </button>
                          ) : (
                            <div className="grid grid-cols-5 gap-1.5">
                              {docSlots.map((d) => (
                                <a key={d.key} href={docs[d.key] || "#"} target="_blank" rel="noreferrer" className="block">
                                  {docs[d.key] ? (
                                    <img src={docs[d.key]!} alt={d.label} className="w-full aspect-[3/4] object-cover rounded-lg border border-slate-200" />
                                  ) : (
                                    <div className="w-full aspect-[3/4] rounded-lg border border-slate-200 bg-slate-100 flex items-center justify-center text-[8px] text-slate-400 text-center p-1">
                                      Indisponible
                                    </div>
                                  )}
                                  <p className="text-[7px] text-slate-400 text-center mt-0.5">{d.label}</p>
                                </a>
                              ))}
                            </div>
                          )}

                          <div className="flex gap-2 pt-1">
                            <button
                              onClick={() => reviewKyc(r, "rejected")}
                              disabled={reviewingId === r.id}
                              className="flex-1 py-2 border border-slate-200 hover:bg-slate-50 text-slate-500 font-bold rounded-xl text-[11px] flex items-center justify-center gap-1 disabled:opacity-50"
                            >
                              <XCircle size={13} /> Rejeter
                            </button>
                            <button
                              onClick={() => reviewKyc(r, "approved")}
                              disabled={reviewingId === r.id}
                              className="flex-1 py-2 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl text-[11px] flex items-center justify-center gap-1 disabled:opacity-50"
                            >
                              {reviewingId === r.id ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />} Valider
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Demandes de retrait */}
                <div className="space-y-2">
                  <h3 className="text-xs font-black text-slate-500 uppercase tracking-wide px-1">
                    Retraits à valider ({payoutRequests.length})
                  </h3>
                  {payoutRequests.length === 0 ? (
                    <p className="text-center text-slate-400 text-sm py-6 bg-white rounded-2xl">Aucune demande en attente.</p>
                  ) : (
                    payoutRequests.map((p) => {
                      const profile = kycPayoutProfiles[p.user_id];
                      return (
                        <div key={p.id} className="bg-white rounded-2xl p-3.5 shadow-sm flex items-center justify-between gap-2">
                          <div>
                            <p className="text-xs font-bold text-slate-800 flex items-center gap-1">
                              <DollarSign size={12} className="text-emerald-500" /> {p.requested_amount} FCFA
                            </p>
                            <p className="text-[10px] text-slate-400">{profile?.full_name || "?"} · {profile?.username || p.user_id?.slice(0, 8)}</p>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => reviewPayout(p, "rejected")}
                              disabled={reviewingId === p.id}
                              className="p-2 border border-slate-200 hover:bg-slate-50 text-slate-500 rounded-full disabled:opacity-50"
                            >
                              <XCircle size={14} />
                            </button>
                            <button
                              onClick={() => reviewPayout(p, "approved")}
                              disabled={reviewingId === p.id}
                              className="p-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-full disabled:opacity-50"
                            >
                              {reviewingId === p.id ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </>
            )}
          </div>
        ) : tab === "reviews" ? (
          <div className="space-y-3">
            {reviewsLoading ? (
              <div className="flex items-center gap-2 text-slate-400 text-sm pt-10 justify-center">
                <Loader2 size={16} className="animate-spin" /> Chargement des avis...
              </div>
            ) : reviews.length === 0 ? (
              <p className="text-center text-slate-400 text-sm pt-10">Aucun avis pour l'instant.</p>
            ) : (
              reviews.map((r) => {
                const reviewer = reviewProfiles[r.reviewer_id];
                const seller = reviewProfiles[r.seller_id];
                return (
                  <div key={r.id} className={`bg-white rounded-2xl p-3.5 shadow-sm space-y-2 ${r.is_hidden ? "opacity-60" : ""}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-800 flex items-center gap-1 flex-wrap">
                          <span
                            onClick={() => reviewer && setViewProfile(reviewer)}
                            className={reviewer ? "cursor-pointer hover:text-rose-500 hover:underline" : ""}
                          >
                            {reviewer?.full_name || "Acheteur inconnu"}
                          </span>
                          <span className="text-slate-400">→</span>
                          <span
                            onClick={() => seller && setViewProfile(seller)}
                            className={seller ? "cursor-pointer hover:text-rose-500 hover:underline" : ""}
                          >
                            {seller?.full_name || "Vendeur inconnu"}
                          </span>
                          {r.is_hidden && (
                            <span className="text-[9px] font-bold uppercase bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded-full">
                              Masqué
                            </span>
                          )}
                        </p>
                        <div className="flex items-center gap-0.5 mt-1">
                          {[1, 2, 3, 4, 5].map((n) => (
                            <Star key={n} size={11} className={n <= r.rating ? "text-amber-400 fill-amber-400" : "text-slate-200 fill-slate-200"} />
                          ))}
                        </div>
                        {r.comment && <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">{r.comment}</p>}
                        {r.is_hidden && r.hidden_reason && (
                          <p className="text-[10px] text-slate-400 mt-1 italic">Motif : {r.hidden_reason}</p>
                        )}
                        <p className="text-[10px] text-slate-400 mt-1">{new Date(r.created_at).toLocaleString("fr-FR")}</p>
                      </div>
                      <button
                        onClick={() => toggleReviewHidden(r)}
                        title={r.is_hidden ? "Réafficher cet avis" : "Masquer cet avis"}
                        className={`w-8 h-8 flex-shrink-0 flex items-center justify-center rounded-full cursor-pointer ${
                          r.is_hidden ? "bg-slate-700 text-white hover:bg-slate-800" : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                        }`}
                      >
                        {r.is_hidden ? <Eye size={14} /> : <EyeOff size={14} />}
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        ) : tab === "announce" ? (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl p-4 shadow-sm space-y-2">
              <div className="flex items-center gap-2">
                <Megaphone size={18} className="text-indigo-500" />
                <h2 className="font-extrabold text-slate-800">Créateur d'annonces</h2>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                Envoie une notification personnalisée à une partie ou à tous les utilisateurs, avec un bouton optionnel
                (accès à une fonctionnalité, lien externe, ou accès payant via Money Fusion).
              </p>
            </div>

            {/* 1. Message */}
            <div className="bg-white rounded-2xl p-4 shadow-sm space-y-3">
              <p className="text-xs font-extrabold text-slate-500 uppercase tracking-wider">1. Message</p>
              <textarea
                value={annMessage}
                onChange={(e) => setAnnMessage(e.target.value)}
                placeholder="Ex: Nouvelle fonctionnalité disponible, maintenance prévue..."
                rows={3}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm outline-none focus:border-indigo-400 resize-none"
              />
            </div>

            {/* 2. Cible */}
            <div className="bg-white rounded-2xl p-4 shadow-sm space-y-3">
              <p className="text-xs font-extrabold text-slate-500 uppercase tracking-wider">2. Cible</p>
              <div className="grid grid-cols-3 gap-2">
                {(["all", "homme", "femme"] as const).map((g) => (
                  <button
                    key={g}
                    onClick={() => setAnnTargetGender(g)}
                    className={`py-2.5 rounded-xl text-xs font-bold border transition cursor-pointer ${
                      annTargetGender === g
                        ? "bg-indigo-500 border-indigo-500 text-white"
                        : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    {g === "all" ? "Tout le monde" : g === "homme" ? "Hommes" : "Femmes"}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-slate-400">
                Sera envoyé à {annRecipientCount()} utilisateur(s) sur {users.length} inscrit(s).
              </p>
            </div>

            {/* 3. Bouton optionnel */}
            <div className="bg-white rounded-2xl p-4 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-extrabold text-slate-500 uppercase tracking-wider">3. Bouton (optionnel)</p>
                <button
                  onClick={() => setAnnCtaEnabled((v) => !v)}
                  className={`w-11 h-6 rounded-full transition relative cursor-pointer ${annCtaEnabled ? "bg-indigo-500" : "bg-slate-200"}`}
                >
                  <span
                    className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                      annCtaEnabled ? "translate-x-5" : "translate-x-0.5"
                    }`}
                  />
                </button>
              </div>

              {annCtaEnabled && (
                <div className="space-y-3 pt-1">
                  <input
                    type="text"
                    value={annCtaLabel}
                    onChange={(e) => setAnnCtaLabel(e.target.value)}
                    placeholder="Texte du bouton (ex: Rejoindre le groupe VIP)"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-semibold outline-none focus:border-indigo-400"
                  />

                  <div className="grid grid-cols-3 gap-2">
                    <button
                      onClick={() => setAnnCtaType("route")}
                      className={`flex flex-col items-center gap-1 py-2.5 rounded-xl text-[10px] font-bold border transition cursor-pointer ${
                        annCtaType === "route" ? "bg-indigo-50 border-indigo-300 text-indigo-600" : "bg-slate-50 border-slate-200 text-slate-500"
                      }`}
                    >
                      <Navigation size={14} /> Écran de l'app
                    </button>
                    <button
                      onClick={() => setAnnCtaType("url")}
                      className={`flex flex-col items-center gap-1 py-2.5 rounded-xl text-[10px] font-bold border transition cursor-pointer ${
                        annCtaType === "url" ? "bg-indigo-50 border-indigo-300 text-indigo-600" : "bg-slate-50 border-slate-200 text-slate-500"
                      }`}
                    >
                      <Link2 size={14} /> Lien externe
                    </button>
                    <button
                      onClick={() => setAnnCtaType("paid")}
                      className={`flex flex-col items-center gap-1 py-2.5 rounded-xl text-[10px] font-bold border transition cursor-pointer ${
                        annCtaType === "paid" ? "bg-emerald-50 border-emerald-300 text-emerald-600" : "bg-slate-50 border-slate-200 text-slate-500"
                      }`}
                    >
                      <DollarSign size={14} /> Payant
                    </button>
                  </div>

                  {annCtaType === "route" && (
                    <select
                      value={annCtaRoute}
                      onChange={(e) => setAnnCtaRoute(e.target.value as any)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-semibold outline-none focus:border-indigo-400"
                    >
                      <option value="discover">Annonces</option>
                      <option value="dashboard">Dashboard</option>
                      <option value="likes">Qui m'a aimé</option>
                      <option value="notifications">Notifications</option>
                      <option value="profile">Mon profil</option>
                      <option value="settings">Paramètres</option>
                    </select>
                  )}

                  {annCtaType === "url" && (
                    <input
                      type="url"
                      value={annCtaUrl}
                      onChange={(e) => setAnnCtaUrl(e.target.value)}
                      placeholder="https://..."
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-semibold outline-none focus:border-indigo-400"
                    />
                  )}

                  {annCtaType === "paid" && (
                    <div className="space-y-2.5 bg-emerald-50/40 border border-emerald-100 rounded-xl p-3">
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase">Prix (FCFA)</label>
                        <input
                          type="number"
                          min={1}
                          value={annPriceAmount}
                          onChange={(e) => setAnnPriceAmount(e.target.value)}
                          placeholder="1000"
                          className="w-full mt-1 bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-semibold outline-none focus:border-emerald-400"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase">Nom du produit (écran de paiement)</label>
                        <input
                          type="text"
                          value={annPaidPlanName}
                          onChange={(e) => setAnnPaidPlanName(e.target.value)}
                          placeholder="Ex: Accès Groupe WhatsApp VIP"
                          className="w-full mt-1 bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-semibold outline-none focus:border-emerald-400"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase">Lien après paiement confirmé</label>
                        <input
                          type="url"
                          value={annSuccessRedirectUrl}
                          onChange={(e) => setAnnSuccessRedirectUrl(e.target.value)}
                          placeholder="Ex: https://chat.whatsapp.com/..."
                          className="w-full mt-1 bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-semibold outline-none focus:border-emerald-400"
                        />
                        <p className="text-[10px] text-slate-400 mt-1">
                          L'utilisateur y sera envoyé automatiquement juste après confirmation du paiement Money Fusion.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 4. Aperçu */}
            <div className="bg-white rounded-2xl p-4 shadow-sm space-y-2">
              <p className="text-xs font-extrabold text-slate-500 uppercase tracking-wider">4. Aperçu</p>
              <div className="border border-slate-150 rounded-2xl p-3 bg-slate-50/50 space-y-2">
                <p className="text-xs text-slate-700 font-medium leading-relaxed">
                  {annMessage.trim() || "Votre message apparaîtra ici..."}
                </p>
                {annCtaEnabled && annCtaLabel.trim() && (
                  <button
                    disabled
                    className={`w-full py-2 rounded-lg text-[11px] font-bold ${
                      annCtaType === "paid" ? "bg-emerald-500" : "bg-indigo-500"
                    } text-white`}
                  >
                    {annCtaLabel}
                    {annCtaType === "paid" && annPriceAmount ? ` · ${annPriceAmount} FCFA` : ""}
                  </button>
                )}
              </div>
            </div>

            {/* 5. Envoi */}
            <div className="bg-white rounded-2xl p-4 shadow-sm space-y-3 border-2 border-rose-100">
              <p className="text-xs font-extrabold text-rose-500 uppercase tracking-wider">5. Envoyer</p>
              <p className="text-[11px] text-slate-500">
                Tapez <span className="font-mono font-bold">ENVOYER</span> pour confirmer, puis cliquez sur le bouton.
              </p>
              <input
                type="text"
                value={annConfirmText}
                onChange={(e) => setAnnConfirmText(e.target.value)}
                placeholder="ENVOYER"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold outline-none focus:border-rose-400"
              />
              <button
                onClick={sendAnnouncement}
                disabled={annSending || !annMessage.trim() || annConfirmText.trim() !== "ENVOYER"}
                className="w-full py-3 bg-rose-500 hover:bg-rose-600 disabled:opacity-40 text-white font-extrabold text-xs rounded-xl transition cursor-pointer flex items-center justify-center gap-2"
              >
                {annSending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                {annSending ? "Envoi en cours..." : `Envoyer à ${annRecipientCount()} utilisateur(s)`}
              </button>
            </div>

            {annLastResult && (
              <div className="bg-white rounded-2xl p-4 shadow-sm">
                <p className="text-xs font-bold text-emerald-600">
                  ✓ Dernière annonce envoyée à {annLastResult.recipients} utilisateur(s).
                </p>
              </div>
            )}
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

      {/* Full profile view - opened from a report (reporter or reported party) */}
      {viewProfile && (
        <ProfileDetailModal
          profile={viewProfile}
          currentUserProfile={null}
          currentUser={currentUser}
          onClose={() => setViewProfile(null)}
        />
      )}
    </div>
  );
}
