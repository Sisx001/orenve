"use client";

import { Plus } from "lucide-react";
import { useCart } from "@/hooks/useCart";
import { useT } from "@/lib/i18n/client";
import { useFeatures } from "@/components/providers/ConfigProvider";
import { LocaleLink } from "@/components/store/LocaleLink";
import { Reveal } from "@/components/store/Reveal";
import { SectionHeading } from "@/components/store/SectionHeading";
import { cn } from "@/lib/utils";

export type LookbookFrame = { image: string; productSlug?: string; x?: number; y?: number; caption?: string };

/** Campaign frames with "shop the look" hotspots that open quick view. */
export function LookbookBlock({ eyebrow, title, frames }: { eyebrow?: string; title: string; frames: LookbookFrame[] }) {
  const t = useT();
  const cart = useCart();
  const features = useFeatures();
  if (frames.length === 0) return null;

  return (
    <section className="section">
      <div className="container-page">
        <SectionHeading eyebrow={eyebrow} title={title} />

        <div className="mt-14 grid gap-6 md:grid-cols-2 md:gap-8">
          {frames.map((f, i) => (
            <Reveal
              key={`${f.image}-${i}`}
              delay={Math.min(i * 0.09, 0.45)}
              className={cn("relative", i % 3 === 0 ? "md:col-span-2" : "")}
            >
              <div className="relative overflow-hidden bg-bone">
                <span className={cn("block w-full", i % 3 === 0 ? "aspect-[16/9]" : "aspect-[4/5]")}>
                  <img src={f.image} alt={f.caption ?? ""} loading="lazy" decoding="async" className="h-full w-full object-cover" />
                </span>

                {f.productSlug && (
                  <div className="absolute" style={{ left: `${f.x ?? 50}%`, top: `${f.y ?? 68}%`, transform: "translate(-50%, -50%)" }}>
                    {features.quickView ? (
                      <button
                        type="button"
                        onClick={() => cart.setQuickView(f.productSlug ?? null)}
                        aria-label={t("home.shopTheLook")}
                        className="group flex items-center gap-2 bg-paper/95 px-3 py-2 text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-ink shadow-lg transition hover:bg-ink hover:text-paper"
                      >
                        <Plus className="h-3 w-3 transition-transform duration-500 group-hover:rotate-90" aria-hidden />
                        {t("home.shopTheLook")}
                      </button>
                    ) : (
                      <LocaleLink
                        href={`/product/${f.productSlug}`}
                        className="flex items-center gap-2 bg-paper/95 px-3 py-2 text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-ink shadow-lg transition hover:bg-ink hover:text-paper"
                      >
                        <Plus className="h-3 w-3" aria-hidden />
                        {t("home.shopTheLook")}
                      </LocaleLink>
                    )}
                  </div>
                )}
              </div>
              {f.caption && <p className="display-italic mt-3 text-sm text-muted">{f.caption}</p>}
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
