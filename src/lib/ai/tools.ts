import "server-only";
import { db } from "@/lib/db";
import { getSetting } from "@/lib/settings";
import { i18nText, parseJson } from "@/lib/json";
import { formatMoney } from "@/lib/money";
import { findOrderForCustomer } from "@/lib/orders/service";
import { recommendFromChart, recommendFromSizeGuide, type ChartRow, type SizeGuide } from "./size-advisor";
import type { ToolSpec } from "./client";

export const TOOL_SPECS: Record<
  "lookup_order" | "search_products" | "recommend_size" | "request_order_change",
  ToolSpec
> = {
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
  recommend_size: {
    type: "function",
    function: {
      name: "recommend_size",
      description:
        "Recommend the best size for a customer based on their body measurements and optional fit preference. Can also check stock for the recommended size when a product is identified. Use whenever the customer asks about sizing.",
      parameters: {
        type: "object",
        properties: {
          product_query: { type: "string", description: "Optional: search term to find a specific product whose size guide to use" },
          height_cm: { type: "number", description: "Customer height in centimetres" },
          weight_kg: { type: "number", description: "Customer weight in kilograms" },
          chest_cm: { type: "number", description: "Customer chest circumference in centimetres" },
          fit: { type: "string", enum: ["regular", "relaxed", "slim"], description: "Desired fit preference" },
        },
        required: [],
      },
    },
  },
  request_order_change: {
    type: "function",
    function: {
      name: "request_order_change",
      description:
        "Submit a change request (cancel, address change, or other) for an order the customer has already verified in this conversation. Only available after lookup_order succeeds. Cancel is always a REQUEST — it does not change the order status.",
      parameters: {
        type: "object",
        properties: {
          order_number: { type: "string", description: "The exact order number, e.g. ORY-2024-000001" },
          type: { type: "string", enum: ["cancel", "address", "other"], description: "Type of request" },
          details: { type: "string", description: "Customer's explanation or new details for the request" },
        },
        required: ["order_number", "type", "details"],
      },
    },
  },
};

export type RunToolCtx = {
  locale: string;
  onOrderVerified?: (n: string) => void;
  verifiedOrder?: string | null;
  allowChangeRequests?: boolean;
  conversationId?: string;
  onRequestCreated?: () => void;
};

/** Executes a tool with strict server-side scoping. Results are plain JSON strings. */
export async function runTool(
  name: string,
  args: Record<string, unknown>,
  ctx: RunToolCtx,
): Promise<string> {
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
      include: {
        variants: { where: { isActive: true } },
        options: true,
        category: true,
        images: { orderBy: { position: "asc" }, take: 1 },
      },
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
        const sizeStock = new Map<string, number>();
        const colors = new Set<string>();
        for (const v of p.variants) {
          const o = parseJson<Record<string, string>>(v.options, {});
          if (o.Size) sizeStock.set(o.Size, (sizeStock.get(o.Size) ?? 0) + v.stock);
          if (o.Color) colors.add(o.Color);
        }
        const sizesStructured = [...sizeStock.entries()].map(([s, stock]) => ({ size: s, stock }));
        const firstImage = p.images[0];
        return {
          productId: p.id,
          slug: p.slug,
          name: i18nText(p.name, ctx.locale),
          price: formatMoney(p.price, undefined, ctx.locale),
          compareAt: p.compareAtPrice ? formatMoney(p.compareAtPrice, undefined, ctx.locale) : null,
          category: p.category ? i18nText(p.category.name, ctx.locale) : null,
          colors: [...colors],
          sizes: sizesStructured,
          // Human-readable summary for the model
          sizeSummary: sizesStructured.map(({ size: s, stock }) => `${s}: ${stock > 0 ? `${stock} in stock` : "sold out"}`),
          requestedSize: size
            ? sizeStock.has(size)
              ? `${size}: ${(sizeStock.get(size) ?? 0) > 0 ? `${sizeStock.get(size)} in stock` : "sold out"}`
              : `${size} not offered`
            : undefined,
          image: firstImage ? firstImage.url : null,
          page: `/${ctx.locale}/product/${p.slug}`,
          details: parseJson<Record<string, Record<string, string>>>(p.details, {}),
        };
      }),
    });
  }

  if (name === "recommend_size") {
    const ai = await getSetting("ai");
    if (!ai.sizeAdvisor.enabled) {
      return JSON.stringify({ result: "disabled", message: "Size advisor is not enabled." });
    }

    const productQuery = args.product_query ? String(args.product_query).trim() : null;
    const chest_cm = args.chest_cm != null ? Number(args.chest_cm) : undefined;
    const height_cm = args.height_cm != null ? Number(args.height_cm) : undefined;
    const weight_kg = args.weight_kg != null ? Number(args.weight_kg) : undefined;
    const fit = (["regular", "relaxed", "slim"].includes(String(args.fit ?? "")) ? args.fit : "regular") as "regular" | "relaxed" | "slim";

    if (!chest_cm && !height_cm && !weight_kg) {
      return JSON.stringify({ result: "need_measurements", message: "Please provide at least one measurement (chest, height, or weight)." });
    }

    let recommendation: { best: string; alt: string | null } | null = null;
    let productName: string | null = null;
    let stockInfo: string | null = null;

    // Try product-specific size guide first
    if (productQuery) {
      const words = productQuery.toLowerCase().split(/\s+/).filter((w) => w.length > 1).slice(0, 5);
      const products = await db.product.findMany({
        where: { status: "published" },
        include: { variants: { where: { isActive: true } }, images: { orderBy: { position: "asc" }, take: 1 } },
        take: 20,
      });
      const match = products
        .map((p) => {
          const hay = `${i18nText(p.name, "en")} ${i18nText(p.name, "bn")}`.toLowerCase();
          const score = words.reduce((s, w) => s + (hay.includes(w) ? 1 : 0), 0);
          return { p, score };
        })
        .filter((x) => x.score > 0)
        .sort((a, b) => b.score - a.score)[0];

      if (match) {
        const sizeGuideRaw = parseJson<SizeGuide | null>(match.p.sizeGuide ?? "", null);
        if (sizeGuideRaw) {
          recommendation = recommendFromSizeGuide(sizeGuideRaw, { chest_cm, height_cm, weight_kg, fit });
        }
        if (recommendation && chest_cm) {
          productName = i18nText(match.p.name, ctx.locale);
          // Find stock for recommended size
          const sizeStock = new Map<string, number>();
          for (const v of match.p.variants) {
            const o = parseJson<Record<string, string>>(v.options, {});
            if (o.Size) sizeStock.set(o.Size, (sizeStock.get(o.Size) ?? 0) + v.stock);
          }
          const stock = sizeStock.get(recommendation.best);
          if (stock !== undefined) {
            stockInfo = stock > 0 ? `${stock} in stock` : "sold out";
          }
        }
      }
    }

    // Fall back to brand chart
    if (!recommendation) {
      const chart = parseJson<ChartRow[]>(ai.sizeAdvisor.chart, []);
      recommendation = recommendFromChart(chart, { chest_cm, height_cm, weight_kg, fit });
    }

    const note = i18nText(ai.sizeAdvisor.note, ctx.locale);

    return JSON.stringify({
      result: "ok",
      best: recommendation.best,
      alt: recommendation.alt,
      product: productName,
      stock: stockInfo,
      note,
      fit,
    });
  }

  if (name === "request_order_change") {
    const orderNumber = String(args.order_number ?? "").trim().toUpperCase();
    const type = String(args.type ?? "") as "cancel" | "address" | "other";
    const details = String(args.details ?? "").trim().slice(0, 2000);

    if (!["cancel", "address", "other"].includes(type)) {
      return JSON.stringify({ result: "invalid_type" });
    }
    if (!details) return JSON.stringify({ result: "missing_details" });

    // Security: order must have been verified in this conversation
    if (!ctx.verifiedOrder || ctx.verifiedOrder.toUpperCase() !== orderNumber) {
      return JSON.stringify({
        result: "not_verified",
        message: "I can only submit change requests for an order you have verified in this conversation. Please look up your order first.",
      });
    }

    if (!ctx.allowChangeRequests) {
      return JSON.stringify({
        result: "disabled",
        message: "Change requests are not available at this time. Please contact us directly.",
      });
    }

    // Look up the order in DB
    const order = await db.order.findFirst({ where: { number: orderNumber }, select: { id: true, number: true, phone: true, customerName: true } });
    if (!order) return JSON.stringify({ result: "not_found" });

    const typeLabel = { cancel: "Cancellation", address: "Address change", other: "Change" }[type] ?? "Change";
    const subject = `Concierge request ${order.number} (${type})`;
    const title = toJson({ en: `Concierge request: ${type}`, bn: `কনসিয়ার্জ অনুরোধ: ${type}` });
    const message = toJson({
      en: `Customer requested ${type.replace("_", " ")} via the concierge. Details: ${details}`,
      bn: `কাস্টমার কনসিয়ার্জের মাধ্যমে ${type} অনুরোধ করেছেন। বিবরণ: ${details}`,
    });

    await db.$transaction([
      db.conciergeRequest.create({
        data: {
          orderId: order.id,
          orderNumber: order.number,
          type,
          details,
          status: "open",
          conversationId: ctx.conversationId ?? null,
          locale: ctx.locale,
        },
      }),
      db.orderEvent.create({
        data: {
          orderId: order.id,
          type: "message",
          title,
          message,
          isPublic: false,
        },
      }),
      db.contactMessage.create({
        data: {
          name: order.customerName,
          email: "concierge@orynve.com",
          phone: order.phone,
          subject,
          message: `${typeLabel} requested by customer.\nOrder: ${order.number}\nDetails: ${details}`,
        },
      }),
    ]);

    ctx.onRequestCreated?.();

    const confirmMsg =
      ctx.locale === "bn"
        ? `আপনার ${type === "cancel" ? "বাতিলের" : type === "address" ? "ঠিকানা পরিবর্তনের" : "পরিবর্তনের"} অনুরোধটি পাঠানো হয়েছে। আমাদের দল শীঘ্রই যোগাযোগ করবে। এটি একটি অনুরোধ — অর্ডারের মর্যাদা এখনই পরিবর্তন হয়নি।`
        : `Your ${type === "cancel" ? "cancellation" : type === "address" ? "address change" : "change"} request has been submitted. Our team will be in touch soon. This is a request — the order status has not changed yet.`;

    return JSON.stringify({ result: "submitted", message: confirmMsg });
  }

  return JSON.stringify({ result: "unknown_tool" });
}

// Inline helpers to avoid circular import with json.ts in a server-only file
function toJson(value: unknown): string {
  return JSON.stringify(value ?? null);
}
