"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { pathMatches } from "@/lib/theme/match";
import { layoutDataAttributes, type ThemeLayout } from "@/lib/theme/types";

/**
 * Applies *page-scoped* theme assignments on the client.
 *
 * Why this exists: a Next.js App Router **layout** cannot read the request
 * pathname (there is no `headers()` key for it, and adding one in middleware is
 * not an option here), so an assignment like `/collections/*` cannot be
 * resolved during the layout render. The layout therefore:
 *
 *   1. resolves the *global* theme server-side (active theme + `*` assignments
 *      + schedule) — so the first paint of every page is already correct for
 *      the common case, with no flash;
 *   2. passes the handful of non-global assignments (max 10, already filtered
 *      by locale and schedule, each with its tokens pre-rendered to CSS) here.
 *
 * This component then, on mount and on every client navigation, picks the
 * highest-priority matching assignment and:
 *   • writes its CSS into a single `<style id="ory-page-theme">` element, and
 *   • overwrites the layout data attributes on `<html>`.
 * When nothing matches it empties that style element and restores the base
 * attributes. Nothing else on the page needs to know.
 *
 * Two deliberate limits:
 *  • For a page-scoped assignment the *server* HTML carries the global palette
 *    and the override lands in the same commit as the route change — a
 *    one-frame difference on a hard navigation.
 *  • Only CSS-driven choices follow a page assignment (colours, fonts, radius,
 *    density, container, grid, card and button styles, grain, eyebrow casing).
 *    The header/footer *component* variants come from the globally resolved
 *    theme, so a route change never remounts the chrome.
 * Use a global assignment (`*`) or the active theme for anything that must be
 * right in the server HTML or must change the header/footer structure.
 */
export type PageThemeEntry = {
  id: string;
  pattern: string;
  css: string;
  layout: ThemeLayout;
};

const STYLE_ID = "ory-page-theme";

export function PageThemeSwitch({ entries, baseLayout }: { entries: PageThemeEntry[]; baseLayout: ThemeLayout }) {
  const pathname = usePathname();

  useEffect(() => {
    if (!entries.length) return;
    const root = document.documentElement;
    let style = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
    if (!style) {
      style = document.createElement("style");
      style.id = STYLE_ID;
      document.head.appendChild(style);
    }

    const match = entries.find((e) => pathMatches(e.pattern, pathname));
    const layout = match?.layout ?? baseLayout;
    style.textContent = match?.css ?? "";
    for (const [key, value] of Object.entries(layoutDataAttributes(layout))) root.setAttribute(key, value);
    root.setAttribute("data-eyebrows", layout.uppercaseEyebrows ? "caps" : "sentence");
  }, [entries, baseLayout, pathname]);

  // Leave the page in the base state when the switcher unmounts.
  useEffect(() => {
    return () => {
      const style = document.getElementById(STYLE_ID);
      if (style) style.textContent = "";
    };
  }, []);

  return null;
}
