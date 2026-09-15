"use client";

import { Check, ExternalLink, MessageCircle, Truck, XCircle } from "lucide-react";
import type { PublicOrderView } from "@/types";
import { useT, useLocale } from "@/lib/i18n/client";
import { useConfig } from "@/components/providers/ConfigProvider";
import { formatMoney } from "@/lib/money";
import { ORDER_STATUSES } from "@/lib/constants";
import { CopyButton } from "@/components/store/CopyButton";
import { LocaleLink } from "@/components/store/LocaleLink";
import { openConcierge } from "@/components/store/ConciergeWidget";
import { Badge } from "@/components/ui";
import { cn } from "@/lib/utils";

const FLOW = ["pending", "confirmed", "processing", "shipped", "delivered"] as const;

export function OrderView({
  order,
  placed = false,
  paymentState = null,
}: {
  order: PublicOrderView;
  placed?: boolean;
  paymentState?: "paid" | "failed" | "cancelled" | null;
}) {
  const t = useT();
  const locale = useLocale();
  const { config } = useConfig();

  const bdt = { code: "BDT", symbol: "৳", rate: 1, decimals: 0 };
  const money = (minor: number) => formatMoney(minor, bdt, locale);
  const dateFmt = new Intl.DateTimeFormat(locale === "bn" ? "bn-BD" : "en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

  const terminal = order.status === "cancelled" || order.status === "refunded";
  const currentIndex = FLOW.indexOf(order.status as (typeof FLOW)[number]);

  const nextText =
    order.paymentStatus === "paid"
      ? t("checkout.nextPaid")
      : order.paymentMethod === "cod"
        ? t("checkout.nextCod")
        : order.paymentMethod === "bkash" || order.paymentMethod === "nagad"
          ? t("checkout.nextMfs")
          : t("checkout.nextPending");

  const statusLabel = (s: string) => ((ORDER_STATUSES as readonly string[]).includes(s) ? t(`tracking.statuses.${s}`) : s);
  const whatsapp = config.contact.whatsapp.replace(/\D/g, "");

  return (
    <div className="mx-auto max-w-4xl">
      {/* banners */}
      {placed && (
        <div className="border border-oxide/40 bg-oxide/5 p-6 md:p-8">
          <p className="eyebrow text-oxide">{t("checkout.eyebrow")}</p>
          <h1 className="display mt-3 text-display-sm">{t("checkout.successTitle", { name: order.customerName })}</h1>
          <p className="mt-3 text-muted">{t("checkout.successText", { number: order.number })}</p>
        </div>
      )}
      {paymentState === "paid" && !placed && (
        <div className="flex items-center gap-3 border border-success/40 bg-success/5 p-5 text-success">
          <Check className="h-4 w-4" aria-hidden />
          <p className="text-sm">{t("checkout.nextPaid")}</p>
        </div>
      )}
      {(paymentState === "failed" || paymentState === "cancelled") && (
        <div className="flex items-center gap-3 border border-danger/40 bg-danger/5 p-5 text-danger" role="alert">
          <XCircle className="h-4 w-4" aria-hidden />
          <p className="text-sm">{t("checkout.paymentFailed")}</p>
        </div>
      )}

      {/* tracking code */}
      <div className={cn("grid gap-6 border border-line p-6 sm:grid-cols-[1fr_auto] sm:items-center md:p-8", (placed || paymentState) && "mt-6")}>
        <div>
          <p className="eyebrow">{t("checkout.trackingCodeLabel")}</p>
          <p className="display mt-2 text-display-sm tracking-[0.12em]">{order.trackingCode}</p>
          <p className="mt-2 text-xs text-muted">{t("checkout.trackingHint")}</p>
          <CopyButton value={order.trackingCode} className="mt-3" />
        </div>
        <dl className="flex flex-col gap-2 text-sm sm:text-right">
          <div>
            <dt className="eyebrow">{t("tracking.orderNumber")}</dt>
            <dd className="tabular-nums">{order.number}</dd>
          </div>
          <div>
            <dt className="eyebrow">{t("tracking.placed")}</dt>
            <dd>{dateFmt.format(new Date(order.placedAt))}</dd>
          </div>
        </dl>
      </div>

      {/* what happens next */}
      {(placed || order.status === "pending") && (
        <div className="mt-6 border border-line bg-bone/40 p-6">
          <p className="eyebrow mb-2">{t("checkout.whatHappensNext")}</p>
          <p className="text-sm leading-relaxed text-muted">{nextText}</p>
        </div>
      )}

      {/* status */}
      <section className="mt-10" aria-labelledby="order-status">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="order-status" className="eyebrow">
            {t("tracking.status")}
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={terminal ? "danger" : order.status === "delivered" ? "success" : "neutral"}>{statusLabel(order.status)}</Badge>
            <Badge tone={order.paymentStatus === "paid" ? "success" : order.paymentStatus === "failed" ? "danger" : "warning"}>
              {t(`tracking.paymentStatuses.${order.paymentStatus}`)}
            </Badge>
            <Badge tone="brass">{t(`tracking.methods.${order.paymentMethod}`)}</Badge>
          </div>
        </div>

        {terminal ? (
          <p className="mt-5 text-sm text-danger">{statusLabel(order.status)}</p>
        ) : (
          <ol className="mt-6 grid gap-3 sm:grid-cols-5">
            {FLOW.map((s, i) => {
              const done = currentIndex >= i;
              return (
                <li key={s} className="flex items-center gap-3 sm:flex-col sm:items-start">
                  <span aria-hidden className={cn("h-px w-8 sm:w-full", done ? "bg-oxide" : "bg-line")} />
                  <span className={cn("text-[0.66rem] uppercase tracking-[0.14em]", done ? "text-ink" : "text-muted")}>{t(`tracking.statuses.${s}`)}</span>
                </li>
              );
            })}
          </ol>
        )}
      </section>

      {/* courier */}
      {order.courier && (
        <section className="mt-8 flex flex-wrap items-center gap-4 border border-line p-5">
          <Truck className="h-4 w-4 shrink-0 text-oxide" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="eyebrow">{t("tracking.courier")}</p>
            <p className="text-sm">
              {order.courier}
              {order.courierTracking ? ` · ${order.courierTracking}` : ""}
            </p>
          </div>
          {order.courierUrl && (
            <a href={order.courierUrl} target="_blank" rel="noopener noreferrer" className="btn-ghost text-oxide">
              <ExternalLink className="h-3.5 w-3.5" aria-hidden />
              {t("tracking.trackWithCourier")}
            </a>
          )}
        </section>
      )}

      {/* items */}
      <section className="mt-10" aria-labelledby="order-items">
        <h2 id="order-items" className="eyebrow mb-4">
          {t("tracking.items")}
        </h2>
        <ul className="divide-y divide-line border-y border-line">
          {order.items.map((it, i) => (
            <li key={`${it.name}-${i}`} className="flex items-center gap-4 py-4">
              <span className="block w-14 shrink-0 bg-bone">
                <span className="block aspect-[3/4] w-full">
                  {it.image ? (
                    <img src={it.image} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
                  ) : (
                    <span className="skeleton block h-full w-full" />
                  )}
                </span>
              </span>
              <span className="min-w-0 flex-1">
                <span className="display block truncate">{it.name}</span>
                <span className="eyebrow mt-0.5 block">
                  {it.variantTitle ?? ""} × {it.quantity}
                </span>
              </span>
              <span className="shrink-0 text-sm tabular-nums">{money(it.unitPrice * it.quantity)}</span>
            </li>
          ))}
        </ul>

        <dl className="mt-5 flex flex-col gap-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted">{t("cart.subtotal")}</dt>
            <dd className="tabular-nums">{money(order.subtotal)}</dd>
          </div>
          {order.discount > 0 && (
            <div className="flex justify-between text-oxide">
              <dt>{t("cart.discount")}</dt>
              <dd className="tabular-nums">−{money(order.discount)}</dd>
            </div>
          )}
          <div className="flex justify-between">
            <dt className="text-muted">{t("cart.shipping")}</dt>
            <dd className="tabular-nums">{order.shipping > 0 ? money(order.shipping) : t("common.free")}</dd>
          </div>
          <div className="mt-2 flex justify-between border-t border-line pt-3 text-base">
            <dt className="display">{t("cart.total")}</dt>
            <dd className="display tabular-nums">{money(order.total)}</dd>
          </div>
        </dl>
        {order.currency !== "BDT" && <p className="mt-3 text-[0.68rem] leading-relaxed text-muted">{t("cart.convertedNote")}</p>}
      </section>

      {/* timeline */}
      {order.events.length > 0 && (
        <section className="mt-12" aria-labelledby="order-timeline">
          <h2 id="order-timeline" className="eyebrow mb-5">
            {t("tracking.timeline")}
          </h2>
          <ol className="relative flex flex-col gap-7 border-l border-line pl-6">
            {order.events.map((e, i) => (
              <li key={i} className="relative">
                <span aria-hidden className="absolute -left-[1.6rem] top-1.5 h-2 w-2 rounded-full bg-oxide" />
                <p className="text-sm font-semibold">{e.title}</p>
                {e.message && <p className="mt-1 text-sm text-muted">{e.message}</p>}
                <p className="eyebrow mt-1.5">{dateFmt.format(new Date(e.createdAt))}</p>
              </li>
            ))}
          </ol>
        </section>
      )}

      {/* help */}
      <section className="mt-14 flex flex-wrap items-center gap-4 border-t border-line pt-8">
        <p className="mr-auto text-sm text-muted">{t("tracking.needHelp")}</p>
        {config.features.aiConcierge && config.ai.enabled && (
          <button
            type="button"
            onClick={() => openConcierge(t("ai.suggestTrack") + ` — ${order.number}`)}
            className="btn-outline"
          >
            <MessageCircle className="h-3.5 w-3.5" aria-hidden />
            {t("tracking.askConcierge")}
          </button>
        )}
        {whatsapp && (
          <a href={`https://wa.me/${whatsapp}?text=${encodeURIComponent(`${order.number}`)}`} target="_blank" rel="noopener noreferrer" className="btn-ghost text-oxide">
            {t("contact.whatsapp")}
          </a>
        )}
        <LocaleLink href="/shop" className="btn-ghost text-muted hover:text-ink">
          {t("cart.continueShopping")}
        </LocaleLink>
      </section>
    </div>
  );
}
