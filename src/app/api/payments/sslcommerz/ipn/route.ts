import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { verifySslcommerz } from "@/lib/payments/sslcommerz";
import { recordGatewayResult } from "@/lib/payments/record";

export const runtime = "nodejs";

/** Server-to-server IPN from SSLCommerz — the authoritative signal. */
export async function POST(req: NextRequest) {
  const form = await req.formData();
  const payload: Record<string, string> = {};
  form.forEach((v, k) => (payload[k] = String(v)));
  const order = await db.order.findFirst({ where: { OR: [{ number: payload.tran_id ?? "" }, { id: payload.value_a ?? "" }] } });
  if (!order) return NextResponse.json({ ok: false }, { status: 404 });
  const v = await verifySslcommerz(payload);
  await recordGatewayResult(order.id, "sslcommerz", v);
  return NextResponse.json({ ok: true });
}
