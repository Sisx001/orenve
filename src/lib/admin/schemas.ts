import { z } from "zod";
import {
  BLOCK_TYPES,
  COUPON_TYPES,
  ORDER_CHANNELS,
  ORDER_STATUSES,
  PAYMENT_METHODS,
  PAYMENT_STATUSES,
  PRODUCT_STATUSES,
  ROLES,
} from "@/lib/constants";

/** i18n pair collected from two form inputs. Empty strings are kept so the
 *  owner can deliberately blank a translation. */
export const i18nPair = z.object({ en: z.string().max(6000).default(""), bn: z.string().max(6000).default("") });
export type I18nPair = z.infer<typeof i18nPair>;

const optionalId = z
  .string()
  .trim()
  .max(40)
  .optional()
  .transform((v) => (v ? v : null));

/* ───────────────────────────── Auth ───────────────────────────── */

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address.").max(160),
  password: z.string().min(1, "Enter your password.").max(200),
  next: z.string().max(400).optional(),
});

export const totpStepSchema = z.object({
  code: z.string().trim().regex(/^\d{6}$/, "Enter the 6-digit code."),
  next: z.string().max(400).optional(),
});

export const changePasswordSchema = z
  .object({
    current: z.string().min(1, "Enter your current password."),
    next: z.string().min(12, "Use at least 12 characters."),
    confirm: z.string().min(1, "Repeat the new password."),
  })
  .refine((v) => v.next === v.confirm, { message: "The two new passwords do not match.", path: ["confirm"] });

/* ───────────────────────────── Products ───────────────────────────── */

export const optionValueSchema = z.object({
  value: z.string().trim().min(1).max(60),
  hex: z.string().trim().regex(/^#[0-9a-fA-F]{6}$/).optional(),
});

export const productOptionSchema = z.object({
  name: z.string().trim().min(1).max(40),
  values: z.array(optionValueSchema).max(60),
});

export const variantInputSchema = z.object({
  id: z.string().trim().max(40).optional(),
  sku: z.string().trim().max(60).optional(),
  title: z.string().trim().min(1).max(160),
  options: z.record(z.string()),
  price: z.number().int().min(0).nullable().optional(),
  stock: z.number().int().min(0).max(1_000_000).default(0),
  lowStockAt: z.number().int().min(0).max(10_000).default(3),
  weightGrams: z.number().int().min(0).max(100_000).nullable().optional(),
  imageId: z.string().trim().max(40).nullable().optional(),
  isActive: z.boolean().default(true),
});

export const productImageInputSchema = z.object({
  id: z.string().trim().max(40).optional(),
  url: z.string().trim().min(1).max(600),
  alt: i18nPair.optional(),
  colorName: z.string().trim().max(60).nullable().optional(),
  width: z.number().int().nullable().optional(),
  height: z.number().int().nullable().optional(),
});

export const sizeGuideSchema = z.object({
  unit: z.enum(["cm", "in"]).default("cm"),
  labels: z.array(z.string().max(60)).max(14).default([]),
  rows: z.array(z.array(z.string().max(60)).max(14)).max(40).default([]),
  notes: z.string().max(1200).default(""),
});

export const productSchema = z.object({
  id: z.string().trim().max(40).optional(),
  name: i18nPair,
  slug: z.string().trim().min(1, "A slug is required.").max(120),
  sku: z.string().trim().max(60).optional(),
  status: z.enum(PRODUCT_STATUSES).default("draft"),
  categoryId: optionalId,
  collectionIds: z.array(z.string().max(40)).max(40).default([]),
  featured: z.boolean().default(false),
  badge: i18nPair.optional(),
  tags: z.array(z.string().trim().max(40)).max(30).default([]),
  price: z.number().int().min(0, "Price cannot be negative."),
  compareAtPrice: z.number().int().min(0).nullable().optional(),
  costPrice: z.number().int().min(0).nullable().optional(),
  description: i18nPair.optional(),
  details: z
    .object({
      material: i18nPair.optional(),
      fit: i18nPair.optional(),
      care: i18nPair.optional(),
      shipping: i18nPair.optional(),
      returns: i18nPair.optional(),
    })
    .optional(),
  video: z.string().trim().max(600).optional(),
  sizeGuide: sizeGuideSchema.nullable().optional(),
  seoTitle: i18nPair.optional(),
  seoDescription: i18nPair.optional(),
  images: z.array(productImageInputSchema).max(40).default([]),
  options: z.array(productOptionSchema).max(6).default([]),
  variants: z.array(variantInputSchema).max(300).default([]),
});
export type ProductInput = z.infer<typeof productSchema>;

/* ───────────────────────────── Orders ───────────────────────────── */

export const addressSchema = z.object({
  line1: z.string().trim().min(3, "Street address is required.").max(200),
  line2: z.string().trim().max(200).default(""),
  city: z.string().trim().min(2, "City is required.").max(100),
  district: z.string().trim().min(2, "Pick a district.").max(60),
  postalCode: z.string().trim().max(12).default(""),
  country: z.string().trim().length(2).default("BD"),
});

export const orderEventSchema = z.object({
  orderId: z.string().min(1),
  type: z.enum(["status", "shipping", "note", "message", "payment", "system"]).default("note"),
  title: i18nPair,
  message: i18nPair.optional(),
  isPublic: z.boolean().default(true),
});

export const orderStatusSchema = z.object({
  orderId: z.string().min(1),
  status: z.enum(ORDER_STATUSES),
  message: z.string().max(600).optional(),
});

export const orderCustomerSchema = z.object({
  orderId: z.string().min(1),
  customerName: z.string().trim().min(2, "Name is required.").max(120),
  phone: z.string().trim().min(6, "Phone is required.").max(24),
  email: z.string().trim().max(160).optional(),
  address: addressSchema,
  notes: z.string().max(1500).optional(),
});

export const orderCourierSchema = z.object({
  orderId: z.string().min(1),
  courier: z.string().trim().max(60).optional(),
  courierTracking: z.string().trim().max(120).optional(),
  courierUrl: z.string().trim().max(600).optional(),
});

export const orderItemsSchema = z.object({
  orderId: z.string().min(1),
  items: z
    .array(
      z.object({
        id: z.string().min(1),
        quantity: z.number().int().min(0).max(999),
        unitPrice: z.number().int().min(0),
      }),
    )
    .max(60),
  shipping: z.number().int().min(0),
  discount: z.number().int().min(0),
});

export const manualOrderSchema = z.object({
  channel: z.enum(ORDER_CHANNELS).default("manual"),
  customerId: optionalId,
  customerName: z.string().trim().min(2, "Customer name is required.").max(120),
  phone: z.string().trim().min(6, "Phone number is required.").max(24),
  email: z.string().trim().max(160).optional(),
  address: addressSchema,
  items: z
    .array(
      z.object({
        variantId: z.string().min(1),
        quantity: z.number().int().min(1).max(999),
        unitPrice: z.number().int().min(0),
      }),
    )
    .min(1, "Add at least one line item.")
    .max(60),
  shipping: z.number().int().min(0).default(0),
  discount: z.number().int().min(0).default(0),
  paymentMethod: z.enum(PAYMENT_METHODS).default("cod"),
  paymentStatus: z.enum(PAYMENT_STATUSES).default("unpaid"),
  status: z.enum(ORDER_STATUSES).default("confirmed"),
  notes: z.string().max(1500).optional(),
  internalNotes: z.string().max(2000).optional(),
  locale: z.string().max(5).default("en"),
  decrementStock: z.boolean().default(true),
});
export type ManualOrderInput = z.infer<typeof manualOrderSchema>;

export const paymentVerifySchema = z.object({
  paymentId: z.string().min(1),
  decision: z.enum(["paid", "failed"]),
  note: z.string().max(400).optional(),
});

/* ───────────────────────────── Customers ───────────────────────────── */

export const customerSchema = z.object({
  id: z.string().trim().max(40).optional(),
  name: z.string().trim().min(2, "Name is required.").max(120),
  phone: z.string().trim().max(24).optional(),
  email: z.string().trim().max(160).optional(),
  locale: z.string().max(5).default("en"),
  notes: z.string().max(4000).optional(),
  tags: z.array(z.string().trim().max(40)).max(30).default([]),
});

/* ───────────────────────────── Coupons ───────────────────────────── */

export const couponSchema = z.object({
  id: z.string().trim().max(40).optional(),
  code: z
    .string()
    .trim()
    .toUpperCase()
    .min(3, "Use at least 3 characters.")
    .max(40)
    .regex(/^[A-Z0-9_-]+$/, "Letters, numbers, dashes and underscores only."),
  type: z.enum(COUPON_TYPES),
  value: z.number().int().min(0).default(0),
  minSubtotal: z.number().int().min(0).default(0),
  maxUses: z.number().int().min(0).nullable().optional(),
  perCustomer: z.number().int().min(0).nullable().optional(),
  startsAt: z.string().max(40).optional(),
  endsAt: z.string().max(40).optional(),
  isActive: z.boolean().default(true),
});

/* ───────────────────────────── Shipping ───────────────────────────── */

export const shippingZoneSchema = z.object({
  id: z.string().trim().max(40).optional(),
  name: i18nPair,
  districts: z.array(z.string().trim().max(60)).max(80).default([]),
  everywhereElse: z.boolean().default(false),
  rate: z.number().int().min(0),
  freeAbove: z.number().int().min(0).nullable().optional(),
  etaMinDays: z.number().int().min(0).max(90).default(2),
  etaMaxDays: z.number().int().min(0).max(90).default(5),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().min(0).max(999).default(0),
});

/* ───────────────────────────── Catalogue ───────────────────────────── */

export const categorySchema = z.object({
  id: z.string().trim().max(40).optional(),
  slug: z.string().trim().min(1, "A slug is required.").max(120),
  name: i18nPair,
  description: i18nPair.optional(),
  image: z.string().trim().max(600).optional(),
  parentId: optionalId,
  sortOrder: z.number().int().min(0).max(999).default(0),
  isActive: z.boolean().default(true),
});

export const collectionSchema = z.object({
  id: z.string().trim().max(40).optional(),
  slug: z.string().trim().min(1, "A slug is required.").max(120),
  name: i18nPair,
  description: i18nPair.optional(),
  image: z.string().trim().max(600).optional(),
  isPublished: z.boolean().default(false),
  sortOrder: z.number().int().min(0).max(999).default(0),
});

/* ───────────────────────────── Content ───────────────────────────── */

export const pageSchema = z.object({
  id: z.string().trim().max(40).optional(),
  slug: z.string().trim().min(1, "A slug is required.").max(120),
  title: i18nPair,
  body: i18nPair,
  template: z.enum(["editorial", "plain", "legal"]).default("editorial"),
  isPublished: z.boolean().default(false),
  showInFooter: z.boolean().default(true),
  seoTitle: i18nPair.optional(),
  seoDescription: i18nPair.optional(),
});

export const blockSchema = z.object({
  id: z.string().trim().max(40).optional(),
  page: z.string().trim().max(40).default("home"),
  type: z.enum(BLOCK_TYPES),
  isEnabled: z.boolean().default(true),
  position: z.number().int().min(0).max(999).default(0),
  data: z.record(z.unknown()).default({}),
});

/* ───────────────────────────── Media ───────────────────────────── */

export const mediaEditSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1).max(200),
  alt: z.string().trim().max(400).optional(),
  folder: z
    .string()
    .trim()
    .max(40)
    .default("library")
    .transform((v) => (v ? v.replace(/[^a-z0-9_-]/gi, "") || "library" : "library")),
});

/* ───────────────────────────── Users ───────────────────────────── */

export const userCreateSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address.").max(160),
  name: z.string().trim().min(2, "Name is required.").max(120),
  role: z.enum(ROLES),
  password: z.string().min(12, "Use at least 12 characters.").max(200),
});

export const userUpdateSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(2).max(120),
  role: z.enum(ROLES),
  isActive: z.boolean().default(true),
});

/* ───────────────────────────── Helpers ───────────────────────────── */

/** `en`/`bn` pair from `<name>_en` / `<name>_bn` form fields. */
/**
 * Reads every `${base}_<locale>` field the form submitted (en, bn and any
 * language registered in the studio). en/bn are always present so existing
 * callers keep their `{ en, bn }` shape; extra locales ride along in the JSON.
 */
export function readI18n(fd: FormData, base: string): I18nPair {
  const out: Record<string, string> = {
    en: String(fd.get(`${base}_en`) ?? "").slice(0, 6000),
    bn: String(fd.get(`${base}_bn`) ?? "").slice(0, 6000),
  };
  const prefix = `${base}_`;
  for (const key of fd.keys()) {
    if (!key.startsWith(prefix)) continue;
    const code = key.slice(prefix.length);
    if (!/^[a-z]{2,3}$/.test(code) || code in out) continue;
    const v = String(fd.get(key) ?? "").slice(0, 6000);
    if (v.trim()) out[code] = v;
  }
  return out as I18nPair;
}

export function readBool(fd: FormData, name: string): boolean {
  const v = fd.get(name);
  return v === "on" || v === "true" || v === "1";
}

export function readInt(fd: FormData, name: string, fallback = 0): number {
  const n = Number(String(fd.get(name) ?? "").replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? Math.round(n) : fallback;
}

/** Major-unit money field (BDT) → minor units. Empty → null. */
export function readMoney(fd: FormData, name: string): number | null {
  const raw = String(fd.get(name) ?? "").trim();
  if (!raw) return null;
  const n = Number(raw.replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? Math.round(n * 100) : null;
}

export function readList(fd: FormData, name: string): string[] {
  return String(fd.get(name) ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function readJson<T>(fd: FormData, name: string, fallback: T): T {
  const raw = fd.get(name);
  if (typeof raw !== "string" || !raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}
