import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { can, requireUser } from "@/lib/auth/session";
import { handleError, jsonOk } from "@/lib/api-server";
import { i18nText } from "@/lib/json";

export type SearchOrder = { id: string; number: string; customerName: string; status: string; total: number };
export type SearchProduct = { id: string; name: string; slug: string; status: string };
export type SearchCustomer = { id: string; name: string; email: string | null; phone: string | null };

export type AdminSearchResult = {
  orders: SearchOrder[];
  products: SearchProduct[];
  customers: SearchCustomer[];
};

/**
 * GET /api/admin/search?q=…
 *
 * Global command-palette search. Returns up to 5 results per entity type,
 * scoped to what the current user's role may access.
 */
export async function GET(req: NextRequest) {
  try {
    const user = await requireUser();
    const q = (req.nextUrl.searchParams.get("q") ?? "").trim();

    if (!q || q.length < 2) {
      return jsonOk<AdminSearchResult>({ orders: [], products: [], customers: [] });
    }

    const canOrders = can(user, "orders.write");
    const canProducts = can(user, "products.write");
    const canCustomers = can(user, "customers.read");

    const [orders, products, customers] = await Promise.all([
      canOrders
        ? db.order.findMany({
            where: {
              OR: [{ number: { contains: q } }, { phone: { contains: q } }, { customerName: { contains: q } }],
            },
            orderBy: { placedAt: "desc" },
            take: 5,
            select: { id: true, number: true, customerName: true, status: true, total: true },
          })
        : Promise.resolve([]),
      canProducts
        ? db.product.findMany({
            where: {
              OR: [{ name: { contains: q } }, { slug: { contains: q } }, { sku: { contains: q } }],
              status: { not: "archived" },
            },
            orderBy: { updatedAt: "desc" },
            take: 5,
            select: { id: true, name: true, slug: true, status: true },
          })
        : Promise.resolve([]),
      canCustomers
        ? db.customer.findMany({
            where: {
              OR: [{ name: { contains: q } }, { email: { contains: q } }, { phone: { contains: q } }],
            },
            orderBy: { updatedAt: "desc" },
            take: 5,
            select: { id: true, name: true, email: true, phone: true },
          })
        : Promise.resolve([]),
    ]);

    return jsonOk<AdminSearchResult>({
      orders: orders.map((o) => ({
        id: o.id,
        number: o.number,
        customerName: o.customerName,
        status: o.status,
        total: o.total,
      })),
      products: products.map((p) => ({
        id: p.id,
        name: i18nText(p.name, "en"),
        slug: p.slug,
        status: p.status,
      })),
      customers: customers.map((c) => ({
        id: c.id,
        name: c.name,
        email: c.email,
        phone: c.phone,
      })),
    });
  } catch (e) {
    return handleError(e);
  }
}
