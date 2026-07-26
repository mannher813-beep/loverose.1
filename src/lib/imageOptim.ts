// Adapts image payload size to the person's actual connection, so a slow or
// capped mobile network doesn't have to download full-resolution photos just
// to show a small avatar or a swipe card. Falls back to the original,
// untouched URL for anything that isn't a Supabase Storage object (e.g. the
// Dicebear placeholder avatars) or if transformations aren't available.

export type NetworkQuality = "slow" | "medium" | "fast";

/**
 * Reads the browser's Network Information API (supported on most Android
 * Chrome / WebView, not on iOS Safari) to classify the current connection.
 * Falls back to "fast" (i.e. don't restrict anything) when the API is
 * unavailable, since we'd rather not guess wrong and needlessly degrade
 * image quality for someone with a perfectly fine connection.
 */
export function getNetworkQuality(): NetworkQuality {
  try {
    const nav = navigator as any;
    const conn = nav.connection || nav.mozConnection || nav.webkitConnection;
    if (!conn) return "fast";

    // Data Saver mode: always treat as slow regardless of reported speed.
    if (conn.saveData) return "slow";

    const type: string | undefined = conn.effectiveType;
    if (type === "slow-2g" || type === "2g") return "slow";
    if (type === "3g") return "medium";

    // effectiveType can be "4g" even on a throttled/congested connection;
    // downlink (Mbps) gives a finer-grained read when available.
    if (typeof conn.downlink === "number") {
      if (conn.downlink < 1.5) return "slow";
      if (conn.downlink < 4) return "medium";
    }

    return "fast";
  } catch {
    return "fast";
  }
}

const WIDTH_BY_QUALITY: Record<NetworkQuality, number> = {
  slow: 200,
  medium: 480,
  fast: 900,
};

const JPEG_QUALITY_BY_QUALITY: Record<NetworkQuality, number> = {
  slow: 45,
  medium: 65,
  fast: 82,
};

const STORAGE_OBJECT_MARKER = "/storage/v1/object/public/";

/**
 * Rewrites a Supabase Storage public object URL to use the image rendering
 * endpoint with a width/quality tuned to the connection. Non-Supabase URLs
 * (Dicebear placeholders, etc.) are returned untouched.
 */
export function getOptimizedImageUrl(
  url: string | null | undefined,
  quality: NetworkQuality
): string | null | undefined {
  if (!url) return url;

  const markerIndex = url.indexOf(STORAGE_OBJECT_MARKER);
  if (markerIndex === -1) return url;

  const origin = url.slice(0, markerIndex);
  const pathAndQuery = url.slice(markerIndex + STORAGE_OBJECT_MARKER.length);

  const width = WIDTH_BY_QUALITY[quality];
  const jpegQuality = JPEG_QUALITY_BY_QUALITY[quality];
  const separator = pathAndQuery.includes("?") ? "&" : "?";

  return `${origin}/storage/v1/render/image/public/${pathAndQuery}${separator}width=${width}&quality=${jpegQuality}&resize=cover`;
}
