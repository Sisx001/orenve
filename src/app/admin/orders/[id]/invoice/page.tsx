import { notFound } from "next/navigation";
import { requireStudio } from "@/lib/admin/session";
import { db } from "@/lib/db";
import { getSetting } from "@/lib/settings";
import { i18nText, parseJson } from "@/lib/json";
import { formatMoney } from "@/lib/money";
import { PAYMENT_METHOD_LABELS, PAYMENT_STATUS_LABELS, STATUS_LABELS } from "@/lib/admin/constants";
import { PrintButton } from "./PrintButton";

export const dynamic = "force-dynamic";

export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireStudio("orders.write", `/admin/orders/${id}/invoice`);

  const [order, brand, contact] = await Promise.all([
    db.order.findUnique({ where: { id }, include: { items: true } }),
    getSetting("brand"),
    getSetting("contact"),
  ]);
  if (!order) notFound();

  const a = parseJson<Record<string, string>>(order.shippingAddress, {});
  const date = order.placedAt.toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });

  return (
    <div className="mx-auto max-w-[820px] bg-paper p-6 print:p-0">
      <style>{`@media print { .no-print { display: none !important; } @page { margin: 16mm; } }`}</style>

      <div className="no-print mb-6 flex items-center justify-between gap-3 border border-line bg-bone/60 px-4 py-3">
        <p className="text-xs text-muted">This page is styled for A4. Use your browser&apos;s print dialog to save a PDF.</p>
        <PrintButton />
      </div>

      <header className="flex flex-wrap items-start justify-between gap-6 border-b-2 border-ink pb-5">
        <div>
          <p className="display text-2xl tracking-[0.18em]">{brand.name.toUpperCase()}</p>
          <p className="mt-1 text-xs text-muted">{i18nText(brand.tagline, "en")}</p>
          <div className="mt-3 space-y-0.5 text-xs text-muted">
            {contact.address && <p>{i18nText(contact.address, "en")}</p>}
            {contact.phone && <p>{contact.phone}</p>}
            {contact.whatsapp && <p>WhatsApp +{contact.whatsapp}</p>}
            {contact.email && <p>{contact.email}</p>}
          </div>
        </div>
        <div className="text-right">
          <p className="text-[0.6rem] font-semibold uppercase tracking-[0.18em] text-muted">Invoice</p>
          <p className="mt-1 font-mono text-lg">{order.number}</p>
          <p className="mt-1 text-xs text-muted">{date}</p>
          <p className="mt-3 text-xs">
            <span className="text-muted">Tracking code </span>
            <span className="font-mono">{order.trackingCode}</span>
          </p>
        </div>
      </header>

      <section className="mt-6 grid gap-6 sm:grid-cols-2">
        <div>
          <p className="text-[0.6rem] font-semibold uppercase tracking-[0.16em] text-muted">Deliver to</p>
          <p className="mt-2 text-sm font-medium">{order.customerName}</p>
          <p className="text-sm">{order.phone}</p>
          {order.email && <p className="text-sm">{order.email}</p>}
          <p className="mt-2 whitespace-pre-line text-sm text-muted">
            {[a.line1, a.line2, a.city, a.district, a.postalCode, a.country].filter(Boolean).join("\n")}
          </p>
        </div>
        <div className="sm:text-right">
          <p className="text-[0.6rem] font-semibold uppercase tracking-[0.16em] text-muted">Order details</p>
          <dl className="mt-2 space-y-1 text-sm">
            <div className="flex justify-between gap-4 sm:justify-end sm:gap-6">
              <dt className="text-muted">Status</dt>
              <dd>{STATUS_LABELS[order.status] ?? order.status}</dd>
            </div>
            <div className="flex justify-between gap-4 sm:justify-end sm:gap-6">
              <dt className="text-muted">Payment</dt>
              <dd>
                {PAYMENT_METHOD_LABELS[order.paymentMethod] ?? order.paymentMethod} ·{" "}
                {PAYMENT_STATUS_LABELS[order.paymentStatus] ?? order.paymentStatus}
              </dd>
            </div>
            <div className="flex justify-between gap-4 sm:justify-end sm:gap-6">
              <dt className="text-muted">Channel</dt>
              <dd className="capitalize">{order.channel}</dd>
            </div>
            {order.courier && (
              <div className="flex justify-between gap-4 sm:justify-end sm:gap-6">
                <dt className="text-muted">Courier</dt>
                <dd>
                  {order.courier}
                  {order.courierTracking ? ` · ${order.courierTracking}` : ""}
                </dd>
              </div>
            )}
          </dl>
        </div>
      </section>

      <table className="mt-8 w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-ink text-[0.6rem] uppercase tracking-[0.14em] text-muted">
            <th className="py-2 text-left font-semibold">Item</th>
            <th className="py-2 text-right font-semibold">Unit</th>
            <th className="py-2 text-right font-semibold">Qty</th>
            <th className="py-2 text-right font-semibold">Amount</th>
          </tr>
        </thead>
        <tbody>
          {order.items.map((i) => (
            <tr key={i.id} className="border-b border-line">
              <td className="py-2.5">
                <p>{i.name}</p>
                <p className="text-xs text-muted">
                  {i.variantTitle ?? ""}
                  {i.sku ? ` · ${i.sku}` : ""}
                </p>
              </td>
              <td className="py-2.5 text-right tabular-nums">{formatMoney(i.unitPrice)}</td>
              <td className="py-2.5 text-right tabular-nums">{i.quantity}</td>
              <td className="py-2.5 text-right tabular-nums">{formatMoney(i.total)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-5 flex justify-end">
        <dl className="w-full max-w-xs space-y-1.5 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted">Subtotal</dt>
            <dd className="tabular-nums">{formatMoney(order.subtotal)}</dd>
          </div>
          {order.discount > 0 && (
            <div className="flex justify-between">
              <dt className="text-muted">Discount{order.couponCode ? ` (${order.couponCode})` : ""}</dt>
              <dd className="tabular-nums">−{formatMoney(order.discount)}</dd>
            </div>
          )}
          <div className="flex justify-between">
            <dt className="text-muted">Delivery</dt>
            <dd className="tabular-nums">{order.shipping === 0 ? "Free" : formatMoney(order.shipping)}</dd>
          </div>
          <div className="flex justify-between border-t-2 border-ink pt-2 text-base font-medium">
            <dt>Total</dt>
            <dd className="tabular-nums">{formatMoney(order.total)}</dd>
          </div>
        </dl>
      </div>

      {order.notes && (
        <section className="mt-8 border-t border-line pt-4">
          <p className="text-[0.6rem] font-semibold uppercase tracking-[0.16em] text-muted">Note</p>
          <p className="mt-1.5 whitespace-pre-line text-sm">{order.notes}</p>
        </section>
      )}

      <footer className="mt-10 border-t border-line pt-4 text-center text-xs text-muted">
        <p>Thank you for choosing {brand.name}.</p>
        <p className="mt-1">Track this order any time with code {order.trackingCode}.</p>
      </footer>
    </div>
  );
}
