import "server-only";
import { createSign, publicEncrypt, privateDecrypt, randomBytes, constants } from "node:crypto";
import { absoluteUrl } from "@/lib/utils";
import { minorToMajor } from "@/lib/money";
import { getSetting } from "@/lib/settings";
import type { PaymentProvider, WebhookVerification } from "./types";

/**
 * Nagad Payment Gateway (merchant API, RSA-secured).
 *  1. POST /check-out/initialize/{merchantId}/{orderId}   sensitiveData = RSA(pgPublicKey, {merchantId, datetime, orderId, challenge}), signature = SHA256withRSA(merchantPrivateKey)
 *     → decrypt response.sensitiveData with merchantPrivateKey → {paymentReferenceId, challenge}
 *  2. POST /check-out/complete/{paymentReferenceId}       sensitiveData = RSA({merchantId, orderId, currencyCode:"050", amount, challenge}) → {callBackUrl}
 *  3. Customer returns to merchantCallbackURL?payment_ref_id=…&status=Success → GET /verify/payment/{payment_ref_id}
 * Sandbox: http://sandbox.mynagad.com:10080/remote-payment-gateway-1.0/api/dfs · Live: https://api.mynagad.com/api/dfs
 */
async function creds() {
  const c = (await getSetting("checkout")).gateways.nagad;
  return {
    base: c.sandbox ? "http://sandbox.mynagad.com:10080/remote-payment-gateway-1.0/api/dfs" : "https://api.mynagad.com/api/dfs",
    merchantId: c.merchantId || process.env.NAGAD_MERCHANT_ID || "",
    merchantNumber: c.merchantNumber || process.env.NAGAD_MERCHANT_NUMBER || "",
    privateKey: pem(c.merchantPrivateKey || process.env.NAGAD_MERCHANT_PRIVATE_KEY || "", "PRIVATE KEY"),
    pgPublicKey: pem(c.pgPublicKey || process.env.NAGAD_PG_PUBLIC_KEY || "", "PUBLIC KEY"),
  };
}

function pem(key: string, label: string) {
  const k = key.trim().replace(/\\n/g, "\n");
  if (!k) return "";
  if (k.includes("-----BEGIN")) return k;
  const body = k.replace(/\s+/g, "").match(/.{1,64}/g)?.join("\n") ?? k;
  return `-----BEGIN ${label}-----\n${body}\n-----END ${label}-----`;
}
const encrypt = (pub: string, data: unknown) => publicEncrypt({ key: pub, padding: constants.RSA_PKCS1_PADDING }, Buffer.from(JSON.stringify(data))).toString("base64");
const decrypt = (priv: string, b64: string) => JSON.parse(privateDecrypt({ key: priv, padding: constants.RSA_PKCS1_PADDING }, Buffer.from(b64, "base64")).toString("utf8"));
const sign = (priv: string, data: unknown) => createSign("SHA256").update(JSON.stringify(data)).sign(priv, "base64");
const stamp = () => {
  const d = new Date(Date.now() + 6 * 3600_000); // Asia/Dhaka
  return d.toISOString().replace(/[-:T]/g, "").slice(0, 14);
};
function headers(ip = "127.0.0.1") {
  return { "Content-Type": "application/json", Accept: "application/json", "X-KM-Api-Version": "v-0.2.0", "X-KM-IP-V4": ip, "X-KM-Client-Type": "PC_WEB" };
}

export const nagadProvider: PaymentProvider = {
  method: "nagad_checkout",
  async isConfigured() {
    const c = await creds();
    return Boolean(c.merchantId && c.privateKey && c.pgPublicKey);
  },
  async init(order) {
    const c = await creds();
    const orderId = order.number.replace(/[^A-Za-z0-9]/g, "").slice(0, 20);
    const datetime = stamp();
    const challenge = randomBytes(20).toString("hex");
    const sensitive = { merchantId: c.merchantId, datetime, orderId, challenge };
    const initRes = await fetch(`${c.base}/check-out/initialize/${c.merchantId}/${orderId}`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({ accountNumber: c.merchantNumber, dateTime: datetime, sensitiveData: encrypt(c.pgPublicKey, sensitive), signature: sign(c.privateKey, sensitive) }),
      cache: "no-store",
      signal: AbortSignal.timeout(30_000),
    });
    const init = (await initRes.json().catch(() => ({}))) as any;
    if (!init.sensitiveData) throw new Error(`Nagad initialize failed: ${init.message ?? init.reason ?? JSON.stringify(init).slice(0, 200)}`);
    const decoded = decrypt(c.privateKey, init.sensitiveData) as { paymentReferenceId: string; challenge: string };

    const complete = { merchantId: c.merchantId, orderId, currencyCode: "050", amount: minorToMajor(order.total).toFixed(2), challenge: decoded.challenge };
    const compRes = await fetch(`${c.base}/check-out/complete/${decoded.paymentReferenceId}`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({ sensitiveData: encrypt(c.pgPublicKey, complete), signature: sign(c.privateKey, complete), merchantCallbackURL: absoluteUrl(`/api/payments/nagad/callback?order=${order.id}`), additionalMerchantInfo: { trackingCode: order.trackingCode } }),
      cache: "no-store",
      signal: AbortSignal.timeout(30_000),
    });
    const comp = (await compRes.json().catch(() => ({}))) as any;
    if (comp.status !== "Success" || !comp.callBackUrl) throw new Error(`Nagad complete failed: ${comp.message ?? JSON.stringify(comp).slice(0, 200)}`);
    return { kind: "redirect", url: comp.callBackUrl, providerRef: decoded.paymentReferenceId };
  },
};

export async function verifyNagad(paymentRefId: string): Promise<WebhookVerification> {
  const c = await creds();
  const res = await fetch(`${c.base}/verify/payment/${encodeURIComponent(paymentRefId)}`, { headers: headers(), cache: "no-store", signal: AbortSignal.timeout(30_000) });
  const d = (await res.json().catch(() => ({}))) as any;
  const ok = d.status === "Success" && (d.statusCode === "000" || d.statusCode === "00_0000_000" || !d.statusCode);
  return { status: ok ? "paid" : "failed", providerRef: paymentRefId, transactionId: d.issuerPaymentRefNo ?? d.paymentRefId, amountMinor: d.amount ? Math.round(Number(d.amount) * 100) : undefined, raw: d };
}
