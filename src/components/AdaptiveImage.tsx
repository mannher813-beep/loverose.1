import { useState, useEffect, useMemo, ImgHTMLAttributes } from "react";
import { getNetworkQuality, getOptimizedImageUrl, NetworkQuality } from "../lib/imageOptim";

interface AdaptiveImageProps extends ImgHTMLAttributes<HTMLImageElement> {
  src?: string | null;
  fallbackSrc?: string;
}

/**
 * Drop-in replacement for <img> that serves a smaller/more compressed
 * version of Supabase-hosted photos on slow connections, and automatically
 * falls back to the original full-size URL if the resized version ever
 * fails to load (e.g. image transformations not enabled on the project) —
 * so a person never sees a broken image because of this optimization.
 */
export default function AdaptiveImage({ src, fallbackSrc, alt, onError, ...rest }: AdaptiveImageProps) {
  const [quality, setQuality] = useState<NetworkQuality>(() => getNetworkQuality());
  const [useOriginal, setUseOriginal] = useState(false);

  useEffect(() => {
    const conn = (navigator as any).connection;
    if (!conn || !conn.addEventListener) return;
    const handleChange = () => setQuality(getNetworkQuality());
    conn.addEventListener("change", handleChange);
    return () => conn.removeEventListener("change", handleChange);
  }, []);

  const effectiveSrc = src || fallbackSrc;

  const displaySrc = useMemo(() => {
    if (!effectiveSrc || useOriginal) return effectiveSrc;
    return getOptimizedImageUrl(effectiveSrc, quality) ?? effectiveSrc;
  }, [effectiveSrc, quality, useOriginal]);

  return (
    <img
      src={displaySrc}
      alt={alt}
      onError={(e) => {
        if (!useOriginal && displaySrc !== effectiveSrc) {
          // The optimized/resized URL failed (e.g. transformations not
          // enabled on this Supabase project) — retry with the untouched
          // original so the image still shows.
          setUseOriginal(true);
        }
        onError?.(e);
      }}
      {...rest}
    />
  );
}
