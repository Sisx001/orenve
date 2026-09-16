/**
 * The slice of a resolved theme that is safe to ship to the browser: layout
 * choices, typography and mode state. Token maps and `customCss` stay on the
 * server — they are already in the `<style>` element, so sending them again
 * would only bloat the RSC payload.
 */
import type { ResolvedTheme, ThemeLayout, ThemeMode, ThemeModePreference, ThemeTypography } from "./types";

/**
 * Studio preview handle. A Next.js *layout* never receives `searchParams`, so
 * `?theme_preview=<id|preset:key>` is mirrored into this short-lived cookie by
 * `ThemePreviewSync` and read server-side on the next render. Setting the
 * cookie directly (what the studio does when it opens a preview) skips the
 * extra round trip entirely.
 */
export const COOKIE_THEME_PREVIEW = "ory_theme_preview";
export const PREVIEW_PARAM = "theme_preview";

export type ThemeClientPayload = {
  key: string;
  name: string;
  layout: ThemeLayout;
  typography: ThemeTypography;
  /** What the visitor asked for (may be "system"). */
  mode: ThemeModePreference;
  /** What is actually painted right now. */
  effective: ThemeMode;
  modes: Record<ThemeMode, boolean>;
  defaultMode: ThemeModePreference;
  allowVisitorToggle: boolean;
};

export function toClientTheme(theme: ResolvedTheme, mode: ThemeModePreference, effective: ThemeMode): ThemeClientPayload {
  return {
    key: theme.key,
    name: theme.name,
    layout: theme.layout,
    typography: theme.typography,
    mode,
    effective,
    modes: theme.modes,
    defaultMode: theme.defaultMode,
    allowVisitorToggle: theme.allowVisitorToggle,
  };
}

/** Which modes a visitor may actually pick, honouring the settings toggles. */
export function enabledModes(modes: Record<ThemeMode, boolean>): ThemeMode[] {
  const list = (["light", "dark", "black"] as ThemeMode[]).filter((m) => modes[m]);
  return list.length ? list : ["light"];
}

/** Fold a preference (possibly "system") into a mode that exists and is enabled. */
export function effectiveMode(preference: ThemeModePreference, modes: Record<ThemeMode, boolean>, systemPrefersDark = false): ThemeMode {
  const allowed = enabledModes(modes);
  if (preference === "system") {
    if (!systemPrefersDark) return allowed.includes("light") ? "light" : allowed[0];
    return allowed.includes("dark") ? "dark" : allowed.includes("black") ? "black" : allowed[0];
  }
  return allowed.includes(preference) ? preference : allowed[0];
}

/** Browser chrome colour for a mode. Pass per-mode hex overrides (e.g. the theme's paper token) when known. */
export function themeColorFor(mode: ThemeMode, tokens?: Partial<Record<ThemeMode, string>>): string {
  if (tokens?.[mode]) return tokens[mode] as string;
  return mode === "light" ? "#faf8f3" : mode === "black" ? "#000000" : "#0e0f0c";
}
