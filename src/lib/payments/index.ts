import "server-only";
import type { PaymentMethod } from "@/lib/constants";
import { getSetting } from "@/lib/settings";
import type { PaymentProvider } from "./types";
import { codProvider, mfsProvider } from "./manual";
import { sslcommerzProvider } from "./sslcommerz";
import { stripeProvider } from "./stripe";

const providers: Record<Exclude<PaymentMethod, "none">, PaymentProvider> = {
  cod: codProvider,
  bkash: mfsProvider("bkash"),
  nagad: mfsProvider("nagad"),
  sslcommerz: sslcommerzProvider,
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
  for (const m of ["cod", "bkash", "nagad", "sslcommerz", "stripe"] as const) {
    if (!checkout[m]) continue;
    if (await providers[m].isConfigured()) out.push(m);
  }
  return out;
}

export type { PaymentProvider, OrderForPayment, PaymentInitResult, WebhookVerification } from "./types";
