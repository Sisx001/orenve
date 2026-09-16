import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink, Printer } from "lucide-react";
import { PageHeader, Section } from "@/components/admin/PageHeader";
import { ChannelBadge, PaymentBadge, StatusBadge } from "@/components/admin/StatusBadge";
import {
  CourierBlock,
  CustomerBlock,
  InternalNotes,
  ItemsEditor,
  PaymentsList,
  StatusActions,
  Timeline,
  type EventRow,
  type OrderAddress,
  type PaymentRow,
} from "./OrderForms";
import { requireStudio } from "@/lib/admin/session";
import { db } from "@/lib/db";
import { csrfToken } from "@/lib/admin/csrf";
import { can } from "@/lib/auth/session";
import { i18nText, parseJson } from "@/lib/json";
import { formatMoney } from "@/lib/money";
import { PAYMENT_METHOD_LABELS } from "@/lib/admin/constants";
import { getSetting } from "@/lib/settings";
import { ShipmentPanel } from "./ShipmentPanel";

export const dynamic = "force-dynamic";

const dt = (d: Date) => d.toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireStudio("orders.write", `/admin/orders/${id}`);
  const csrf = await csrfToken();

  const order = await db.order.findUnique({
    where: { id },
    include: {
      items: true,
      payments: { orderBy: { createdAt: "desc" }, include: { verifiedBy: { select: { name: true } } } },
      events: { orderBy: { createdAt: "desc" }, include: { createdBy: { select: { name: true } } } },
      customer: { select: { id: true, name: true, phone: true, _count: { select: { orders: true } } } },
      shipments: { orderBy: { createdAt: "desc" } },
      conciergeRequests: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!order) notFound();
  const courierSettings = await getSetting("courier");

  const address = parseJson<Partial<OrderAddress>>(order.shippingAddress, {});
  const addr: OrderAddress = {
    line1: address.line1 ?? "",
    line2: address.line2 ?? "",
    city: address.city ?? "",
    district: address.district ?? "",
    postalCode: address.postalCode ?? "",
    country: address.country ?? "BD",
  };
  const extraAddress = [address.area, address.upazila, address.division].filter(Boolean).join(" · ");

  const payments: PaymentRow[] = order.payments.map((p) => ({
    id: p.id,
    method: p.method,
    provider: p.provider,
    amount: p.amount,
    status: p.status,
    transactionId: p.transactionId,
    senderNumber: p.senderNumber,
    verifiedBy: p.verifiedBy?.name ?? null,
    verifiedAt: p.verifiedAt ? dt(p.verifiedAt) : null,
    createdAt: dt(p.createdAt),
  }));

  const events: EventRow[] = order.events.map((e) => ({
    id: e.id,
    type: e.type,
    title: i18nText(e.title, "en"),
    message: e.message ? i18nText(e.message, "en") : null,
    isPublic: e.isPublic,
    by: e.createdBy?.name ?? null,
    createdAt: dt(e.createdAt),
  }));

  const canVerify = can(user, "payments.verify");

  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHeader
        title={<span className="font-mono text-[1.4rem]">{order.number}</span>}
        description={`Placed ${dt(order.placedAt)} · tracking code ${order.trackingCode}`}
        actions={
          <>
            <Link href={`/admin/orders/${order.id}/invoice`} target="_blank" className="btn-outline px-4 py-2.5 text-[0.65rem]">
              <Printer className="h-3.5 w-3.5" />
              Invoice
            </Link>
            <Link href="/admin/orders" className="btn-ghost text-[0.65rem] text-muted">
              Back to orders
            </Link>
          </>
        }
      />

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <StatusBadge status={order.status} />
        <PaymentBadge status={order.paymentStatus} method={order.paymentMethod} />
        <ChannelBadge channel={order.channel} />
        {order.couponCode && (
          <span className="border border-brass/40 bg-brass/10 px-2 py-0.5 text-[0.6rem] font-semibold uppercase tracking-[0.14em]">
            Coupon {order.couponCode}
          </span>
        )}
        {order.currency !== "BDT" && (
          <span className="text-xs text-muted">
            Shown to the customer in {order.currency} at {order.exchangeRate} / ৳1
          </span>
        )}
      </div>

      <div className="mb-6 border border-line bg-bone/50 p-4">
        <StatusActions
          orderId={order.id}
          status={order.status}
          csrf={csrf}
          paymentStatus={order.paymentStatus}
          paymentMethod={order.paymentMethod}
          canVerify={canVerify}
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        <div className="space-y-5 xl:col-span-2">
          <Section title="Items & totals" description={`${order.items.length} line${order.items.length === 1 ? "" : "s"}`}>
            <ItemsEditor
              orderId={order.id}
              csrf={csrf}
              editable={order.status === "pending"}
              shipping={order.shipping}
              discount={order.discount}
              items={order.items.map((i) => ({
                id: i.id,
                name: i.name,
                variantTitle: i.variantTitle,
                sku: i.sku,
                image: i.image,
                unitPrice: i.unitPrice,
                quantity: i.quantity,
              }))}
              currencyNote={`Payment method: ${PAYMENT_METHOD_LABELS[order.paymentMethod] ?? order.paymentMethod}`}
            />
          </Section>

          <Section title="Payments" description="Verify bKash and Nagad transactions here.">
            <PaymentsList payments={payments} csrf={csrf} canVerify={canVerify} />
          </Section>

          <Section title="Timeline" description="Public entries are what the customer and the AI concierge see.">
            <Timeline orderId={order.id} csrf={csrf} events={events} />
          </Section>
        </div>

        <div className="space-y-5">
          <Section
            title="Customer & delivery"
            actions={
              order.customer ? (
                <Link href={`/admin/customers/${order.customer.id}`} className="inline-flex items-center gap-1 text-[0.62rem] uppercase tracking-[0.14em] text-oxide hover:underline">
                  {order.customer._count.orders} order{order.customer._count.orders === 1 ? "" : "s"}
                  <ExternalLink className="h-3 w-3" />
                </Link>
              ) : null
            }
          >
            <CustomerBlock
              orderId={order.id}
              csrf={csrf}
              customerName={order.customerName}
              phone={order.phone}
              email={order.email ?? ""}
              notes={order.notes ?? ""}
              address={addr}
            />
          </Section>

          <Section title="Shipments" description={extraAddress ? `Delivery area: ${extraAddress}` : "Book a consignment or record the courier you used."}>
            <ShipmentPanel
              orderId={order.id}
              canBook={order.status !== "cancelled" && order.status !== "refunded"}
              manualCouriers={courierSettings.manualCouriers}
              shipments={order.shipments.map((s) => ({
                id: s.id,
                provider: s.provider,
                consignmentId: s.consignmentId,
                trackingCode: s.trackingCode,
                trackingUrl: s.trackingUrl,
                status: s.status,
                rawStatus: s.rawStatus,
                codAmount: s.codAmount,
                deliveryFee: s.deliveryFee,
                lastSyncedAt: s.lastSyncedAt ? dt(s.lastSyncedAt) : null,
                createdAt: dt(s.createdAt),
              }))}
            />
            <details className="mt-4 border-t border-line pt-3">
              <summary className="cursor-pointer text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-muted">Edit courier fields by hand</summary>
              <div className="mt-3">
                <CourierBlock orderId={order.id} csrf={csrf} courier={order.courier ?? ""} tracking={order.courierTracking ?? ""} url={order.courierUrl ?? ""} />
              </div>
            </details>
          </Section>

          <Section title="Internal notes">
            <InternalNotes orderId={order.id} csrf={csrf} value={order.internalNotes ?? ""} />
          </Section>

          {order.conciergeRequests.length > 0 && (
            <Section
              title="Concierge requests"
              description="Change requests submitted by the customer through the AI concierge."
            >
              <ul className="space-y-2">
                {order.conciergeRequests.map((r) => (
                  <li key={r.id} className="border border-line p-3 text-sm">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-medium capitalize">{r.type.replace("_", " ")}</p>
                        <p className="mt-0.5 text-xs text-muted">{r.details.slice(0, 200)}</p>
                        <p className="mt-1 text-[0.6rem] uppercase tracking-[0.12em] text-muted">
                          {r.createdAt.toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </div>
                      <span
                        className={`shrink-0 border px-2 py-0.5 text-[0.58rem] font-semibold uppercase tracking-[0.12em] ${
                          r.status === "open"
                            ? "border-warning/40 bg-warning/10 text-warning"
                            : r.status === "resolved"
                              ? "border-success/40 bg-success/10 text-success"
                              : "border-muted/40 bg-muted/10 text-muted"
                        }`}
                      >
                        {r.status}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          <Section title="Summary">
            <dl className="space-y-1.5 text-sm">
              {[
                ["Subtotal", formatMoney(order.subtotal)],
                ["Discount", `−${formatMoney(order.discount)}`],
                ["Shipping", formatMoney(order.shipping)],
                ...(order.codFee > 0 ? [["COD fee", formatMoney(order.codFee)] as [string, string]] : []),
                ["Total", formatMoney(order.total)],
              ].map(([k, v], i) => (
                <div key={k} className={i === 3 ? "flex justify-between border-t border-line pt-1.5 font-medium" : "flex justify-between"}>
                  <dt className={i === 3 ? "" : "text-muted"}>{k}</dt>
                  <dd className="tabular-nums">{v}</dd>
                </div>
              ))}
            </dl>
            <dl className="mt-4 space-y-1 border-t border-line pt-3 text-xs text-muted">
              {order.confirmedAt && <Row label="Confirmed" value={dt(order.confirmedAt)} />}
              {order.paidAt && <Row label="Paid" value={dt(order.paidAt)} />}
              {order.shippedAt && <Row label="Shipped" value={dt(order.shippedAt)} />}
              {order.deliveredAt && <Row label="Delivered" value={dt(order.deliveredAt)} />}
              {order.cancelledAt && <Row label="Cancelled" value={dt(order.cancelledAt)} />}
              {order.ip && <Row label="IP" value={order.ip} />}
              <Row label="Locale" value={order.locale} />
            </dl>
          </Section>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt>{label}</dt>
      <dd className="text-right">{value}</dd>
    </div>
  );
}
