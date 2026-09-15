import "server-only";
import { db } from "@/lib/db";
import { i18nText, parseJson } from "@/lib/json";
import { formatMoney } from "@/lib/money";
import { findOrderForCustomer } from "@/lib/orders/service";
import type { ToolSpec } from "./client";

export const TOOL_SPECS: Record<"lookup_order" | "search_products", ToolSpec> = {
  lookup_order: {
    type: "function",
    function: {
      name: "lookup_order",
      description:
        "Look up ONE order that belongs to the customer. Requires the order number (ORY-YYYY-NNNNNN) or 8-character tracking code AND the mobile number used at checkout. Returns public status, timeline, items and courier info. Returns not_found if the pair does not match.",
      parameters: {
        type: "object",
        properties: {
          reference: { type: "string", description: "Order number or tracking code exactly as the customer wrote it" },
          phone: { type: "string", description: "Customer mobile number, e.g. 017XXXXXXXX or +88017XXXXXXXX" },
        },
        required: ["reference", "phone"],
      },
    },
  },
  search_products: {
    type: "function",
    function: {
      name: "search_products",
      description:
        "Search the published catalogue by free text (name, category, colour, material). Returns up to 6 products with price, colours, sizes with live stock, and the product page path. Use for any size, stock, price or availability question.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Search words, e.g. 'overcoat', 'linen shirt', 'black'" },
          size: { type: "string", description: "Optional size to check stock for, e.g. M" },
        },
        required: ["query"],
      },
    },
  },
};

/** Executes a tool with strict server-side scoping. Results are plain JSON strings. */
export async function runTool(name: string, args: Record<string, unknown>, ctx: { locale: string; onOrderVerified?: (n: string) => void }): Promise<string> {
  if (name === "lookup_order") {
    const reference = String(args.reference ?? "").trim();
    const phone = String(args.phone ?? "").trim();
    if (!reference || !phone) return JSON.stringify({ result: "missing_reference_or_phone" });
    const view = await findOrderForCustomer(reference, phone, ctx.locale);
    if (!view) return JSON.stringify({ result: "not_found", hint: "Order reference and phone number must both match." });
    ctx.onOrderVerified?.(view.number);
    return JSON.stringify({
      result: "found",
      order: {
        number: view.number,
        status: view.status,
        placedAt: view.placedAt,
        paymentMethod: view.paymentMethod,
        paymentStatus: view.paymentStatus,
        total: formatMoney(view.total, undefined, ctx.locale),
        items: view.items.map((i) => `${i.name} (${i.variantTitle ?? ""}) ×${i.quantity}`),
        courier: view.courier,
        courierTracking: view.courierTracking,
        courierUrl: view.courierUrl,
        timeline: view.events.map((e) => ({ at: e.createdAt.slice(0, 16).replace("T", " "), title: e.title, message: e.message })),
        trackPage: `/${ctx.locale}/order/${view.trackingCode}`,
      },
    });
  }

  if (name === "search_products") {
    const query = String(args.query ?? "").trim().toLowerCase();
    const size = args.size ? String(args.size).trim().toUpperCase() : null;
    const words = query.split(/\s+/).filter((w) => w.length > 1).slice(0, 5);
    const products = await db.product.findMany({
      where: { status: "published" },
      include: { variants: { where: { isActive: true } }, options: true, category: true, images: { orderBy: { position: "asc" }, take: 1 } },
      orderBy: [{ featured: "desc" }, { sortOrder: "asc" }],
      take: 60,
    });
    const scored = products
      .map((p) => {
        const hay = [
          i18nText(p.name, "en"),
          i18nText(p.name, "bn"),
          i18nText(p.description, "en"),
          p.category ? i18nText(p.category.name, "en") : "",
          ...parseJson<string[]>(p.tags, []),
          ...p.options.flatMap((o) => parseJson<{ value: string }[]>(o.values, []).map((v) => v.value)),
        ]
          .join(" ")
          .toLowerCase();
        const score = words.reduce((s, w) => s + (hay.includes(w) ? 1 : 0), 0);
        return { p, score };
      })
      .filter((x) => x.score > 0 || words.length === 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 6);

    return JSON.stringify({
      result: scored.length ? "found" : "no_match",
      products: scored.map(({ p }) => {
        const sizes = new Map<string, number>();
        const colors = new Set<string>();
        for (const v of p.variants) {
          const o = parseJson<Record<string, string>>(v.options, {});
          if (o.Size) sizes.set(o.Size, (sizes.get(o.Size) ?? 0) + v.stock);
          if (o.Color) colors.add(o.Color);
        }
        return {
          name: i18nText(p.name, ctx.locale),
          price: formatMoney(p.price, undefined, ctx.locale),
          compareAt: p.compareAtPrice ? formatMoney(p.compareAtPrice, undefined, ctx.locale) : null,
          category: p.category ? i18nText(p.category.name, ctx.locale) : null,
          colors: [...colors],
          sizes: [...sizes.entries()].map(([s, stock]) => `${s}: ${stock > 0 ? `${stock} in stock` : "sold out"}`),
          requestedSize: size ? (sizes.has(size) ? `${size}: ${sizes.get(size)! > 0 ? `${sizes.get(size)} in stock` : "sold out"}` : `${size} not offered`) : undefined,
          details: parseJson<Record<string, Record<string, string>>>(p.details, {}),
          page: `/${ctx.locale}/product/${p.slug}`,
        };
      }),
    });
  }

  return JSON.stringify({ result: "unknown_tool" });
}
