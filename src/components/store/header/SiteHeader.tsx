"use client";

/**
 * Storefront header entry point. Picks the variant from the resolved theme's
 * `layout.header` and wraps everything in `HeaderProvider` so all variants and
 * parts share one piece of state (scroll, submenu, sheet, nav links).
 *
 * `classic` is the shipped default and renders the header ORYNVE has always
 * had; the other four are opt-in through the theme.
 */
import { AnnouncementBar, NavSheet } from "./parts";
import { CenteredHeader, ClassicHeader, SplitHeader, TransparentHeader, UtilityHeader } from "./variants";
import { HeaderProvider, useTheme, type NavCategory, type NavCollection } from "./context";
import type { HeaderStyle } from "@/lib/theme/types";

export type { NavCategory, NavCollection };

const VARIANTS: Record<HeaderStyle, () => React.JSX.Element> = {
  classic: ClassicHeader,
  centered: CenteredHeader,
  split: SplitHeader,
  transparent: TransparentHeader,
  utility: UtilityHeader,
};

function HeaderBody() {
  const { layout } = useTheme();
  const Variant = VARIANTS[layout.header] ?? ClassicHeader;
  return (
    <>
      <AnnouncementBar />
      <Variant />
      <NavSheet />
    </>
  );
}

export function SiteHeader({ categories, collections }: { categories: NavCategory[]; collections: NavCollection[] }) {
  return (
    <HeaderProvider categories={categories} collections={collections}>
      <HeaderBody />
    </HeaderProvider>
  );
}
