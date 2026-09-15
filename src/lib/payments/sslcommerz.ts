import "server-only";
import { absoluteUrl } from "@/lib/utils";
import { minorToMajor } from "@/lib/money";
import type { PaymentProvider, WebhookVerification } from "./types";

/**
 * SSLCommerz hosted checkout (Bangladesh: cards, bKash, Nagad, Rocket, net banking).
 * Docs: https://developer.sslcommerz.com/doc/v4/
 * Flow: init → redirect to GatewayPageURL → success/fail/cancel callbacks (POST) →
 *       server validates via validator API using val_id before marking paid.
 */
const base = () =>
  process.env.SSLCOMMERZ_SANDBOX === "false" ? "https://securepay.sslcommerz.com" : "https://sandbox.sslcommerz.com";

export const sslcommerzProvider: PaymentProvider = {
  method: "sslcommerz",
  async isConfigured() {
    return Boolean(process.env.SSLCOMMERZ_STORE_ID && process.env.SSLCOMMERZ_STORE_PASSWORD);
  },
  async init(order) {
    const body = new URLSearchParams({
      store_id: process.env.SSLCOMMERZ_STORE_ID!,
      store_passwd: process.env.SSLCOMMERZ_STORE_PASSWORD!,
      total_amount: minorToMajor(order.total).toFixed(2),
      currency: "BDT",
      tran_id: order.number,
      success_url: absoluteUrl(`/api/payments/sslcommerz/callback?result=success`),
      fail_url: absoluteUrl(`/api/payments/sslcommerz/callback?result=fail`),
      cancel_url: absoluteUrl(`/api/payments/sslcommerz/callback?result=cancel`),
      ipn_url: absoluteUrl(`/api/payments/sslcommerz/ipn`),
      cus_name: order.customerName,
      cus_email: order.email || "customer@example.com",
      cus_phone: order.phone,
      cus_add1: "Bangladesh",
      cus_city: "Dhaka",
      cus_country: "Bangladesh",
      shipping_method: "NO",
      product_name: order.items.map((i) => i.name).join(", ").slice(0, 250) || "ORYNVE order",
      product_category: "Fashion",
      product_profile: "physical-goods",
      value_a: order.id,
      value_b: order.trackingCode,
    });
    const res = await fetch(`${base()}/gwprocess/v4/api.php`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
      cache: "no-store",
    });
    const data = (await res.json()) as { status: string; GatewayPageURL?: string; sessionkey?: string; failedreason?: string };
    if (data.status !== "SUCCESS" || !data.GatewayPageURL) {
      throw new Error(`SSLCommerz init failed: ${data.failedreason ?? data.status}`);
    }
    return { kind: "redirect", url: data.GatewayPageURL, providerRef: data.sessionkey };
  },
};

/** Validate a callback/IPN payload against SSLCommerz before trusting it. */
export async function verifySslcommerz(payload: Record<string, string>): Promise<WebhookVerification> {
  const valId = payload.val_id;
  const tranId = payload.tran_id;
  if (!valId || !tranId) return { status: "failed", raw: payload, orderNumber: tranId };
  const url = new URL(`${base()}/validator/api/validationserverAPI.php`);
  url.searchParams.set("val_id", valId);
  url.searchParams.set("store_id", process.env.SSLCOMMERZ_STORE_ID!);
  url.searchParams.set("store_passwd", process.env.SSLCOMMERZ_STORE_PASSWORD!);
  url.searchParams.set("format", "json");
  const res = await fetch(url, { cache: "no-store" });
  const data = (await res.json()) as { status: string; tran_id: string; amount: string; bank_tran_id?: string; store_amount?: string };
  const ok = (data.status === "VALID" || data.status === "VALIDATED") && data.tran_id === tranId;
  return {
    orderNumber: tranId,
    orderId: payload.value_a,
    status: ok ? "paid" : "failed",
    providerRef: valId,
    transactionId: data.bank_tran_id,
    amountMinor: Math.round(Number(data.amount) * 100),
    raw: data,
  };
}
