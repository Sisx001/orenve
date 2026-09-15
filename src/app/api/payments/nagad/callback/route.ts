import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { verifyNagad } from "@/lib/payments/nagad";
import { recordGatewayResult } from "@/lib/payments/record";
import { absoluteUrl } from "@/lib/utils";

export const runtime = "nodejs";

/** Nagad redirects to merchantCallbackURL?order_id=…&payment_ref_id=…&status=Success|Aborted|Failed */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const refId = sp.get("payment_ref_id") ?? "";
  const status = sp.get("status") ?? "";
  const orderId = sp.get("order") ?? "";
  const order = (orderId && (await db.order.findUnique({ where: { id: orderId } }))) || (refId ? (await db.payment.findFirst({ where: { providerRef: refId }, include: { order: true } }))?.order : null);
  if (!order) return NextResponse.redirect(absoluteUrl("/"), 303);
  if (status.toLowerCase() === "success" && refId) {
    const v = await verifyNagad(refId);
    await recordGatewayResult(order.id, "nagad_checkout", v);
    return NextResponse.redirect(absoluteUrl(`/${order.locale}/order/${order.trackingCode}?${v.status === "paid" ? "paid=1" : "failed=1"}`), 303);
  }
  await recordGatewayResult(order.id, "nagad_checkout", { status: "failed", raw: Object.fromEntries(sp), providerRef: refId });
  return NextResponse.redirect(absoluteUrl(`/${order.locale}/order/${order.trackingCode}?${status.toLowerCase() === "aborted" ? "cancelled=1" : "failed=1"}`), 303);
}
