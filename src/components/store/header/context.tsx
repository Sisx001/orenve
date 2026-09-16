"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useCart } from "@/hooks/useCart";
import { useT, useLocale } from "@/lib/i18n/client";
import type { Translator } from "@/lib/i18n";
import { useConfig } from "@/components/providers/ConfigProvider";
import { useTheme } from "@/lib/theme/client";
import { localizedPath, stripLocale } from "@/lib/i18n";
import { COOKIE_LOCALE } from "@/lib/constants";
import { i18nText } from "@/lib/json";

export type NavCategory = { slug: string; name: string; image: string | null; count: number };
export type NavCollection = { slug: string; name: string; image: string | null };

export type NavLink = { href: string; label: string };

type HeaderState = {
  t: Translator;
  locale: string;
  categories: NavCategory[];
  collections: NavCollection[];
  /** Primary nav: collections, new arrivals, lookbook, about, track. */
  links: NavLink[];
  /** True once the page is scrolled past the header's resting height. */
  condensed: boolean;
  /** Desktop submenu (mega / dropdown) open state. */
  submenu: boolean;
  setSubmenu: (open: boolean) => void;
  /** Mobile (or `drawer` menu style) sheet. */
  sheet: boolean;
  setSheet: (open: boolean) => void;
  announcement: string;
  wishCount: number;
  isHome: boolean;
  switchLocale: (next: string) => void;
};

const HeaderContext = createContext<HeaderState | null>(null);

export function HeaderProvider({ categories, collections, children }: { categories: NavCategory[]; collections: NavCollection[]; children: ReactNode }) {
  const t = useT();
  const locale = useLocale();
  const cart = useCart();
  const router = useRouter();
  const pathname = usePathname();
  const { config } = useConfig();

  const [condensed, setCondensed] = useState(false);
  const [submenu, setSubmenu] = useState(false);
  const [sheet, setSheet] = useState(false);

  useEffect(() => {
    const onScroll = () => setCondensed(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    setSubmenu(false);
    setSheet(false);
  }, [pathname]);

  // ⌘K / Ctrl+K opens search
  useEffect(() => {
    if (!config.features.search) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        cart.openSearch(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [config.features.search, cart]);

  const value = useMemo<HeaderState>(() => {
    const switchLocale = (next: string) => {
      document.cookie = `${COOKIE_LOCALE}=${encodeURIComponent(next)}; path=/; max-age=31536000; samesite=lax`;
      const qs = typeof window === "undefined" ? "" : window.location.search;
      router.push(`${localizedPath(stripLocale(pathname), next)}${qs}`);
    };
    return {
      t,
      locale,
      categories,
      collections,
      links: [
        { href: "/collections", label: t("nav.collections") },
        { href: "/shop?sort=newest", label: t("nav.newArrivals") },
        { href: "/lookbook", label: t("nav.lookbook") },
        { href: "/about", label: t("nav.about") },
        { href: "/track", label: t("nav.track") },
      ],
      condensed,
      submenu,
      setSubmenu,
      sheet,
      setSheet,
      announcement: i18nText(config.brand.announcement, locale),
      wishCount: cart.wishlist.length,
      isHome: stripLocale(pathname) === "/",
      switchLocale,
    };
  }, [t, locale, categories, collections, condensed, submenu, sheet, config.brand.announcement, cart.wishlist.length, pathname, router]);

  return <HeaderContext.Provider value={value}>{children}</HeaderContext.Provider>;
}

export function useHeader(): HeaderState {
  const ctx = useContext(HeaderContext);
  if (!ctx) throw new Error("useHeader must be used within HeaderProvider");
  return ctx;
}

/** Convenience re-exports so variant files need one import each. */
export { useConfig, useTheme, useCart };
