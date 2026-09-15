import type { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getClientIp } from "@/lib/request";
import { rateLimit } from "@/lib/ratelimit";
import { getSetting } from "@/lib/settings";
import { handleError, jsonError, jsonOk } from "@/lib/api-server";

export const runtime = "nodejs";
const schema = z.object({ email: z.string().trim().email().max(160), locale: z.string().default("en"), website: z.string().max(0).optional() });

export async function POST(req: NextRequest) {
  try {
    const rl = await rateLimit("newsletter", getClientIp(req.headers), 10, 3600);
    if (!rl.ok) return jsonError("errors.rateLimited", 429);
    const features = await getSetting("features");
    if (!features.newsletter) return jsonError("errors.notFound", 404);
    const { email, locale, website } = schema.parse(await req.json());
    if (website) return jsonOk({});
    await db.subscriber.upsert({ where: { email: email.toLowerCase() }, update: { locale }, create: { email: email.toLowerCase(), locale, source: "storefront" } });
    return jsonOk({});
  } catch (e) {
    return handleError(e);
  }
}
