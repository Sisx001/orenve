import type { CourierProvider } from "@/lib/constants";

export type ShipmentStatus = "booked" | "picked" | "in_transit" | "delivered" | "returned" | "cancelled" | "failed" | "unknown";

export type ConsignmentInput = {
  orderId: string;
  orderNumber: string;
  recipientName: string;
  recipientPhone: string; // 11-digit local format 01XXXXXXXXX
  address: string; // full single-line address
  district: string;
  upazila?: string;
  area?: string;
  postcode?: string;
  codAmount: number; // BDT major units (0 for prepaid)
  itemDescription: string;
  quantity: number;
  weightKg: number;
  note?: string;
  /** provider-specific location ids chosen in the studio (Pathao city/zone/area, RedX area) */
  providerLocation?: Record<string, string | number>;
};

export type ConsignmentResult = {
  consignmentId: string;
  trackingCode?: string;
  trackingUrl?: string;
  status: ShipmentStatus;
  rawStatus?: string;
  deliveryFee?: number; // BDT major
  raw: unknown;
};

export type TrackingResult = { status: ShipmentStatus; rawStatus: string; raw: unknown; updatedAt?: string };

export interface CourierAdapter {
  provider: CourierProvider;
  /** true when the required keys exist (env or studio settings) */
  isConfigured(): Promise<boolean>;
  createConsignment(input: ConsignmentInput): Promise<ConsignmentResult>;
  track(consignmentId: string, trackingCode?: string): Promise<TrackingResult>;
  cancel?(consignmentId: string): Promise<boolean>;
  /** optional delivery price quote */
  quote?(input: Pick<ConsignmentInput, "district" | "weightKg" | "codAmount" | "providerLocation">): Promise<{ fee: number; codFee?: number; raw: unknown } | null>;
  /** optional provider location lists for the studio pickers */
  locations?(level: "cities" | "zones" | "areas", parentId?: string | number): Promise<{ id: string | number; name: string }[]>;
}

export type CourierCredentials = {
  pathao: { baseUrl: string; clientId: string; clientSecret: string; username: string; password: string; storeId: string };
  steadfast: { baseUrl: string; apiKey: string; secretKey: string };
  redx: { baseUrl: string; accessToken: string; pickupStoreId: string };
  paperfly: { baseUrl: string; username: string; password: string; merchantKey: string };
};
