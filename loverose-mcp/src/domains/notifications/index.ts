import { z } from "zod";
import type { RegisterDomainTools } from "../types.js";
import { mcpOk, mcpFail, withMcpErrorHandling } from "../../core/mcpResult.js";
import { accessTokenSchema, asUser, unwrap, limitSchema } from "../../core/tooling.js";
import { createLogger } from "../../core/logger.js";

/**
 * Domaine NOTIFICATIONS
 * ---------------------
 * Réutilise src/components/Notifications.tsx et src/lib/push.ts :
 *   - notifications      : { user_id, lu (booléen), announcement_id?, ... }
 *   - push_subscriptions : { user_id, endpoint, p256dh, auth } (upsert onConflict endpoint)
 *
 * NB : le push WEB (navigateur) n'a pas de sens pour un serveur MCP —
 * l'agent « poll » les notifications non lues avec get_unread_count /
 * list_notifications. register_push_subscription existe pour les clients
 * MCP capables de fournir une souscription Web Push réelle (endpoint VAPID).
 */

const logger = createLogger("domain:notifications");

export const registerNotificationsTools: RegisterDomainTools = ({ server, admin, config }) => {
  // -------------------------------------------------------------------
  // list_notifications
  // -------------------------------------------------------------------
  server.tool(
    "list_notifications",
    "Liste les notifications du membre (table notifications, ordre antéchronologique) — équivalent du panneau Notifications de l'app. " +
      "Option : uniquement les non-lues (lu = false).",
    {
      accessToken: accessTokenSchema,
      unread_only: z.boolean().default(false),
      limit: limitSchema,
    },
    withMcpErrorHandling(async (args: { accessToken: string; unread_only: boolean; limit: number }) => {
      const { uid, db } = await asUser(admin, config, args.accessToken);
      let query = db.from("notifications").select("*").eq("user_id", uid).order("created_at", { ascending: false }).limit(args.limit);
      if (args.unread_only) query = query.eq("lu", false);
      const notifs = await query;
      if (notifs.error) return mcpFail(`Lecture des notifications impossible : ${notifs.error.message}`, { code: notifs.error.code });
      return mcpOk({ count: (notifs.data as any[])?.length ?? 0, notifications: notifs.data });
    })
  );

  // -------------------------------------------------------------------
  // get_unread_count
  // -------------------------------------------------------------------
  server.tool(
    "get_unread_count",
    "Nombre de notifications non lues du membre (notifications.lu = false) — utile pour un polling léger.",
    { accessToken: accessTokenSchema },
    withMcpErrorHandling(async (args: { accessToken: string }) => {
      const { uid, db } = await asUser(admin, config, args.accessToken);
      const res = await db.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", uid).eq("lu", false);
      if (res.error) return mcpFail(`Comptage impossible : ${res.error.message}`, { code: res.error.code });
      return mcpOk({ unread_count: res.count ?? 0 });
    })
  );

  // -------------------------------------------------------------------
  // mark_notification_read
  // -------------------------------------------------------------------
  server.tool(
    "mark_notification_read",
    "Marque une notification comme lue (update lu = true) — même update que Notifications.tsx.",
    {
      accessToken: accessTokenSchema,
      notification_id: z.string().uuid(),
    },
    withMcpErrorHandling(async (args: { accessToken: string; notification_id: string }) => {
      const { uid, db } = await asUser(admin, config, args.accessToken);
      unwrap(
        await db.from("notifications").update({ lu: true }).eq("id", args.notification_id).eq("user_id", uid),
        "Marquage impossible"
      );
      return mcpOk({ marked: args.notification_id, lu: true });
    })
  );

  // -------------------------------------------------------------------
  // mark_all_notifications_read
  // -------------------------------------------------------------------
  server.tool(
    "mark_all_notifications_read",
    "Marque TOUTES les notifications du membre comme lues (update lu = true where user_id) — comme le bouton « tout marquer ».",
    { accessToken: accessTokenSchema },
    withMcpErrorHandling(async (args: { accessToken: string }) => {
      const { uid, db } = await asUser(admin, config, args.accessToken);
      unwrap(await db.from("notifications").update({ lu: true }).eq("user_id", uid), "Marquage global impossible");
      return mcpOk({ all_read: true });
    })
  );

  // -------------------------------------------------------------------
  // register_push_subscription — lib/push.ts (schéma exact)
  // -------------------------------------------------------------------
  server.tool(
    "register_push_subscription",
    "Enregistre une souscription Web Push pour le membre (upsert push_subscriptions : endpoint/p256dh/auth, même schéma que src/lib/push.ts). " +
      "Réservé aux clients MCP disposant d'un vrai endpoint Web Push (clés VAPID).",
    {
      accessToken: accessTokenSchema,
      endpoint: z.string().url().describe("URL d'endpoint Web Push du navigateur/service"),
      p256dh: z.string().min(1).describe("Clé publique p256dh (base64url)"),
      auth: z.string().min(1).describe("Secret auth (base64url)"),
    },
    withMcpErrorHandling(async (args: { accessToken: string; endpoint: string; p256dh: string; auth: string }) => {
      const { uid, db } = await asUser(admin, config, args.accessToken);
      unwrap(
        await db
          .from("push_subscriptions")
          .upsert({ user_id: uid, endpoint: args.endpoint, p256dh: args.p256dh, auth: args.auth }, { onConflict: "endpoint" }),
        "Enregistrement de la souscription push impossible"
      );
      logger.info("push subscription registered", { uid });
      return mcpOk({ registered: true, endpoint: args.endpoint });
    })
  );
};
