import "server-only";
import { db } from "@/lib/db";
import { toJson, parseJson } from "@/lib/json";
import { getSetting } from "@/lib/settings";
import type { CourierProvider } from "@/lib/constants";
import type { CourierAdapter, ConsignmentInput, ShipmentStatus } from "./types";
import { pathao } from "./pathao";
import { steadfast } from "./steadfast";
import { redx } from "./redx";
import { paperfly } from "./paperfly";

const adapters: Record<Exclude<CourierProvider, "manual">, CourierAdapter> = { pathao, steadfast, redx, paperfly };

export function getCourier(provider: CourierProvider): CourierAdapter | null {
  return provider === "manual" ? null : adapters[provider] ?? null;
}

export async function availableCouriers(): Promise<CourierProvider[]> {
  const s = await getSetting("courier");
  const out: CourierProvider[] = [];
  for (const p of ["pathao", "steadfast", "redx", "paperfly"] as const) {
    if (s[p].enabled && (await adapters[p].isConfigured())) out.push(p);
  }
  out.push("manual");
  return out;
}

const PUBLIC_TITLES: Record<ShipmentStatus, { en: string; bn: string }> = {
  booked: { en: "Booked with courier", bn: "কুরিয়ারে বুক করা হয়েছে" },
  picked: { en: "Picked up by courier", bn: "কুরিয়ার সংগ্রহ করেছে" },
  in_transit: { en: "On its way", bn: "পথে আছে" },
  delivered: { en: "Delivered", bn: "ডেলিভারি সম্পন্ন" },
  returned: { en: "Returned to us", bn: "আমাদের কাছে ফেরত" },
  cancelled: { en: "Shipment cancelled", bn: "শিপমেন্ট বাতিল" },
  failed: { en: "Delivery attempt failed", bn: "ডেলিভারি চেষ্টা ব্যর্থ" },
  unknown: { en: "Courier update", bn: "কুরিয়ার আপডেট" },
};

/** Books a consignment for an order and records a Shipment + public timeline event. */
export async function bookShipment(orderId: string, provider: CourierProvider, userId: string | null, opts: { note?: string; weightKg?: number; providerLocation?: Record<string, string | number>; manual?: { trackingCode?: string; trackingUrl?: string; courierName?: string } } = {}) {
  const order = await db.order.findUniqueOrThrow({ where: { id: orderId }, include: { items: true } });
  const addr = parseJson<Record<string, string>>(order.shippingAddress, {});
  const cod = order.paymentStatus === "paid" ? 0 : order.total / 100;

  if (provider === "manual") {
    const s = await db.shipment.create({
      data: { orderId, provider: "manual", trackingCode: opts.manual?.trackingCode ?? null, trackingUrl: opts.manual?.trackingUrl ?? null, status: "booked", codAmount: Math.round(cod * 100), note: opts.manual?.courierName ?? opts.note ?? null, createdById: userId },
    });
    await db.order.update({ where: { id: orderId }, data: { courier: opts.manual?.courierName ?? "Courier", courierTracking: opts.manual?.trackingCode ?? null, courierUrl: opts.manual?.trackingUrl ?? null, courierStatus: "booked" } });
    await addShipmentEvent(orderId, "booked", opts.manual?.courierName ?? "Courier", opts.manual?.trackingCode ?? undefined, userId);
    return s;
  }

  const adapter = adapters[provider];
  const phoneLocal = order.phone.startsWith("880") ? `0${order.phone.slice(3)}` : order.phone;
  const input: ConsignmentInput = {
    orderId,
    orderNumber: order.number,
    recipientName: order.customerName,
    recipientPhone: phoneLocal,
    address: [addr.line1, addr.line2].filter(Boolean).join(", "),
    district: addr.district ?? "",
    upazila: addr.upazila ?? addr.city,
    area: addr.area,
    postcode: addr.postalCode,
    codAmount: cod,
    itemDescription: order.items.map((i) => `${i.name}${i.variantTitle ? ` (${i.variantTitle})` : ""} ×${i.quantity}`).join(", "),
    quantity: order.items.reduce((a, i) => a + i.quantity, 0),
    weightKg: opts.weightKg ?? Math.max(0.5, order.items.reduce((a, i) => a + i.quantity, 0) * 0.4),
    note: opts.note ?? order.notes ?? undefined,
    providerLocation: opts.providerLocation,
  };
  const result = await adapter.createConsignment(input);
  const shipment = await db.shipment.create({
    data: {
      orderId,
      provider,
      consignmentId: result.consignmentId,
      trackingCode: result.trackingCode ?? null,
      trackingUrl: result.trackingUrl ?? null,
      status: result.status === "unknown" ? "booked" : result.status,
      rawStatus: result.rawStatus ?? null,
      codAmount: Math.round(cod * 100),
      deliveryFee: result.deliveryFee != null ? Math.round(result.deliveryFee * 100) : null,
      weightGrams: Math.round(input.weightKg * 1000),
      note: opts.note ?? null,
      rawPayload: toJson(result.raw).slice(0, 20000),
      lastSyncedAt: new Date(),
      createdById: userId,
    },
  });
  await db.order.update({
    where: { id: orderId },
    data: { courier: providerLabel(provider), courierTracking: result.trackingCode ?? result.consignmentId, courierUrl: result.trackingUrl ?? null, courierStatus: result.rawStatus ?? result.status, status: order.status === "confirmed" || order.status === "pending" ? "processing" : order.status },
  });
  await addShipmentEvent(orderId, "booked", providerLabel(provider), result.trackingCode ?? result.consignmentId, userId);
  return shipment;
}

/** Pulls the latest status for a shipment and writes a public event when it changes. */
export async function syncShipment(shipmentId: string) {
  const s = await db.shipment.findUniqueOrThrow({ where: { id: shipmentId }, include: { order: true } });
  if (s.provider === "manual" || !s.consignmentId) return s;
  const adapter = adapters[s.provider as Exclude<CourierProvider, "manual">];
  const t = await adapter.track(s.consignmentId, s.trackingCode ?? undefined);
  const next = (t.status === "unknown" ? s.status : t.status) as ShipmentStatus;
  const changed = next !== s.status || t.rawStatus !== s.rawStatus;
  const updated = await db.shipment.update({ where: { id: shipmentId }, data: { status: next, rawStatus: t.rawStatus, rawPayload: toJson(t.raw).slice(0, 20000), lastSyncedAt: new Date() } });
  if (changed) {
    await db.order.update({ where: { id: s.orderId }, data: { courierStatus: t.rawStatus, ...(next === "delivered" ? { status: "delivered", deliveredAt: new Date(), ...(s.order.paymentMethod === "cod" ? { paymentStatus: "paid", paidAt: new Date() } : {}) } : next === "in_transit" || next === "picked" ? { status: s.order.status === "delivered" ? s.order.status : "shipped", shippedAt: s.order.shippedAt ?? new Date() } : {}) } });
    await addShipmentEvent(s.orderId, next, providerLabel(s.provider as CourierProvider), s.trackingCode ?? undefined, null, t.rawStatus);
  }
  return updated;
}

async function addShipmentEvent(orderId: string, status: ShipmentStatus, courier: string, tracking: string | undefined, userId: string | null, rawStatus?: string) {
  const t = PUBLIC_TITLES[status];
  await db.orderEvent.create({
    data: {
      orderId,
      type: "shipping",
      title: toJson(t),
      message: toJson({ en: `${courier}${tracking ? ` — ${tracking}` : ""}${rawStatus ? ` (${rawStatus})` : ""}`, bn: `${courier}${tracking ? ` — ${tracking}` : ""}` }),
      isPublic: true,
      createdById: userId,
    },
  });
}

export function providerLabel(p: CourierProvider) {
  return ({ pathao: "Pathao", steadfast: "Steadfast", redx: "RedX", paperfly: "Paperfly", manual: "Courier" } as Record<CourierProvider, string>)[p];
}

export type { CourierAdapter, ConsignmentInput, ShipmentStatus } from "./types";
