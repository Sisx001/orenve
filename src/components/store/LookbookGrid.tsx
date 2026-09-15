"use client";

import { Plus } from "lucide-react";
import { useCart } from "@/hooks/useCart";
import { useT } from "@/lib/i18n/client";
import { useFeatures } from "@/components/providers/ConfigProvider";
import { LocaleLink } from "@/components/store/LocaleLink";
import { Reveal } from "@/components/store/Reveal";
import { cn } from "@/lib/utils";

export type LookbookItem = { image: string; slug?: string; caption?: string };

/** Editorial masonry of campaign frames and product imagery. */
export function LookbookGrid({ items }: { items: LookbookItem[] }) {
  const t = useT();
  const cart = useCart();
  const features = useFeatures();
  if (items.length === 0) return null;

  return (
    <div className="columns-1 gap-4 sm:columns-2 lg:columns-3 lg:gap-6 3xl:columns-4">
      {items.map((it, i) => (
        <Reveal key={`${it.image}-${i}`} delay={Math.min((i % 6) * 0.06, 0.35)} className="mb-4 break-inside-avoid lg:mb-6">
          <figure className="group relative overflow-hidden bg-bone">
            <img
              src={it.image}
              alt={it.caption ?? ""}
              loading={i < 4 ? "eager" : "lazy"}
              decoding="async"
              className={cn(
                "w-full object-cover transition-transform duration-[1200ms] ease-editorial group-hover:scale-[1.03]",
                i % 5 === 0 ? "aspect-[3/4]" : i % 5 === 3 ? "aspect-square" : "aspect-[4/5]",
              )}
            />
            <span aria-hidden className="absolute inset-0 bg-ink/0 transition-colors duration-700 group-hover:bg-coal/25" />

            {it.slug && (
              <figcaption className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-4 opacity-0 transition-opacity duration-500 group-hover:opacity-100">
                {features.quickView ? (
                  <button
                    type="button"
                    onClick={() => cart.setQuickView(it.slug ?? null)}
                    className="flex items-center gap-2 bg-paper/95 px-3 py-2 text-[0.6rem] font-semibold uppercase tracking-[0.14em] text-ink transition hover:bg-ink hover:text-paper"
                  >
                    <Plus className="h-3 w-3" aria-hidden />
                    {t("home.shopTheLook")}
                  </button>
                ) : (
                  <LocaleLink
                    href={`/product/${it.slug}`}
                    className="flex items-center gap-2 bg-paper/95 px-3 py-2 text-[0.6rem] font-semibold uppercase tracking-[0.14em] text-ink transition hover:bg-ink hover:text-paper"
                  >
                    <Plus className="h-3 w-3" aria-hidden />
                    {t("home.shopTheLook")}
                  </LocaleLink>
                )}
                {it.caption && <span className="display-italic text-right text-xs text-snow drop-shadow">{it.caption}</span>}
              </figcaption>
            )}
          </figure>
        </Reveal>
      ))}
    </div>
  );
}
