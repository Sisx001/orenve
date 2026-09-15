import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { verifyShurjopay } from "@/lib/payments/shurjopay";
import { recordGatewayResult } from "@/lib/payments/record";
import { absoluteUrl } from "@/lib/utils";

export const runtime = "nodejs";

/** shurjoPay returns the customer to return_url?order_id=<sp_order_id>. */
export async function GET(req: NextRequest) {
  const spOrderId = req.nextUrl.searchParams.get("order_id") ?? "";
  const cancelled = req.nextUrl.searchParams.get("cancel") === "1";
  const payment = spOrderId ? await db.payment.findFirst({ where: { providerRef: spOrderId }, include: { order: true } }) : null;
  const order = payment?.order ?? null;
  if (!order) return NextResponse.redirect(absoluteUrl("/"), 303);
  if (cancelled) {
    await recordGatewayResult(order.id, "shurjopay", { status: "failed", raw: { cancelled: true }, providerRef: spOrderId });
    return NextResponse.redirect(absoluteUrl(`/${order.locale}/order/${order.trackingCode}?cancelled=1`), 303);
  }
  const v = await verifyShurjopay(spOrderId);
  await recordGatewayResult(order.id, "shurjopay", v);
  return NextResponse.redirect(absoluteUrl(`/${order.locale}/order/${order.trackingCode}?${v.status === "paid" ? "paid=1" : "failed=1"}`), 303);
}
