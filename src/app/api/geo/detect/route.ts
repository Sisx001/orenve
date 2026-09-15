import type { NextRequest } from "next/server";
import { z } from "zod";
import { getClientIp } from "@/lib/request";
import { rateLimit } from "@/lib/ratelimit";
import { getGeoData, lookupIp } from "@/lib/geo/service";
import { findDistrictByName, nearestDistrict } from "@/lib/geo/bd";
import { handleError, jsonError, jsonOk } from "@/lib/api-server";

export const runtime = "nodejs";

const bodySchema = z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) }).partial();

/**
 * Address auto-detect for checkout.
 *  GET  /api/geo/detect          → IP-based guess (country, district)
 *  POST /api/geo/detect {lat,lng} → browser geolocation → nearest district
 * Never blocks checkout: returns { detected: null } on any failure.
 */
export async function GET(req: NextRequest) {
  try {
    const ip = getClientIp(req.headers);
    const rl = await rateLimit("geo-detect", ip, 30, 3600);
    if (!rl.ok) return jsonError("errors.rateLimited", 429);
    const data = await getGeoData();
    const hit = await lookupIp(ip);
    if (!hit) return jsonOk({ detected: null, source: "ip" });
    let district = hit.city ? findDistrictByName(hit.city, data) : undefined;
    if (!district && hit.region) district = findDistrictByName(hit.region, data);
    if (!district && hit.lat && hit.lng && hit.country === "BD") district = nearestDistrict(hit.lat, hit.lng, data)?.district ?? undefined;
    return jsonOk({
      detected: hit.country === "BD" && district ? { country: "BD", districtId: district.id, district: district.en, divisionId: district.divisionId, confidence: "low" } : { country: hit.country ?? null },
      source: "ip",
    });
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req.headers);
    const rl = await rateLimit("geo-detect", ip, 30, 3600);
    if (!rl.ok) return jsonError("errors.rateLimited", 429);
    const { lat, lng } = bodySchema.parse(await req.json());
    if (lat === undefined || lng === undefined) return jsonOk({ detected: null, source: "gps" });
    const data = await getGeoData();
    const near = nearestDistrict(lat, lng, data);
    if (!near || near.approxKm > 80) return jsonOk({ detected: null, source: "gps" });
    return jsonOk({ detected: { country: "BD", districtId: near.district.id, district: near.district.en, divisionId: near.district.divisionId, confidence: near.approxKm < 25 ? "high" : "medium", approxKm: Math.round(near.approxKm) }, source: "gps" });
  } catch (e) {
    return handleError(e);
  }
}
