import "server-only";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { getClientIp } from "@/lib/request";
import { toJson } from "@/lib/json";

export async function audit(
  userId: string | null | undefined,
  action: string,
  entity: string,
  entityId?: string | null,
  meta?: Record<string, unknown>,
) {
  try {
    const h = await headers();
    await db.auditLog.create({
      data: {
        userId: userId ?? null,
        action,
        entity,
        entityId: entityId ?? null,
        meta: meta ? toJson(meta) : null,
        ip: getClientIp(h),
      },
    });
  } catch {
    /* auditing must never break the request */
  }
}
