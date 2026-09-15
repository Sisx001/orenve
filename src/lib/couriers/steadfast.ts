import "server-only";
import type { CourierAdapter, ConsignmentInput, ConsignmentResult, ShipmentStatus, TrackingResult } from "./types";
import { courierCreds } from "./credentials";

/**
 * Steadfast Courier merchant API. Base: https://portal.packzy.com/api/v1
 * Auth headers: Api-Key, Secret-Key. Endpoints: POST /create_order,
 * GET /status_by_cid/{id} | /status_by_invoice/{invoice} | /status_by_trackingcode/{code}, GET /get_balance.
 */
async function api<T = any>(path: string, init: RequestInit = {}): Promise<T> {
  const c = await courierCreds("steadfast");
  const res = await fetch(`${c.baseUrl}${path}`, {
    ...init,
    headers: { "Api-Key": c.apiKey, "Secret-Key": c.secretKey, "Content-Type": "application/json", Accept: "application/json", ...(init.headers ?? {}) },
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });
  const data = (await res.json().catch(() => ({}))) as any;
  if (!res.ok || (data.status && Number(data.status) >= 400)) throw new Error(`Steadfast ${path} → ${data.status ?? res.status}: ${data.message ?? JSON.stringify(data.errors ?? "").slice(0, 200)}`);
  return data as T;
}

const STATUS_MAP: Record<string, ShipmentStatus> = {
  in_review: "booked",
  pending: "in_transit",
  hold: "in_transit",
  delivered: "delivered",
  partial_delivered: "delivered",
  delivered_approval_pending: "delivered",
  partial_delivered_approval_pending: "delivered",
  cancelled: "cancelled",
  cancelled_approval_pending: "cancelled",
  unknown: "unknown",
  unknown_approval_pending: "unknown",
};
export const mapSteadfastStatus = (s: string): ShipmentStatus => STATUS_MAP[s?.toLowerCase()] ?? "unknown";

export const steadfast: CourierAdapter = {
  provider: "steadfast",
  async isConfigured() {
    const c = await courierCreds("steadfast");
    return Boolean(c.apiKey && c.secretKey);
  },
  async createConsignment(input: ConsignmentInput): Promise<ConsignmentResult> {
    const body = {
      invoice: input.orderNumber,
      recipient_name: input.recipientName.slice(0, 100),
      recipient_phone: input.recipientPhone,
      recipient_address: [input.address, input.area, input.upazila, input.district, input.postcode].filter(Boolean).join(", ").slice(0, 250),
      cod_amount: Math.max(0, Math.round(input.codAmount)),
      note: input.note?.slice(0, 480),
      item_description: input.itemDescription.slice(0, 200),
      total_lot: input.quantity,
      delivery_type: 0,
    };
    const data = await api<any>("/create_order", { method: "POST", body: JSON.stringify(body) });
    const c = data.consignment ?? {};
    return {
      consignmentId: String(c.consignment_id),
      trackingCode: c.tracking_code,
      trackingUrl: c.tracking_code ? `https://steadfast.com.bd/t/${c.tracking_code}` : undefined,
      status: mapSteadfastStatus(c.status ?? "in_review"),
      rawStatus: c.status,
      raw: data,
    };
  },
  async track(consignmentId, trackingCode): Promise<TrackingResult> {
    const data = trackingCode ? await api<any>(`/status_by_trackingcode/${encodeURIComponent(trackingCode)}`) : await api<any>(`/status_by_cid/${encodeURIComponent(consignmentId)}`);
    const raw = data.delivery_status ?? "unknown";
    return { status: mapSteadfastStatus(raw), rawStatus: String(raw), raw: data };
  },
};
