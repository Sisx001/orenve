import { NextResponse, type NextRequest } from "next/server";
import { verifyStripeWebhook } from "@/lib/payments/stripe";
import { recordGatewayResult } from "@/lib/payments/record";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const sig = req.headers.get("stripe-signature");
  if (!sig || !process.env.STRIPE_WEBHOOK_SECRET) return NextResponse.json({ ok: false }, { status: 400 });
  const raw = await req.text();
  try {
    const v = await verifyStripeWebhook(raw, sig);
    if (v?.orderId) await recordGatewayResult(v.orderId, "stripe", v);
    return NextResponse.json({ received: true });
  } catch (e) {
    console.error("[stripe webhook]", e);
    return NextResponse.json({ ok: false }, { status: 400 });
  }
}
