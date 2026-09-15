import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { verifyAamarpay } from "@/lib/payments/aamarpay";
import { recordGatewayResult } from "@/lib/payments/record";
import { absoluteUrl } from "@/lib/utils";

export const runtime = "nodejs";

async function handle(req: NextRequest) {
  const payload: Record<string, string> = {};
  if (req.method === "POST") (await req.formData()).forEach((v, k) => (payload[k] = String(v)));
  req.nextUrl.searchParams.forEach((v, k) => (payload[k] ??= v));
  const tranId = payload.mer_txnid ?? payload.tran_id ?? "";
  const order = await db.order.findFirst({ where: { OR: [{ number: tranId }, { id: payload.opt_a ?? "" }] } });
  if (!order) return NextResponse.redirect(absoluteUrl("/"), 303);
  const result = req.nextUrl.searchParams.get("result");
  if (result === "success") {
    const v = await verifyAamarpay(order.number);
    await recordGatewayResult(order.id, "aamarpay", v);
    return NextResponse.redirect(absoluteUrl(`/${order.locale}/order/${order.trackingCode}?${v.status === "paid" ? "paid=1" : "failed=1"}`), 303);
  }
  await recordGatewayResult(order.id, "aamarpay", { status: "failed", raw: payload });
  return NextResponse.redirect(absoluteUrl(`/${order.locale}/order/${order.trackingCode}?${result === "cancel" ? "cancelled=1" : "failed=1"}`), 303);
}
export const POST = handle;
export const GET = handle;
