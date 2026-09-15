import type { NextRequest } from "next/server";
import { z } from "zod";
import { quote, CheckoutError } from "@/lib/orders/service";
import { availableMethods } from "@/lib/payments";
import { handleError, jsonError, jsonOk } from "@/lib/api-server";

export const runtime = "nodejs";

const schema = z.object({
  items: z.array(z.object({ variantId: z.string(), quantity: z.number().int().min(1).max(20) })).min(1).max(30),
  district: z.string().optional(),
  couponCode: z.string().optional(),
  locale: z.string().default("en"),
  paymentMethod: z.string().optional(),
});

/** POST /api/checkout/quote — live totals (shipping, coupon) for the cart drawer & checkout. */
export async function POST(req: NextRequest) {
  try {
    const input = schema.parse(await req.json());
    const q = await quote(input);
    const methods = await availableMethods();
    return jsonOk({
      subtotal: q.subtotal,
      shipping: q.shipping,
      codFee: q.codFee,
      discount: q.discount,
      total: q.total,
      zone: q.zone ? { id: q.zone.id, etaMinDays: q.zone.etaMinDays, etaMaxDays: q.zone.etaMaxDays, freeAbove: q.zone.freeAbove } : null,
      coupon: q.coupon ? { code: q.coupon.code, type: q.coupon.type, value: q.coupon.value } : null,
      lines: q.lines.map((l) => ({ variantId: l.variantId, unitPrice: l.unitPrice, quantity: l.quantity, stock: l.variant.stock })),
      methods,
    });
  } catch (e) {
    if (e instanceof CheckoutError) return jsonError(e.code, 409, { vars: e.vars ?? {} });
    return handleError(e);
  }
}
