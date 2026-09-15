import "server-only";
import { absoluteUrl } from "@/lib/utils";
import { minorToMajor } from "@/lib/money";
import { getSetting } from "@/lib/settings";
import type { PaymentProvider, WebhookVerification } from "./types";

/**
 * aamarPay hosted checkout (cards, bKash, Nagad, Rocket, banks).
 * Init: POST {base}/jsonpost.php → { payment_url }. Verify: GET {base}/api/v1/trxcheck/request.php
 * Sandbox: https://sandbox.aamarpay.com (store aamarpaytest) · Live: https://secure.aamarpay.com
 */
async function creds() {
  const c = (await getSetting("checkout")).gateways.aamarpay;
  return {
    base: c.sandbox ? "https://sandbox.aamarpay.com" : "https://secure.aamarpay.com",
    storeId: c.storeId || process.env.AAMARPAY_STORE_ID || "",
    signatureKey: c.signatureKey || process.env.AAMARPAY_SIGNATURE_KEY || "",
  };
}

export const aamarpayProvider: PaymentProvider = {
  method: "aamarpay",
  async isConfigured() {
    const c = await creds();
    return Boolean(c.storeId && c.signatureKey);
  },
  async init(order) {
    const c = await creds();
    const body = {
      store_id: c.storeId,
      signature_key: c.signatureKey,
      tran_id: order.number,
      amount: minorToMajor(order.total).toFixed(2),
      currency: "BDT",
      desc: `ORYNVE ${order.number}`,
      cus_name: order.customerName,
      cus_email: order.email || "customer@example.com",
      cus_phone: order.phone,
      cus_add1: "Bangladesh",
      cus_city: "Dhaka",
      cus_country: "Bangladesh",
      success_url: absoluteUrl(`/api/payments/aamarpay/callback?result=success`),
      fail_url: absoluteUrl(`/api/payments/aamarpay/callback?result=fail`),
      cancel_url: absoluteUrl(`/api/payments/aamarpay/callback?result=cancel`),
      opt_a: order.id,
      opt_b: order.trackingCode,
      type: "json",
    };
    const res = await fetch(`${c.base}/jsonpost.php`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), cache: "no-store", signal: AbortSignal.timeout(20_000) });
    const data = (await res.json().catch(() => ({}))) as any;
    if (!data.payment_url) throw new Error(`aamarPay init failed: ${JSON.stringify(data).slice(0, 200)}`);
    return { kind: "redirect", url: data.payment_url };
  },
};

export async function verifyAamarpay(tranId: string): Promise<WebhookVerification> {
  const c = await creds();
  const url = new URL(`${c.base}/api/v1/trxcheck/request.php`);
  url.searchParams.set("request_id", tranId);
  url.searchParams.set("store_id", c.storeId);
  url.searchParams.set("signature_key", c.signatureKey);
  url.searchParams.set("type", "json");
  const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(20_000) });
  const data = (await res.json().catch(() => ({}))) as any;
  const ok = String(data.pay_status ?? data.status_title ?? "").toLowerCase().includes("success") || data.status_code === "2";
  return { orderNumber: tranId, status: ok ? "paid" : "failed", providerRef: data.pg_txnid ?? data.mer_txnid, transactionId: data.bank_trxid ?? data.pg_txnid, amountMinor: data.amount ? Math.round(Number(data.amount) * 100) : undefined, raw: data };
}
