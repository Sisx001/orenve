import "server-only";
import { getSetting } from "@/lib/settings";
import type { CourierCredentials } from "./types";

/**
 * Credentials come from the studio (Settings → Couriers) first, then env vars.
 * Sandbox toggles switch base URLs.
 */
export async function courierCreds<K extends keyof CourierCredentials>(provider: K): Promise<CourierCredentials[K]> {
  const s = await getSetting("courier");
  const env = process.env;
  switch (provider) {
    case "pathao": {
      const p = s.pathao;
      return {
        baseUrl: (p.baseUrl || (p.sandbox ? "https://courier-api-sandbox.pathao.com" : "https://api-hermes.pathao.com")).replace(/\/$/, ""),
        clientId: p.clientId || env.PATHAO_CLIENT_ID || "",
        clientSecret: p.clientSecret || env.PATHAO_CLIENT_SECRET || "",
        username: p.username || env.PATHAO_USERNAME || "",
        password: p.password || env.PATHAO_PASSWORD || "",
        storeId: p.storeId || env.PATHAO_STORE_ID || "",
      } as CourierCredentials[K];
    }
    case "steadfast": {
      const p = s.steadfast;
      return { baseUrl: (p.baseUrl || "https://portal.packzy.com/api/v1").replace(/\/$/, ""), apiKey: p.apiKey || env.STEADFAST_API_KEY || "", secretKey: p.secretKey || env.STEADFAST_SECRET_KEY || "" } as CourierCredentials[K];
    }
    case "redx": {
      const p = s.redx;
      return {
        baseUrl: (p.baseUrl || (p.sandbox ? "https://sandbox.redx.com.bd/v1.0.0-beta" : "https://openapi.redx.com.bd/v1.0.0-beta")).replace(/\/$/, ""),
        accessToken: p.accessToken || env.REDX_ACCESS_TOKEN || "",
        pickupStoreId: p.pickupStoreId || env.REDX_PICKUP_STORE_ID || "",
      } as CourierCredentials[K];
    }
    case "paperfly": {
      const p = s.paperfly;
      return { baseUrl: (p.baseUrl || "https://api.paperfly.com.bd").replace(/\/$/, ""), username: p.username || env.PAPERFLY_USERNAME || "", password: p.password || env.PAPERFLY_PASSWORD || "", merchantKey: p.merchantKey || env.PAPERFLY_KEY || "" } as CourierCredentials[K];
    }
  }
  throw new Error(`Unknown courier ${provider}`);
}
