import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { audit } from "@/lib/audit";
import { handleError } from "@/lib/api-server";
import { i18nText, parseJson } from "@/lib/json";
import { minorToMajor } from "@/lib/money";

const esc = (v: unknown) => {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** Streaming CSV of every variant — opens straight into Excel / Sheets. */
export async function GET() {
  try {
    const user = await requireUser("products.write");

    const variants = await db.productVariant.findMany({
      orderBy: [{ productId: "asc" }, { position: "asc" }],
      include: { product: { select: { name: true, slug: true, sku: true, status: true, price: true } } },
    });
    await audit(user.id, "inventory.export", "variant", null, { rows: variants.length });

    const header = ["product", "product_slug", "product_sku", "status", "variant", "variant_sku", "options", "price_bdt", "stock", "low_stock_at", "active"];
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(`${header.join(",")}\n`));
        for (const v of variants) {
          const options = parseJson<Record<string, string>>(v.options, {});
          const row = [
            i18nText(v.product.name, "en"),
            v.product.slug,
            v.product.sku ?? "",
            v.product.status,
            v.title,
            v.sku ?? "",
            Object.entries(options)
              .map(([k, val]) => `${k}: ${val}`)
              .join("; "),
            minorToMajor(v.price ?? v.product.price).toFixed(2),
            v.stock,
            v.lowStockAt,
            v.isActive ? "yes" : "no",
          ];
          controller.enqueue(encoder.encode(`${row.map(esc).join(",")}\n`));
        }
        controller.close();
      },
    });

    const stamp = new Date().toISOString().slice(0, 10);
    return new Response(stream, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="orynve-inventory-${stamp}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    return handleError(e);
  }
}
