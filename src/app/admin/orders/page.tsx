import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { Pagination } from "@/components/admin/Pagination";
import { SearchInput, FilterSelect } from "@/components/admin/SearchInput";
import { OrdersTable, type OrderRow } from "./OrdersTable";
import { requireStudio } from "@/lib/admin/session";
import { getOrderStatusCounts } from "@/lib/admin/queries";
import { db } from "@/lib/db";
import { csrfToken } from "@/lib/admin/csrf";
import { ORDER_CHANNELS, ORDER_STATUSES, PAYMENT_STATUSES } from "@/lib/constants";
import { CHANNEL_LABELS, PAYMENT_STATUS_LABELS, STATUS_LABELS } from "@/lib/admin/constants";
import { normalizeBdPhone } from "@/lib/orders/service";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";
const PAGE_SIZE = 20;

const str = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);

export default async function OrdersPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireStudio("orders.write", "/admin/orders");
  const sp = await searchParams;
  const q = str(sp.q) ?? "";
  const status = str(sp.status) ?? "";
  const payment = str(sp.payment) ?? "";
  const channel = str(sp.channel) ?? "";
  const from = str(sp.from) ?? "";
  const to = str(sp.to) ?? "";
  const page = Math.max(1, Number(str(sp.page) ?? "1") || 1);

  const where: Prisma.OrderWhereInput = {};
  if (status && (ORDER_STATUSES as readonly string[]).includes(status)) where.status = status;
  if (payment && (PAYMENT_STATUSES as readonly string[]).includes(payment)) where.paymentStatus = payment;
  if (channel && (ORDER_CHANNELS as readonly string[]).includes(channel)) where.channel = channel;
  if (from || to) {
    where.placedAt = {};
    if (from) where.placedAt.gte = new Date(`${from}T00:00:00`);
    if (to) where.placedAt.lte = new Date(`${to}T23:59:59`);
  }
  if (q) {
    const digits = q.replace(/\D/g, "");
    where.OR = [
      { number: { contains: q.toUpperCase() } },
      { trackingCode: { contains: q.toUpperCase() } },
      { customerName: { contains: q } },
      { email: { contains: q } },
      ...(digits.length >= 4 ? [{ phone: { contains: digits } }, { phone: { contains: normalizeBdPhone(q) } }] : []),
    ];
  }

  const [counts, total, orders, csrf] = await Promise.all([
    getOrderStatusCounts(),
    db.order.count({ where }),
    db.order.findMany({
      where,
      orderBy: { placedAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        number: true,
        customerName: true,
        phone: true,
        total: true,
        channel: true,
        paymentStatus: true,
        paymentMethod: true,
        status: true,
        placedAt: true,
        _count: { select: { items: true } },
      },
    }),
    csrfToken(),
  ]);

  const rows: OrderRow[] = orders.map((o) => ({
    id: o.id,
    number: o.number,
    customerName: o.customerName,
    phone: o.phone,
    items: o._count.items,
    total: o.total,
    channel: o.channel,
    paymentStatus: o.paymentStatus,
    paymentMethod: o.paymentMethod,
    status: o.status,
    placedAt: o.placedAt.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "2-digit" }),
  }));

  const params = { q, status, payment, channel, from, to };
  const tabHref = (s: string) => {
    const usp = new URLSearchParams();
    for (const [k, v] of Object.entries({ q, payment, channel, from, to })) if (v) usp.set(k, v);
    if (s) usp.set("status", s);
    const qs = usp.toString();
    return qs ? `/admin/orders?${qs}` : "/admin/orders";
  };

  return (
    <div className="mx-auto max-w-[1500px]">
      <PageHeader
        title="Orders"
        description="Every order from the website, WhatsApp, Messenger and the phone."
        actions={
          <Link href="/admin/orders/new" className="btn px-4 py-2.5 text-[0.65rem]">
            <Plus className="h-3.5 w-3.5" />
            New manual order
          </Link>
        }
      />

      {/* status tabs */}
      <div className="no-scrollbar mb-4 flex gap-1 overflow-x-auto border-b border-line">
        {[{ value: "", label: "All" }, ...ORDER_STATUSES.map((s) => ({ value: s, label: STATUS_LABELS[s] ?? s }))].map((t) => {
          const active = status === t.value;
          const count = t.value ? (counts[t.value] ?? 0) : (counts.all ?? 0);
          return (
            <Link
              key={t.value || "all"}
              href={tabHref(t.value)}
              className={cn(
                "-mb-px flex shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2.5 text-[0.68rem] font-semibold uppercase tracking-[0.14em] transition",
                active ? "border-oxide text-ink" : "border-transparent text-muted hover:text-ink",
              )}
            >
              {t.label}
              <span className={cn("tabular-nums", active ? "text-oxide" : "text-muted/70")}>{count}</span>
            </Link>
          );
        })}
      </div>

      {/* filters */}
      <div className="mb-4 flex flex-wrap items-end gap-2.5">
        <SearchInput param="q" placeholder="Order number, tracking code, name or phone…" className="min-w-[16rem] flex-1" />
        <FilterSelect
          param="payment"
          label="Payment"
          options={[{ value: "", label: "Any" }, ...PAYMENT_STATUSES.map((s) => ({ value: s, label: PAYMENT_STATUS_LABELS[s] ?? s }))]}
        />
        <FilterSelect
          param="channel"
          label="Channel"
          options={[{ value: "", label: "Any" }, ...ORDER_CHANNELS.map((c) => ({ value: c, label: CHANNEL_LABELS[c] ?? c }))]}
        />
        <form className="flex items-end gap-2" action="/admin/orders" method="get">
          {status && <input type="hidden" name="status" value={status} />}
          {q && <input type="hidden" name="q" value={q} />}
          {payment && <input type="hidden" name="payment" value={payment} />}
          {channel && <input type="hidden" name="channel" value={channel} />}
          <label className="block">
            <span className="mb-1 block text-[0.58rem] uppercase tracking-[0.14em] text-muted">From</span>
            <input type="date" name="from" defaultValue={from} className="field-box py-2 text-xs" />
          </label>
          <label className="block">
            <span className="mb-1 block text-[0.58rem] uppercase tracking-[0.14em] text-muted">To</span>
            <input type="date" name="to" defaultValue={to} className="field-box py-2 text-xs" />
          </label>
          <button type="submit" className="btn-outline px-3.5 py-2.5 text-[0.62rem]">
            Apply
          </button>
          {(from || to) && (
            <Link href={tabHref(status)} className="btn-ghost text-[0.62rem] text-muted">
              Reset
            </Link>
          )}
        </form>
      </div>

      {rows.length === 0 ? (
        <div className="card px-6 py-20 text-center">
          <p className="text-sm text-muted">No orders match these filters.</p>
          <Link href="/admin/orders" className="mt-3 inline-block text-[0.65rem] uppercase tracking-[0.14em] text-oxide hover:underline">
            Clear filters
          </Link>
        </div>
      ) : (
        <>
          <OrdersTable rows={rows} csrf={csrf} />
          <div className="mt-4">
            <Pagination basePath="/admin/orders" params={params} page={page} pageSize={PAGE_SIZE} total={total} />
          </div>
        </>
      )}
    </div>
  );
}
