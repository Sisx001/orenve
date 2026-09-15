"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Heart, Menu, Moon, Search, ShoppingBag, Sun, X, ChevronDown } from "lucide-react";
import { useCart } from "@/hooks/useCart";
import { useT, useLocale } from "@/lib/i18n/client";
import { useConfig } from "@/components/providers/ConfigProvider";
import { localeMeta, localizedPath, stripLocale } from "@/lib/i18n";
import { COOKIE_LOCALE, SUPPORTED_LOCALES } from "@/lib/constants";
import { i18nText } from "@/lib/json";
import { Logo } from "@/components/brand/Logo";
import { LocaleLink } from "@/components/store/LocaleLink";
import { Modal } from "@/components/ui";
import { DUR, EASE } from "@/lib/store/motion";
import { cn } from "@/lib/utils";

export type NavCategory = { slug: string; name: string; image: string | null; count: number };
export type NavCollection = { slug: string; name: string; image: string | null };

export function SiteHeader({ categories, collections }: { categories: NavCategory[]; collections: NavCollection[] }) {
  const t = useT();
  const locale = useLocale();
  const cart = useCart();
  const router = useRouter();
  const pathname = usePathname();
  const { config, currency, currencies, setCurrency, theme, setTheme } = useConfig();
  const features = config.features;

  const [condensed, setCondensed] = useState(false);
  const [mega, setMega] = useState(false);
  const [mobile, setMobile] = useState(false);

  useEffect(() => {
    const onScroll = () => setCondensed(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    setMega(false);
    setMobile(false);
  }, [pathname]);

  // ⌘K / Ctrl+K opens search
  useEffect(() => {
    if (!features.search) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        cart.openSearch(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [features.search, cart]);

  function switchLocale(next: string) {
    document.cookie = `${COOKIE_LOCALE}=${encodeURIComponent(next)}; path=/; max-age=31536000; samesite=lax`;
    const qs = typeof window === "undefined" ? "" : window.location.search;
    router.push(`${localizedPath(stripLocale(pathname), next)}${qs}`);
  }

  const announcement = i18nText(config.brand.announcement, locale);
  const wishCount = cart.wishlist.length;

  const links: { href: string; label: string }[] = [
    { href: "/collections", label: t("nav.collections") },
    { href: "/shop?sort=newest", label: t("nav.newArrivals") },
    { href: "/lookbook", label: t("nav.lookbook") },
    { href: "/about", label: t("nav.about") },
    { href: "/track", label: t("nav.track") },
  ];

  return (
    <>
      {config.brand.showAnnouncement && announcement && (
        <div className="relative z-50 bg-ink text-bone">
          <div className="container-page flex items-center justify-center py-2.5 text-center">
            <LocaleLink href={config.brand.announcementLink || "/shop"} className="text-[0.66rem] font-medium uppercase tracking-[0.16em] hover:text-brass">
              {announcement}
            </LocaleLink>
          </div>
        </div>
      )}

      <header
        className={cn(
          "sticky top-0 z-50 border-b bg-paper/90 backdrop-blur-md transition-all duration-500 ease-editorial",
          condensed ? "border-line" : "border-transparent",
        )}
        onMouseLeave={() => setMega(false)}
      >
        <div className={cn("container-page flex items-center justify-between gap-6 transition-all duration-500 ease-editorial", condensed ? "py-3" : "py-5")}>
          {/* left: mobile menu + nav */}
          <div className="flex flex-1 items-center gap-6">
            <button type="button" onClick={() => setMobile(true)} aria-label={t("common.menu")} className="p-1 lg:hidden">
              <Menu className="h-5 w-5" aria-hidden />
            </button>

            <nav aria-label={t("nav.shop")} className="hidden items-center gap-7 lg:flex">
              <button
                type="button"
                onMouseEnter={() => setMega(true)}
                onClick={() => setMega((v) => !v)}
                aria-expanded={mega}
                className="flex items-center gap-1.5 text-[0.7rem] font-semibold uppercase tracking-[0.16em] transition hover:text-oxide"
              >
                {t("nav.shop")}
                <ChevronDown className={cn("h-3 w-3 transition-transform duration-300", mega && "rotate-180")} aria-hidden />
              </button>
              {links.slice(0, 3).map((l) => (
                <LocaleLink key={l.href} href={l.href} className="text-[0.7rem] font-semibold uppercase tracking-[0.16em] transition hover:text-oxide">
                  {l.label}
                </LocaleLink>
              ))}
            </nav>
          </div>

          {/* centre: logo */}
          <LocaleLink href="/" aria-label={config.brand.name || "ORYNVE"} className="shrink-0">
            {config.brand.logoUrl ? (
              <img src={config.brand.logoUrl} alt={config.brand.name} className={cn("w-auto transition-all duration-500", condensed ? "h-5" : "h-7")} />
            ) : (
              <Logo withMonogram={!condensed} name={config.brand.name} />
            )}
          </LocaleLink>

          {/* right: actions */}
          <div className="flex flex-1 items-center justify-end gap-1.5 sm:gap-3">
            {links.slice(3).map((l) => (
              <LocaleLink key={l.href} href={l.href} className="hidden text-[0.7rem] font-semibold uppercase tracking-[0.16em] transition hover:text-oxide xl:block">
                {l.label}
              </LocaleLink>
            ))}

            {features.languageSwitcher && SUPPORTED_LOCALES.length > 1 && (
              <div className="hidden items-center gap-1 text-[0.66rem] font-semibold uppercase tracking-[0.14em] md:flex">
                {SUPPORTED_LOCALES.map((l) => (
                  <button
                    key={l}
                    type="button"
                    onClick={() => switchLocale(l)}
                    aria-current={l === locale}
                    className={cn("px-1 transition", l === locale ? "text-ink underline decoration-oxide underline-offset-4" : "text-muted hover:text-ink")}
                  >
                    {localeMeta[l]?.nativeName ?? l}
                  </button>
                ))}
              </div>
            )}

            {features.currencySwitcher && currencies.length > 1 && (
              <label className="hidden md:block">
                <span className="sr-only">{t("common.currency")}</span>
                <select
                  value={currency.code}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="border-0 bg-transparent text-[0.66rem] font-semibold uppercase tracking-[0.14em] text-muted outline-none hover:text-ink"
                >
                  {currencies.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.code}
                    </option>
                  ))}
                </select>
              </label>
            )}

            {features.darkModeToggle && (
              <button type="button" onClick={() => setTheme(theme === "dark" ? "light" : "dark")} aria-label={t("common.theme")} className="p-1.5 text-muted hover:text-ink">
                {theme === "dark" ? <Sun className="h-4 w-4" aria-hidden /> : <Moon className="h-4 w-4" aria-hidden />}
              </button>
            )}

            {features.search && (
              <button type="button" onClick={() => cart.openSearch(true)} aria-label={t("common.search")} className="p-1.5 hover:text-oxide">
                <Search className="h-[1.1rem] w-[1.1rem]" aria-hidden />
              </button>
            )}

            {features.wishlist && (
              <LocaleLink href="/wishlist" aria-label={t("common.wishlist")} className="relative p-1.5 hover:text-oxide">
                <Heart className="h-[1.1rem] w-[1.1rem]" aria-hidden />
                {wishCount > 0 && <span className="absolute -right-0.5 -top-0.5 min-w-[1rem] bg-oxide px-1 text-center text-[0.55rem] font-bold leading-4 text-paper">{wishCount}</span>}
              </LocaleLink>
            )}

            {features.cart && (
              <button type="button" onClick={() => cart.openCart(true)} aria-label={`${t("common.bag")} (${cart.count})`} className="relative p-1.5 hover:text-oxide">
                <ShoppingBag className="h-[1.1rem] w-[1.1rem]" aria-hidden />
                {cart.count > 0 && <span className="absolute -right-0.5 -top-0.5 min-w-[1rem] bg-ink px-1 text-center text-[0.55rem] font-bold leading-4 text-paper">{cart.count}</span>}
              </button>
            )}
          </div>
        </div>

        {/* mega menu */}
        <AnimatePresence>
          {mega && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: DUR.fast, ease: EASE }}
              className="absolute inset-x-0 top-full hidden border-y border-line bg-paper lg:block"
            >
              <div className="container-page grid grid-cols-[1.1fr_1.4fr] gap-14 py-12">
                <div>
                  <p className="eyebrow mb-5">{t("nav.categories")}</p>
                  <ul className="grid grid-cols-2 gap-x-8 gap-y-2.5">
                    <li className="col-span-2">
                      <LocaleLink href="/shop" className="display text-xl hover:text-oxide">
                        {t("nav.allPieces")}
                      </LocaleLink>
                    </li>
                    {categories.map((c) => (
                      <li key={c.slug}>
                        <LocaleLink href={`/shop?category=${c.slug}`} className="group flex items-baseline gap-2 py-0.5 text-sm transition hover:text-oxide">
                          <span>{c.name}</span>
                          <span className="text-[0.62rem] text-muted">{c.count}</span>
                        </LocaleLink>
                      </li>
                    ))}
                  </ul>
                </div>

                <div>
                  <p className="eyebrow mb-5">{t("nav.featuredCollections")}</p>
                  <div className="grid grid-cols-2 gap-5">
                    {collections.slice(0, 2).map((c) => (
                      <LocaleLink key={c.slug} href={`/collections/${c.slug}`} className="group block">
                        <span className="block aspect-[4/3] w-full overflow-hidden bg-bone">
                          {c.image ? (
                            <img
                              src={c.image}
                              alt={c.name}
                              loading="lazy"
                              decoding="async"
                              className="h-full w-full object-cover transition-transform duration-[900ms] ease-editorial group-hover:scale-[1.04]"
                            />
                          ) : (
                            <span className="skeleton block h-full w-full" />
                          )}
                        </span>
                        <span className="display mt-3 block text-lg group-hover:text-oxide">{c.name}</span>
                      </LocaleLink>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* mobile menu */}
      <Modal open={mobile} onClose={() => setMobile(false)} side="left" title={t("common.menu")} className="max-w-[22rem]">
        <nav aria-label={t("common.menu")} className="flex flex-col">
          <LocaleLink href="/shop" onClick={() => setMobile(false)} className="display border-b border-line py-4 text-display-sm hover:text-oxide">
            {t("nav.shop")}
          </LocaleLink>
          {links.map((l) => (
            <LocaleLink key={l.href} href={l.href} onClick={() => setMobile(false)} className="display border-b border-line py-4 text-display-sm hover:text-oxide">
              {l.label}
            </LocaleLink>
          ))}
        </nav>

        {categories.length > 0 && (
          <div className="mt-8">
            <p className="eyebrow mb-3">{t("nav.categories")}</p>
            <ul className="flex flex-wrap gap-2">
              {categories.map((c) => (
                <li key={c.slug}>
                  <LocaleLink
                    href={`/shop?category=${c.slug}`}
                    onClick={() => setMobile(false)}
                    className="block border border-line px-3 py-1.5 text-xs text-muted hover:border-ink hover:text-ink"
                  >
                    {c.name}
                  </LocaleLink>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-10 flex flex-col gap-5 border-t border-line pt-6">
          {features.languageSwitcher && (
            <div>
              <p className="eyebrow mb-2">{t("common.language")}</p>
              <div className="flex gap-2">
                {SUPPORTED_LOCALES.map((l) => (
                  <button
                    key={l}
                    type="button"
                    onClick={() => {
                      setMobile(false);
                      switchLocale(l);
                    }}
                    className={cn("border px-3 py-1.5 text-xs", l === locale ? "border-ink bg-ink text-paper" : "border-line text-muted")}
                  >
                    {localeMeta[l]?.nativeName ?? l}
                  </button>
                ))}
              </div>
            </div>
          )}

          {features.currencySwitcher && currencies.length > 1 && (
            <div>
              <p className="eyebrow mb-2">{t("common.currency")}</p>
              <div className="flex flex-wrap gap-2">
                {currencies.map((c) => (
                  <button
                    key={c.code}
                    type="button"
                    onClick={() => setCurrency(c.code)}
                    className={cn("border px-3 py-1.5 text-xs", c.code === currency.code ? "border-ink bg-ink text-paper" : "border-line text-muted")}
                  >
                    {c.symbol} {c.code}
                  </button>
                ))}
              </div>
            </div>
          )}

          {features.darkModeToggle && (
            <div>
              <p className="eyebrow mb-2">{t("common.theme")}</p>
              <div className="flex gap-2">
                {(["light", "dark"] as const).map((th) => (
                  <button
                    key={th}
                    type="button"
                    onClick={() => setTheme(th)}
                    className={cn("flex items-center gap-2 border px-3 py-1.5 text-xs", theme === th ? "border-ink bg-ink text-paper" : "border-line text-muted")}
                  >
                    {th === "light" ? <Sun className="h-3.5 w-3.5" aria-hidden /> : <Moon className="h-3.5 w-3.5" aria-hidden />}
                    {t(`common.${th}`)}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <button type="button" onClick={() => setMobile(false)} className="btn-ghost mt-10 text-muted">
          <X className="h-3.5 w-3.5" aria-hidden />
          {t("common.close")}
        </button>
      </Modal>
    </>
  );
}
