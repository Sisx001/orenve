"use client";

/**
 * Client-side theme state. The provider owns the visitor's colour-mode
 * preference (cookie + `<html>` attributes) and exposes the resolved layout and
 * typography so components can switch variants without prop drilling.
 *
 * Written with `createElement` rather than JSX so it can stay a `.ts` module —
 * the storefront and the studio both import `useTheme` from this exact path.
 */
import { createContext, createElement, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { COOKIE_THEME } from "@/lib/constants";
import type { ThemeLayout, ThemeMode, ThemeModePreference, ThemeTypography } from "./types";
import { effectiveMode, enabledModes, type ThemeClientPayload } from "./payload";

export type ThemeContextValue = {
  key: string;
  name: string;
  layout: ThemeLayout;
  typography: ThemeTypography;
  /** The visitor's stored preference; may be "system". */
  mode: ThemeModePreference;
  /** The mode actually painted right now. */
  effective: ThemeMode;
  setMode: (mode: ThemeModePreference) => void;
  modes: Record<ThemeMode, boolean>;
  /** Modes the visitor may choose, in display order. */
  available: ThemeMode[];
  defaultMode: ThemeModePreference;
  allowVisitorToggle: boolean;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

/** Paint colour, per mode, for the `theme-color` meta tag (mobile browser chrome). */
import { themeColorFor } from "./payload";
export { themeColorFor };

function writeCookie(value: string) {
  document.cookie = `${COOKIE_THEME}=${encodeURIComponent(value)}; path=/; max-age=31536000; samesite=lax`;
}

export function ThemeProvider({ theme, children }: { theme: ThemeClientPayload; children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeModePreference>(theme.mode);
  const [systemDark, setSystemDark] = useState(false);

  // Track the OS preference so "system" can follow it live.
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    setSystemDark(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const effective = useMemo(() => effectiveMode(mode, theme.modes, systemDark), [mode, theme.modes, systemDark]);
  const available = useMemo(() => enabledModes(theme.modes), [theme.modes]);

  const setMode = useCallback((next: ThemeModePreference) => {
    setModeState(next);
    writeCookie(next);
  }, []);

  // Keep <html> in sync. The inline bootstrap script in the layout already did
  // this for the first paint; this effect handles later toggles.
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = effective;
    root.style.colorScheme = effective === "light" ? "light" : "dark";
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", themeColorFor(effective));
  }, [effective]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      key: theme.key,
      name: theme.name,
      layout: theme.layout,
      typography: theme.typography,
      mode,
      effective,
      setMode,
      modes: theme.modes,
      available,
      defaultMode: theme.defaultMode,
      allowVisitorToggle: theme.allowVisitorToggle,
    }),
    [theme, mode, effective, setMode, available],
  );

  return createElement(ThemeContext.Provider, { value }, children);
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}

/** Layout only — the common case, and it keeps re-renders obvious in devtools. */
export const useThemeLayout = () => useTheme().layout;

export type { ThemeClientPayload };
