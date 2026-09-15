import "server-only";
import type { CourierAdapter, ConsignmentInput, ConsignmentResult, ShipmentStatus, TrackingResult } from "./types";
import { courierCreds } from "./credentials";

/**
 * Paperfly merchant API (https://api.paperfly.com.bd). Basic-auth style username/password
 * plus a merchant key header. Endpoints: POST /OrderPlacement, POST /API-Order-Tracking.
 * Field names follow Paperfly's published merchant integration sheet; adjust in the
 * studio if your account uses a newer schema.
 */
async function api<T = any>(path: string, body: unknown): Promise<T> {
  const c = await courierCreds("paperfly");
  const res = await fetch(`${c.baseUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json", paperflykey: c.merchantKey, Authorization: `Basic ${Buffer.from(`${c.username}:${c.password}`).toString("base64")}` },
    body: JSON.stringify(body),
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });
  const data = (await res.json().catch(() => ({}))) as any;
  if (!res.ok || data.response_code === "error" || data.error) throw new Error(`Paperfly ${path} → ${res.status}: ${data.message ?? data.error ?? ""}`.slice(0, 250));
  return data as T;
}

const STATUS_MAP: Record<string, ShipmentStatus> = {
  "order placed": "booked",
  "picked up": "picked",
  "in transit": "in_transit",
  "out for delivery": "in_transit",
  delivered: "delivered",
  "partially delivered": "delivered",
  returned: "returned",
  "return in progress": "returned",
  cancelled: "cancelled",
  hold: "in_transit",
};
export const mapPaperflyStatus = (s: string): ShipmentStatus => STATUS_MAP[s?.toLowerCase()] ?? "unknown";

export const paperfly: CourierAdapter = {
  provider: "paperfly",
  async isConfigured() {
    const c = await courierCreds("paperfly");
    return Boolean(c.username && c.password && c.merchantKey);
  },
  async createConsignment(input: ConsignmentInput): Promise<ConsignmentResult> {
    const body = {
      merOrderRef: input.orderNumber,
      pickMerchantName: "",
      productSizeWeight: input.weightKg <= 1 ? "standard" : "large",
      productBrief: input.itemDescription.slice(0, 200),
      packagePrice: String(Math.max(0, Math.round(input.codAmount))),
      max_weight: String(input.weightKg),
      deliveryOption: "regular",
      custname: input.recipientName.slice(0, 100),
      custaddress: [input.address, input.area].filter(Boolean).join(", ").slice(0, 250),
      customerThana: input.upazila ?? input.district,
      customerDistrict: input.district,
      custPhone: input.recipientPhone,
      instruction: input.note ?? "",
    };
    const data = await api<any>("/OrderPlacement", body);
    const id = String(data.success?.tracking_number ?? data.tracking_number ?? data.orderRef ?? input.orderNumber);
    return { consignmentId: id, trackingCode: id, trackingUrl: `https://paperfly.com.bd/tracking?trackingNumber=${id}`, status: "booked", rawStatus: "order placed", raw: data };
  },
  async track(consignmentId): Promise<TrackingResult> {
    const data = await api<any>("/API-Order-Tracking", { ReferenceNumber: consignmentId });
    const raw = String(data.success?.status ?? data.status ?? data.orderStatus ?? "unknown");
    return { status: mapPaperflyStatus(raw), rawStatus: raw, raw: data };
  },
};
