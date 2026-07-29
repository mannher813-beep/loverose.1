import { useEffect, useRef, useState } from "react";
import { Megaphone, X } from "lucide-react";
import { supabase } from "../lib/supabase";

const AUTO_DISMISS_MS = 5000;

interface AdminNotificationRow {
  id: string;
  content: string;
  created_at: string;
}

interface Props {
  currentUser: any;
  onOpenNotifications: () => void;
}

/**
 * Small top-right preview card for notifications the admin team sends
 * (the `notifications` rows where is_admin = true). Purely a presentation
 * layer: it listens for new rows with its own realtime subscription and
 * shows a preview that fades on its own after a few seconds, or on click
 * routes to the existing Notifications screen. It never writes to the
 * database and never touches the existing unread-count subscription,
 * push-toast handler, or NotificationsView — those keep working exactly
 * as before.
 */
export default function AdminAnnouncementToast({ currentUser, onOpenNotifications }: Props) {
  const [item, setItem] = useState<AdminNotificationRow | null>(null);
  const [visible, setVisible] = useState(false);
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!currentUser) return;

    const channel = supabase
      .channel(`admin-announcement-toast-${currentUser.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${currentUser.id}`,
        },
        (payload) => {
          const row = payload.new as any;
          if (!row?.is_admin) return; // only ever surfaces admin-sourced rows
          show({ id: row.id, content: row.content, created_at: row.created_at });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id]);

  const clearTimers = () => {
    if (dismissTimer.current) clearTimeout(dismissTimer.current);
    if (mountTimer.current) clearTimeout(mountTimer.current);
  };

  const show = (row: AdminNotificationRow) => {
    clearTimers();
    setVisible(false);
    setItem(row);
    // Two-step mount so the enter transition actually animates from its
    // "hidden" state instead of starting already fully visible.
    mountTimer.current = setTimeout(() => setVisible(true), 20);
    dismissTimer.current = setTimeout(() => dismiss(), AUTO_DISMISS_MS);
  };

  const dismiss = () => {
    setVisible(false);
    // Wait for the exit transition to finish before unmounting.
    setTimeout(() => setItem(null), 250);
  };

  useEffect(() => clearTimers, []);

  if (!item) return null;

  return (
    <div
      className={`fixed top-4 right-4 z-[9999] w-[min(340px,calc(100vw-2rem))] transition-all duration-300 ease-out ${
        visible ? "opacity-100 translate-y-0 translate-x-0" : "opacity-0 -translate-y-2 translate-x-2"
      }`}
      role="status"
    >
      <button
        onClick={() => {
          dismiss();
          onOpenNotifications();
        }}
        className="relative w-full text-left bg-white rounded-2xl shadow-xl shadow-slate-900/10 border border-slate-100 overflow-hidden cursor-pointer group hover:shadow-2xl hover:shadow-slate-900/15 transition-shadow"
      >
        <div className="flex items-start gap-3 p-3.5 pr-9">
          <div className="w-9 h-9 rounded-full bg-rose-50 flex items-center justify-center flex-shrink-0 border border-rose-100 group-hover:bg-rose-100 transition-colors">
            <Megaphone size={16} className="text-rose-500" />
          </div>
          <div className="min-w-0 pt-0.5">
            <p className="text-[11px] font-black text-rose-500 tracking-wide uppercase">LoveRose</p>
            <p className="text-xs text-slate-700 font-medium leading-snug mt-0.5 line-clamp-2">{item.content}</p>
          </div>
        </div>

        <span
          onClick={(e) => {
            e.stopPropagation();
            dismiss();
          }}
          role="button"
          aria-label="Fermer"
          className="absolute top-2 right-2 p-1 text-slate-300 hover:text-slate-500 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
        >
          <X size={13} />
        </span>

        {/* Countdown sliver — timed to match the auto-dismiss delay above */}
        <div className="h-[3px] bg-slate-50">
          <div
            className="h-full bg-rose-400 origin-left"
            style={{
              transform: visible ? "scaleX(0)" : "scaleX(1)",
              transitionProperty: "transform",
              transitionTimingFunction: "linear",
              transitionDuration: visible ? `${AUTO_DISMISS_MS}ms` : "0ms",
            }}
          />
        </div>
      </button>
    </div>
  );
}
