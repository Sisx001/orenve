"use client";

/**
 * Storefront footer entry point. Picks the variant from the resolved theme's
 * `layout.footer`; `editorial` is the shipped default.
 */
import { useTheme } from "@/lib/theme/client";
import type { FooterStyle } from "@/lib/theme/types";
import { ColumnsFooter, CompactFooter, EditorialFooter, MinimalFooter } from "./variants";
import type { FooterPage } from "./parts";

export type { FooterPage };

const VARIANTS: Record<FooterStyle, (props: { pages: FooterPage[] }) => React.JSX.Element> = {
  editorial: EditorialFooter,
  columns: ColumnsFooter,
  compact: CompactFooter,
  minimal: MinimalFooter,
};

export function SiteFooter({ pages }: { pages: FooterPage[] }) {
  const { layout } = useTheme();
  const Variant = VARIANTS[layout.footer] ?? EditorialFooter;
  return <Variant pages={pages} />;
}
