"use client";

/**
 * Building blocks shared by every header variant: the announcement bar, the
 * brand mark, nav links, the utility cluster (language / currency / appearance /
 * search / wishlist / bag), the two desktop submenu panels and the mobile sheet.
 * Variants in ./variants.tsx compose these — no variant owns markup twice.
 */
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, Heart, Menu, Monitor, Moon, MoonStar, Search, ShoppingBag, Sun, X } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { LocaleLink } from "@/components/store/LocaleLink";
import { Modal } from "@/components/ui";
import { DUR, EASE } from "@/lib/store/motion";
import { cn } from "@/lib/utils";
import type { ThemeMode, ThemeModePreference } from "@/lib/theme/types";
import { useCart, useConfig, useHeader, useTheme } from "./context";

/* ─────────────────────────── Announcement ─────────────────────────── */

export function AnnouncementBar() {
  const { announcement } = useHeader();
  const { config } = useConfig();
  if (!config.brand.showAnnouncement || !announcement) return null;
  return (
    <div className="relative z-50 bg-coal text-snow">
      <div className="container-page flex items-center justify-center py-2.5 text-center">
        <LocaleLink href={config.brand.announcementLink || "/shop"} className="text-[0.66rem] font-medium uppercase tracking-[0.16em] hover:text-brass">
          {announcement}
        </LocaleLink>
      </div>
    </div>
  );
}

/* ─────────────────────────── Brand ─────────────────────────── */

export function BrandMark({ large = false }: { large?: boolean }) {
  const { condensed } = useHeader();
  const { config } = useConfig();
  const small = condensed && !large;
  return (
    <LocaleLink href="/" aria-label={config.brand.name || "ORYNVE"} className="shrink-0">
      {config.brand.logoUrl ? (
        <img src={config.brand.logoUrl} alt={config.brand.name} className={cn("w-auto transition-all duration-500", small ? "h-5" : large ? "h-9" : "h-7")} />
      ) : (
        <Logo withMonogram={!small} name={config.brand.name} />
      )}
    </LocaleLink>
  );
}

/* ─────────────────────────── Nav ─────────────────────────── */

const NAV_LINK = "text-[0.7rem] font-semibold uppercase tracking-[0.16em] transition hover:text-oxide";

/** The Shop entry: a button that opens a panel, or a plain link for `inline`/`drawer`. */
export function ShopEntry() {
  const { t, submenu, setSubmenu } = useHeader();
  const { layout } = useTheme();
  if (layout.menu === "inline" || layout.menu === "drawer") {
    return (
      <LocaleLink href="/shop" className={NAV_LINK}>
        {t("nav.shop")}
      </LocaleLink>
    );
  }
  return (
    <button
      type="button"
      onMouseEnter={() => setSubmenu(true)}
      onClick={() => setSubmenu(!submenu)}
      aria-expanded={submenu}
      className={cn(NAV_LINK, "flex items-center gap-1.5")}
    >
      {t("nav.shop")}
      <ChevronDown className={cn("h-3 w-3 transition-transform duration-300", submenu && "rotate-180")} aria-hidden />
    </button>
  );
}

/**
 * Desktop nav. `inline` promotes the collections straight into the bar instead
 * of hiding them behind a submenu; every other style shows the Shop entry plus
 * the first three primary links.
 */
export function NavLinks({ className, count = 3 }: { className?: string; count?: number }) {
  const { t, links, collections } = useHeader();
  const { layout } = useTheme();
  const inline = layout.menu === "inline";
  return (
    <nav aria-label={t("nav.shop")} className={cn("items-center gap-7", className)}>
      <ShopEntry />
      {inline
        ? collections.slice(0, 3).map((c) => (
            <LocaleLink key={c.slug} href={`/collections/${c.slug}`} className={NAV_LINK}>
              {c.name}
            </LocaleLink>
          ))
        : null}
      {links.slice(0, count).map((l) => (
        <LocaleLink key={l.href} href={l.href} className={NAV_LINK}>
          {l.label}
        </LocaleLink>
      ))}
    </nav>
  );
}

export function SecondaryLinks({ className, from = 3 }: { className?: string; from?: number }) {
  const { links } = useHeader();
  return (
    <>
      {links.slice(from).map((l) => (
        <LocaleLink key={l.href} href={l.href} className={cn(NAV_LINK, className)}>
          {l.label}
        </LocaleLink>
      ))}
    </>
  );
}

/* ─────────────────────────── Appearance toggle ─────────────────────────── */

const MODE_ICON: Record<ThemeMode | "system", typeof Sun> = { light: Sun, dark: Moon, black: MoonStar, system: Monitor };

function modeLabelKey(mode: ThemeModePreference) {
  return mode === "light" ? "common.themeLight" : mode === "dark" ? "common.themeDark" : mode === "black" ? "common.themeBlack" : "common.themeSystem";
}

/**
 * Cycles through the modes the owner enabled (1–3 of light/dark/black). Hidden
 * when `allowVisitorToggle` is off, when the `darkModeToggle` feature is off, or
 * when only one mode exists.
 */
export function AppearanceToggle({ className }: { className?: string }) {
  const { t } = useHeader();
  const { config } = useConfig();
  const { effective, setMode, available, allowVisitorToggle } = useTheme();
  if (!allowVisitorToggle || !config.features.darkModeToggle || available.length < 2) return null;
  const next = available[(Math.max(0, available.indexOf(effective)) + 1) % available.length];
  const Icon = MODE_ICON[next];
  return (
    <button
      type="button"
      onClick={() => setMode(next)}
      aria-label={`${t("common.appearance")}: ${t(modeLabelKey(next))}`}
      title={t(modeLabelKey(next))}
      className={cn("p-1.5 text-muted transition hover:text-ink", className)}
    >
      <Icon className="h-4 w-4" aria-hidden />
    </button>
  );
}

/** The full picker used inside the mobile sheet — every enabled mode plus "system". */
export function AppearancePicker() {
  const { t } = useHeader();
  const { config } = useConfig();
  const { mode, setMode, available, allowVisitorToggle } = useTheme();
  if (!allowVisitorToggle || !config.features.darkModeToggle || available.length < 2) return null;
  const options: ThemeModePreference[] = [...available, "system"];
  return (
    <div>
      <p className="eyebrow mb-2">{t("common.appearance")}</p>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const Icon = MODE_ICON[option];
          return (
            <button
              key={option}
              type="button"
              onClick={() => setMode(option)}
              aria-pressed={mode === option}
              className={cn("flex items-center gap-2 border px-3 py-1.5 text-xs", mode === option ? "border-ink bg-ink text-paper" : "border-line text-muted")}
            >
              <Icon className="h-3.5 w-3.5" aria-hidden />
              {t(modeLabelKey(option))}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ─────────────────────────── Utilities ─────────────────────────── */

export function LanguagePills({ className }: { className?: string }) {
  const { t, locale, switchLocale } = useHeader();
  const { config } = useConfig();
  const locales = config.locales;
  if (!config.features.languageSwitcher || locales.length < 2) return null;
  return (
    <div className={cn("items-center gap-1 text-[0.66rem] font-semibold uppercase tracking-[0.14em]", className)} aria-label={t("common.language")}>
      {locales.map((l) => (
        <button
          key={l.code}
          type="button"
          lang={l.code}
          onClick={() => switchLocale(l.code)}
          aria-current={l.code === locale}
          className={cn("px-1 transition", l.code === locale ? "text-ink underline decoration-oxide underline-offset-4" : "text-muted hover:text-ink")}
        >
          {l.nativeName}
        </button>
      ))}
    </div>
  );
}

export function CurrencySelect({ className }: { className?: string }) {
  const { t } = useHeader();
  const { config, currency, currencies, setCurrency } = useConfig();
  if (!config.features.currencySwitcher || currencies.length < 2) return null;
  return (
    <label className={className}>
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
  );
}

/** Search, wishlist and bag — the icons present in every variant. */
export function ActionIcons() {
  const { t, wishCount } = useHeader();
  const { config } = useConfig();
  const cart = useCart();
  const features = config.features;
  return (
    <>
      {features.search && (
        <button type="button" onClick={() => cart.openSearch(true)} aria-label={t("common.search")} className="p-1.5 hover:text-oxide">
          <Search className="h-[1.1rem] w-[1.1rem]" aria-hidden />
        </button>
      )}
      {features.wishlist && (
        <LocaleLink href="/wishlist" aria-label={t("common.wishlist")} className="relative p-1.5 hover:text-oxide">
          <Heart className="h-[1.1rem] w-[1.1rem]" aria-hidden />
          {wishCount > 0 && <span className="absolute -right-0.5 -top-0.5 min-w-[1rem] bg-oxide px-1 text-center text-[0.55rem] font-bold leading-4 text-snow">{wishCount}</span>}
        </LocaleLink>
      )}
      {features.cart && (
        <button type="button" onClick={() => cart.openCart(true)} aria-label={`${t("common.bag")} (${cart.count})`} className="relative p-1.5 hover:text-oxide">
          <ShoppingBag className="h-[1.1rem] w-[1.1rem]" aria-hidden />
          {cart.count > 0 && <span className="absolute -right-0.5 -top-0.5 min-w-[1rem] bg-ink px-1 text-center text-[0.55rem] font-bold leading-4 text-paper">{cart.count}</span>}
        </button>
      )}
    </>
  );
}

export function SheetTrigger({ className }: { className?: string }) {
  const { t, setSheet } = useHeader();
  return (
    <button type="button" onClick={() => setSheet(true)} aria-label={t("common.menu")} className={cn("p-1", className)}>
      <Menu className="h-5 w-5" aria-hidden />
    </button>
  );
}

/* ─────────────────────────── Submenu panels ─────────────────────────── */

/** The editorial mega panel: categories on the left, two collection cards right. */
export function MegaPanel() {
  const { t, submenu, categories, collections } = useHeader();
  return (
    <AnimatePresence>
      {submenu && (
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
                        <img src={c.image} alt={c.name} loading="lazy" decoding="async" className="h-full w-full object-cover transition-transform duration-[900ms] ease-editorial group-hover:scale-[1.04]" />
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
  );
}

/** A compact two-column list panel — no imagery, opens under the Shop entry. */
export function DropdownPanel() {
  const { t, submenu, categories, collections } = useHeader();
  return (
    <AnimatePresence>
      {submenu && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: DUR.fast, ease: EASE }}
          className="absolute inset-x-0 top-full hidden border-y border-line bg-paper lg:block"
        >
          <div className="container-page grid grid-cols-2 gap-12 py-8 lg:grid-cols-3">
            <div>
              <p className="eyebrow mb-3">{t("nav.categories")}</p>
              <ul className="flex flex-col gap-1.5">
                <li>
                  <LocaleLink href="/shop" className="text-sm font-medium hover:text-oxide">
                    {t("nav.allPieces")}
                  </LocaleLink>
                </li>
                {categories.map((c) => (
                  <li key={c.slug}>
                    <LocaleLink href={`/shop?category=${c.slug}`} className="text-sm text-muted transition hover:text-ink">
                      {c.name}
                    </LocaleLink>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="eyebrow mb-3">{t("nav.collections")}</p>
              <ul className="flex flex-col gap-1.5">
                {collections.map((c) => (
                  <li key={c.slug}>
                    <LocaleLink href={`/collections/${c.slug}`} className="text-sm text-muted transition hover:text-ink">
                      {c.name}
                    </LocaleLink>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** Whichever panel the theme's `menu` style asks for (none for drawer/inline). */
export function SubmenuPanel() {
  const { layout } = useTheme();
  if (layout.menu === "mega") return <MegaPanel />;
  if (layout.menu === "dropdown") return <DropdownPanel />;
  return null;
}

/* ─────────────────────────── Mobile / drawer sheet ─────────────────────────── */

export function NavSheet() {
  const { t, locale, links, categories, sheet, setSheet, switchLocale } = useHeader();
  const { config, currency, currencies, setCurrency } = useConfig();
  const features = config.features;
  const locales = config.locales;

  return (
    <Modal open={sheet} onClose={() => setSheet(false)} side="left" title={t("common.menu")} className="max-w-[22rem]">
      <nav aria-label={t("common.menu")} className="flex flex-col">
        <LocaleLink href="/shop" onClick={() => setSheet(false)} className="display border-b border-line py-4 text-display-sm hover:text-oxide">
          {t("nav.shop")}
        </LocaleLink>
        {links.map((l) => (
          <LocaleLink key={l.href} href={l.href} onClick={() => setSheet(false)} className="display border-b border-line py-4 text-display-sm hover:text-oxide">
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
                <LocaleLink href={`/shop?category=${c.slug}`} onClick={() => setSheet(false)} className="block border border-line px-3 py-1.5 text-xs text-muted hover:border-ink hover:text-ink">
                  {c.name}
                </LocaleLink>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-10 flex flex-col gap-5 border-t border-line pt-6">
        {features.languageSwitcher && locales.length > 1 && (
          <div>
            <p className="eyebrow mb-2">{t("common.language")}</p>
            <div className="flex flex-wrap gap-2">
              {locales.map((l) => (
                <button
                  key={l.code}
                  type="button"
                  lang={l.code}
                  onClick={() => {
                    setSheet(false);
                    switchLocale(l.code);
                  }}
                  className={cn("border px-3 py-1.5 text-xs", l.code === locale ? "border-ink bg-ink text-paper" : "border-line text-muted")}
                >
                  {l.nativeName}
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

        <AppearancePicker />
      </div>

      <button type="button" onClick={() => setSheet(false)} className="btn-ghost mt-10 text-muted">
        <X className="h-3.5 w-3.5" aria-hidden />
        {t("common.close")}
      </button>
    </Modal>
  );
}
