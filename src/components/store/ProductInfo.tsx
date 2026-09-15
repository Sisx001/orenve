"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Heart, Minus, Plus, Share2, ShieldCheck, Truck, RefreshCcw, MessageCircle } from "lucide-react";
import type { CartLine, ProductDetail } from "@/types";
import { useT, useLocale } from "@/lib/i18n/client";
import { useConfig } from "@/components/providers/ConfigProvider";
import { useCart } from "@/hooks/useCart";
import { Accordion, type AccordionItem } from "@/components/store/Accordion";
import { PriceTag } from "@/components/store/PriceTag";
import { RatingStars } from "@/components/store/RatingStars";
import { SizeGuideModal } from "@/components/store/SizeGuideModal";
import { LocaleLink } from "@/components/store/LocaleLink";
import { Badge } from "@/components/ui";
import { localizedPath } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export type DeliveryZone = { name: string; etaMinDays: number; etaMaxDays: number } | null;

export function ProductInfo({
  product,
  mode = "full",
  delivery = null,
  onColorChange,
}: {
  product: ProductDetail;
  mode?: "full" | "quick";
  delivery?: DeliveryZone;
  onColorChange?: (color: string | null) => void;
}) {
  const t = useT();
  const locale = useLocale();
  const router = useRouter();
  const { config } = useConfig();
  const cart = useCart();
  const features = config.features;

  const colorOption = useMemo(() => product.options.find((o) => /^colou?r$/i.test(o.name)) ?? null, [product.options]);
  const sizeOption = useMemo(() => product.options.find((o) => /^size$/i.test(o.name)) ?? null, [product.options]);

  const variantFor = useCallback(
    (color: string | null, size: string | null) =>
      product.variants.find(
        (v) =>
          (!colorOption || color === null || v.options[colorOption.name] === color) &&
          (!sizeOption || size === null || v.options[sizeOption.name] === size),
      ) ?? null,
    [product.variants, colorOption, sizeOption],
  );

  const initialColor = useMemo(() => {
    if (!colorOption) return null;
    const inStock = colorOption.values.find((c) => (variantFor(c.value, null)?.stock ?? 0) > 0 || product.variants.some((v) => v.options[colorOption.name] === c.value && v.stock > 0));
    return (inStock ?? colorOption.values[0])?.value ?? null;
  }, [colorOption, product.variants, variantFor]);

  const [color, setColor] = useState<string | null>(initialColor);
  const [size, setSize] = useState<string | null>(null);
  const [qty, setQty] = useState(1);
  const [sizeError, setSizeError] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [shared, setShared] = useState(false);

  useEffect(() => {
    onColorChange?.(color);
  }, [color, onColorChange]);

  const variant = variantFor(color, size);
  const needsSize = !!sizeOption && !size;
  const unitPrice = variant?.price ?? product.price;
  const maxStock = variant?.stock ?? 0;
  const lowStock = !!variant && variant.stock > 0 && variant.stock <= variant.lowStockAt;
  const wished = cart.isWished(product.id);

  const stockForSize = useCallback((s: string) => variantFor(color, s)?.stock ?? 0, [variantFor, color]);
  const stockForColor = useCallback(
    (c: string) => (colorOption ? product.variants.filter((v) => v.options[colorOption.name] === c).reduce((a, v) => a + v.stock, 0) : product.totalStock),
    [colorOption, product.variants, product.totalStock],
  );

  const line = useMemo<Omit<CartLine, "key"> | null>(() => {
    if (!variant) return null;
    return {
      productId: product.id,
      variantId: variant.id,
      slug: product.slug,
      name: product.name,
      variantTitle: variant.title,
      options: variant.options,
      unitPrice: variant.price ?? product.price,
      quantity: qty,
      image: variant.imageUrl ?? product.images[0]?.url ?? null,
      maxStock: variant.stock,
    };
  }, [variant, product, qty]);

  function addToBag(): boolean {
    if (needsSize) {
      setSizeError(true);
      toast.error(t("product.chooseSizeFirst"));
      return false;
    }
    if (!line || maxStock < 1) {
      toast.error(t("product.soldOutText"));
      return false;
    }
    cart.add(line, qty);
    toast.success(t("product.added"));
    return true;
  }

  function buyNow() {
    if (!addToBag()) return;
    cart.openCart(false);
    router.push(localizedPath("/checkout", locale));
  }

  function orderWhatsapp() {
    if (!addToBag()) return;
    cart.openCart(false);
    router.push(`${localizedPath("/checkout", locale)}?channel=whatsapp`);
  }

  async function share() {
    const url = typeof window === "undefined" ? "" : window.location.href;
    const data = { title: product.name, text: product.seoDescription, url };
    if (typeof navigator !== "undefined" && "share" in navigator) {
      try {
        await navigator.share(data);
        return;
      } catch {
        /* user dismissed — fall through to copy */
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setShared(true);
      toast.success(t("common.copied"));
      setTimeout(() => setShared(false), 1800);
    } catch {
      toast.error(t("common.somethingWrong"));
    }
  }

  const accordionItems: AccordionItem[] = ([
    product.details.material ? { id: "material", title: t("product.material"), content: product.details.material } : null,
    product.details.fit ? { id: "fit", title: t("product.fit"), content: product.details.fit } : null,
    product.details.care ? { id: "care", title: t("product.care"), content: product.details.care } : null,
    product.details.shipping || product.details.returns
      ? {
          id: "shipping",
          title: t("product.shippingReturns"),
          content: (
            <div className="space-y-3">
              {product.details.shipping && <p>{product.details.shipping}</p>}
              {product.details.returns && <p>{product.details.returns}</p>}
            </div>
          ),
        }
      : null,
  ] as (AccordionItem | null)[]).filter((x): x is AccordionItem => x !== null);

  const soldOut = product.totalStock <= 0;

  return (
    <div className={cn("flex flex-col", mode === "full" ? "gap-8" : "gap-6")}>
      {/* heading */}
      <div>
        {mode === "full" && (
          <nav aria-label="Breadcrumb" className="eyebrow mb-5 flex flex-wrap items-center gap-2">
            <LocaleLink href="/shop" className="hover:text-ink">
              {t("product.breadcrumbShop")}
            </LocaleLink>
            {product.category && (
              <>
                <span aria-hidden>/</span>
                <span className="text-ink">{product.category}</span>
              </>
            )}
          </nav>
        )}

        <div className="flex flex-wrap items-center gap-2">
          {product.badge && <Badge tone="brass">{product.badge}</Badge>}
          {soldOut && <Badge tone="neutral">{t("common.soldOut")}</Badge>}
        </div>

        <h1 className={cn("display mt-3 text-balance", mode === "full" ? "text-display-md" : "text-display-sm")}>
          {mode === "quick" ? (
            <LocaleLink href={`/product/${product.slug}`} className="hover:text-oxide">
              {product.name}
            </LocaleLink>
          ) : (
            product.name
          )}
        </h1>

        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2">
          <PriceTag price={unitPrice} compareAt={product.compareAtPrice} size="lg" />
          {features.reviews && product.rating.count > 0 && (
            <a href="#reviews" className="flex items-center gap-2 text-xs text-muted hover:text-ink">
              <RatingStars value={product.rating.average} label={`${product.rating.average} / 5`} />
              <span className="tabular-nums">{t("product.reviewCount", { count: product.rating.count })}</span>
            </a>
          )}
        </div>

        {mode === "full" && <p className="prose-editorial mt-6 max-w-prose text-muted">{product.description}</p>}
      </div>

      {/* colour */}
      {colorOption && colorOption.values.length > 0 && (
        <fieldset>
          <legend className="eyebrow mb-3">
            {t("product.selectColor")}
            {color && <span className="ml-2 normal-case tracking-normal text-ink">{color}</span>}
          </legend>
          <div className="flex flex-wrap gap-2.5">
            {colorOption.values.map((c) => {
              const out = stockForColor(c.value) <= 0;
              const active = color === c.value;
              return (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => {
                    setColor(c.value);
                    setSize(null);
                    setQty(1);
                  }}
                  aria-pressed={active}
                  aria-label={c.value}
                  title={c.value}
                  className={cn(
                    "relative h-9 w-9 border transition",
                    active ? "border-ink ring-1 ring-ink ring-offset-2 ring-offset-paper" : "border-line hover:border-muted",
                    out && "opacity-40",
                  )}
                  style={{ background: c.hex ?? "rgb(var(--c-bone))" }}
                >
                  {out && <span aria-hidden className="absolute inset-0 m-auto h-px w-full rotate-45 bg-ink/60" />}
                </button>
              );
            })}
          </div>
        </fieldset>
      )}

      {/* size */}
      {sizeOption && sizeOption.values.length > 0 && (
        <fieldset>
          <legend className="mb-3 flex w-full items-center justify-between gap-4">
            <span className="eyebrow">{t("product.selectSize")}</span>
            {features.sizeGuide && product.sizeGuide && (
              <button type="button" onClick={() => setGuideOpen(true)} className="btn-ghost text-muted hover:text-oxide">
                {t("product.sizeGuide")}
              </button>
            )}
          </legend>
          <div className="flex flex-wrap gap-2">
            {sizeOption.values.map((s) => {
              const stock = stockForSize(s.value);
              const out = stock <= 0;
              const active = size === s.value;
              return (
                <button
                  key={s.value}
                  type="button"
                  disabled={out}
                  onClick={() => {
                    setSize(s.value);
                    setSizeError(false);
                    setQty(1);
                  }}
                  aria-pressed={active}
                  className={cn(
                    "min-w-[3.25rem] border px-3 py-2.5 text-[0.7rem] font-semibold uppercase tracking-[0.14em] transition",
                    active ? "border-ink bg-ink text-paper" : "border-line hover:border-ink",
                    out && "cursor-not-allowed text-line line-through hover:border-line",
                  )}
                >
                  {s.value}
                </button>
              );
            })}
          </div>
          <p className={cn("mt-3 text-xs", sizeError ? "text-danger" : lowStock ? "text-oxide" : "text-muted")} role={sizeError ? "alert" : undefined}>
            {sizeError
              ? t("product.chooseSizeFirst")
              : lowStock && size
                ? t("product.onlyLeft", { count: maxStock, size })
                : size
                  ? t("product.available")
                  : t("product.chooseToSee")}
          </p>
        </fieldset>
      )}

      {/* quantity + actions */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center border border-line" role="group" aria-label={t("product.quantity")}>
            <button
              type="button"
              onClick={() => setQty((q) => Math.max(1, q - 1))}
              disabled={qty <= 1}
              aria-label={t("common.remove")}
              className="px-3.5 py-3 text-muted transition hover:text-ink"
            >
              <Minus className="h-3.5 w-3.5" aria-hidden />
            </button>
            <span className="min-w-[2.5rem] text-center text-sm tabular-nums" aria-live="polite">
              {qty}
            </span>
            <button
              type="button"
              onClick={() => setQty((q) => Math.min(q + 1, Math.max(1, maxStock || 1), 20))}
              disabled={maxStock > 0 && qty >= Math.min(maxStock, 20)}
              aria-label={t("common.add")}
              className="px-3.5 py-3 text-muted transition hover:text-ink"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden />
            </button>
          </div>

          {features.wishlist && (
            <button
              type="button"
              onClick={() => cart.toggleWish(product.id)}
              aria-pressed={wished}
              className="btn-ghost text-muted hover:text-oxide"
            >
              <Heart className={cn("h-4 w-4", wished && "fill-oxide text-oxide")} aria-hidden />
              <span>{t("common.wishlist")}</span>
            </button>
          )}

          <button type="button" onClick={share} className="btn-ghost text-muted hover:text-ink">
            {shared ? <Check className="h-4 w-4 text-success" aria-hidden /> : <Share2 className="h-4 w-4" aria-hidden />}
            <span>{t("common.share")}</span>
          </button>
        </div>

        {features.cart && (
          <div className="flex flex-col gap-2.5">
            <button type="button" onClick={addToBag} disabled={soldOut} className="btn w-full">
              {soldOut ? t("common.soldOut") : t("product.addToBag")}
            </button>
            <div className="flex flex-col gap-2.5 sm:flex-row">
              <button type="button" onClick={buyNow} disabled={soldOut} className="btn-outline flex-1">
                {t("product.buyNow")}
              </button>
              {config.checkout.whatsapp && config.contact.whatsapp && (
                <button type="button" onClick={orderWhatsapp} disabled={soldOut} className="btn-outline flex-1">
                  <MessageCircle className="h-3.5 w-3.5" aria-hidden />
                  {t("product.orderWhatsapp")}
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* trust + delivery */}
      <ul className="grid gap-3 border-y border-line py-5 text-xs text-muted sm:grid-cols-3">
        <li className="flex items-center gap-2">
          <Truck className="h-4 w-4 shrink-0 text-oxide" aria-hidden />
          <span>{delivery ? t("product.deliveryEstimate", { min: delivery.etaMinDays, max: delivery.etaMaxDays }) : t("product.codAvailable")}</span>
        </li>
        <li className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 shrink-0 text-oxide" aria-hidden />
          <span>{t("product.secureCheckout")}</span>
        </li>
        <li className="flex items-center gap-2">
          <RefreshCcw className="h-4 w-4 shrink-0 text-oxide" aria-hidden />
          <span>{t("product.assurance")}</span>
        </li>
      </ul>

      {mode === "full" && accordionItems.length > 0 && <Accordion items={accordionItems} defaultOpen="material" />}

      {mode === "full" && variant?.sku && (
        <p className="text-[0.62rem] uppercase tracking-[0.16em] text-muted">
          {t("product.sku")} {variant.sku}
        </p>
      )}

      {mode === "quick" && (
        <LocaleLink href={`/product/${product.slug}`} className="btn-ghost text-oxide">
          {t("common.readMore")}
        </LocaleLink>
      )}

      {features.sizeGuide && product.sizeGuide && <SizeGuideModal open={guideOpen} onClose={() => setGuideOpen(false)} guide={product.sizeGuide} />}

      {/* sticky mobile bar */}
      {mode === "full" && features.cart && (
        <div data-sticky-bar className="safe-bottom fixed inset-x-0 bottom-0 z-[75] flex items-center gap-3 border-t border-line bg-paper/95 px-4 py-3 backdrop-blur md:hidden">
          <div className="min-w-0 flex-1">
            <p className="truncate text-[0.7rem] uppercase tracking-[0.14em] text-muted">{product.name}</p>
            <PriceTag price={unitPrice} compareAt={product.compareAtPrice} size="sm" showPercent={false} />
          </div>
          <button type="button" onClick={addToBag} disabled={soldOut} className="btn shrink-0 px-5 py-3">
            {soldOut ? t("common.soldOut") : t("product.addToBag")}
          </button>
        </div>
      )}
    </div>
  );
}
