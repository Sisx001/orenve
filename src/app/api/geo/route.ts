import type { NextRequest } from "next/server";
import { getGeoData } from "@/lib/geo/service";
import { getAreas, getDistricts, getDivisions, getPostcodes, getUpazilas, searchGeo } from "@/lib/geo/bd";
import { jsonOk, handleError } from "@/lib/api-server";

export const runtime = "nodejs";

/**
 * GET /api/geo?level=divisions
 * GET /api/geo?level=districts&division=3
 * GET /api/geo?level=upazilas&district=1
 * GET /api/geo?level=areas&district=1
 * GET /api/geo?level=postcodes&district=1&upazila=Gulshan
 * GET /api/geo?q=mirpur           (free text search, EN/BN/postcode)
 */
export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const data = await getGeoData();
    const q = sp.get("q");
    if (q) return jsonOk({ results: searchGeo(q, 15, data) }, { headers: { "Cache-Control": "public, max-age=3600" } });
    const level = sp.get("level") ?? "divisions";
    const headers = { "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800" };
    switch (level) {
      case "divisions":
        return jsonOk({ items: getDivisions(data) }, { headers });
      case "districts":
        return jsonOk({ items: getDistricts(sp.get("division") ?? undefined, data) }, { headers });
      case "upazilas":
        return jsonOk({ items: getUpazilas(sp.get("district") ?? "", data) }, { headers });
      case "areas":
        return jsonOk({ items: getAreas(sp.get("district") ?? "", data) }, { headers });
      case "postcodes":
        return jsonOk({ items: getPostcodes(sp.get("district") ?? "", sp.get("upazila") ?? undefined, data) }, { headers });
      default:
        return jsonOk({ items: [] }, { headers });
    }
  } catch (e) {
    return handleError(e);
  }
}
