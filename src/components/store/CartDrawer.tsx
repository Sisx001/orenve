"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Minus, Plus, Trash2, MessageCircle } from "lucide-react";
import { useCart } from "@/hooks/useCart";
import { useT, useLocale } from "@/lib/i18n/client";
import { useConfig } from "@/components/providers/ConfigProvider";
import { apiFetch } from "@/lib/store/api";
import { localizedPath } from "@/lib/i18n";
import { Button, Input, Modal } from "@/components/ui";
import { LocaleLink } from "@/components/store/LocaleLink";
import { cn } from "@/lib/utils";

type QuoteResponse = {
  subtotal: number;
  shipping: number;
  discount: number;
  total: number;
  zone: { id: string; etaMinDays: number; etaMaxDays: number; freeAbove: number | null } | null;
  coupon: { code: string; type: string; value: number } | null;
};

/** Slide-over bag. Totals are always re-priced by the server. */
export function CartDrawer() {
  const cart = useCart();
  const t = useT();
  const locale = useLocale();
  const router = useRouter();
  const { config, currency, money } = useConfig();

  const [coupon, setCoupon] = useState(cart.couponCode);
  const [quote, setQuote] = useState<QuoteResponse | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const items = cart.lines.map((l) => ({ variantId: l.variantId, quantity: l.quantity }));
  const itemsKey = JSON.stringify(items);

  const refresh = useCallback(
    async (code: string) => {
      if (items.length === 0) {
        setQuote(null);
        return;
      }
      try {
        const r = await apiFetch<QuoteResponse>("/api/checkout/quote", {
          method: "POST",
          json: { items, couponCode: code || undefined, locale },
        });
        setQuote(r);
        setCouponError(null);
      } catch (e) {
        const err = e as Error & { vars?: Record<string, string | number> };
        if (code) setCouponError(t(err.message, err.vars));
      }
    },
    // items is derived from itemsKey; keeping the key avoids an identity loop
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [itemsKey, locale, t],
  );

  useEffect(() => {
    if (!cart.cartOpen) return;
    void refresh(cart.couponCode);
  }, [cart.cartOpen, itemsKey, cart.couponCode, refresh]);

  async function applyCoupon(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    cart.setCoupon(coupon.trim().toUpperCase());
    await refresh(coupon.trim().toUpperCase());
    setBusy(false);
  }

  function go(path: string) {
    cart.openCart(false);
    router.push(localizedPath(path, locale));
  }

  const subtotal = quote?.subtotal ?? cart.subtotal;
  const freeAbove = quote?.zone?.freeAbove ?? null;
  const progress = freeAbove ? Math.min(100, Math.round((subtotal / freeAbove) * 100)) : null;

  return (
    <Modal open={cart.cartOpen} onClose={() => cart.openCart(false)} side="right" title={t("cart.title")} description={t("cart.subtitle")} testId="cart-drawer">
      {cart.lines.length === 0 ? (
        <div className="flex flex-col items-center py-20 text-center">
          <span className="display text-4xl text-line">O/</span>
          <h3 className="display mt-6 text-display-sm">{t("cart.empty")}</h3>
          <p className="mt-3 max-w-xs text-sm text-muted">{t("cart.emptyText")}</p>
          <Button className="mt-8" onClick={() => go("/shop")}>
            {t("cart.explore")}
          </Button>
        </div>
      ) : (
        <div className="flex h-full flex-col">
          {progress !== null && freeAbove !== null && (
            <div className="mb-6">
              <p className="mb-2 text-xs text-muted">
                {subtotal >= freeAbove ? t("cart.freeShippingUnlocked") : t("cart.freeShippingProgress", { amount: money(freeAbove - subtotal) })}
              </p>
              <div className="h-px w-full bg-line" role="presentation">
                <div className="h-px bg-oxide transition-all duration-700 ease-editorial" style={{ width: `${progress}%` }} />
              </div>
            </div>
          )}

          <ul className="flex flex-col divide-y divide-line">
            {cart.lines.map((l) => (
              <li key={l.key} className="flex gap-4 py-5">
                <LocaleLink href={`/product/${l.slug}`} onClick={() => cart.openCart(false)} className="block w-20 shrink-0 bg-bone">
                  <span className="block aspect-[3/4] w-full">
                    {l.image ? (
                      <img src={l.image} alt={l.name} loading="lazy" decoding="async" className="h-full w-full object-cover" />
                    ) : (
                      <span className="skeleton block h-full w-full" />
                    )}
                  </span>
                </LocaleLink>

                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <LocaleLink href={`/product/${l.slug}`} onClick={() => cart.openCart(false)} className="display block truncate text-base hover:text-oxide">
                        {l.name}
                      </LocaleLink>
                      <p className="eyebrow mt-1">{l.variantTitle}</p>
                    </div>
                    <span className="shrink-0 text-sm tabular-nums">{money(l.unitPrice * l.quantity)}</span>
                  </div>

                  <div className="mt-auto flex items-center justify-between gap-3">
                    <div className="flex items-center border border-line">
                      <button
                        type="button"
                        onClick={() => cart.update(l.variantId, l.quantity - 1)}
                        aria-label={t("common.remove")}
                        className="px-2.5 py-2 text-muted hover:text-ink"
                      >
                        <Minus className="h-3 w-3" aria-hidden />
                      </button>
                      <span className="min-w-[2rem] text-center text-xs tabular-nums">{l.quantity}</span>
                      <button
                        type="button"
                        onClick={() => cart.update(l.variantId, l.quantity + 1)}
                        disabled={l.quantity >= Math.min(l.maxStock, 20)}
                        aria-label={t("common.add")}
                        className="px-2.5 py-2 text-muted hover:text-ink"
                      >
                        <Plus className="h-3 w-3" aria-hidden />
                      </button>
                    </div>
                    {l.quantity >= l.maxStock && <span className="text-[0.62rem] text-oxide">{t("cart.onlyAvailable", { count: l.maxStock })}</span>}
                    <button type="button" onClick={() => cart.remove(l.variantId)} aria-label={t("common.remove")} className="p-1 text-muted hover:text-danger">
                      <Trash2 className="h-3.5 w-3.5" aria-hidden />
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>

          {config.features.coupons && (
            <form onSubmit={applyCoupon} className="mt-6 flex items-end gap-2">
              <Input
                label={t("cart.couponCode")}
                value={coupon}
                onChange={(e) => setCoupon(e.target.value)}
                className="uppercase"
                autoComplete="off"
                error={couponError}
                hint={quote?.coupon ? t("cart.couponApplied") : undefined}
              />
              <Button type="submit" variant="outline" size="sm" loading={busy} className="mb-[1.6rem]">
                {t("cart.apply")}
              </Button>
            </form>
          )}

          <dl className="mt-8 flex flex-col gap-2 border-t border-line pt-5 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted">{t("cart.subtotal")}</dt>
              <dd className="tabular-nums">{money(subtotal)}</dd>
            </div>
            {!!quote?.discount && (
              <div className="flex justify-between text-oxide">
                <dt>{t("cart.discount")}</dt>
                <dd className="tabular-nums">−{money(quote.discount)}</dd>
              </div>
            )}
            <div className="flex justify-between">
              <dt className="text-muted">{t("cart.shipping")}</dt>
              <dd className="text-muted">{t("cart.shippingCalculated")}</dd>
            </div>
            <div className="mt-2 flex justify-between border-t border-line pt-3 text-base">
              <dt className="display">{t("cart.total")}</dt>
              <dd className="display tabular-nums">{money(Math.max(0, subtotal - (quote?.discount ?? 0)))}</dd>
            </div>
          </dl>

          {currency.code !== "BDT" && <p className="mt-3 text-[0.68rem] leading-relaxed text-muted">{t("cart.convertedNote")}</p>}

          <div className="sticky bottom-0 mt-6 flex flex-col gap-2.5 bg-paper pb-1 pt-4">
            <Button onClick={() => go("/checkout")} className="w-full">
              {t("cart.checkout")}
            </Button>
            {config.checkout.whatsapp && config.contact.whatsapp && (
              <button type="button" onClick={() => go("/checkout?channel=whatsapp")} className={cn("btn-outline w-full")}>
                <MessageCircle className="h-3.5 w-3.5" aria-hidden />
                {t("product.orderWhatsapp")}
              </button>
            )}
            <button type="button" onClick={() => cart.openCart(false)} className="btn-ghost mx-auto text-muted hover:text-ink">
              {t("cart.continueShopping")}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
