import "server-only";
import { db } from "@/lib/db";
import { toJson } from "@/lib/json";
import type { WebhookVerification } from "./types";

/** Idempotently applies a gateway result to an order + payment rows. */
export async function recordGatewayResult(orderId: string, provider: "sslcommerz" | "stripe", v: WebhookVerification) {
  const order = await db.order.findUnique({ where: { id: orderId } });
  if (!order) return;
  if (order.paymentStatus === "paid" && v.status !== "paid") return; // never downgrade a paid order from a late fail event

  const existing = await db.payment.findFirst({ where: { orderId, provider }, orderBy: { createdAt: "desc" } });
  const status = v.status === "paid" ? "paid" : v.status === "failed" ? "failed" : "pending";
  const data = { status, providerRef: v.providerRef ?? existing?.providerRef ?? null, transactionId: v.transactionId ?? existing?.transactionId ?? null, rawPayload: toJson(v.raw).slice(0, 20000) };
  if (existing) await db.payment.update({ where: { id: existing.id }, data });
  else await db.payment.create({ data: { orderId, method: provider, provider, amount: v.amountMinor ?? order.total, currency: order.currency, ...data } });

  if (v.status === "paid" && order.paymentStatus !== "paid") {
    await db.order.update({
      where: { id: orderId },
      data: { paymentStatus: "paid", paidAt: new Date(), status: order.status === "pending" ? "confirmed" : order.status, confirmedAt: order.confirmedAt ?? new Date() },
    });
    await db.orderEvent.create({
      data: { orderId, type: "payment", title: toJson({ en: "Payment received", bn: "পেমেন্ট গৃহীত" }), message: toJson({ en: "Thank you — your payment is confirmed.", bn: "ধন্যবাদ — আপনার পেমেন্ট নিশ্চিত হয়েছে।" }), isPublic: true },
    });
  } else if (v.status === "failed" && order.paymentStatus !== "paid") {
    await db.order.update({ where: { id: orderId }, data: { paymentStatus: "failed" } });
    await db.orderEvent.create({
      data: { orderId, type: "payment", title: toJson({ en: "Payment not completed", bn: "পেমেন্ট সম্পন্ন হয়নি" }), message: toJson({ en: "You can retry payment or choose another method.", bn: "আবার চেষ্টা করুন বা অন্য পদ্ধতি বাছুন।" }), isPublic: true },
    });
  }
}
