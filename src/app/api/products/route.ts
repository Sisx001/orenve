import type { NextRequest } from "next/server";
import { getProduct, listProducts } from "@/lib/catalog";
import { normalizeLocale } from "@/lib/i18n";
import { handleError, jsonError, jsonOk } from "@/lib/api-server";

export const runtime = "nodejs";

/**
 * GET /api/products — read-only storefront catalogue helper.
 *
 *   ?slug=the-ease-shirt   → { product: ProductDetail }   (quick view)
 *   ?ids=a,b,c             → { products: ProductCard[] }  (wishlist)
 *   ?all=1                 → { products: ProductCard[] }  (search index)
 *
 * Always scoped to published products via src/lib/catalog.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const locale = normalizeLocale(searchParams.get("locale"));

    const slug = searchParams.get("slug");
    if (slug) {
      const product = await getProduct(slug, locale);
      if (!product) return jsonError("errors.notFound", 404);
      return jsonOk({ product });
    }

    const idsParam = searchParams.get("ids");
    if (idsParam !== null) {
      const ids = idsParam.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 100);
      if (ids.length === 0) return jsonOk({ products: [] });
      const all = await listProducts(locale);
      const order = new Map(ids.map((id, i) => [id, i]));
      const products = all.filter((p) => order.has(p.id)).sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
      return jsonOk({ products });
    }

    if (searchParams.get("all") === "1") {
      const products = await listProducts(locale);
      return jsonOk({ products });
    }

    return jsonError("errors.invalidInput", 400);
  } catch (e) {
    return handleError(e);
  }
}
