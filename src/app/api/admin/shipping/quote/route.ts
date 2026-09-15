import type { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { handleError, jsonOk } from "@/lib/api-server";
import { resolveZoneRate } from "@/lib/admin/queries";

/** Shipping rate for a district, used to prefill manual orders. */
export async function GET(req: NextRequest) {
  try {
    await requireUser("orders.write");
    const district = req.nextUrl.searchParams.get("district") ?? "";
    const subtotal = Number(req.nextUrl.searchParams.get("subtotal") ?? "0") || 0;
    if (!district) return jsonOk({ rate: 0, name: "No district", zoneId: null });
    const zone = await resolveZoneRate(district, subtotal);
    return jsonOk({ rate: zone.rate, name: zone.name, zoneId: zone.zoneId });
  } catch (e) {
    return handleError(e);
  }
}
