import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { handleError, jsonOk } from "@/lib/api-server";
import { normalizeBdPhone } from "@/lib/orders/service";
import type { CustomerPick } from "@/lib/admin/types";

/** Look up an existing customer by phone, name or email. */
export async function GET(req: NextRequest) {
  try {
    await requireUser("customers.read");
    const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
    if (q.length < 2) return jsonOk({ items: [] as CustomerPick[] });

    const digits = q.replace(/\D/g, "");
    const rows = await db.customer.findMany({
      where: {
        OR: [
          { name: { contains: q } },
          { email: { contains: q } },
          ...(digits.length >= 3 ? [{ phone: { contains: digits } }, { phone: { contains: normalizeBdPhone(q) } }] : []),
        ],
      },
      orderBy: { updatedAt: "desc" },
      take: 12,
      include: {
        _count: { select: { orders: true } },
        addresses: { orderBy: { isDefault: "desc" }, take: 1 },
      },
    });

    const items: CustomerPick[] = rows.map((c) => {
      const a = c.addresses[0];
      return {
        id: c.id,
        name: c.name,
        phone: c.phone,
        email: c.email,
        orders: c._count.orders,
        address: a
          ? {
              line1: a.line1,
              line2: a.line2 ?? "",
              city: a.city,
              district: a.district,
              postalCode: a.postalCode ?? "",
              country: a.country,
            }
          : null,
      };
    });

    return jsonOk({ items });
  } catch (e) {
    return handleError(e);
  }
}
