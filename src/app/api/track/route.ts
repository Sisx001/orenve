import type { NextRequest } from "next/server";
import { z } from "zod";
import { getClientIp } from "@/lib/request";
import { rateLimit } from "@/lib/ratelimit";
import { findOrderForCustomer } from "@/lib/orders/service";
import { handleError, jsonError, jsonOk } from "@/lib/api-server";

export const runtime = "nodejs";

const schema = z.object({ reference: z.string().trim().min(4).max(40), phone: z.string().trim().min(8).max(20), locale: z.string().default("en") });

/** POST /api/track — public order lookup (reference + phone must both match). */
export async function POST(req: NextRequest) {
  try {
    const rl = await rateLimit("track", getClientIp(req.headers), 30, 900);
    if (!rl.ok) return jsonError("errors.rateLimited", 429);
    const { reference, phone, locale } = schema.parse(await req.json());
    const order = await findOrderForCustomer(reference, phone, locale);
    if (!order) return jsonError("tracking.notFound", 404);
    return jsonOk({ order });
  } catch (e) {
    return handleError(e);
  }
}
