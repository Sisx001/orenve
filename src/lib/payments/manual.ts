import "server-only";
import { getSetting } from "@/lib/settings";
import type { PaymentProvider } from "./types";

export const codProvider: PaymentProvider = {
  method: "cod",
  async isConfigured() {
    return true;
  },
  async init() {
    return { kind: "none" };
  },
};

/** bKash / Nagad "Send Money" flow: customer pays to the shop wallet and submits TrxID; staff verify. */
export function mfsProvider(method: "bkash" | "nagad"): PaymentProvider {
  return {
    method,
    async isConfigured() {
      const c = await getSetting("checkout");
      return Boolean(method === "bkash" ? c.bkashNumber : c.nagadNumber);
    },
    async init(order) {
      const c = await getSetting("checkout");
      const number = method === "bkash" ? c.bkashNumber : c.nagadNumber;
      return {
        kind: "instructions",
        number,
        instructions: c.mfsInstructions,
      };
    },
  };
}
