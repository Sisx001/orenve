import type { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getClientIp } from "@/lib/request";
import { rateLimit } from "@/lib/ratelimit";
import { getSetting } from "@/lib/settings";
import { handleError, jsonError, jsonOk } from "@/lib/api-server";

export const runtime = "nodejs";
const schema = z.object({
  productId: z.string().min(1),
  customerName: z.string().trim().min(2).max(80),
  rating: z.number().int().min(1).max(5),
  title: z.string().trim().max(120).optional().or(z.literal("")),
  body: z.string().trim().min(10).max(2000),
  website: z.string().max(0).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const rl = await rateLimit("review", getClientIp(req.headers), 5, 3600);
    if (!rl.ok) return jsonError("errors.rateLimited", 429);
    const features = await getSetting("features");
    if (!features.reviews) return jsonError("errors.notFound", 404);
    const data = schema.parse(await req.json());
    if (data.website) return jsonOk({});
    const product = await db.product.findFirst({ where: { id: data.productId, status: "published" }, select: { id: true } });
    if (!product) return jsonError("errors.notFound", 404);
    await db.review.create({ data: { productId: product.id, customerName: data.customerName, rating: data.rating, title: data.title || null, body: data.body, isApproved: false } });
    return jsonOk({});
  } catch (e) {
    return handleError(e);
  }
}
