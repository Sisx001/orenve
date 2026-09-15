import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { syncShipment } from "@/lib/couriers";
import { getSetting } from "@/lib/settings";
import { jsonError, jsonOk } from "@/lib/api-server";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * GET /api/cron/sync-shipments?key=CRON_SECRET
 * Polls open shipments and writes timeline events. Point any scheduler at it:
 * Vercel Cron (vercel.json), Railway cron, cPanel cron (curl), or GitHub Actions.
 * Also runs opportunistically from the studio dashboard when autoSyncMinutes elapsed.
 */
export async function GET(req: NextRequest) {
  const key = req.nextUrl.searchParams.get("key") ?? req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const secret = process.env.CRON_SECRET;
  if (!secret || key !== secret) return jsonError("errors.forbidden", 403);
  const courier = await getSetting("courier");
  const open = await db.shipment.findMany({
    where: { provider: { not: "manual" }, status: { in: ["booked", "picked", "in_transit", "failed"] } },
    orderBy: { lastSyncedAt: "asc" },
    take: 40,
  });
  const results: { id: string; status: string; error?: string }[] = [];
  for (const s of open) {
    try {
      const u = await syncShipment(s.id);
      results.push({ id: s.id, status: u.status });
    } catch (e: any) {
      results.push({ id: s.id, status: s.status, error: String(e?.message ?? e).slice(0, 160) });
    }
  }
  return jsonOk({ synced: results.length, intervalMinutes: courier.autoSyncMinutes, results });
}
