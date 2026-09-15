import "server-only";
import { z } from "zod";
import { db } from "@/lib/db";
import { parseJson, toJson, i18nText } from "@/lib/json";
import { getSetting } from "@/lib/settings";
import { formatMoney } from "@/lib/money";
import { BD_DISTRICTS, PAYMENT_METHODS, type PaymentMethod, type OrderStatus } from "@/lib/constants";
import { generateTrackingCode, formatOrderNumber } from "./numbers";
import type { PublicOrderView } from "@/types";

// ───────────────────────────── validation ─────────────────────────────

export const checkoutSchema = z.object({
  items: z
    .array(z.object({ variantId: z.string().min(1), quantity: z.number().int().min(1).max(20) }))
    .min(1)
    .max(30),
  customerName: z.string().trim().min(2).max(120),
  phone: z
    .string()
    .trim()
    .transform((v) => v.replace(/[\s-]/g, ""))
    .refine((v) => /^(\+?880|0)?1[3-9]\d{8}$/.test(v) || /^\+?[1-9]\d{7,14}$/.test(v), "invalid_phone"),
  email: z.string().trim().email().max(160).optional().or(z.literal("")),
  address: z.object({
    line1: z.string().trim().min(3).max(200),
    line2: z.string().trim().max(200).optional().or(z.literal("")),
    city: z.string().trim().min(2).max(100),
    district: z.string().trim().min(2).max(60),
    division: z.string().trim().max(60).optional().or(z.literal("")),
    upazila: z.string().trim().max(80).optional().or(z.literal("")),
    area: z.string().trim().max(120).optional().or(z.literal("")),
    postalCode: z.string().trim().max(12).optional().or(z.literal("")),
    country: z.string().trim().length(2).default("BD"),
    lat: z.number().optional(),
    lng: z.number().optional(),
  }),
  notes: z.string().trim().max(1500).optional().or(z.literal("")),
  couponCode: z.string().trim().max(40).optional().or(z.literal("")),
  paymentMethod: z.enum(PAYMENT_METHODS),
  currency: z.string().length(3).default("BDT"),
  locale: z.string().default("en"),
  channel: z.enum(["website", "whatsapp", "messenger"]).default("website"),
  mfs: z.object({ transactionId: z.string().trim().min(6).max(40), senderNumber: z.string().trim().min(8).max(20) }).optional(),
  website: z.string().max(0).optional(), // honeypot
});
export type CheckoutInput = z.infer<typeof checkoutSchema>;

export function normalizeBdPhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (/^01[3-9]\d{8}$/.test(digits)) return `880${digits.slice(1)}`;
  if (/^8801[3-9]\d{8}$/.test(digits)) return digits;
  return digits;
}

// ───────────────────────────── pricing ─────────────────────────────

export class CheckoutError extends Error {
  code: string;
  vars?: Record<string, string | number>;
  constructor(code: string, vars?: Record<string, string | number>) {
    super(code);
    this.code = code;
    this.vars = vars;
  }
}

export async function priceCart(items: { variantId: string; quantity: number }[], locale = "en") {
  const merged = new Map<string, number>();
  for (const i of items) merged.set(i.variantId, (merged.get(i.variantId) ?? 0) + i.quantity);
  const variants = await db.productVariant.findMany({
    where: { id: { in: [...merged.keys()] }, isActive: true },
    include: { product: { include: { images: { orderBy: { position: "asc" }, take: 1 } } }, image: true },
  });
  if (variants.length !== merged.size) throw new CheckoutError("errors.productUnavailable");

  const lines = variants.map((v) => {
    if (v.product.status !== "published") throw new CheckoutError("errors.productUnavailable");
    const qty = merged.get(v.id)!;
    const name = i18nText(v.product.name, locale);
    if (qty > v.stock) throw new CheckoutError("errors.outOfStock", { name, variant: v.title, stock: v.stock });
    const unitPrice = v.price ?? v.product.price;
    return {
      variant: v,
      productId: v.productId,
      variantId: v.id,
      name,
      variantTitle: v.title,
      sku: v.sku,
      image: v.image?.url ?? v.product.images[0]?.url ?? null,
      unitPrice,
      quantity: qty,
      total: unitPrice * qty,
    };
  });
  const subtotal = lines.reduce((a, l) => a + l.total, 0);
  return { lines, subtotal };
}

export async function computeShipping(district: string, subtotal: number) {
  const zones = await db.shippingZone.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" } });
  const normalized = district.trim().toLowerCase();
  let zone = zones.find((z) => parseJson<string[]>(z.districts, []).some((d) => d.toLowerCase() === normalized));
  zone ??= zones.find((z) => parseJson<string[]>(z.districts, []).includes("*"));
  if (!zone) return { zone: null, amount: 0 };
  const free = zone.freeAbove != null && subtotal >= zone.freeAbove;
  return { zone, amount: free ? 0 : zone.rate };
}

export async function applyCoupon(code: string | undefined, subtotal: number, shipping: number) {
  if (!code) return { discount: 0, shipping, coupon: null as null | Awaited<ReturnType<typeof db.coupon.findUnique>> };
  const coupon = await db.coupon.findUnique({ where: { code: code.toUpperCase() } });
  const now = new Date();
  if (!coupon || !coupon.isActive) throw new CheckoutError("cart.couponInvalid");
  if ((coupon.startsAt && coupon.startsAt > now) || (coupon.endsAt && coupon.endsAt < now)) throw new CheckoutError("errors.couponExpired");
  if (coupon.maxUses != null && coupon.usedCount >= coupon.maxUses) throw new CheckoutError("errors.couponExpired");
  if (subtotal < coupon.minSubtotal) throw new CheckoutError("errors.couponMin", { amount: formatMoney(coupon.minSubtotal) });
  if (coupon.type === "percent") return { discount: Math.round((subtotal * coupon.value) / 100), shipping, coupon };
  if (coupon.type === "fixed") return { discount: Math.min(coupon.value, subtotal), shipping, coupon };
  return { discount: 0, shipping: 0, coupon }; // free_shipping
}

export async function quote(input: { items: { variantId: string; quantity: number }[]; district?: string; couponCode?: string; locale?: string; paymentMethod?: string }) {
  const { lines, subtotal } = await priceCart(input.items, input.locale);
  const ship = input.district ? await computeShipping(input.district, subtotal) : { zone: null, amount: 0 };
  const { discount, shipping, coupon } = await applyCoupon(input.couponCode || undefined, subtotal, ship.amount);
  // Cash-on-delivery handling fee (studio → Checkout & payments). Only when COD is the chosen method.
  const checkout = input.paymentMethod === "cod" ? await getSetting("checkout") : null;
  const codFee = checkout && checkout.codFee > 0 ? checkout.codFee : 0;
  const total = Math.max(0, subtotal - discount + shipping + codFee);
  return { lines, subtotal, shipping, discount, codFee, total, zone: ship.zone, coupon };
}

// ───────────────────────────── placement ─────────────────────────────

async function nextOrderNumber() {
  const year = new Date().getFullYear();
  const count = await db.order.count({ where: { number: { startsWith: `ORY-${year}-` } } });
  // small retry window handles concurrent inserts (unique constraint)
  for (let i = 1; i <= 5; i++) {
    const candidate = formatOrderNumber(count + i);
    const exists = await db.order.findUnique({ where: { number: candidate }, select: { id: true } });
    if (!exists) return candidate;
  }
  return `ORY-${year}-${Date.now().toString().slice(-6)}`;
}

export async function placeOrder(raw: unknown, ctx: { ip?: string }) {
  const input = checkoutSchema.parse(raw);
  if (input.website) throw new CheckoutError("errors.invalidInput"); // honeypot tripped

  const [site, checkout, currencySetting] = await Promise.all([getSetting("site"), getSetting("checkout"), getSetting("currency")]);
  if (site.mode !== "live") throw new CheckoutError("checkout.paused");
  if (!checkout.website && input.channel === "website") throw new CheckoutError("checkout.paused");

  const q = await quote({ items: input.items, district: input.address.district, couponCode: input.couponCode || undefined, locale: input.locale, paymentMethod: input.paymentMethod });
  if (checkout.minOrder && q.subtotal < checkout.minOrder) throw new CheckoutError("checkout.minOrder", { amount: formatMoney(checkout.minOrder) });
  if (input.paymentMethod === "cod" && checkout.codMaxOrder > 0 && q.subtotal > checkout.codMaxOrder) throw new CheckoutError("checkout.codMaxOrder", { amount: formatMoney(checkout.codMaxOrder) });
  if (checkout.requireEmail && !input.email) throw new CheckoutError("errors.invalidInput");

  const method: PaymentMethod = input.paymentMethod;
  if (method !== "none" && !checkout[method as keyof typeof checkout]) throw new CheckoutError("errors.paymentNotConfigured");
  const currency = currencySetting.display.find((c) => c.code === input.currency && c.enabled) ?? currencySetting.display[0];

  const phone = normalizeBdPhone(input.phone);
  const paymentStatus = method === "bkash" || method === "nagad" ? "pending_verification" : "unpaid";
  const status: OrderStatus = method === "cod" && checkout.autoConfirmCod ? "confirmed" : "pending";

  const order = await db.$transaction(async (tx) => {
    // decrement stock atomically; fail if any line went out of stock meanwhile
    for (const l of q.lines) {
      const r = await tx.productVariant.updateMany({
        where: { id: l.variantId, stock: { gte: l.quantity } },
        data: { stock: { decrement: l.quantity } },
      });
      if (r.count !== 1) throw new CheckoutError("errors.outOfStock", { name: l.name, variant: l.variantTitle, stock: l.variant.stock });
    }
    if (q.coupon) await tx.coupon.update({ where: { id: q.coupon.id }, data: { usedCount: { increment: 1 } } });

    const customer = await tx.customer.upsert({
      where: { phone },
      update: { name: input.customerName, email: input.email || undefined, locale: input.locale },
      create: { phone, name: input.customerName, email: input.email || null, locale: input.locale },
    });

    const created = await tx.order.create({
      data: {
        number: await nextOrderNumber(),
        trackingCode: generateTrackingCode(),
        customerId: customer.id,
        status,
        channel: input.channel,
        paymentMethod: method,
        paymentStatus,
        currency: currency.code,
        exchangeRate: currency.rate,
        subtotal: q.subtotal,
        discount: q.discount,
        shipping: q.shipping,
        codFee: q.codFee,
        total: q.total,
        couponCode: q.coupon?.code ?? null,
        customerName: input.customerName,
        email: input.email || null,
        phone,
        shippingAddress: toJson(input.address),
        shippingZoneId: q.zone?.id ?? null,
        notes: input.notes || null,
        locale: input.locale,
        ip: ctx.ip ?? null,
        confirmedAt: status === "confirmed" ? new Date() : null,
        items: {
          create: q.lines.map((l) => ({
            productId: l.productId,
            variantId: l.variantId,
            name: l.name,
            variantTitle: l.variantTitle,
            sku: l.sku,
            image: l.image,
            unitPrice: l.unitPrice,
            quantity: l.quantity,
            total: l.total,
          })),
        },
        events: {
          create: [
            {
              type: "status",
              title: toJson({ en: "Order received", bn: "অর্ডার গৃহীত" }),
              message: toJson({
                en: "Thank you — we've received your order and will confirm it shortly.",
                bn: "ধন্যবাদ — আপনার অর্ডার পেয়েছি, শিগগিরই নিশ্চিত করব।",
              }),
              isPublic: true,
            },
          ],
        },
      },
      include: { items: true },
    });

    if (input.mfs && (method === "bkash" || method === "nagad")) {
      await tx.payment.create({
        data: {
          orderId: created.id,
          method,
          provider: "manual",
          amount: q.total,
          status: "pending_verification",
          transactionId: input.mfs.transactionId,
          senderNumber: input.mfs.senderNumber,
        },
      });
      await tx.orderEvent.create({
        data: {
          orderId: created.id,
          type: "payment",
          title: toJson({ en: "Payment submitted for verification", bn: "পেমেন্ট যাচাইয়ের জন্য জমা" }),
          message: toJson({ en: `TrxID ${input.mfs.transactionId} received.`, bn: `TrxID ${input.mfs.transactionId} পেয়েছি।` }),
          isPublic: true,
        },
      });
    }
    return created;
  });

  return order;
}

// ───────────────────────────── public view ─────────────────────────────

export function maskPhone(phone: string) {
  return phone.length > 6 ? `${phone.slice(0, 5)}•••••${phone.slice(-2)}` : "•••";
}

export async function findOrderForCustomer(reference: string, phone: string, locale = "en"): Promise<PublicOrderView | null> {
  const ref = reference.trim().toUpperCase();
  const normalized = normalizeBdPhone(phone);
  const order = await db.order.findFirst({
    where: {
      OR: [{ number: ref }, { trackingCode: ref }],
      phone: { in: [normalized, phone.replace(/\D/g, ""), `0${normalized.slice(3)}`] },
    },
    include: { items: true, events: { where: { isPublic: true }, orderBy: { createdAt: "asc" } } },
  });
  if (!order) return null;
  return toPublicView(order, locale);
}

export async function findOrderByTrackingCode(code: string, locale = "en"): Promise<PublicOrderView | null> {
  const order = await db.order.findUnique({
    where: { trackingCode: code.toUpperCase() },
    include: { items: true, events: { where: { isPublic: true }, orderBy: { createdAt: "asc" } } },
  });
  return order ? toPublicView(order, locale) : null;
}

type OrderWithRel = NonNullable<Awaited<ReturnType<typeof db.order.findFirst<{ include: { items: true; events: true } }>>>>;

export function toPublicView(order: OrderWithRel, locale: string): PublicOrderView {
  return {
    number: order.number,
    trackingCode: order.trackingCode,
    status: order.status,
    paymentMethod: order.paymentMethod,
    paymentStatus: order.paymentStatus,
    channel: order.channel,
    placedAt: order.placedAt.toISOString(),
    total: order.total,
    subtotal: order.subtotal,
    codFee: order.codFee,
    shipping: order.shipping,
    discount: order.discount,
    currency: order.currency,
    customerName: order.customerName,
    phoneMasked: maskPhone(order.phone),
    courier: order.courier,
    courierTracking: order.courierTracking,
    courierUrl: order.courierUrl,
    items: order.items.map((i) => ({ name: i.name, variantTitle: i.variantTitle, quantity: i.quantity, unitPrice: i.unitPrice, image: i.image })),
    events: order.events.map((e) => ({
      type: e.type,
      title: i18nText(e.title, locale),
      message: e.message ? i18nText(e.message, locale) : null,
      createdAt: e.createdAt.toISOString(),
    })),
  };
}

// ───────────────────────────── staff transitions ─────────────────────────────

const STATUS_TITLES: Record<OrderStatus, { en: string; bn: string }> = {
  pending: { en: "Order received", bn: "অর্ডার গৃহীত" },
  confirmed: { en: "Order confirmed", bn: "অর্ডার নিশ্চিত" },
  processing: { en: "Your pieces are being prepared", bn: "আপনার পিস প্রস্তুত হচ্ছে" },
  shipped: { en: "Handed to courier", bn: "কুরিয়ারে হস্তান্তর" },
  delivered: { en: "Delivered", bn: "ডেলিভারি সম্পন্ন" },
  cancelled: { en: "Order cancelled", bn: "অর্ডার বাতিল" },
  refunded: { en: "Refunded", bn: "রিফান্ড সম্পন্ন" },
};

export async function transitionOrder(orderId: string, status: OrderStatus, userId: string | null, message?: string) {
  const order = await db.order.findUniqueOrThrow({ where: { id: orderId }, include: { items: true } });
  const now = new Date();
  const data: Record<string, unknown> = { status };
  if (status === "confirmed") data.confirmedAt = now;
  if (status === "shipped") data.shippedAt = now;
  if (status === "delivered") {
    data.deliveredAt = now;
    if (order.paymentMethod === "cod") {
      data.paymentStatus = "paid";
      data.paidAt = now;
    }
  }
  if (status === "cancelled" || status === "refunded") {
    data.cancelledAt = now;
    if (order.status !== "cancelled" && order.status !== "refunded") {
      // restock
      for (const it of order.items) {
        if (it.variantId) await db.productVariant.update({ where: { id: it.variantId }, data: { stock: { increment: it.quantity } } }).catch(() => {});
      }
    }
    if (status === "refunded") data.paymentStatus = "refunded";
  }
  await db.order.update({ where: { id: orderId }, data });
  await db.orderEvent.create({
    data: {
      orderId,
      type: "status",
      title: toJson(STATUS_TITLES[status]),
      message: message ? toJson({ en: message, bn: message }) : null,
      isPublic: true,
      createdById: userId,
    },
  });
}

export function districtIsValid(d: string) {
  return (BD_DISTRICTS as readonly string[]).some((x) => x.toLowerCase() === d.trim().toLowerCase());
}
