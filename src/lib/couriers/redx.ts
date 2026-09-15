import "server-only";
import type { CourierAdapter, ConsignmentInput, ConsignmentResult, ShipmentStatus, TrackingResult } from "./types";
import { courierCreds } from "./credentials";

/**
 * RedX OpenAPI. Sandbox: https://sandbox.redx.com.bd/v1.0.0-beta  Production: https://openapi.redx.com.bd/v1.0.0-beta
 * Auth header: API-ACCESS-TOKEN: Bearer <token>. Endpoints: POST /parcel, GET /parcel/track/{id},
 * GET /parcel/info/{id}, GET /areas, GET /pickup/stores. Status webhooks POST to a merchant callback URL.
 */
async function api<T = any>(path: string, init: RequestInit = {}): Promise<T> {
  const c = await courierCreds("redx");
  const res = await fetch(`${c.baseUrl}${path}`, {
    ...init,
    headers: { "API-ACCESS-TOKEN": `Bearer ${c.accessToken}`, "Content-Type": "application/json", Accept: "application/json", ...(init.headers ?? {}) },
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });
  const data = (await res.json().catch(() => ({}))) as any;
  if (!res.ok) throw new Error(`RedX ${path} → ${res.status}: ${data.message ?? JSON.stringify(data).slice(0, 200)}`);
  return data as T;
}

const STATUS_MAP: Record<string, ShipmentStatus> = {
  "pickup-pending": "booked",
  "ready-for-delivery": "in_transit",
  "picked-up": "picked",
  "in-transit": "in_transit",
  "on-the-way": "in_transit",
  "delivery-in-progress": "in_transit",
  delivered: "delivered",
  "partially-delivered": "delivered",
  "returned": "returned",
  "return-in-progress": "returned",
  "returned-to-merchant": "returned",
  cancelled: "cancelled",
  hold: "in_transit",
  "delivery-failed": "failed",
};
export const mapRedxStatus = (s: string): ShipmentStatus => STATUS_MAP[s?.toLowerCase().replace(/[\s_]+/g, "-")] ?? "unknown";

export const redx: CourierAdapter = {
  provider: "redx",
  async isConfigured() {
    const c = await courierCreds("redx");
    return Boolean(c.accessToken);
  },
  async createConsignment(input: ConsignmentInput): Promise<ConsignmentResult> {
    const c = await courierCreds("redx");
    const loc = input.providerLocation ?? {};
    const body = {
      customer_name: input.recipientName.slice(0, 100),
      customer_phone: input.recipientPhone,
      delivery_area: String(loc.areaName ?? input.area ?? input.upazila ?? input.district),
      delivery_area_id: Number(loc.areaId ?? 0),
      customer_address: [input.address, input.area, input.upazila, input.district].filter(Boolean).join(", ").slice(0, 250),
      merchant_invoice_id: input.orderNumber,
      cash_collection_amount: String(Math.max(0, Math.round(input.codAmount))),
      parcel_weight: Math.round(input.weightKg * 1000),
      instruction: input.note?.slice(0, 200) ?? "",
      value: Math.max(1, Math.round(input.codAmount)),
      is_closed_box: "yes",
      ...(c.pickupStoreId ? { pickup_store_id: Number(c.pickupStoreId) } : {}),
      parcel_details_json: [{ name: input.itemDescription.slice(0, 100), category: "Fashion", value: Math.max(1, Math.round(input.codAmount)) }],
    };
    const data = await api<any>("/parcel", { method: "POST", body: JSON.stringify(body) });
    const id = String(data.tracking_id ?? data.parcel?.tracking_id ?? data.id ?? "");
    return { consignmentId: id, trackingCode: id, trackingUrl: id ? `https://redx.com.bd/track-parcel/?trackingId=${id}` : undefined, status: "booked", rawStatus: "pickup-pending", raw: data };
  },
  async track(consignmentId): Promise<TrackingResult> {
    const data = await api<any>(`/parcel/track/${encodeURIComponent(consignmentId)}`);
    const events: any[] = data.tracking ?? data.data ?? [];
    const last = events[events.length - 1] ?? {};
    const raw = String(last.message_en ?? last.status ?? data.status ?? "unknown");
    return { status: mapRedxStatus(last.status ?? raw), rawStatus: raw, raw: data, updatedAt: last.time };
  },
  async locations(level) {
    if (level !== "areas") return [];
    const data = await api<any>("/areas");
    const list: any[] = data.areas ?? data.data ?? [];
    return list.map((a) => ({ id: a.id, name: `${a.name}${a.district_name ? ` (${a.district_name})` : ""}` }));
  },
};
