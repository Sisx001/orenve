"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import type { PublicConfig } from "@/lib/settings";
import { formatMoney, type DisplayCurrency } from "@/lib/money";
import { COOKIE_CURRENCY } from "@/lib/constants";
import { useLocale } from "@/lib/i18n/client";
import { useTheme } from "@/lib/theme/client";
import type { ThemeMode, ThemeModePreference } from "@/lib/theme/types";

type Ctx = {
  config: PublicConfig;
  currency: DisplayCurrency;
  setCurrency: (code: string) => void;
  currencies: DisplayCurrency[];
  money: (minorBdt: number) => string;
  /** Visitor preference — may be "system". */
  mode: ThemeModePreference;
  /** The mode actually painted. */
  effective: ThemeMode;
  setMode: (mode: ThemeModePreference) => void;
  modes: Record<ThemeMode, boolean>;
  allowVisitorToggle: boolean;
  /** @deprecated Backwards-compatible alias for `effective`. */
  theme: ThemeMode;
  /** @deprecated Backwards-compatible alias for `setMode`. */
  setTheme: (t: ThemeModePreference) => void;
};

const ConfigContext = createContext<Ctx | null>(null);

function setCookie(name: string, value: string) {
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=31536000; samesite=lax`;
}

/**
 * Colour-mode state lives in `ThemeProvider` (see `@/lib/theme/client`) because
 * the resolved theme decides which modes exist. This provider re-exports it so
 * the long-standing `useConfig().theme` / `setTheme` call sites keep working.
 */
export function ConfigProvider({ config, initialCurrency, children }: { config: PublicConfig; initialCurrency: string; children: ReactNode }) {
  const locale = useLocale();
  const themeCtx = useTheme();
  const currencies = useMemo(() => config.currency.display.filter((c) => c.enabled), [config]);
  const [code, setCode] = useState(() => (currencies.some((c) => c.code === initialCurrency) ? initialCurrency : currencies[0]?.code ?? "BDT"));

  const currency = useMemo(() => currencies.find((c) => c.code === code) ?? currencies[0] ?? { code: "BDT", symbol: "৳", rate: 1, decimals: 0 }, [currencies, code]);

  const setCurrency = useCallback((c: string) => {
    setCode(c);
    setCookie(COOKIE_CURRENCY, c);
  }, []);

  const money = useCallback((minor: number) => formatMoney(minor, currency, locale), [currency, locale]);

  const value = useMemo<Ctx>(
    () => ({
      config,
      currency,
      setCurrency,
      currencies,
      money,
      mode: themeCtx.mode,
      effective: themeCtx.effective,
      setMode: themeCtx.setMode,
      modes: themeCtx.modes,
      allowVisitorToggle: themeCtx.allowVisitorToggle,
      theme: themeCtx.effective,
      setTheme: themeCtx.setMode,
    }),
    [config, currency, setCurrency, currencies, money, themeCtx],
  );
  return <ConfigContext.Provider value={value}>{children}</ConfigContext.Provider>;
}

export function useConfig() {
  const ctx = useContext(ConfigContext);
  if (!ctx) throw new Error("useConfig must be used within ConfigProvider");
  return ctx;
}
export const useMoney = () => useConfig().money;
export const useFeatures = () => useConfig().config.features;
/** Storefront languages (enabled only) as registered in the studio. */
export const useLocales = () => useConfig().config.locales;
