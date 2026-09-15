import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { verifySslcommerz } from "@/lib/payments/sslcommerz";
import { recordGatewayResult } from "@/lib/payments/record";
import { absoluteUrl } from "@/lib/utils";

export const runtime = "nodejs";

/** SSLCommerz posts the customer back here after payment. We validate server-side, then redirect to the order page. */
export async function POST(req: NextRequest) {
  const form = await req.formData();
  const payload: Record<string, string> = {};
  form.forEach((v, k) => (payload[k] = String(v)));
  const result = req.nextUrl.searchParams.get("result");
  const order = await db.order.findFirst({ where: { OR: [{ number: payload.tran_id ?? "" }, { id: payload.value_a ?? "" }] } });
  if (!order) return NextResponse.redirect(absoluteUrl("/"), 303);

  if (result === "success") {
    const v = await verifySslcommerz(payload);
    await recordGatewayResult(order.id, "sslcommerz", v);
    return NextResponse.redirect(absoluteUrl(`/${order.locale}/order/${order.trackingCode}?${v.status === "paid" ? "paid=1" : "failed=1"}`), 303);
  }
  await recordGatewayResult(order.id, "sslcommerz", { status: "failed", raw: payload, providerRef: payload.val_id });
  return NextResponse.redirect(absoluteUrl(`/${order.locale}/order/${order.trackingCode}?${result === "cancel" ? "cancelled=1" : "failed=1"}`), 303);
}

export async function GET(req: NextRequest) {
  return NextResponse.redirect(absoluteUrl("/"), 303);
}
