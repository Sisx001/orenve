"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Heart, Maximize2 } from "lucide-react";
import type { ProductCard as ProductCardType } from "@/types";
import { useT } from "@/lib/i18n/client";
import { useCart } from "@/hooks/useCart";
import { useFeatures } from "@/components/providers/ConfigProvider";
import { LocaleLink } from "@/components/store/LocaleLink";
import { PriceTag } from "@/components/store/PriceTag";
import { DUR, EASE, stagger } from "@/lib/store/motion";
import { cn } from "@/lib/utils";

export type ProductCardView = "grid" | "list" | "editorial";

export function ProductCard({
  product,
  index = 0,
  view = "grid",
  priority = false,
  className,
}: {
  product: ProductCardType;
  index?: number;
  view?: ProductCardView;
  priority?: boolean;
  className?: string;
}) {
  const t = useT();
  const features = useFeatures();
  const cart = useCart();
  const [hover, setHover] = useState(false);
  const wished = cart.isWished(product.id);

  const primary = product.images[0];
  const secondary = product.images[1];
  const showSecond = hover && !!secondary;

  const media = (
    <span
      className={cn(
        "group/media relative block overflow-hidden bg-bone",
        view === "editorial" ? "aspect-[4/5]" : view === "list" ? "aspect-[3/4]" : "aspect-[3/4]",
      )}
    >
      {primary ? (
        <>
          <img
            src={primary.url}
            alt={primary.alt}
            loading={priority ? "eager" : "lazy"}
            decoding="async"
            fetchPriority={priority ? "high" : "auto"}
            className={cn(
              "absolute inset-0 h-full w-full object-cover transition-all duration-[900ms] ease-editorial",
              showSecond ? "opacity-0" : "opacity-100",
              hover && "scale-[1.03]",
            )}
          />
          {secondary && (
            <img
              src={secondary.url}
              alt={secondary.alt}
              loading="lazy"
              decoding="async"
              className={cn(
                "absolute inset-0 h-full w-full object-cover transition-all duration-[900ms] ease-editorial",
                showSecond ? "scale-[1.03] opacity-100" : "opacity-0",
              )}
            />
          )}
        </>
      ) : (
        <span className="absolute inset-0 skeleton" />
      )}

      {/* badges */}
      <span className="pointer-events-none absolute left-0 top-0 flex flex-col items-start gap-1.5 p-3">
        {product.badge && (
          <span className="bg-paper/95 px-2.5 py-1 text-[0.6rem] font-semibold uppercase tracking-[0.16em] text-ink">{product.badge}</span>
        )}
        {product.compareAtPrice != null && product.compareAtPrice > product.price && (
          <span className="bg-oxide px-2.5 py-1 text-[0.6rem] font-semibold uppercase tracking-[0.16em] text-paper">{t("common.sale")}</span>
        )}
        {features.stockBadges && !product.inStock && (
          <span className="bg-ink/85 px-2.5 py-1 text-[0.6rem] font-semibold uppercase tracking-[0.16em] text-paper">{t("common.soldOut")}</span>
        )}
      </span>
    </span>
  );

  const details = (
    <div className={cn("flex flex-col gap-2", view === "list" ? "py-1" : "pt-4")}>
      <div className="flex items-start justify-between gap-3">
        <h3 className={cn("display leading-tight", view === "list" ? "text-display-sm" : "text-[1.05rem]")}>
          <LocaleLink href={`/product/${product.slug}`} className="hover:text-oxide" data-cursor={t("shop.quickView")}>
            {product.name}
          </LocaleLink>
        </h3>
        <PriceTag price={product.price} compareAt={product.compareAtPrice} size={view === "list" ? "md" : "sm"} showPercent={false} className="shrink-0" />
      </div>

      {product.category && <p className="eyebrow">{product.category}</p>}

      {view === "list" && product.tags.length > 0 && <p className="max-w-prose text-sm text-muted">{product.tags.join(" · ")}</p>}

      <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-2">
        {product.colors.length > 0 && (
          <span className="flex items-center gap-1.5" aria-label={t("product.selectColor")}>
            {product.colors.slice(0, 5).map((c) => (
              <span
                key={c.value}
                title={c.value}
                className="h-2.5 w-2.5 rounded-full border border-line"
                style={{ background: c.hex ?? "rgb(var(--c-line))" }}
              />
            ))}
            {product.colors.length > 5 && <span className="text-[0.62rem] text-muted">+{product.colors.length - 5}</span>}
          </span>
        )}
        {product.sizes.length > 0 && (
          <span className={cn("flex flex-wrap items-center gap-1.5 text-[0.62rem] uppercase tracking-[0.12em]", product.inStock ? "text-muted" : "text-line")}>
            {product.sizes.slice(0, 6).map((s) => (
              <span key={s} className={cn(!product.inStock && "line-through")}>
                {s}
              </span>
            ))}
          </span>
        )}
      </div>
    </div>
  );

  return (
    <motion.article
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-8% 0px" }}
      transition={{ duration: DUR.base, ease: EASE, delay: stagger(index) }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className={cn("group relative", view === "list" && "grid grid-cols-[minmax(7rem,14rem)_1fr] items-center gap-6 border-b border-line pb-8", className)}
    >
      <div className="relative">
        <LocaleLink href={`/product/${product.slug}`} className="block" aria-label={product.name}>
          {media}
        </LocaleLink>

        {/* actions */}
        <div className="absolute right-0 top-0 flex flex-col gap-1 p-3">
          {features.wishlist && (
            <button
              type="button"
              onClick={() => cart.toggleWish(product.id)}
              aria-label={t("common.wishlist")}
              aria-pressed={wished}
              className="flex h-9 w-9 items-center justify-center bg-paper/90 text-ink transition hover:bg-paper"
            >
              <Heart className={cn("h-4 w-4", wished && "fill-oxide text-oxide")} aria-hidden />
            </button>
          )}
          {features.quickView && (
            <button
              type="button"
              onClick={() => cart.setQuickView(product.slug)}
              aria-label={t("shop.quickView")}
              className="hidden h-9 w-9 items-center justify-center bg-paper/90 text-ink opacity-0 transition duration-300 ease-editorial hover:bg-paper group-hover:opacity-100 md:flex"
            >
              <Maximize2 className="h-3.5 w-3.5" aria-hidden />
            </button>
          )}
        </div>

        {features.quickView && (
          <button
            type="button"
            onClick={() => cart.setQuickView(product.slug)}
            className="absolute inset-x-3 bottom-3 hidden translate-y-2 bg-paper/95 py-3 text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-ink opacity-0 transition duration-500 ease-editorial hover:bg-ink hover:text-paper group-hover:translate-y-0 group-hover:opacity-100 md:block"
          >
            {t("shop.quickView")}
          </button>
        )}
      </div>

      {details}
    </motion.article>
  );
}
