import type { NextRequest } from "next/server";
import { verifyCsrf } from "@/lib/auth/csrf";
import { getClientIp } from "@/lib/request";
import { rateLimit } from "@/lib/ratelimit";
import { placeOrder, CheckoutError } from "@/lib/orders/service";
import { getProvider } from "@/lib/payments";
import { getSetting } from "@/lib/settings";
import { i18nText } from "@/lib/json";
import { buildHandoffMessage, whatsappUrl, messengerUrl } from "@/lib/orders/whatsapp";
import { handleError, jsonError, jsonOk } from "@/lib/api-server";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";

export const runtime = "nodejs";

/**
 * POST /api/checkout
 * Places an order (stock decremented atomically), then starts the payment.
 * Response tells the client what to do next: show success, redirect to a
 * gateway, show MFS instructions, or open WhatsApp/Messenger with a prepared message.
 */
export async function POST(req: NextRequest) {
  try {
    if (!(await verifyCsrf())) return jsonError("errors.csrf", 403);
    const ip = getClientIp(req.headers);
    const rl = await rateLimit("checkout", ip, 20, 3600);
    if (!rl.ok) return jsonError("errors.rateLimited", 429);

    const body = await req.json();
    const order = await placeOrder(body, { ip });
    const locale = order.locale;

    const [currencySetting, checkout, contact] = await Promise.all([getSetting("currency"), getSetting("checkout"), getSetting("contact")]);
    const currency = currencySetting.display.find((c) => c.code === order.currency) ?? currencySetting.display[0];

    // Conversational channels: prepare the message with server-computed prices.
    let handoff: { whatsapp: string | null; messenger: string | null; message: string } | null = null;
    if (order.channel === "whatsapp" || order.channel === "messenger") {
      const message = buildHandoffMessage({
        template: i18nText(checkout.whatsappTemplate, locale),
        items: order.items.map((i) => ({ name: i.name, variantTitle: i.variantTitle ?? "", quantity: i.quantity, unitPrice: i.unitPrice })),
        subtotal: order.subtotal,
        reference: order.number,
        notes: order.notes ?? undefined,
        currency,
        locale,
      });
      handoff = { whatsapp: whatsappUrl(contact.whatsapp, message), messenger: messengerUrl(contact.messengerPage, order.number), message };
    }

    const provider = getProvider(order.paymentMethod as any);
    let payment: Awaited<ReturnType<NonNullable<typeof provider>["init"]>> = { kind: "none" };
    if (provider && (await provider.isConfigured())) {
      try {
        payment = await provider.init({
          id: order.id,
          number: order.number,
          trackingCode: order.trackingCode,
          total: order.total,
          currency: order.currency,
          exchangeRate: order.exchangeRate,
          customerName: order.customerName,
          email: order.email,
          phone: order.phone,
          locale,
          items: order.items.map((i) => ({ name: `${i.name}${i.variantTitle ? ` — ${i.variantTitle}` : ""}`, quantity: i.quantity, unitPrice: i.unitPrice })),
        });
        if (payment.kind === "redirect") {
          await db.payment.create({
            data: { orderId: order.id, method: order.paymentMethod, provider: order.paymentMethod, amount: order.total, currency: order.currency, status: "pending", providerRef: payment.providerRef ?? null },
          });
        }
      } catch (e) {
        console.error("[checkout] payment init failed", e);
        await db.orderEvent.create({
          data: { orderId: order.id, type: "payment", title: JSON.stringify({ en: "Payment could not be started", bn: "পেমেন্ট শুরু করা যায়নি" }), isPublic: false },
        });
        payment = { kind: "none" };
      }
    }

    await audit(null, "order.placed", "order", order.id, { number: order.number, channel: order.channel, total: order.total });

    return jsonOk({
      order: { id: order.id, number: order.number, trackingCode: order.trackingCode, total: order.total, status: order.status, paymentMethod: order.paymentMethod, paymentStatus: order.paymentStatus, locale },
      payment,
      handoff,
    });
  } catch (e) {
    if (e instanceof CheckoutError) return jsonError(e.code, 409, { vars: e.vars ?? {} });
    return handleError(e);
  }
}
