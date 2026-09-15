import "server-only";
import { absoluteUrl } from "@/lib/utils";
import { minorToMajor } from "@/lib/money";
import { getSetting } from "@/lib/settings";
import type { PaymentProvider, WebhookVerification } from "./types";

/**
 * shurjoPay v2.1 — POST /get_token → POST /secret-pay → redirect checkout_url → POST /verification.
 * Sandbox: https://sandbox.shurjopayment.com/api · Live: https://engine.shurjopayment.com/api
 */
async function creds() {
  const c = (await getSetting("checkout")).gateways.shurjopay;
  return {
    base: c.sandbox ? "https://sandbox.shurjopayment.com/api" : "https://engine.shurjopayment.com/api",
    username: c.username || process.env.SHURJOPAY_USERNAME || "",
    password: c.password || process.env.SHURJOPAY_PASSWORD || "",
    prefix: c.prefix || process.env.SHURJOPAY_PREFIX || "ORY",
  };
}

async function token() {
  const c = await creds();
  const res = await fetch(`${c.base}/get_token`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: c.username, password: c.password }), cache: "no-store", signal: AbortSignal.timeout(15_000) });
  const data = (await res.json()) as any;
  if (!data.token) throw new Error(`shurjoPay auth failed: ${data.message ?? res.status}`);
  return { token: data.token as string, type: (data.token_type as string) ?? "Bearer", storeId: data.store_id as number };
}

export const shurjopayProvider: PaymentProvider = {
  method: "shurjopay",
  async isConfigured() {
    const c = await creds();
    return Boolean(c.username && c.password);
  },
  async init(order) {
    const c = await creds();
    const t = await token();
    const body = {
      prefix: c.prefix,
      token: t.token,
      return_url: absoluteUrl(`/api/payments/shurjopay/callback`),
      cancel_url: absoluteUrl(`/api/payments/shurjopay/callback?cancel=1`),
      store_id: t.storeId,
      amount: minorToMajor(order.total).toFixed(2),
      order_id: order.number,
      currency: "BDT",
      customer_name: order.customerName,
      customer_address: "Bangladesh",
      customer_phone: order.phone,
      customer_city: "Dhaka",
      customer_post_code: "1200",
      client_ip: "127.0.0.1",
      value1: order.id,
      value2: order.trackingCode,
    };
    const res = await fetch(`${c.base}/secret-pay`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `${t.type} ${t.token}` }, body: JSON.stringify(body), cache: "no-store", signal: AbortSignal.timeout(20_000) });
    const data = (await res.json().catch(() => ({}))) as any;
    if (!data.checkout_url) throw new Error(`shurjoPay init failed: ${data.message ?? JSON.stringify(data).slice(0, 200)}`);
    return { kind: "redirect", url: data.checkout_url, providerRef: data.sp_order_id };
  },
};

export async function verifyShurjopay(spOrderId: string): Promise<WebhookVerification> {
  const c = await creds();
  const t = await token();
  const res = await fetch(`${c.base}/verification`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `${t.type} ${t.token}` }, body: JSON.stringify({ order_id: spOrderId }), cache: "no-store", signal: AbortSignal.timeout(20_000) });
  const arr = (await res.json().catch(() => [])) as any;
  const d = Array.isArray(arr) ? arr[0] : arr;
  const ok = Number(d?.sp_code) === 1000;
  return { orderNumber: d?.customer_order_id, orderId: d?.value1, status: ok ? "paid" : "failed", providerRef: spOrderId, transactionId: d?.bank_trx_id, amountMinor: d?.amount ? Math.round(Number(d.amount) * 100) : undefined, raw: d };
}
