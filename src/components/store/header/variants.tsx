"use client";

/**
 * The five header variants. Each one is pure composition over ./parts.tsx —
 * `classic` reproduces the header ORYNVE shipped with, byte for byte, so the
 * default store does not move.
 */
import { cn } from "@/lib/utils";
import { useHeader, useTheme } from "./context";
import { ActionIcons, AppearanceToggle, BrandMark, CurrencySelect, LanguagePills, NavLinks, SecondaryLinks, SheetTrigger, SubmenuPanel } from "./parts";

const SHELL = "site-header sticky top-0 z-50 border-b bg-paper/90 backdrop-blur-md transition-all duration-500 ease-editorial";

/** True when the theme wants the hamburger at every breakpoint. */
function useDrawerOnly() {
  return useTheme().layout.menu === "drawer";
}

function Utilities({ compact = false }: { compact?: boolean }) {
  return (
    <>
      <LanguagePills className="hidden md:flex" />
      <CurrencySelect className="hidden md:block" />
      {!compact && <AppearanceToggle />}
      <ActionIcons />
    </>
  );
}

/* ─────────────────────────── classic (shipped default) ─────────────────────────── */

export function ClassicHeader() {
  const { condensed, setSubmenu } = useHeader();
  const drawer = useDrawerOnly();
  return (
    <header className={cn(SHELL, condensed ? "border-line" : "border-transparent")} onMouseLeave={() => setSubmenu(false)}>
      <div className={cn("container-page flex items-center justify-between gap-6 transition-all duration-500 ease-editorial", condensed ? "py-3" : "py-5")}>
        <div className="flex flex-1 items-center gap-6">
          <SheetTrigger className={drawer ? "" : "lg:hidden"} />
          {!drawer && <NavLinks className="hidden lg:flex" />}
        </div>

        <BrandMark />

        <div className="flex flex-1 items-center justify-end gap-1.5 sm:gap-3">
          <SecondaryLinks className="hidden xl:block" />
          <Utilities />
        </div>
      </div>
      <SubmenuPanel />
    </header>
  );
}

/* ─────────────────────────── centered ─────────────────────────── */

/** Logo centred on its own row, nav underneath. Collapses to one row on scroll. */
export function CenteredHeader() {
  const { condensed, setSubmenu } = useHeader();
  const drawer = useDrawerOnly();
  return (
    <header className={cn(SHELL, condensed ? "border-line" : "border-transparent")} onMouseLeave={() => setSubmenu(false)}>
      <div className={cn("container-page transition-all duration-500 ease-editorial", condensed ? "py-2.5" : "py-5")}>
        <div className="flex items-center justify-between gap-6">
          <div className="flex flex-1 items-center gap-3">
            <SheetTrigger className={drawer ? "" : "lg:hidden"} />
            <LanguagePills className="hidden md:flex" />
            <CurrencySelect className="hidden md:block" />
          </div>
          <BrandMark large={!condensed} />
          <div className="flex flex-1 items-center justify-end gap-1.5 sm:gap-3">
            <AppearanceToggle />
            <ActionIcons />
          </div>
        </div>
        {!drawer && (
          <div className={cn("hidden justify-center transition-all duration-500 ease-editorial lg:flex", condensed ? "mt-1.5" : "mt-4")}>
            <NavLinks className="flex" count={5} />
          </div>
        )}
      </div>
      <SubmenuPanel />
    </header>
  );
}

/* ─────────────────────────── split ─────────────────────────── */

/** One row, three zones: nav left, logo centred absolutely, utilities right. */
export function SplitHeader() {
  const { condensed, setSubmenu } = useHeader();
  const drawer = useDrawerOnly();
  return (
    <header className={cn(SHELL, condensed ? "border-line" : "border-transparent")} onMouseLeave={() => setSubmenu(false)}>
      <div className={cn("container-page relative flex items-center justify-between gap-6 transition-all duration-500 ease-editorial", condensed ? "py-3" : "py-4")}>
        <div className="flex items-center gap-6">
          <SheetTrigger className={drawer ? "" : "lg:hidden"} />
          {!drawer && <NavLinks className="hidden lg:flex" count={5} />}
        </div>

        <div className="pointer-events-none absolute inset-x-0 flex justify-center">
          <span className="pointer-events-auto">
            <BrandMark />
          </span>
        </div>

        <div className="flex items-center justify-end gap-1.5 sm:gap-3">
          <Utilities />
        </div>
      </div>
      <SubmenuPanel />
    </header>
  );
}

/* ─────────────────────────── transparent ─────────────────────────── */

/**
 * Sits over the hero on the home page and turns solid once the visitor scrolls
 * (or immediately on any other route). The transparent state is styled by
 * `[data-header="transparent"] .site-header[data-solid="false"]` in globals.css
 * so the text flips to snow without every child needing a class.
 */
export function TransparentHeader() {
  const { condensed, isHome, setSubmenu } = useHeader();
  const drawer = useDrawerOnly();
  const solid = condensed || !isHome;
  return (
    <header
      data-solid={solid ? "true" : "false"}
      className={cn("site-header sticky top-0 z-50 border-b transition-all duration-500 ease-editorial", solid ? "border-line bg-paper/90 backdrop-blur-md" : "border-transparent")}
      onMouseLeave={() => setSubmenu(false)}
    >
      <div className={cn("container-page flex items-center justify-between gap-6 transition-all duration-500 ease-editorial", solid ? "py-3" : "py-6")}>
        <div className="flex flex-1 items-center gap-6">
          <SheetTrigger className={drawer ? "" : "lg:hidden"} />
          {!drawer && <NavLinks className="hidden lg:flex" />}
        </div>
        <BrandMark />
        <div className="flex flex-1 items-center justify-end gap-1.5 sm:gap-3">
          <SecondaryLinks className="hidden xl:block" />
          <Utilities />
        </div>
      </div>
      <SubmenuPanel />
    </header>
  );
}

/* ─────────────────────────── utility ─────────────────────────── */

/** A thin hairline row (language, currency, contact) above the main header row. */
export function UtilityHeader() {
  const { condensed, setSubmenu } = useHeader();
  const drawer = useDrawerOnly();
  return (
    <header className={cn(SHELL, condensed ? "border-line" : "border-transparent")} onMouseLeave={() => setSubmenu(false)}>
      <div className="border-b border-line/70">
        <div className="container-page flex items-center justify-between gap-4 py-1.5 text-[0.62rem] uppercase tracking-[0.14em] text-muted">
          <LanguagePills className="flex" />
          <div className="flex items-center gap-4">
            <SecondaryLinks className="hidden sm:block" from={4} />
            <CurrencySelect />
            <AppearanceToggle className="p-0.5" />
          </div>
        </div>
      </div>

      <div className={cn("container-page flex items-center justify-between gap-6 transition-all duration-500 ease-editorial", condensed ? "py-2.5" : "py-4")}>
        <div className="flex flex-1 items-center gap-6">
          <SheetTrigger className={drawer ? "" : "lg:hidden"} />
          {!drawer && <NavLinks className="hidden lg:flex" />}
        </div>
        <BrandMark />
        <div className="flex flex-1 items-center justify-end gap-1.5 sm:gap-3">
          <SecondaryLinks className="hidden xl:block" from={3} />
          <ActionIcons />
        </div>
      </div>
      <SubmenuPanel />
    </header>
  );
}
