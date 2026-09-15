import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { executeBkash } from "@/lib/payments/bkash";
import { recordGatewayResult } from "@/lib/payments/record";
import { absoluteUrl } from "@/lib/utils";

export const runtime = "nodejs";

/** bKash redirects to callbackURL?paymentID=…&status=success|failure|cancel */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const paymentId = sp.get("paymentID") ?? "";
  const status = sp.get("status") ?? "failure";
  const orderId = sp.get("order") ?? "";
  const order = (orderId && (await db.order.findUnique({ where: { id: orderId } }))) || (paymentId ? (await db.payment.findFirst({ where: { providerRef: paymentId }, include: { order: true } }))?.order : null);
  if (!order) return NextResponse.redirect(absoluteUrl("/"), 303);
  if (status === "success" && paymentId) {
    const v = await executeBkash(paymentId);
    await recordGatewayResult(order.id, "bkash_checkout", v);
    return NextResponse.redirect(absoluteUrl(`/${order.locale}/order/${order.trackingCode}?${v.status === "paid" ? "paid=1" : "failed=1"}`), 303);
  }
  await recordGatewayResult(order.id, "bkash_checkout", { status: "failed", raw: Object.fromEntries(sp), providerRef: paymentId });
  return NextResponse.redirect(absoluteUrl(`/${order.locale}/order/${order.trackingCode}?${status === "cancel" ? "cancelled=1" : "failed=1"}`), 303);
}
