import type { OrderStatus } from "@/lib/constants";

/* ───────────────────────────── Couriers ───────────────────────────── */

export const COURIERS = [
  { value: "Pathao", label: "Pathao", url: (t: string) => `https://merchant.pathao.com/tracking?consignment_id=${encodeURIComponent(t)}` },
  { value: "Steadfast", label: "Steadfast", url: (t: string) => `https://steadfast.com.bd/t/${encodeURIComponent(t)}` },
  { value: "RedX", label: "RedX", url: (t: string) => `https://redx.com.bd/track-parcel/?trackingId=${encodeURIComponent(t)}` },
  { value: "Paperfly", label: "Paperfly", url: (t: string) => `https://paperfly.com.bd/tracking/?order_id=${encodeURIComponent(t)}` },
  { value: "Sundarban", label: "Sundarban Courier", url: (_t: string) => `https://sundarbancourierltd.com/track-parcel` },
  { value: "Other", label: "Other / manual", url: (_t: string) => "" },
] as const;

export function courierTrackingUrl(courier: string | null | undefined, tracking: string | null | undefined): string {
  if (!courier || !tracking) return "";
  const found = COURIERS.find((c) => c.value === courier);
  return found ? found.url(tracking) : "";
}

/* ───────────────────────────── Order status flow ───────────────────────────── */

export const STATUS_FLOW: Record<OrderStatus, OrderStatus[]> = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["processing", "shipped", "cancelled"],
  processing: ["shipped", "cancelled"],
  shipped: ["delivered", "cancelled"],
  delivered: ["refunded"],
  cancelled: [],
  refunded: [],
};

export const STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  processing: "Processing",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
  refunded: "Refunded",
};

export const PAYMENT_STATUS_LABELS: Record<string, string> = {
  unpaid: "Unpaid",
  pending_verification: "Awaiting verification",
  paid: "Paid",
  failed: "Failed",
  refunded: "Refunded",
};

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cod: "Cash on delivery",
  bkash: "bKash",
  nagad: "Nagad",
  sslcommerz: "SSLCOMMERZ",
  stripe: "Card (Stripe)",
  none: "No payment",
};

export const CHANNEL_LABELS: Record<string, string> = {
  website: "Website",
  whatsapp: "WhatsApp",
  messenger: "Messenger",
  manual: "Manual",
};

/* ───────────────────────────── AI provider presets ───────────────────────────── */

export const AI_PRESETS = [
  { value: "deepseek", label: "DeepSeek", baseUrl: "https://api.deepseek.com/v1", model: "deepseek-chat" },
  { value: "openai", label: "OpenAI", baseUrl: "https://api.openai.com/v1", model: "gpt-4o-mini" },
  { value: "groq", label: "Groq", baseUrl: "https://api.groq.com/openai/v1", model: "llama-3.3-70b-versatile" },
  { value: "openrouter", label: "OpenRouter", baseUrl: "https://openrouter.ai/api/v1", model: "deepseek/deepseek-chat" },
  { value: "ollama", label: "Ollama (self-hosted)", baseUrl: "http://localhost:11434/v1", model: "llama3.1" },
  { value: "custom", label: "Custom endpoint", baseUrl: "", model: "" },
] as const;

/* ───────────────────────────── Fonts ───────────────────────────── */

export const FONT_DISPLAY = ["Fraunces", "Playfair Display", "Cormorant Garamond", "Instrument Serif"];
export const FONT_SANS = ["Space Grotesk", "Inter", "Manrope", "DM Sans", "Outfit"];
export const FONT_BANGLA = ["Hind Siliguri", "Noto Sans Bengali", "Tiro Bangla"];

/* ───────────────────────────── Homepage block schema ───────────────────────────── */

export type BlockFieldType = "text" | "i18n" | "i18n-long" | "number" | "boolean" | "image" | "images" | "url" | "frames" | "testimonials" | "focal";

export type BlockField = {
  key: string;
  label: string;
  type: BlockFieldType;
  hint?: string;
};

export const BLOCK_SCHEMA: Record<string, { label: string; description: string; fields: BlockField[] }> = {
  hero: {
    label: "Hero",
    description: "Full-bleed opening statement with imagery or video.",
    fields: [
      { key: "eyebrow", label: "Eyebrow", type: "i18n" },
      { key: "title", label: "Title", type: "i18n" },
      { key: "subtitle", label: "Subtitle", type: "i18n-long" },
      { key: "cta", label: "Primary button label", type: "i18n" },
      { key: "ctaLink", label: "Primary button link", type: "url", hint: "Relative, e.g. /shop" },
      { key: "secondary", label: "Secondary button label", type: "i18n" },
      { key: "secondaryLink", label: "Secondary button link", type: "url" },
      { key: "images", label: "Images", type: "images", hint: "Multiple images cross-fade." },
      { key: "video", label: "Background video URL", type: "url", hint: "mp4/webm. Overrides images when set." },
      { key: "focal", label: "Focal point", type: "focal", hint: "CSS object-position, e.g. 50% 30%" },
      { key: "overlay", label: "Overlay strength", type: "number", hint: "0–100. Darkens imagery behind the text." },
    ],
  },
  marquee: {
    label: "Marquee",
    description: "Scrolling strip of brand phrases.",
    fields: [{ key: "text", label: "Text", type: "i18n", hint: "Separate phrases with • " }],
  },
  featured: {
    label: "Featured products",
    description: "Pulls products flagged as featured.",
    fields: [
      { key: "title", label: "Title", type: "i18n" },
      { key: "subtitle", label: "Subtitle", type: "i18n-long" },
      { key: "limit", label: "Number of products", type: "number" },
    ],
  },
  arrivals: {
    label: "New arrivals",
    description: "Most recently published products.",
    fields: [
      { key: "title", label: "Title", type: "i18n" },
      { key: "subtitle", label: "Subtitle", type: "i18n-long" },
      { key: "limit", label: "Number of products", type: "number" },
    ],
  },
  editorial: {
    label: "Editorial split",
    description: "Image beside a block of copy.",
    fields: [
      { key: "eyebrow", label: "Eyebrow", type: "i18n" },
      { key: "title", label: "Title", type: "i18n" },
      { key: "text", label: "Body", type: "i18n-long" },
      { key: "image", label: "Image", type: "image" },
      { key: "link", label: "Link", type: "url" },
      { key: "button", label: "Button label", type: "i18n" },
    ],
  },
  collections: {
    label: "Collections grid",
    description: "Shows every published collection.",
    fields: [{ key: "title", label: "Title", type: "i18n" }],
  },
  lookbook: {
    label: "Lookbook",
    description: "Shoppable image frames.",
    fields: [
      { key: "eyebrow", label: "Eyebrow", type: "i18n" },
      { key: "title", label: "Title", type: "i18n" },
      { key: "frames", label: "Frames", type: "frames", hint: "Image + optional product slug." },
    ],
  },
  testimonials: {
    label: "Testimonials",
    description: "Customer quotes.",
    fields: [{ key: "items", label: "Quotes", type: "testimonials" }],
  },
  manifesto: {
    label: "Manifesto",
    description: "Centred brand statement.",
    fields: [
      { key: "eyebrow", label: "Eyebrow", type: "i18n" },
      { key: "title", label: "Title", type: "i18n" },
      { key: "text", label: "Body", type: "i18n-long" },
      { key: "link", label: "Link", type: "url" },
      { key: "button", label: "Button label", type: "i18n" },
    ],
  },
  video: {
    label: "Video",
    description: "Full-width video moment.",
    fields: [
      { key: "url", label: "Video URL", type: "url" },
      { key: "poster", label: "Poster image", type: "image" },
      { key: "title", label: "Title", type: "i18n" },
    ],
  },
  newsletter: {
    label: "Newsletter",
    description: "Email capture band. No settings.",
    fields: [],
  },
  custom: {
    label: "Custom copy",
    description: "Free-form titled text block.",
    fields: [
      { key: "title", label: "Title", type: "i18n" },
      { key: "body", label: "Body", type: "i18n-long" },
    ],
  },
};

export const MARKDOWN_HELP =
  "Separate paragraphs with a blank line. **bold** for emphasis. Start a line with “- ” for a bullet. Start a line with “## ” for a sub-heading.";
