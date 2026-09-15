import "server-only";
import { db } from "@/lib/db";
import { getSetting } from "@/lib/settings";
import { i18nText, parseJson } from "@/lib/json";

const DAY = 86_400_000;

export function startOfDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

/** Monday-start week containing `d`. */
export function startOfWeek(d = new Date()) {
  const x = startOfDay(d);
  const shift = (x.getDay() + 6) % 7;
  x.setDate(x.getDate() - shift);
  return x;
}

export type DashboardStats = Awaited<ReturnType<typeof getDashboardStats>>;

export async function getDashboardStats() {
  const now = new Date();
  const today = startOfDay(now);
  const weekStart = startOfWeek(now);
  const since30 = new Date(today.getTime() - 29 * DAY);
  const since7 = new Date(now.getTime() - 7 * DAY);

  const [
    revenueAgg,
    ordersToday,
    ordersWeek,
    pendingOrders,
    awaitingPayments,
    aiConvos,
    aiFlagged,
    recentOrders,
    revenueRows,
    lowStock,
    lowStockCount,
  ] = await Promise.all([
    db.order.aggregate({
      _sum: { total: true },
      _count: { _all: true },
      where: { placedAt: { gte: since30 }, status: { notIn: ["cancelled", "refunded"] } },
    }),
    db.order.count({ where: { placedAt: { gte: today } } }),
    db.order.count({ where: { placedAt: { gte: weekStart } } }),
    db.order.count({ where: { status: "pending" } }),
    db.payment.count({ where: { status: "pending_verification" } }),
    db.aiConversation.count({ where: { createdAt: { gte: since7 } } }),
    db.aiConversation.count({ where: { flagged: true } }),
    db.order.findMany({
      orderBy: { placedAt: "desc" },
      take: 8,
      select: {
        id: true,
        number: true,
        customerName: true,
        total: true,
        status: true,
        paymentStatus: true,
        channel: true,
        placedAt: true,
        _count: { select: { items: true } },
      },
    }),
    db.order.findMany({
      where: { placedAt: { gte: since30 } },
      select: { placedAt: true, total: true, status: true },
    }),
    db.productVariant.findMany({
      where: { isActive: true, stock: { lte: 5 } },
      orderBy: { stock: "asc" },
      take: 10,
      select: { id: true, title: true, stock: true, lowStockAt: true, product: { select: { id: true, name: true, slug: true } } },
    }),
    db.productVariant.count({ where: { isActive: true, stock: { lte: 3 } } }),
  ]);

  // 30-day daily series (revenue in minor units, order count)
  const series: { date: string; revenue: number; orders: number }[] = [];
  const buckets = new Map<string, { revenue: number; orders: number }>();
  for (const r of revenueRows) {
    if (r.status === "cancelled" || r.status === "refunded") continue;
    const key = startOfDay(r.placedAt).toISOString().slice(0, 10);
    const b = buckets.get(key) ?? { revenue: 0, orders: 0 };
    b.revenue += r.total;
    b.orders += 1;
    buckets.set(key, b);
  }
  for (let i = 0; i < 30; i++) {
    const d = new Date(since30.getTime() + i * DAY);
    const key = d.toISOString().slice(0, 10);
    const b = buckets.get(key) ?? { revenue: 0, orders: 0 };
    series.push({ date: key, revenue: b.revenue, orders: b.orders });
  }

  return {
    revenue30: revenueAgg._sum.total ?? 0,
    orders30: revenueAgg._count._all ?? 0,
    ordersToday,
    ordersWeek,
    pendingOrders,
    awaitingPayments,
    lowStockCount,
    aiConvos7: aiConvos,
    aiFlagged,
    recentOrders,
    series,
    lowStock: lowStock.map((v) => ({
      id: v.id,
      productId: v.product.id,
      product: i18nText(v.product.name, "en"),
      title: v.title,
      stock: v.stock,
      lowStockAt: v.lowStockAt,
    })),
  };
}

export type ChecklistItem = { id: string; label: string; done: boolean; href: string; hint: string };

/** First-run setup checklist shown on the dashboard until everything is green. */
export async function getSetupChecklist(): Promise<ChecklistItem[]> {
  const [contact, checkout, ai] = await Promise.all([getSetting("contact"), getSetting("checkout"), getSetting("ai")]);
  const [productWithPhoto, owner, seededOwner] = await Promise.all([
    db.product.count({ where: { status: "published", images: { some: {} } } }),
    db.user.findFirst({ where: { role: "owner" }, select: { id: true, lastLoginAt: true, updatedAt: true, createdAt: true } }),
    db.auditLog.count({ where: { action: "password.change" } }),
  ]);

  const aiReady = Boolean((ai.baseUrl || process.env.AI_BASE_URL) && (ai.model || process.env.AI_MODEL));
  const mfsReady = (!checkout.bkash || Boolean(checkout.bkashNumber)) && (!checkout.nagad || Boolean(checkout.nagadNumber));

  return [
    {
      id: "whatsapp",
      label: "WhatsApp number set",
      done: Boolean(contact.whatsapp),
      href: "/admin/settings/contact",
      hint: "Customers order and get help through WhatsApp — add the business number.",
    },
    {
      id: "mfs",
      label: "bKash / Nagad numbers added",
      done: mfsReady,
      href: "/admin/settings/checkout",
      hint: "Mobile money is switched on but no receiving number is configured.",
    },
    {
      id: "ai",
      label: "AI concierge configured",
      done: aiReady,
      href: "/admin/settings/ai",
      hint: "Point the concierge at an OpenAI-compatible endpoint and test the connection.",
    },
    {
      id: "password",
      label: "Owner password changed from the seed value",
      done: seededOwner > 0 || Boolean(owner && owner.updatedAt.getTime() - owner.createdAt.getTime() > 60_000),
      href: "/admin/profile",
      hint: "The seeded password is public knowledge — change it now.",
    },
    {
      id: "product",
      label: "At least one published product with photos",
      done: productWithPhoto > 0,
      href: "/admin/products/new",
      hint: "The storefront needs a published product with imagery before launch.",
    },
  ];
}

/** Status tab counts for the orders list. */
export async function getOrderStatusCounts(): Promise<Record<string, number>> {
  const rows = await db.order.groupBy({ by: ["status"], _count: { _all: true } });
  const out: Record<string, number> = {};
  let all = 0;
  for (const r of rows) {
    out[r.status] = r._count._all;
    all += r._count._all;
  }
  out.all = all;
  return out;
}

/** Zone rate for a district — mirrors the storefront's shipping resolution. */
export async function resolveZoneRate(district: string, subtotal: number) {
  const zones = await db.shippingZone.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" } });
  const norm = district.trim().toLowerCase();
  let zone = zones.find((z) => parseJson<string[]>(z.districts, []).some((d) => d.toLowerCase() === norm));
  zone ??= zones.find((z) => parseJson<string[]>(z.districts, []).includes("*"));
  if (!zone) return { zoneId: null as string | null, rate: 0, name: "No zone" };
  const free = zone.freeAbove != null && subtotal >= zone.freeAbove;
  return { zoneId: zone.id, rate: free ? 0 : zone.rate, name: i18nText(zone.name, "en") };
}
