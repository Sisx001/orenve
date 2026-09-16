import Link from "next/link";
import {
  AlertTriangle,
  ArrowUpRight,
  Bot,
  Check,
  CreditCard,
  Layers,
  Mail,
  PackageCheck,
  Plus,
  Receipt,
  TrendingUp,
  Boxes,
  FileText,
  Settings,
} from "lucide-react";
import { PageHeader, Section } from "@/components/admin/PageHeader";
import { Sparkline } from "@/components/admin/Sparkline";
import { ChannelBadge, PaymentBadge, StatusBadge } from "@/components/admin/StatusBadge";
import { requireStudio } from "@/lib/admin/session";
import { getDashboardStats, getSetupChecklist } from "@/lib/admin/queries";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

// ─────────────────────── KPI card ─────────────────────────────────────────────
function Kpi({
  label,
  value,
  hint,
  href,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  href?: string;
  icon: React.ComponentType<{ className?: string }>;
  tone?: "warning" | "danger" | "success";
}) {
  const body = (
    <div
      className={cn(
        "group card h-full p-4 transition",
        href && "hover:border-ink",
        tone === "warning" && "border-warning/40 bg-warning/[0.04]",
        tone === "danger" && "border-danger/40 bg-danger/[0.04]",
        tone === "success" && "border-success/40 bg-success/[0.04]",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-[0.6rem] font-semibold uppercase tracking-[0.16em] text-muted">{label}</p>
        <Icon
          className={cn(
            "h-3.5 w-3.5 shrink-0",
            tone === "warning"
              ? "text-warning"
              : tone === "danger"
              ? "text-danger"
              : tone === "success"
              ? "text-success"
              : "text-muted",
          )}
        />
      </div>
      <p className="display mt-2.5 text-2xl tabular-nums leading-none">{value}</p>
      {hint && <p className="mt-1.5 text-xs text-muted">{hint}</p>}
      {href && (
        <span className="mt-2 inline-flex items-center gap-1 text-[0.62rem] uppercase tracking-[0.14em] text-oxide opacity-0 transition group-hover:opacity-100">
          Open <ArrowUpRight className="h-3 w-3" />
        </span>
      )}
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

// ─────────────────────── Quick action button ───────────────────────────────────
function QuickAction({
  href,
  icon: Icon,
  label,
  description,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  description?: string;
}) {
  return (
    <Link
      href={href}
      className="group card flex items-center gap-3 p-4 transition hover:border-ink"
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center border border-line bg-bone transition group-hover:border-oxide group-hover:bg-oxide/10">
        <Icon className="h-4 w-4 text-muted group-hover:text-oxide" />
      </span>
      <div className="min-w-0">
        <p className="text-sm font-medium">{label}</p>
        {description && <p className="text-xs text-muted">{description}</p>}
      </div>
      <ArrowUpRight className="ml-auto h-3.5 w-3.5 text-muted opacity-0 transition group-hover:opacity-100" />
    </Link>
  );
}

// ─────────────────────── Page ─────────────────────────────────────────────────
export default async function AdminDashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireStudio(undefined, "/admin");
  const sp = await searchParams;
  const denied = typeof sp.denied === "string" ? sp.denied : null;

  const [stats, checklist] = await Promise.all([getDashboardStats(), getSetupChecklist()]);
  const outstanding = checklist.filter((c) => !c.done);

  // Greeting
  const firstName = user.name.split(" ")[0];
  const todayStr = new Date().toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHeader
        title={`Good to see you, ${firstName}`}
        description={todayStr}
        actions={
          <>
            <Link href="/admin/products/new" className="btn px-4 py-2.5 text-[0.65rem]">
              <Plus className="h-3.5 w-3.5" />
              Add product
            </Link>
            <Link href="/admin/orders/new" className="btn-outline px-4 py-2.5 text-[0.65rem]">
              <Receipt className="h-3.5 w-3.5" />
              New manual order
            </Link>
            <Link href="/admin/orders?payment=pending_verification" className="btn-outline px-4 py-2.5 text-[0.65rem]">
              <CreditCard className="h-3.5 w-3.5" />
              Verify payments
            </Link>
          </>
        }
      />

      {/* Permission denied notice */}
      {denied && (
        <div className="mb-5 border border-warning/40 bg-warning/10 px-3.5 py-2.5 text-sm text-warning">
          Your role does not include{" "}
          <span className="font-mono">{denied}</span> — ask the owner for access.
        </div>
      )}

      {/* ── KPI row 1 ─────────────────────────────────────────────────── */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi
          label="Revenue · 30 days"
          value={formatMoney(stats.revenue30)}
          hint={`${stats.orders30} orders placed`}
          icon={TrendingUp}
          href="/admin/orders"
        />
        <Kpi
          label="Orders today"
          value={String(stats.ordersToday)}
          hint={`${stats.ordersWeek} this week`}
          icon={Receipt}
          href="/admin/orders"
        />
        <Kpi
          label="Pending confirmation"
          value={String(stats.pendingOrders)}
          hint="Orders waiting for confirmation"
          icon={PackageCheck}
          href="/admin/orders?status=pending"
          tone={stats.pendingOrders > 0 ? "warning" : undefined}
        />
        <Kpi
          label="Payments to verify"
          value={String(stats.awaitingPayments)}
          hint="bKash / Nagad TrxIDs submitted"
          icon={CreditCard}
          href="/admin/orders?payment=pending_verification"
          tone={stats.awaitingPayments > 0 ? "warning" : undefined}
        />
      </div>

      {/* ── KPI row 2 ─────────────────────────────────────────────────── */}
      <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi
          label="Low stock variants"
          value={String(stats.lowStockCount)}
          hint="At or below 3 units"
          icon={Boxes}
          href="/admin/inventory?low=1"
          tone={stats.lowStockCount > 0 ? "danger" : undefined}
        />
        <Kpi
          label="Open concierge requests"
          value={String(stats.openConciergeCount)}
          hint="Cancellation and address changes"
          icon={Bot}
          href="/admin/concierge/requests"
          tone={stats.openConciergeCount > 0 ? "warning" : undefined}
        />
        <Kpi
          label="New messages"
          value={String(stats.newMessagesCount)}
          hint="Unread contact messages"
          icon={Mail}
          href="/admin/messages"
          tone={stats.newMessagesCount > 0 ? "warning" : undefined}
        />
        <div className="card p-4">
          <p className="text-[0.6rem] font-semibold uppercase tracking-[0.16em] text-muted">Average order value · 30 days</p>
          <p className="display mt-2.5 text-2xl tabular-nums leading-none">
            {formatMoney(stats.orders30 > 0 ? Math.round(stats.revenue30 / stats.orders30) : 0)}
          </p>
          <p className="mt-1.5 text-xs text-muted">Excludes cancelled and refunded orders.</p>
        </div>
      </div>

      {/* ── Attention panel ───────────────────────────────────────────── */}
      {(stats.awaitingPayments > 0 || stats.pendingOrders > 0 || stats.openConciergeCount > 0) && (
        <Section title="Needs your attention" className="mt-5">
          <ul className="divide-y divide-line/70">
            {stats.awaitingPayments > 0 && (
              <li className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center bg-warning/10">
                    <CreditCard className="h-3.5 w-3.5 text-warning" />
                  </span>
                  <div>
                    <p className="text-sm font-medium">{stats.awaitingPayments} payment{stats.awaitingPayments > 1 ? "s" : ""} awaiting verification</p>
                    <p className="text-xs text-muted">bKash or Nagad TrxIDs submitted by customers</p>
                  </div>
                </div>
                <Link href="/admin/orders?payment=pending_verification" className="shrink-0 text-[0.62rem] uppercase tracking-[0.14em] text-oxide hover:underline">
                  Review
                </Link>
              </li>
            )}
            {stats.pendingOrders > 0 && (
              <li className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center bg-warning/10">
                    <PackageCheck className="h-3.5 w-3.5 text-warning" />
                  </span>
                  <div>
                    <p className="text-sm font-medium">{stats.pendingOrders} order{stats.pendingOrders > 1 ? "s" : ""} pending confirmation</p>
                    <p className="text-xs text-muted">Confirm to move the order to processing</p>
                  </div>
                </div>
                <Link href="/admin/orders?status=pending" className="shrink-0 text-[0.62rem] uppercase tracking-[0.14em] text-oxide hover:underline">
                  Review
                </Link>
              </li>
            )}
            {stats.openConciergeCount > 0 && (
              <li className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center bg-warning/10">
                    <Bot className="h-3.5 w-3.5 text-warning" />
                  </span>
                  <div>
                    <p className="text-sm font-medium">{stats.openConciergeCount} open concierge request{stats.openConciergeCount > 1 ? "s" : ""}</p>
                    <p className="text-xs text-muted">Customers waiting for a response</p>
                  </div>
                </div>
                <Link href="/admin/concierge/requests" className="shrink-0 text-[0.62rem] uppercase tracking-[0.14em] text-oxide hover:underline">
                  Review
                </Link>
              </li>
            )}
          </ul>
        </Section>
      )}

      {/* ── Setup checklist ───────────────────────────────────────────── */}
      {outstanding.length > 0 && (
        <Section
          title="Before you launch"
          description={`${checklist.length - outstanding.length} of ${checklist.length} done`}
          className="mt-5"
        >
          <ul className="space-y-2.5">
            {checklist.map((item) => (
              <li key={item.id} className="flex items-start gap-3">
                <span
                  className={cn(
                    "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center border",
                    item.done ? "border-success bg-success text-paper" : "border-line",
                  )}
                >
                  {item.done && <Check className="h-3 w-3" />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className={cn("text-sm", item.done && "text-muted line-through")}>{item.label}</p>
                  {!item.done && <p className="mt-0.5 text-xs text-muted">{item.hint}</p>}
                </div>
                {!item.done && (
                  <Link
                    href={item.href}
                    className="shrink-0 text-[0.62rem] uppercase tracking-[0.14em] text-oxide underline-offset-4 hover:underline"
                  >
                    Fix
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {/* ── Revenue chart + Low stock ─────────────────────────────────── */}
      <div className="mt-5 grid gap-5 xl:grid-cols-3">
        <Section title="Revenue & orders · last 30 days" className="xl:col-span-2">
          <Sparkline series={stats.series} />
        </Section>

        <Section
          title="Low stock"
          actions={
            <Link href="/admin/inventory?low=1" className="text-[0.62rem] uppercase tracking-[0.14em] text-oxide hover:underline">
              Inventory
            </Link>
          }
        >
          {stats.lowStock.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted">Everything is well stocked.</p>
          ) : (
            <ul className="divide-y divide-line/70">
              {stats.lowStock.map((v) => (
                <li key={v.id} className="flex items-center justify-between gap-3 py-2">
                  <div className="min-w-0">
                    <Link href={`/admin/products/${v.productId}`} className="block truncate text-sm hover:underline">
                      {v.product}
                    </Link>
                    <p className="truncate text-xs text-muted">{v.title}</p>
                  </div>
                  <span
                    className={cn(
                      "shrink-0 border px-2 py-0.5 text-[0.62rem] font-semibold tabular-nums",
                      v.stock === 0
                        ? "border-danger/40 bg-danger/10 text-danger"
                        : "border-warning/40 bg-warning/10 text-warning",
                    )}
                  >
                    {v.stock === 0 ? "Out" : `${v.stock} left`}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>

      {/* ── Recent orders ─────────────────────────────────────────────── */}
      <Section
        title="Recent orders"
        className="mt-5"
        actions={
          <Link href="/admin/orders" className="text-[0.62rem] uppercase tracking-[0.14em] text-oxide hover:underline">
            All orders
          </Link>
        }
      >
        {stats.recentOrders.length === 0 ? (
          <div className="py-10 text-center">
            <AlertTriangle className="mx-auto mb-3 h-5 w-5 text-muted" />
            <p className="text-sm text-muted">No orders yet. Publish a product and share the storefront.</p>
          </div>
        ) : (
          <div className="-mx-4 overflow-x-auto sm:-mx-5">
            <table className="w-full min-w-[46rem] border-collapse text-sm">
              <thead>
                <tr className="border-b border-line text-[0.6rem] uppercase tracking-[0.14em] text-muted">
                  <th className="px-4 py-2 text-left font-semibold sm:px-5">Order</th>
                  <th className="px-3 py-2 text-left font-semibold">Customer</th>
                  <th className="px-3 py-2 text-right font-semibold">Items</th>
                  <th className="px-3 py-2 text-right font-semibold">Total</th>
                  <th className="px-3 py-2 text-left font-semibold">Channel</th>
                  <th className="px-3 py-2 text-left font-semibold">Payment</th>
                  <th className="px-3 py-2 text-left font-semibold">Status</th>
                  <th className="px-4 py-2 text-right font-semibold sm:px-5">Placed</th>
                </tr>
              </thead>
              <tbody>
                {stats.recentOrders.map((o) => (
                  <tr key={o.id} className="border-b border-line/60 last:border-0 hover:bg-bone/60">
                    <td className="px-4 py-2.5 sm:px-5">
                      <Link href={`/admin/orders/${o.id}`} className="font-mono text-xs underline-offset-4 hover:underline">
                        {o.number}
                      </Link>
                    </td>
                    <td className="max-w-[12rem] truncate px-3 py-2.5">{o.customerName}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{o._count.items}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{formatMoney(o.total)}</td>
                    <td className="px-3 py-2.5">
                      <ChannelBadge channel={o.channel} />
                    </td>
                    <td className="px-3 py-2.5">
                      <PaymentBadge status={o.paymentStatus} />
                    </td>
                    <td className="px-3 py-2.5">
                      <StatusBadge status={o.status} />
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-right text-xs text-muted sm:px-5">
                      {o.placedAt.toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      {/* ── Quick actions ─────────────────────────────────────────────── */}
      <Section title="Quick actions" className="mt-5">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <QuickAction href="/admin/products/new" icon={Plus} label="New product" description="Add a new product to your catalogue" />
          <QuickAction href="/admin/orders/new" icon={Receipt} label="New manual order" description="Create an order on behalf of a customer" />
          <QuickAction href="/admin/pages/new" icon={FileText} label="New page" description="Create an editorial or legal page" />
          <QuickAction href="/admin/catalog" icon={Layers} label="Manage collections" description="Organise products into collections" />
          <QuickAction href="/admin/settings" icon={Settings} label="Settings" description="Checkout, shipping, appearance and more" />
          <QuickAction href="/admin/messages" icon={Mail} label="Messages" description="Respond to customer messages" />
        </div>
      </Section>
    </div>
  );
}
