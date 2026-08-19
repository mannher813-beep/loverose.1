import React, { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { 
  Bell, 
  Check, 
  CheckCheck, 
  Heart, 
  MessageSquare, 
  Sparkles, 
  ShieldCheck, 
  Loader2, 
  Trash2, 
  Inbox,
  Star,
  ArrowRight,
  Loader
} from "lucide-react";
import { Profile } from "../types";

interface AnnouncementCta {
  id: string;
  cta_enabled: boolean;
  cta_label: string | null;
  cta_type: "route" | "url" | "paid" | null;
  cta_route: string | null;
  cta_url: string | null;
  is_paid: boolean;
  price_amount: number | null;
  paid_plan_name: string | null;
  success_redirect_url: string | null;
}

interface NotificationItem {
  id: string;
  user_id: string;
  sender_id: string;
  type: string; // 'match', 'like', 'message', 'system'
  content: string;
  lu: boolean;
  created_at: string;
  announcement_id?: string | null;
  sender_profile?: Profile;
  announcement?: AnnouncementCta;
}

interface NotificationsProps {
  currentUser: any;
  onNavigateToTab: (tab: 'discover' | 'dashboard' | 'profile' | 'settings' | 'notifications' | 'likes') => void;
  onLikeBack?: (partnerId: string) => void;
  onAuthRequired?: () => void;
}

export default function Notifications({ currentUser, onNavigateToTab, onLikeBack, onAuthRequired }: NotificationsProps) {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [unlockedAnnouncementIds, setUnlockedAnnouncementIds] = useState<Set<string>>(new Set());
  const [payingAnnouncementId, setPayingAnnouncementId] = useState<string | null>(null);

  const loadNotifications = async () => {
    if (!currentUser) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", currentUser.id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Batch-fetch des annonces liées (bouton configurable) en une seule requête
      const announcementIds = Array.from(
        new Set((data || []).map((n) => n.announcement_id).filter(Boolean))
      ) as string[];

      let announcementsById: Record<string, AnnouncementCta> = {};
      if (announcementIds.length > 0) {
        const { data: anns } = await supabase
          .from("admin_announcements")
          .select("id, cta_enabled, cta_label, cta_type, cta_route, cta_url, is_paid, price_amount, paid_plan_name, success_redirect_url")
          .in("id", announcementIds);
        for (const a of anns || []) announcementsById[a.id] = a as AnnouncementCta;

        const { data: unlocks } = await supabase
          .from("announcement_unlocks")
          .select("announcement_id")
          .eq("user_id", currentUser.id)
          .in("announcement_id", announcementIds);
        setUnlockedAnnouncementIds(new Set((unlocks || []).map((u) => u.announcement_id)));
      }

      // Map sender profile
      const populated = await Promise.all(
        (data || []).map(async (notif) => {
          const announcement = notif.announcement_id ? announcementsById[notif.announcement_id] : undefined;
          if (!notif.sender_id) return { ...notif, announcement };
          
          const { data: prof } = await supabase
            .from("profiles")
            .select("*")
            .eq("uid", notif.sender_id)
            .single();

          return {
            ...notif,
            sender_profile: prof || undefined,
            announcement,
          };
        })
      );

      setNotifications(populated);
    } catch (err) {
      console.error("Error loading notifications:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!currentUser) return;

    loadNotifications();

    // Subscribe to real-time notification additions/deletions/updates
    const channelName = `notifications-view-${currentUser.id}-${Math.random().toString(36).substring(2, 11)}`;
    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${currentUser.id}`
        },
        () => {
          loadNotifications();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUser]);

  if (!currentUser) {
    return (
      <div className="max-w-md mx-auto my-12 p-8 bg-white border border-slate-200 rounded-3xl shadow-sm text-center space-y-4">
        <div className="w-14 h-14 bg-rose-50 text-rose-500 rounded-2xl flex items-center justify-center mx-auto">
          <Bell size={28} />
        </div>
        <div className="space-y-1">
          <h2 className="text-xl font-black text-slate-900">Centre de Notifications</h2>
          <p className="text-xs text-slate-500 leading-relaxed">
            Connectez-vous pour recevoir vos alertes de nouveaux matchs, de super likes et de messages en temps réel.
          </p>
        </div>
        <button
          onClick={onAuthRequired}
          className="w-full py-3 bg-rose-500 hover:bg-rose-600 text-white font-black text-xs rounded-xl shadow-md transition cursor-pointer"
        >
          Se connecter / S'inscrire
        </button>
      </div>
    );
  }

  const handleMarkAsRead = async (id: string, senderId?: string, type?: string) => {
    try {
      const { error } = await supabase
        .from("notifications")
        .update({ lu: true })
        .eq("id", id);

      if (error) throw error;

      setNotifications(prev =>
        prev.map(n => n.id === id ? { ...n, lu: true } : n)
      );

      // Trigger custom unread count update
      window.dispatchEvent(new Event("loverose-notification-read"));

      // Interactive behaviors depending on notification type
      if (type === 'match' && senderId && onLikeBack) {
        onLikeBack(senderId);
        onNavigateToTab('likes');
      } else if (type === 'like') {
        onNavigateToTab('likes');
      }
    } catch (err) {
      console.error("Error marking notification as read:", err);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      const { error } = await supabase
        .from("notifications")
        .update({ lu: true })
        .eq("user_id", currentUser.id);

      if (error) throw error;

      setNotifications(prev => prev.map(n => ({ ...n, lu: true })));
      window.dispatchEvent(new Event("loverose-notification-read"));
      alert("Toutes vos notifications ont été marquées comme lues !");
    } catch (err) {
      console.error("Error marking all read:", err);
    }
  };

  const handleDeleteNotification = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try {
      const { error } = await supabase
        .from("notifications")
        .delete()
        .eq("id", id);

      if (error) throw error;

      setNotifications(prev => prev.filter(n => n.id !== id));
      window.dispatchEvent(new Event("loverose-notification-read"));
    } catch (err) {
      console.error("Error deleting notification:", err);
    }
  };

  const handleAnnouncementCta = async (e: React.MouseEvent, announcement: AnnouncementCta) => {
    e.stopPropagation();
    if (!announcement.cta_enabled) return;

    if (announcement.cta_type === "route" && announcement.cta_route) {
      onNavigateToTab(announcement.cta_route as any);
      return;
    }

    if (announcement.cta_type === "url" && announcement.cta_url) {
      window.open(announcement.cta_url, "_blank", "noopener,noreferrer");
      return;
    }

    if (announcement.cta_type === "paid") {
      if (!currentUser) {
        onAuthRequired?.();
        return;
      }

      // Déjà payé précédemment : on redirige directement, pas de second paiement.
      if (unlockedAnnouncementIds.has(announcement.id) && announcement.success_redirect_url) {
        window.location.href = announcement.success_redirect_url;
        return;
      }

      setPayingAnnouncementId(announcement.id);
      try {
        const response = await fetch("/api/payments/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: currentUser.id,
            planId: `announcement_unlock:${announcement.id}`,
            planName: announcement.paid_plan_name || "Accès premium",
            amount: announcement.price_amount || 0,
            email: currentUser.email,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          if (data.checkoutUrl) {
            localStorage.setItem("last_payment_reference", data.reference);
            window.location.href = data.checkoutUrl;
          } else {
            throw new Error("Impossible de générer le lien de paiement.");
          }
        } else {
          const errData = await response.json().catch(() => ({}));
          throw new Error(errData.error || "La passerelle de paiement a renvoyé une erreur.");
        }
      } catch (err: any) {
        alert(err.message || "Erreur lors de l'initialisation du paiement.");
      } finally {
        setPayingAnnouncementId(null);
      }
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "match":
        return <Sparkles className="text-amber-500" size={16} fill="currentColor" />;
      case "like":
        return <Heart className="text-rose-500" size={16} fill="currentColor" />;
      case "message":
        return <MessageSquare className="text-indigo-500" size={16} fill="currentColor" />;
      case "verified":
      case "system":
        return <ShieldCheck className="text-emerald-500" size={16} fill="currentColor" />;
      default:
        return <Bell className="text-slate-400" size={16} />;
    }
  };

  return (
    <div id="notifications-screen" className="flex-1 overflow-y-auto bg-slate-50 p-4 md:p-8 space-y-6 font-sans max-w-4xl mx-auto w-full text-left">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Bell className="text-rose-500" />
            <span>Mes Notifications</span>
          </h2>
          <p className="text-slate-500 text-xs mt-1">Consultez vos Matchs, likes reçus, messages importants et actualités de compte.</p>
        </div>
        
        {notifications.some(n => !n.lu) && (
          <button
            onClick={handleMarkAllRead}
            className="text-xs bg-rose-50 hover:bg-rose-100 text-rose-600 font-extrabold px-4 py-2 rounded-xl transition cursor-pointer flex items-center gap-1.5 self-start sm:self-center"
          >
            <CheckCheck size={14} />
            <span>Tout marquer comme lu</span>
          </button>
        )}
      </div>

      <button
        onClick={() => onNavigateToTab('likes')}
        className="w-full flex items-center gap-3 bg-gradient-to-r from-rose-500 to-rose-400 hover:from-rose-600 hover:to-rose-500 text-white rounded-2xl p-4 shadow-md transition cursor-pointer"
      >
        <div className="w-11 h-11 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
          <Heart size={20} fill="currentColor" />
        </div>
        <div className="flex-1 text-left">
          <p className="font-extrabold text-sm">Qui vous a aimé ✨</p>
          <p className="text-[11px] text-white/80">Voir vos likes, super likes et matchs</p>
        </div>
        <Sparkles size={16} className="flex-shrink-0" />
      </button>

      {/* List Container */}
      {loading ? (
        <div className="py-20 text-center space-y-3">
          <Loader2 className="animate-spin text-rose-500 mx-auto" size={32} />
          <p className="text-slate-500 text-xs font-semibold">Chargement de vos notifications...</p>
        </div>
      ) : notifications.length > 0 ? (
        <div className="bg-white border border-slate-150 rounded-3xl overflow-hidden shadow-xs divide-y divide-slate-100">
          {notifications.map((notif) => {
            const senderName = notif.sender_profile?.full_name || "LoveRose";
            const senderAvatar = notif.sender_profile?.avatar_url || `https://api.dicebear.com/7.x/initials/svg?seed=${senderName}`;
            
            return (
              <div
                key={notif.id}
                onClick={() => handleMarkAsRead(notif.id, notif.sender_id, notif.type)}
                className={`p-4 md:p-5 flex items-start gap-4 transition cursor-pointer hover:bg-slate-50/50 relative group ${
                  !notif.lu ? "bg-rose-500/5 hover:bg-rose-500/10" : ""
                }`}
              >
                {/* Unread dot indicator */}
                {!notif.lu && (
                  <div className="absolute left-2 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-rose-500"></div>
                )}

                {/* Sender Avatar */}
                {(() => {
                  const isSuperLike = notif.content.toLowerCase().includes("super like") || notif.type === "super_like";
                  return (
                    <div className={`w-11 h-11 rounded-full flex-shrink-0 relative ${
                      isSuperLike ? "ring-2 ring-amber-400 border border-amber-300 shadow-md shadow-amber-400/15" : "border border-slate-200"
                    }`}>
                      <img src={senderAvatar} alt="" className="w-full h-full object-cover rounded-full bg-slate-100" referrerPolicy="no-referrer" />
                      <div className="absolute -bottom-1 -right-1 bg-white p-1 rounded-full border border-slate-100 shadow-xs">
                        {isSuperLike ? <Star className="text-amber-500 fill-amber-500" size={14} /> : getNotificationIcon(notif.type)}
                      </div>
                    </div>
                  );
                })()}

                {/* Content */}
                <div className="flex-1 min-w-0 text-left space-y-1">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-extrabold text-slate-800 tracking-tight">
                      {senderName}
                    </p>
                    <span className="text-[12px] text-slate-400 font-semibold whitespace-nowrap">
                      {new Date(notif.created_at).toLocaleDateString()} à {new Date(notif.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  
                  <p className="text-xs text-slate-600 font-medium leading-relaxed pr-6">
                    {notif.content}
                  </p>

                  {!notif.lu && (
                    <span className="inline-block text-[11px] bg-rose-500 text-white font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-md mt-1 scale-90 origin-left">
                      Nouveau
                    </span>
                  )}

                  {notif.announcement?.cta_enabled && notif.announcement.cta_label && (
                    <button
                      onClick={(e) => handleAnnouncementCta(e, notif.announcement!)}
                      disabled={payingAnnouncementId === notif.announcement.id}
                      className={`mt-2 flex items-center justify-center gap-1.5 w-full sm:w-auto px-4 py-2 rounded-xl text-[11px] font-extrabold text-white transition cursor-pointer disabled:opacity-60 ${
                        notif.announcement.cta_type === "paid"
                          ? "bg-emerald-500 hover:bg-emerald-600"
                          : "bg-indigo-500 hover:bg-indigo-600"
                      }`}
                    >
                      {payingAnnouncementId === notif.announcement.id ? (
                        <Loader size={12} className="animate-spin" />
                      ) : (
                        <ArrowRight size={12} />
                      )}
                      <span>
                        {notif.announcement.cta_label}
                        {notif.announcement.cta_type === "paid" && notif.announcement.price_amount
                          ? ` · ${notif.announcement.price_amount} FCFA`
                          : ""}
                      </span>
                    </button>
                  )}
                </div>

                {/* Delete button shown on hover */}
                <button
                  onClick={(e) => handleDeleteNotification(e, notif.id)}
                  className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg hover:bg-slate-100 transition md:opacity-0 group-hover:opacity-100 cursor-pointer self-center"
                  title="Supprimer la notification"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-white border border-slate-150 rounded-3xl p-12 text-center space-y-3 shadow-xs">
          <div className="w-14 h-14 bg-slate-50 text-slate-400 rounded-full flex items-center justify-center mx-auto">
            <Inbox size={24} />
          </div>
          <h4 className="font-extrabold text-slate-800 text-sm">Boîte de réception vide</h4>
          <p className="text-slate-400 text-xs max-w-xs mx-auto leading-relaxed">
            Vous n'avez reçu aucune notification pour le moment. Dès qu'un membre s'intéresse à vous, cela apparaîtra ici !
          </p>
        </div>
      )}

    </div>
  );
}
