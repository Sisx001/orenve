import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { handleError, jsonOk } from "@/lib/api-server";
import { i18nText } from "@/lib/json";
import type { ProductPick } from "@/lib/admin/types";

/** Product + variant picker used by the manual order builder. */
export async function GET(req: NextRequest) {
  try {
    await requireUser("orders.write");
    const q = (req.nextUrl.searchParams.get("q") ?? "").trim();

    const products = await db.product.findMany({
      where: {
        status: { not: "archived" },
        ...(q
          ? {
              OR: [{ name: { contains: q } }, { slug: { contains: q } }, { sku: { contains: q } }, { tags: { contains: q } }],
            }
          : {}),
      },
      orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
      take: 24,
      include: {
        images: { orderBy: { position: "asc" }, take: 1 },
        variants: { orderBy: { position: "asc" } },
      },
    });

    const items: ProductPick[] = products.map((p) => ({
      id: p.id,
      name: i18nText(p.name, "en"),
      slug: p.slug,
      price: p.price,
      image: p.images[0]?.url ?? null,
      variants: p.variants.map((v) => ({
        id: v.id,
        title: v.title,
        sku: v.sku,
        price: v.price ?? p.price,
        stock: v.stock,
        isActive: v.isActive,
      })),
    }));

    return jsonOk({ items });
  } catch (e) {
    return handleError(e);
  }
}
