"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { PublicConfig } from "@/lib/settings";
import { formatMoney, type DisplayCurrency } from "@/lib/money";
import { COOKIE_CURRENCY, COOKIE_THEME } from "@/lib/constants";
import { useLocale } from "@/lib/i18n/client";

type Theme = "light" | "dark";

type Ctx = {
  config: PublicConfig;
  currency: DisplayCurrency;
  setCurrency: (code: string) => void;
  currencies: DisplayCurrency[];
  money: (minorBdt: number) => string;
  theme: Theme;
  setTheme: (t: Theme) => void;
};

const ConfigContext = createContext<Ctx | null>(null);

function setCookie(name: string, value: string) {
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=31536000; samesite=lax`;
}

export function ConfigProvider({
  config,
  initialCurrency,
  initialTheme,
  children,
}: {
  config: PublicConfig;
  initialCurrency: string;
  initialTheme: Theme;
  children: ReactNode;
}) {
  const locale = useLocale();
  const currencies = useMemo(() => config.currency.display.filter((c) => c.enabled), [config]);
  const [code, setCode] = useState(() => (currencies.some((c) => c.code === initialCurrency) ? initialCurrency : currencies[0]?.code ?? "BDT"));
  const [theme, setThemeState] = useState<Theme>(initialTheme);

  const currency = useMemo(() => currencies.find((c) => c.code === code) ?? currencies[0] ?? { code: "BDT", symbol: "৳", rate: 1, decimals: 0 }, [currencies, code]);

  const setCurrency = useCallback((c: string) => {
    setCode(c);
    setCookie(COOKIE_CURRENCY, c);
  }, []);

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
    setCookie(COOKIE_THEME, t);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = theme;
    root.style.colorScheme = theme;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", theme === "dark" ? "#0e0f0c" : "#faf8f3");
  }, [theme]);

  const money = useCallback((minor: number) => formatMoney(minor, currency, locale), [currency, locale]);

  const value = useMemo<Ctx>(() => ({ config, currency, setCurrency, currencies, money, theme, setTheme }), [config, currency, setCurrency, currencies, money, theme, setTheme]);
  return <ConfigContext.Provider value={value}>{children}</ConfigContext.Provider>;
}

export function useConfig() {
  const ctx = useContext(ConfigContext);
  if (!ctx) throw new Error("useConfig must be used within ConfigProvider");
  return ctx;
}
export const useMoney = () => useConfig().money;
export const useFeatures = () => useConfig().config.features;
