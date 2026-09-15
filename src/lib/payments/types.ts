import type { PaymentMethod } from "@/lib/constants";

export type OrderForPayment = {
  id: string;
  number: string;
  trackingCode: string;
  total: number; // minor BDT
  currency: string;
  exchangeRate: number;
  customerName: string;
  email: string | null;
  phone: string;
  locale: string;
  items: { name: string; quantity: number; unitPrice: number }[];
};

export type PaymentInitResult =
  | { kind: "none" } // COD / manual: nothing to redirect to
  | { kind: "redirect"; url: string; providerRef?: string }
  | { kind: "instructions"; instructions: Record<string, string>; number: string };

export interface PaymentProvider {
  method: PaymentMethod;
  /** Is this method usable right now (env keys present + studio toggle)? */
  isConfigured(): Promise<boolean>;
  /** Start the payment for an order. */
  init(order: OrderForPayment): Promise<PaymentInitResult>;
}

export type WebhookVerification = {
  orderId?: string;
  orderNumber?: string;
  status: "paid" | "failed" | "pending";
  providerRef?: string;
  transactionId?: string;
  amountMinor?: number;
  raw: unknown;
};
