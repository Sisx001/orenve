import "server-only";
import type { CourierAdapter, ConsignmentInput, ConsignmentResult, ShipmentStatus, TrackingResult } from "./types";
import { courierCreds } from "./credentials";

/**
 * Pathao Courier Merchant API ("Aladdin").
 * Sandbox: https://courier-api-sandbox.pathao.com   Production: https://api-hermes.pathao.com
 * Auth: POST /aladdin/api/v1/issue-token (client_credentials + merchant username/password) → Bearer.
 * Docs: merchant.pathao.com → Developers.
 */
let tokenCache: { token: string; exp: number } | null = null;

async function token(): Promise<string> {
  const c = await courierCreds("pathao");
  if (tokenCache && tokenCache.exp > Date.now() + 60_000) return tokenCache.token;
  const res = await fetch(`${c.baseUrl}/aladdin/api/v1/issue-token`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ client_id: c.clientId, client_secret: c.clientSecret, grant_type: "password", username: c.username, password: c.password }),
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  const data = (await res.json()) as any;
  if (!res.ok || !data.access_token) throw new Error(`Pathao auth failed: ${data.message ?? res.status}`);
  tokenCache = { token: data.access_token, exp: Date.now() + (Number(data.expires_in) || 3600) * 1000 };
  return tokenCache.token;
}

async function api<T = any>(path: string, init: RequestInit = {}): Promise<T> {
  const c = await courierCreds("pathao");
  const t = await token();
  const res = await fetch(`${c.baseUrl}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", Accept: "application/json", Authorization: `Bearer ${t}`, ...(init.headers ?? {}) },
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });
  const data = (await res.json().catch(() => ({}))) as any;
  if (!res.ok) throw new Error(`Pathao ${path} → ${res.status}: ${data.message ?? JSON.stringify(data.errors ?? data).slice(0, 200)}`);
  return data as T;
}

const STATUS_MAP: Record<string, ShipmentStatus> = {
  pending: "booked",
  pickup_requested: "booked",
  assigned_for_pickup: "booked",
  picked: "picked",
  pickup_failed: "failed",
  pickup_cancelled: "cancelled",
  at_the_sorting_hub: "in_transit",
  in_transit: "in_transit",
  received_at_last_mile_hub: "in_transit",
  assigned_for_delivery: "in_transit",
  delivered: "delivered",
  partial_delivery: "delivered",
  return: "returned",
  delivery_failed: "failed",
  on_hold: "in_transit",
  paid_return: "returned",
  exchange: "returned",
};
export const mapPathaoStatus = (s: string): ShipmentStatus => STATUS_MAP[s?.toLowerCase().replace(/\s+/g, "_")] ?? "unknown";

export const pathao: CourierAdapter = {
  provider: "pathao",
  async isConfigured() {
    const c = await courierCreds("pathao");
    return Boolean(c.clientId && c.clientSecret && c.username && c.password && c.storeId);
  },
  async createConsignment(input: ConsignmentInput): Promise<ConsignmentResult> {
    const c = await courierCreds("pathao");
    const loc = input.providerLocation ?? {};
    const body = {
      store_id: Number(c.storeId),
      merchant_order_id: input.orderNumber,
      recipient_name: input.recipientName.slice(0, 100),
      recipient_phone: input.recipientPhone,
      recipient_address: input.address.slice(0, 220),
      ...(loc.cityId ? { recipient_city: Number(loc.cityId) } : {}),
      ...(loc.zoneId ? { recipient_zone: Number(loc.zoneId) } : {}),
      ...(loc.areaId ? { recipient_area: Number(loc.areaId) } : {}),
      delivery_type: Number(loc.deliveryType ?? 48), // 48 normal, 12 on-demand
      item_type: 2, // parcel
      special_instruction: input.note?.slice(0, 200),
      item_quantity: input.quantity,
      item_weight: Math.min(10, Math.max(0.5, input.weightKg)),
      item_description: input.itemDescription.slice(0, 200),
      amount_to_collect: Math.round(input.codAmount),
    };
    const data = await api<any>("/aladdin/api/v1/orders", { method: "POST", body: JSON.stringify(body) });
    const d = data.data ?? data;
    return {
      consignmentId: String(d.consignment_id),
      trackingCode: String(d.consignment_id),
      trackingUrl: `https://merchant.pathao.com/tracking?consignment_id=${d.consignment_id}`,
      status: mapPathaoStatus(d.order_status ?? "pending"),
      rawStatus: d.order_status,
      deliveryFee: d.delivery_fee != null ? Number(d.delivery_fee) : undefined,
      raw: data,
    };
  },
  async track(consignmentId): Promise<TrackingResult> {
    const data = await api<any>(`/aladdin/api/v1/orders/${encodeURIComponent(consignmentId)}/info`);
    const d = data.data ?? data;
    const raw = d.order_status ?? d.status ?? "unknown";
    return { status: mapPathaoStatus(raw), rawStatus: String(raw), raw: data, updatedAt: d.updated_at };
  },
  async cancel(consignmentId) {
    await api(`/aladdin/api/v1/orders/${encodeURIComponent(consignmentId)}/cancel`, { method: "POST", body: "{}" });
    return true;
  },
  async quote(input) {
    const c = await courierCreds("pathao");
    const loc = input.providerLocation ?? {};
    if (!loc.cityId || !loc.zoneId) return null;
    const data = await api<any>("/aladdin/api/v1/merchant/price-plan", {
      method: "POST",
      body: JSON.stringify({ store_id: Number(c.storeId), item_type: 2, delivery_type: Number(loc.deliveryType ?? 48), item_weight: Math.min(10, Math.max(0.5, input.weightKg)), recipient_city: Number(loc.cityId), recipient_zone: Number(loc.zoneId) }),
    });
    const d = data.data ?? data;
    return { fee: Number(d.final_price ?? d.price ?? 0), codFee: d.cod_charge != null ? Number(d.cod_charge) : undefined, raw: data };
  },
  async locations(level, parentId) {
    const path = level === "cities" ? "/aladdin/api/v1/city-list" : level === "zones" ? `/aladdin/api/v1/cities/${parentId}/zone-list` : `/aladdin/api/v1/zones/${parentId}/area-list`;
    const data = await api<any>(path);
    const list: any[] = data.data?.data ?? data.data ?? [];
    return list.map((x) => ({ id: x.city_id ?? x.zone_id ?? x.area_id, name: x.city_name ?? x.zone_name ?? x.area_name }));
  },
};
