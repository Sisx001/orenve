import "server-only";
import type { PaymentMethod } from "@/lib/constants";
import { getSetting } from "@/lib/settings";
import type { PaymentProvider } from "./types";
import { codProvider, mfsProvider } from "./manual";
import { sslcommerzProvider } from "./sslcommerz";
import { stripeProvider } from "./stripe";
import { aamarpayProvider } from "./aamarpay";
import { shurjopayProvider } from "./shurjopay";
import { bkashProvider } from "./bkash";
import { nagadProvider } from "./nagad";

const providers: Record<Exclude<PaymentMethod, "none">, PaymentProvider> = {
  cod: codProvider,
  bkash: mfsProvider("bkash"),
  nagad: mfsProvider("nagad"),
  bkash_checkout: bkashProvider,
  nagad_checkout: nagadProvider,
  sslcommerz: sslcommerzProvider,
  aamarpay: aamarpayProvider,
  shurjopay: shurjopayProvider,
  stripe: stripeProvider,
};

export function getProvider(method: PaymentMethod): PaymentProvider | null {
  if (method === "none") return null;
  return providers[method] ?? null;
}

/** Methods the customer may pick right now: studio toggle AND provider config. */
export async function availableMethods(): Promise<PaymentMethod[]> {
  const checkout = await getSetting("checkout");
  const out: PaymentMethod[] = [];
  for (const m of Object.keys(providers) as Exclude<PaymentMethod, "none">[]) {
    if (!checkout[m]) continue;
    try {
      if (await providers[m].isConfigured()) out.push(m);
    } catch {
      /* misconfigured provider never blocks checkout */
    }
  }
  return out;
}

export const METHOD_LABELS: Record<PaymentMethod, { en: string; bn: string }> = {
  cod: { en: "Cash on delivery", bn: "ক্যাশ অন ডেলিভারি" },
  bkash: { en: "bKash (Send Money)", bn: "বিকাশ (সেন্ড মানি)" },
  nagad: { en: "Nagad (Send Money)", bn: "নগদ (সেন্ড মানি)" },
  bkash_checkout: { en: "bKash", bn: "বিকাশ" },
  nagad_checkout: { en: "Nagad", bn: "নগদ" },
  sslcommerz: { en: "Card / Mobile banking (SSLCommerz)", bn: "কার্ড / মোবাইল ব্যাংকিং (SSLCommerz)" },
  aamarpay: { en: "Card / Mobile banking (aamarPay)", bn: "কার্ড / মোবাইল ব্যাংকিং (aamarPay)" },
  shurjopay: { en: "Card / Mobile banking (shurjoPay)", bn: "কার্ড / মোবাইল ব্যাংকিং (shurjoPay)" },
  stripe: { en: "International card", bn: "আন্তর্জাতিক কার্ড" },
  none: { en: "—", bn: "—" },
};

export type { PaymentProvider, OrderForPayment, PaymentInitResult, WebhookVerification } from "./types";
