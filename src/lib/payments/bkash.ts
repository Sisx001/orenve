import "server-only";
import { absoluteUrl } from "@/lib/utils";
import { minorToMajor } from "@/lib/money";
import { getSetting } from "@/lib/settings";
import type { PaymentProvider, WebhookVerification } from "./types";

/**
 * bKash Tokenized Checkout (URL mode "0011").
 * Grant token → Create payment (redirect to bkashURL) → callback → Execute payment → verify status.
 * Sandbox: https://tokenized.sandbox.bka.sh/v1.2.0-beta · Live: https://tokenized.pay.bka.sh/v1.2.0-beta
 */
async function creds() {
  const c = (await getSetting("checkout")).gateways.bkash;
  return {
    base: c.sandbox ? "https://tokenized.sandbox.bka.sh/v1.2.0-beta" : "https://tokenized.pay.bka.sh/v1.2.0-beta",
    appKey: c.appKey || process.env.BKASH_APP_KEY || "",
    appSecret: c.appSecret || process.env.BKASH_APP_SECRET || "",
    username: c.username || process.env.BKASH_USERNAME || "",
    password: c.password || process.env.BKASH_PASSWORD || "",
  };
}

let tokenCache: { token: string; exp: number } | null = null;
async function grantToken() {
  if (tokenCache && tokenCache.exp > Date.now() + 60_000) return tokenCache.token;
  const c = await creds();
  const res = await fetch(`${c.base}/tokenized/checkout/token/grant`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json", username: c.username, password: c.password },
    body: JSON.stringify({ app_key: c.appKey, app_secret: c.appSecret }),
    cache: "no-store",
    signal: AbortSignal.timeout(30_000),
  });
  const data = (await res.json()) as any;
  if (!data.id_token) throw new Error(`bKash grant token failed: ${data.statusMessage ?? res.status}`);
  tokenCache = { token: data.id_token, exp: Date.now() + (Number(data.expires_in) || 3600) * 1000 };
  return tokenCache.token;
}

async function api<T = any>(path: string, body?: unknown): Promise<T> {
  const c = await creds();
  const t = await grantToken();
  const res = await fetch(`${c.base}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json", Authorization: t, "X-App-Key": c.appKey },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
    signal: AbortSignal.timeout(30_000),
  });
  return (await res.json().catch(() => ({}))) as T;
}

export const bkashProvider: PaymentProvider = {
  method: "bkash_checkout",
  async isConfigured() {
    const c = await creds();
    return Boolean(c.appKey && c.appSecret && c.username && c.password);
  },
  async init(order) {
    const data = await api<any>("/tokenized/checkout/create", {
      mode: "0011",
      payerReference: order.phone,
      callbackURL: absoluteUrl(`/api/payments/bkash/callback?order=${order.id}`),
      amount: minorToMajor(order.total).toFixed(2),
      currency: "BDT",
      intent: "sale",
      merchantInvoiceNumber: order.number,
    });
    if (data.statusCode !== "0000" || !data.bkashURL) throw new Error(`bKash create failed: ${data.statusMessage ?? JSON.stringify(data).slice(0, 200)}`);
    return { kind: "redirect", url: data.bkashURL, providerRef: data.paymentID };
  },
};

/** Called from the callback route when status=success: finalizes the payment. */
export async function executeBkash(paymentId: string): Promise<WebhookVerification> {
  const data = await api<any>(`/tokenized/checkout/execute`, { paymentID: paymentId });
  let ok = data.statusCode === "0000" && data.transactionStatus === "Completed";
  let raw = data;
  if (!ok && !data.statusCode) {
    // no/late response → query
    const q = await api<any>(`/tokenized/checkout/payment/status`, { paymentID: paymentId });
    ok = q.transactionStatus === "Completed";
    raw = q;
  }
  return { orderNumber: raw.merchantInvoiceNumber, status: ok ? "paid" : "failed", providerRef: paymentId, transactionId: raw.trxID, amountMinor: raw.amount ? Math.round(Number(raw.amount) * 100) : undefined, raw };
}
