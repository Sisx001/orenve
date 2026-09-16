"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { COOKIE_THEME_PREVIEW, PREVIEW_PARAM } from "@/lib/theme/payload";

/**
 * Mirrors `?theme_preview=<Theme id | preset:key>` into a session cookie and
 * refreshes, because a layout cannot read `searchParams` and the resolver runs
 * in the layout. `?theme_preview=` with an empty value clears the preview.
 *
 * Rendered only for signed-in studio users — the server still re-checks the
 * session before honouring the cookie, so a visitor who forges it gets nothing.
 */
export function ThemePreviewSync({ current }: { current: string | null }) {
  const params = useSearchParams();
  const router = useRouter();
  const requested = params.get(PREVIEW_PARAM);

  useEffect(() => {
    if (requested === null) return;
    if (requested === (current ?? "")) return;
    document.cookie = requested
      ? `${COOKIE_THEME_PREVIEW}=${encodeURIComponent(requested)}; path=/; samesite=lax`
      : `${COOKIE_THEME_PREVIEW}=; path=/; max-age=0; samesite=lax`;
    router.refresh();
  }, [requested, current, router]);

  return null;
}
