import "server-only";
import { createHash } from "node:crypto";
import { db } from "@/lib/db";

/**
 * Fixed-window rate limiter backed by the database (works on serverless where
 * memory is not shared) with an in-memory fast path for hot processes.
 */
type Bucket = { count: number; windowStart: number };
const memory = new Map<string, Bucket>();

export type RateLimitResult = { ok: boolean; remaining: number; retryAfterSec: number };

export async function rateLimit(scope: string, identifier: string, limit: number, windowSec: number): Promise<RateLimitResult> {
  const key = createHash("sha256").update(`${scope}:${identifier}`).digest("hex");
  const now = Date.now();
  const windowMs = windowSec * 1000;

  const mem = memory.get(key);
  if (mem && now - mem.windowStart < windowMs) {
    mem.count++;
    if (mem.count > limit) {
      return { ok: false, remaining: 0, retryAfterSec: Math.ceil((mem.windowStart + windowMs - now) / 1000) };
    }
  } else {
    memory.set(key, { count: 1, windowStart: now });
  }
  if (memory.size > 5000) memory.clear();

  try {
    const row = await db.rateEvent.findUnique({ where: { key } });
    if (!row || now - row.windowStart.getTime() >= windowMs) {
      await db.rateEvent.upsert({
        where: { key },
        update: { count: 1, windowStart: new Date(now) },
        create: { key, count: 1, windowStart: new Date(now) },
      });
      return { ok: true, remaining: limit - 1, retryAfterSec: 0 };
    }
    const updated = await db.rateEvent.update({ where: { key }, data: { count: { increment: 1 } } });
    if (updated.count > limit) {
      return {
        ok: false,
        remaining: 0,
        retryAfterSec: Math.ceil((row.windowStart.getTime() + windowMs - now) / 1000),
      };
    }
    return { ok: true, remaining: limit - updated.count, retryAfterSec: 0 };
  } catch {
    // DB hiccup: fall back to the memory verdict rather than failing open forever.
    return { ok: true, remaining: 0, retryAfterSec: 0 };
  }
}

/** Periodic cleanup (called opportunistically from admin pages). */
export async function cleanupRateEvents(olderThanSec = 3600) {
  await db.rateEvent.deleteMany({ where: { windowStart: { lt: new Date(Date.now() - olderThanSec * 1000) } } });
}
