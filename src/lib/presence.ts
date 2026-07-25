// The client only pings `is_online = true` roughly every 60s while active,
// and only clears it on a clean disconnect (tab close / visibilitychange).
// Mobile browsers routinely kill the app without firing that event — phone
// locked, network dropped, app swiped away — so the raw flag can get stuck
// "true" for days. Anywhere the app shows someone as online, it should gate
// on recency instead of trusting the flag alone.
const ONLINE_STALE_MS = 2 * 60 * 1000;

export function isActuallyOnline(
  profile: { is_online?: boolean | null; last_seen?: string | null } | null | undefined
): boolean {
  if (!profile?.is_online || !profile.last_seen) return false;
  return Date.now() - new Date(profile.last_seen).getTime() < ONLINE_STALE_MS;
}
