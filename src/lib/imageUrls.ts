import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Cache of storage path -> signed URL to avoid re-signing on every render.
 * Signed URLs expire in 1 hour, so we cache for 55 minutes.
 */
const cache = new Map<string, { url: string; expiresAt: number }>();
const TTL_MS = 55 * 60 * 1000;

export async function getSignedImageUrl(path: string): Promise<string> {
  if (!path) return "";
  const cached = cache.get(path);
  if (cached && cached.expiresAt > Date.now()) return cached.url;

  const { data, error } = await supabase.storage
    .from("question-images")
    .createSignedUrl(path, 3600);

  if (error || !data?.signedUrl) return "";
  cache.set(path, { url: data.signedUrl, expiresAt: Date.now() + TTL_MS });
  return data.signedUrl;
}

/**
 * Returns a map of path -> signed URL for the given paths. The map fills in
 * asynchronously and re-renders when new URLs resolve.
 */
export function useSignedImageUrls(paths: Array<string | null | undefined>) {
  const [urls, setUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    const unique = Array.from(new Set(paths.filter((p): p is string => !!p)));
    if (!unique.length) return;

    let cancelled = false;
    (async () => {
      const results = await Promise.all(
        unique.map(async (p) => [p, await getSignedImageUrl(p)] as const)
      );
      if (cancelled) return;
      setUrls((prev) => {
        const next = { ...prev };
        for (const [p, u] of results) if (u) next[p] = u;
        return next;
      });
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paths.join("|")]);

  return urls;
}
