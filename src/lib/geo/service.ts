import "server-only";
import { cache } from "react";
import { db } from "@/lib/db";
import { BD_GEO, type GeoData } from "./bd";

/**
 * Bundled dataset + studio overrides (added, renamed or hidden entries).
 * Cached per request; the studio revalidates paths after edits.
 */
export const getGeoData = cache(async (): Promise<GeoData> => {
  let overrides: Awaited<ReturnType<typeof db.geoOverride.findMany>> = [];
  try {
    overrides = await db.geoOverride.findMany();
  } catch {
    return BD_GEO;
  }
  if (!overrides.length) return BD_GEO;

  const data: GeoData = {
    divisions: [...BD_GEO.divisions],
    districts: [...BD_GEO.districts],
    upazilas: [...BD_GEO.upazilas],
    postcodes: [...BD_GEO.postcodes],
    dhakaAreas: [...BD_GEO.dhakaAreas],
  };
  const hidden = new Set(overrides.filter((o) => o.isHidden && o.targetKey).map((o) => `${o.level}:${o.targetKey}`));
  data.districts = data.districts.filter((d) => !hidden.has(`district:${d.id}`));
  data.upazilas = data.upazilas.filter((u) => !hidden.has(`upazila:${u.id}`));
  data.dhakaAreas = data.dhakaAreas.filter((a) => !hidden.has(`area:${a.districtId}:${a.en}`));
  data.postcodes = data.postcodes.filter((p) => !hidden.has(`postcode:${p.code}:${p.office}`));

  for (const o of overrides) {
    if (o.isHidden) continue;
    if (o.level === "district" && o.parentId) data.districts.push({ id: `c_${o.id}`, divisionId: o.parentId, en: o.en, bn: o.bn ?? o.en, lat: o.lat ?? 0, lng: o.lng ?? 0 });
    if (o.level === "upazila" && o.parentId) data.upazilas.push({ id: `c_${o.id}`, districtId: o.parentId, en: o.en, bn: o.bn ?? o.en });
    if (o.level === "area" && o.parentId) data.dhakaAreas.push({ districtId: o.parentId, corporation: "Custom", en: o.en, bn: o.bn ?? o.en });
    if (o.level === "postcode" && o.parentId && o.code) {
      const d = data.districts.find((x) => x.id === o.parentId);
      data.postcodes.push({ divisionId: d?.divisionId ?? "", districtId: o.parentId, upazila: o.en, office: o.en, code: o.code });
    }
  }
  return data;
});

/** Best-effort IP geolocation via a free provider (no key). Returns null offline. */
export async function lookupIp(ip: string): Promise<{ country?: string; city?: string; region?: string; lat?: number; lng?: number } | null> {
  if (!ip || ip === "0.0.0.0" || ip.startsWith("127.") || ip.startsWith("10.") || ip.startsWith("192.168.") || ip === "::1") return null;
  const provider = process.env.IP_GEO_PROVIDER ?? "ipapi";
  try {
    if (provider === "ipapi") {
      const r = await fetch(`https://ipapi.co/${encodeURIComponent(ip)}/json/`, { cache: "no-store", signal: AbortSignal.timeout(2500), headers: { "User-Agent": "orynve/2" } });
      if (!r.ok) return null;
      const j = (await r.json()) as any;
      if (j.error) return null;
      return { country: j.country_code, city: j.city, region: j.region, lat: Number(j.latitude), lng: Number(j.longitude) };
    }
    if (provider === "ip-api") {
      const r = await fetch(`http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,countryCode,regionName,city,lat,lon`, { cache: "no-store", signal: AbortSignal.timeout(2500) });
      const j = (await r.json()) as any;
      if (j.status !== "success") return null;
      return { country: j.countryCode, city: j.city, region: j.regionName, lat: j.lat, lng: j.lon };
    }
  } catch {
    return null;
  }
  return null;
}
