import { formatMoney, type DisplayCurrency } from "@/lib/money";

/**
 * Builds the pre-filled WhatsApp / Messenger message. Runs on the server
 * (checkout API) so the customer cannot alter prices in the message.
 */
export function buildHandoffMessage(opts: {
  template: string;
  items: { name: string; variantTitle: string; quantity: number; unitPrice: number }[];
  subtotal: number;
  reference: string;
  notes?: string;
  currency: DisplayCurrency;
  locale: string;
  productBase?: string;
}) {
  const lines = opts.items
    .map((i) => `• ${i.name} — ${i.variantTitle} × ${i.quantity} (${formatMoney(i.unitPrice, opts.currency, opts.locale)})`)
    .join("\n");
  return opts.template
    .replaceAll("{items}", lines)
    .replaceAll("{subtotal}", formatMoney(opts.subtotal, opts.currency, opts.locale))
    .replaceAll("{reference}", opts.reference)
    .replaceAll("{notes}", opts.notes ? `${opts.locale === "bn" ? "নোট" : "Notes"}: ${opts.notes}` : "")
    .trim();
}

export function whatsappUrl(number: string, text: string) {
  const digits = number.replace(/\D/g, "");
  return digits ? `https://wa.me/${digits}?text=${encodeURIComponent(text)}` : null;
}

export function messengerUrl(page: string, ref: string) {
  const handle = page.replace(/^https?:\/\/(m\.me|www\.facebook\.com|facebook\.com)\//, "").replace(/\/$/, "");
  return handle ? `https://m.me/${handle}?ref=${encodeURIComponent(ref)}` : null;
}
