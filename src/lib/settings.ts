import "server-only";
import { cache } from "react";
import { z } from "zod";
import { db } from "@/lib/db";
import { parseJson, toJson } from "@/lib/json";
import { getEnabledLocales } from "@/lib/i18n/registry";

/**
 * Typed settings stored as JSON rows in `Setting`. Every group has a Zod schema
 * with defaults, so a missing or partial row always yields a complete object.
 */
export const brandSchema = z.object({
  name: z.string().default("ORYNVE"),
  tagline: z.record(z.string()).default({ en: "Not for everyone. For you.", bn: "সবার জন্য নয়। আপনার জন্য।" }),
  logoUrl: z.string().nullable().default(null), // custom raster/SVG upload; null = built-in mark
  accent: z.string().default("#b24a24"),
  brass: z.string().default("#c9a25c"),
  theme: z.enum(["light", "dark", "system"]).default("light"),
  radius: z.number().min(0).max(24).default(2),
  fontDisplay: z.string().default("Fraunces"),
  fontSans: z.string().default("Space Grotesk"),
  fontBangla: z.string().default("Hind Siliguri"),
  announcement: z.record(z.string()).default({ en: "Collection 001 is live — free delivery in Dhaka over ৳5,000", bn: "কালেকশন ০০১ এখন লাইভ — ঢাকায় ৳৫,০০০ এর উপরে ফ্রি ডেলিভারি" }),
  announcementLink: z.string().default("/shop"),
  showAnnouncement: z.boolean().default(true),
});

export const contactSchema = z.object({
  whatsapp: z.string().default(""), // E.164 without +, e.g. 8801XXXXXXXXX
  messengerPage: z.string().default(""), // m.me/<page>
  instagram: z.string().default(""),
  facebook: z.string().default(""),
  tiktok: z.string().default(""),
  email: z.string().default(""),
  phone: z.string().default(""),
  address: z.record(z.string()).default({ en: "Dhaka, Bangladesh", bn: "ঢাকা, বাংলাদেশ" }),
  hours: z.record(z.string()).default({ en: "Sat–Thu, 10:00–20:00", bn: "শনি–বৃহঃ, সকাল ১০টা – রাত ৮টা" }),
  mapUrl: z.string().default(""),
});

export const featuresSchema = z.object({
  cart: z.boolean().default(true),
  wishlist: z.boolean().default(true),
  search: z.boolean().default(true),
  reviews: z.boolean().default(true),
  quickView: z.boolean().default(true),
  newsletter: z.boolean().default(true),
  intro: z.boolean().default(true), // first-visit brand intro
  animations: z.boolean().default(true),
  customCursor: z.boolean().default(true),
  darkModeToggle: z.boolean().default(true),
  languageSwitcher: z.boolean().default(true),
  currencySwitcher: z.boolean().default(true),
  aiConcierge: z.boolean().default(true),
  orderTracking: z.boolean().default(true),
  coupons: z.boolean().default(true),
  sizeGuide: z.boolean().default(true),
  stockBadges: z.boolean().default(true),
  backInStockNotify: z.boolean().default(false),
  productVideo: z.boolean().default(true),
  socialProof: z.boolean().default(true),
  pwa: z.boolean().default(true),
});

export const checkoutSchema = z.object({
  whatsapp: z.boolean().default(true),
  messenger: z.boolean().default(false),
  website: z.boolean().default(true), // on-site checkout form
  cod: z.boolean().default(true),
  bkash: z.boolean().default(true), // manual Send Money + TrxID
  nagad: z.boolean().default(true), // manual Send Money + TrxID
  bkash_checkout: z.boolean().default(false), // bKash Tokenized Checkout API
  nagad_checkout: z.boolean().default(false), // Nagad Payment Gateway API
  sslcommerz: z.boolean().default(false),
  aamarpay: z.boolean().default(false),
  shurjopay: z.boolean().default(false),
  stripe: z.boolean().default(false),
  codFee: z.number().int().default(0), // minor units added for COD orders
  codMaxOrder: z.number().int().default(0), // 0 = no cap
  bkashNumber: z.string().default(""),
  nagadNumber: z.string().default(""),
  gateways: z
    .object({
      bkash: z.object({ sandbox: z.boolean().default(true), appKey: z.string().default(""), appSecret: z.string().default(""), username: z.string().default(""), password: z.string().default("") }).default({}),
      nagad: z.object({ sandbox: z.boolean().default(true), merchantId: z.string().default(""), merchantNumber: z.string().default(""), merchantPrivateKey: z.string().default(""), pgPublicKey: z.string().default("") }).default({}),
      aamarpay: z.object({ sandbox: z.boolean().default(true), storeId: z.string().default(""), signatureKey: z.string().default("") }).default({}),
      shurjopay: z.object({ sandbox: z.boolean().default(true), username: z.string().default(""), password: z.string().default(""), prefix: z.string().default("ORY") }).default({}),
      sslcommerz: z.object({ sandbox: z.boolean().default(true), storeId: z.string().default(""), storePassword: z.string().default("") }).default({}),
    })
    .default({}),
  mfsInstructions: z.record(z.string()).default({
    en: "Send Money to the number above, then enter the Transaction ID (TrxID) below. We verify within business hours.",
    bn: "উপরের নম্বরে সেন্ড মানি করুন, তারপর নিচে ট্রানজ্যাকশন আইডি (TrxID) দিন। আমরা অফিস সময়ের মধ্যে যাচাই করি।",
  }),
  requireEmail: z.boolean().default(false),
  guestCheckout: z.boolean().default(true),
  minOrder: z.number().int().default(0),
  notesEnabled: z.boolean().default(true),
  whatsappTemplate: z.record(z.string()).default({
    en: "Hello ORYNVE, I would like to order:\n\n{items}\n\nSubtotal: {subtotal}\nReference: {reference}\n{notes}",
    bn: "হ্যালো ORYNVE, আমি অর্ডার করতে চাই:\n\n{items}\n\nসাবটোটাল: {subtotal}\nরেফারেন্স: {reference}\n{notes}",
  }),
  autoConfirmCod: z.boolean().default(false),
});

export const currencySchema = z.object({
  base: z.literal("BDT").default("BDT"),
  display: z
    .array(
      z.object({
        code: z.string().length(3),
        symbol: z.string(),
        rate: z.number().positive(), // units per 1 BDT
        enabled: z.boolean(),
        decimals: z.number().int().min(0).max(2),
      }),
    )
    .default([
      { code: "BDT", symbol: "৳", rate: 1, enabled: true, decimals: 0 },
      { code: "USD", symbol: "$", rate: 0.0082, enabled: true, decimals: 2 },
      { code: "EUR", symbol: "€", rate: 0.0076, enabled: true, decimals: 2 },
      { code: "GBP", symbol: "£", rate: 0.0064, enabled: false, decimals: 2 },
      { code: "INR", symbol: "₹", rate: 0.69, enabled: false, decimals: 0 },
    ]),
});

export const localeSchema = z.object({
  default: z.string().default("en"),
  enabled: z.array(z.string()).default(["en", "bn"]),
  autoDetect: z.boolean().default(true),
});

export const seoSchema = z.object({
  title: z.record(z.string()).default({ en: "ORYNVE — Quiet rebellion. Considered menswear.", bn: "ORYNVE — নিঃশব্দ বিদ্রোহ। ভাবনাপূর্ণ মেনসওয়্যার।" }),
  description: z.record(z.string()).default({
    en: "Independent premium menswear from Dhaka. Considered silhouettes, honest materials, Collection 001.",
    bn: "ঢাকা থেকে স্বাধীন প্রিমিয়াম মেনসওয়্যার। ভাবনাপূর্ণ সিলুয়েট, সৎ উপাদান, কালেকশন ০০১।",
  }),
  ogImage: z.string().default("/brand/og.jpg"),
  twitter: z.string().default(""),
  gaId: z.string().default(""), // optional Google Analytics 4
  metaPixelId: z.string().default(""), // optional Meta Pixel
  robotsIndex: z.boolean().default(true),
});

export const siteSchema = z.object({
  mode: z.enum(["live", "maintenance", "coming_soon"]).default("live"),
  maintenanceTitle: z.record(z.string()).default({ en: "Something considered is on its way.", bn: "কিছু ভাবনাপূর্ণ আসছে।" }),
  maintenanceMessage: z.record(z.string()).default({ en: "We're taking a moment to make things better. Leave your email and be the first to know.", bn: "আমরা আরও ভালো করতে একটু সময় নিচ্ছি। ইমেইল দিন, প্রথমে জানুন।" }),
  launchDate: z.string().default(""),
  maintenanceImage: z.string().default(""),
  allowlistIps: z.array(z.string()).default([]),
});

export const aiSchema = z.object({
  enabled: z.boolean().default(true),
  provider: z.enum(["openai_compatible"]).default("openai_compatible"),
  baseUrl: z.string().default(""), // falls back to env AI_BASE_URL
  apiKey: z.string().default(""), // falls back to env AI_API_KEY (stored encrypted-at-rest is host's job; never sent to client)
  model: z.string().default(""), // falls back to env AI_MODEL
  temperature: z.number().min(0).max(1).default(0.2),
  maxTokens: z.number().int().min(64).max(4096).default(600),
  assistantName: z.record(z.string()).default({ en: "ORYNVE Concierge", bn: "ORYNVE কনসিয়ার্জ" }),
  greeting: z.record(z.string()).default({
    en: "Hello — I can track your order, check sizes and stock, or answer questions about delivery and returns. How can I help?",
    bn: "হ্যালো — আমি আপনার অর্ডার ট্র্যাক করতে, সাইজ ও স্টক দেখতে, বা ডেলিভারি ও রিটার্ন নিয়ে প্রশ্নের উত্তর দিতে পারি। কীভাবে সাহায্য করতে পারি?",
  }),
  extraInstructions: z.string().default(""), // owner-added brand facts, policies, tone
  allowProductSearch: z.boolean().default(true),
  allowOrderLookup: z.boolean().default(true),
  requirePhoneForOrder: z.boolean().default(true),
  maxMessagesPerSession: z.number().int().default(40),
  rateLimitPerHour: z.number().int().default(60),
  logConversations: z.boolean().default(true),
  handoffWhatsapp: z.boolean().default(true),
  // ── Phase 4 upgrades ──
  streaming: z.boolean().default(true), // stream the final reply token by token
  showProductCards: z.boolean().default(true), // render product / order cards in the widget
  allowChangeRequests: z.boolean().default(true), // customers may ask to cancel / change address after verifying an order
  sizeAdvisor: z
    .object({
      enabled: z.boolean().default(true),
      // Brand-level fit table used when a product has no size guide. Chest in cm, height/weight ranges.
      chart: z
        .string()
        .default(
          JSON.stringify([
            { size: "S", chest: [88, 94], height: [160, 172], weight: [52, 64] },
            { size: "M", chest: [94, 100], height: [168, 178], weight: [62, 74] },
            { size: "L", chest: [100, 106], height: [174, 184], weight: [72, 86] },
            { size: "XL", chest: [106, 114], height: [180, 190], weight: [84, 98] },
          ]),
        ),
      note: z.record(z.string()).default({ en: "Between sizes? Size up for a relaxed fit, down for a closer fit.", bn: "দুই সাইজের মাঝে? রিল্যাক্সড ফিটের জন্য বড়, ক্লোজ ফিটের জন্য ছোট সাইজ নিন।" }),
    })
    .default({}),
  brandVoice: z
    .string()
    .default("Quiet confidence. Precise, warm, unhurried. Short sentences. No hype words, no exclamation marks, no emojis. British spelling in English; natural, modern Bangla — never a word-for-word transliteration."),
  writerEnabled: z.boolean().default(true),
  writerTemperature: z.number().min(0).max(1.5).default(0.7),
});

/** Multi-language engine (Phase 4). Built-in en/bn live in messages/*.json; extra languages live in the Language table. */
export const i18nSchema = z.object({
  glossary: z.array(z.string()).default(["ORYNVE", "bKash", "Nagad", "WhatsApp", "Messenger", "COD"]), // never translated
  autoTranslateNewContent: z.boolean().default(false), // translate new products/pages into every enabled language on save
  showMachineBadge: z.boolean().default(false), // small "machine translated" note in the footer for unreviewed languages
  contentModels: z.array(z.string()).default(["product", "category", "collection", "page", "block", "setting"]),
  batchSize: z.number().int().min(5).max(80).default(35), // dictionary keys per AI call
});

export const courierSchema = z.object({
  defaultProvider: z.enum(["pathao", "steadfast", "redx", "paperfly", "manual"]).default("manual"),
  autoBookOnConfirm: z.boolean().default(false),
  autoSyncMinutes: z.number().int().min(0).default(60), // 0 = manual sync only
  defaultWeightKg: z.number().min(0.1).default(0.5),
  pathao: z.object({ enabled: z.boolean().default(false), sandbox: z.boolean().default(true), baseUrl: z.string().default(""), clientId: z.string().default(""), clientSecret: z.string().default(""), username: z.string().default(""), password: z.string().default(""), storeId: z.string().default(""), webhookSecret: z.string().default("") }).default({}),
  steadfast: z.object({ enabled: z.boolean().default(false), baseUrl: z.string().default(""), apiKey: z.string().default(""), secretKey: z.string().default("") }).default({}),
  redx: z.object({ enabled: z.boolean().default(false), sandbox: z.boolean().default(true), baseUrl: z.string().default(""), accessToken: z.string().default(""), pickupStoreId: z.string().default("") }).default({}),
  paperfly: z.object({ enabled: z.boolean().default(false), baseUrl: z.string().default(""), username: z.string().default(""), password: z.string().default(""), merchantKey: z.string().default("") }).default({}),
  manualCouriers: z.array(z.string()).default(["Pathao", "Steadfast", "RedX", "Paperfly", "Sundarban", "SA Paribahan", "Carrybee"]),
});

export const geoSchema = z.object({
  addressLevels: z.array(z.enum(["division", "district", "upazila", "area", "postcode"])).default(["district", "upazila", "area", "postcode"]),
  autoDetect: z.boolean().default(true),
  requirePostcode: z.boolean().default(false),
  allowCustomArea: z.boolean().default(true),
  internationalShipping: z.boolean().default(false),
});

export const SETTING_SCHEMAS = {
  courier: courierSchema,
  geo: geoSchema,
  brand: brandSchema,
  contact: contactSchema,
  features: featuresSchema,
  checkout: checkoutSchema,
  currency: currencySchema,
  locale: localeSchema,
  seo: seoSchema,
  site: siteSchema,
  ai: aiSchema,
  i18n: i18nSchema,
} as const;

export type SettingKey = keyof typeof SETTING_SCHEMAS;
export type SettingValue<K extends SettingKey> = z.infer<(typeof SETTING_SCHEMAS)[K]>;

export const getSetting = cache(async <K extends SettingKey>(key: K): Promise<SettingValue<K>> => {
  const row = await db.setting.findUnique({ where: { key } }).catch(() => null);
  const schema = SETTING_SCHEMAS[key];
  const parsed = schema.safeParse(parseJson(row?.value, {}));
  return (parsed.success ? parsed.data : schema.parse({})) as SettingValue<K>;
});

export async function getAllSettings() {
  const keys = Object.keys(SETTING_SCHEMAS) as SettingKey[];
  const entries = await Promise.all(keys.map(async (k) => [k, await getSetting(k)] as const));
  return Object.fromEntries(entries) as { [K in SettingKey]: SettingValue<K> };
}

export async function saveSetting<K extends SettingKey>(key: K, value: unknown): Promise<SettingValue<K>> {
  const data = SETTING_SCHEMAS[key].parse(value) as SettingValue<K>;
  await db.setting.upsert({ where: { key }, update: { value: toJson(data) }, create: { key, value: toJson(data) } });
  return data;
}

/** Public-safe subset shipped to the client (never includes secrets like AI keys). */
export async function getPublicConfig() {
  const [brand, contact, features, checkout, currency, locale, seo, site, ai, i18n, locales] = await Promise.all([
    getSetting("brand"),
    getSetting("contact"),
    getSetting("features"),
    getSetting("checkout"),
    getSetting("currency"),
    getSetting("locale"),
    getSetting("seo"),
    getSetting("site"),
    getSetting("ai"),
    getSetting("i18n"),
    getEnabledLocales(),
  ]);
  const { apiKey: _k, baseUrl: _b, model: _m, extraInstructions: _e, brandVoice: _v, ...aiPublic } = ai;
  const { gateways: _g, ...checkoutPublic } = checkout; // gateway credentials never leave the server
  const geo = await getSetting("geo");
  return {
    brand,
    contact,
    features,
    checkout: checkoutPublic,
    currency,
    locale,
    seo,
    site,
    ai: aiPublic,
    geo,
    /** Every language reachable on the storefront, built-ins first. */
    locales,
    i18n: { showMachineBadge: i18n.showMachineBadge },
  };
}
export type PublicConfig = Awaited<ReturnType<typeof getPublicConfig>>;
