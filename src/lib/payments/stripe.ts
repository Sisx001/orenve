import "server-only";
import Stripe from "stripe";
import { absoluteUrl } from "@/lib/utils";
import type { PaymentProvider, WebhookVerification } from "./types";

/**
 * Stripe Checkout for international customers. Charges are made in the
 * display currency the customer chose (default USD) using the owner-maintained
 * exchange rate recorded on the order.
 *
 * NOTE: Stripe does not onboard Bangladeshi entities directly; the store owner
 * needs a Stripe account in a supported country (see docs/PAYMENTS.md).
 */
let client: Stripe | null = null;
export function stripe(): Stripe {
  if (!client) client = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2025-02-24.acacia" as any });
  return client;
}

const ZERO_DECIMAL = new Set(["JPY", "KRW", "VND"]);

export const stripeProvider: PaymentProvider = {
  method: "stripe",
  async isConfigured() {
    return Boolean(process.env.STRIPE_SECRET_KEY);
  },
  async init(order) {
    const currency = order.currency === "BDT" ? "USD" : order.currency;
    const rate = order.currency === "BDT" ? 0.0082 : order.exchangeRate;
    const toUnit = (minorBdt: number) => {
      const major = (minorBdt / 100) * rate;
      return ZERO_DECIMAL.has(currency) ? Math.round(major) : Math.round(major * 100);
    };
    const session = await stripe().checkout.sessions.create({
      mode: "payment",
      client_reference_id: order.id,
      customer_email: order.email || undefined,
      metadata: { orderId: order.id, orderNumber: order.number, trackingCode: order.trackingCode },
      line_items: order.items.map((i) => ({
        quantity: i.quantity,
        price_data: { currency: currency.toLowerCase(), unit_amount: toUnit(i.unitPrice), product_data: { name: i.name } },
      })),
      success_url: absoluteUrl(`/${order.locale}/order/${order.trackingCode}?paid=1`),
      cancel_url: absoluteUrl(`/${order.locale}/order/${order.trackingCode}?cancelled=1`),
    });
    return { kind: "redirect", url: session.url!, providerRef: session.id };
  },
};

export async function verifyStripeWebhook(rawBody: string, signature: string): Promise<WebhookVerification | null> {
  const event = stripe().webhooks.constructEvent(rawBody, signature, process.env.STRIPE_WEBHOOK_SECRET!);
  if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
    const s = event.data.object as Stripe.Checkout.Session;
    return {
      orderId: s.metadata?.orderId ?? s.client_reference_id ?? undefined,
      orderNumber: s.metadata?.orderNumber,
      status: s.payment_status === "paid" ? "paid" : "pending",
      providerRef: s.id,
      transactionId: typeof s.payment_intent === "string" ? s.payment_intent : s.payment_intent?.id,
      raw: event,
    };
  }
  if (event.type === "checkout.session.async_payment_failed" || event.type === "checkout.session.expired") {
    const s = event.data.object as Stripe.Checkout.Session;
    return { orderId: s.metadata?.orderId ?? undefined, status: "failed", providerRef: s.id, raw: event };
  }
  return null;
}
