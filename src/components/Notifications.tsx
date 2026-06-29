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
  Star
} from "lucide-react";
import { Profile } from "../types";

interface NotificationItem {
  id: string;
  user_id: string;
  sender_id: string;
  type: string; // 'match', 'like', 'message', 'system'
  content: string;
  lu: boolean;
  created_at: string;
  sender_profile?: Profile;
}

interface NotificationsProps {
  currentUser: any;
  onNavigateToTab: (tab: 'discover' | 'chat' | 'feed' | 'shop' | 'profile' | 'settings') => void;
  onStartChat?: (partnerId: string) => void;
}

export default function Notifications({ currentUser, onNavigateToTab, onStartChat }: NotificationsProps) {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);

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

      // Map sender profile
      const populated = await Promise.all(
        (data || []).map(async (notif) => {
          if (!notif.sender_id) return notif;
          
          const { data: prof } = await supabase
            .from("profiles")
            .select("*")
            .eq("uid", notif.sender_id)
            .single();

          return {
            ...notif,
            sender_profile: prof || undefined
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
      if (type === 'match' && senderId && onStartChat) {
        onStartChat(senderId);
      } else if (type === 'message') {
        onNavigateToTab('chat');
      } else if (type === 'like') {
        onNavigateToTab('discover');
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

      {/* List Container */}
      {loading ? (
        <div className="py-20 text-center space-y-3">
          <Loader2 className="animate-spin text-rose-500 mx-auto" size={32} />
          <p className="text-slate-500 text-xs font-semibold">Chargement de vos notifications...</p>
        </div>
      ) : notifications.length > 0 ? (
        <div className="bg-white border border-slate-150 rounded-3xl overflow-hidden shadow-xs divide-y divide-slate-100">
          {notifications.map((notif) => {
            const senderName = notif.sender_profile?.full_name || "Membre LoveRose";
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
                    <span className="text-[10px] text-slate-400 font-semibold whitespace-nowrap">
                      {new Date(notif.created_at).toLocaleDateString()} à {new Date(notif.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  
                  <p className="text-xs text-slate-600 font-medium leading-relaxed pr-6">
                    {notif.content}
                  </p>

                  {!notif.lu && (
                    <span className="inline-block text-[9px] bg-rose-500 text-white font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-md mt-1 scale-90 origin-left">
                      Nouveau
                    </span>
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
