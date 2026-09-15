import geo from "@/data/bd-geo.json";

/**
 * Bangladesh administrative geography — divisions → districts → upazilas/thanas,
 * post offices with postcodes, and Dhaka city-corporation areas. Bilingual.
 * Source: ifahimreza/bangladesh-geojson (MIT). Studio-added custom entries are
 * merged on top by src/lib/geo/service.ts.
 */
export type GeoDivision = { id: string; en: string; bn: string; lat: number; lng: number };
export type GeoDistrict = { id: string; divisionId: string; en: string; bn: string; lat: number; lng: number };
export type GeoUpazila = { id: string; districtId: string; en: string; bn: string };
export type GeoPostcode = { divisionId: string; districtId: string; upazila: string; office: string; code: string };
export type GeoArea = { districtId: string; corporation: string; en: string; bn: string };

export type GeoData = {
  divisions: GeoDivision[];
  districts: GeoDistrict[];
  upazilas: GeoUpazila[];
  postcodes: GeoPostcode[];
  dhakaAreas: GeoArea[];
};

export const BD_GEO: GeoData = geo as unknown as GeoData;

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

export function localizedName(item: { en: string; bn: string }, locale: string) {
  return locale === "bn" && item.bn ? item.bn : item.en;
}

export function getDivisions(data: GeoData = BD_GEO) {
  return [...data.divisions].sort((a, b) => a.en.localeCompare(b.en));
}
export function getDistricts(divisionId?: string, data: GeoData = BD_GEO) {
  return data.districts.filter((d) => !divisionId || d.divisionId === divisionId).sort((a, b) => a.en.localeCompare(b.en));
}
export function getUpazilas(districtId: string, data: GeoData = BD_GEO) {
  return data.upazilas.filter((u) => u.districtId === districtId).sort((a, b) => a.en.localeCompare(b.en));
}
export function getAreas(districtId: string, data: GeoData = BD_GEO) {
  return data.dhakaAreas.filter((a) => a.districtId === districtId).sort((a, b) => a.en.localeCompare(b.en));
}
export function getPostcodes(districtId: string, upazila?: string, data: GeoData = BD_GEO) {
  const list = data.postcodes.filter((p) => p.districtId === districtId);
  if (!upazila) return list;
  const n = norm(upazila);
  const exact = list.filter((p) => norm(p.upazila) === n);
  return exact.length ? exact : list.filter((p) => norm(p.upazila).includes(n) || n.includes(norm(p.upazila)));
}
export function findDistrictByName(name: string, data: GeoData = BD_GEO) {
  const n = norm(name);
  const aliases: Record<string, string> = { chittagong: "chattogram", barisal: "barishal", comilla: "cumilla", jessore: "jashore", bogra: "bogura", "cox's bazar": "cox's bazar", coxsbazar: "cox's bazar" };
  const target = aliases[n] ?? n;
  return data.districts.find((d) => norm(d.en) === target || d.bn === name.trim()) ?? data.districts.find((d) => norm(d.en).startsWith(target));
}
export function findDivisionByName(name: string, data: GeoData = BD_GEO) {
  const n = norm(name);
  return data.divisions.find((d) => norm(d.en) === n || d.bn === name.trim());
}

/** Free-text search across every level (EN + BN). */
export function searchGeo(query: string, limit = 12, data: GeoData = BD_GEO) {
  const q = norm(query);
  if (!q) return [];
  const out: { type: "division" | "district" | "upazila" | "area" | "postcode"; label: string; bn: string; districtId?: string; divisionId?: string; code?: string }[] = [];
  for (const d of data.divisions) if (norm(d.en).includes(q) || d.bn.includes(query)) out.push({ type: "division", label: d.en, bn: d.bn, divisionId: d.id });
  for (const d of data.districts) if (norm(d.en).includes(q) || d.bn.includes(query)) out.push({ type: "district", label: d.en, bn: d.bn, districtId: d.id, divisionId: d.divisionId });
  for (const u of data.upazilas) if (norm(u.en).includes(q) || u.bn.includes(query)) out.push({ type: "upazila", label: u.en, bn: u.bn, districtId: u.districtId });
  for (const a of data.dhakaAreas) if (norm(a.en).includes(q) || a.bn.includes(query)) out.push({ type: "area", label: a.en, bn: a.bn, districtId: a.districtId });
  if (/^\d{3,4}$/.test(q)) for (const p of data.postcodes) if (p.code.startsWith(q)) out.push({ type: "postcode", label: `${p.office} ${p.code}`, bn: "", districtId: p.districtId, divisionId: p.divisionId, code: p.code });
  return out.slice(0, limit);
}

/** Nearest district to a coordinate (for geolocation auto-detect). */
export function nearestDistrict(lat: number, lng: number, data: GeoData = BD_GEO) {
  let best: GeoDistrict | null = null;
  let bestD = Infinity;
  for (const d of data.districts) {
    const dl = d.lat - lat;
    const dg = (d.lng - lng) * Math.cos((lat * Math.PI) / 180);
    const dist = dl * dl + dg * dg;
    if (dist < bestD) {
      bestD = dist;
      best = d;
    }
  }
  return best ? { district: best, approxKm: Math.sqrt(bestD) * 111 } : null;
}

export function isValidBdPostcode(code: string, data: GeoData = BD_GEO) {
  return data.postcodes.some((p) => p.code === code.trim());
}
