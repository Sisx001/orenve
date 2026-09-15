import "server-only";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AuthError } from "@/lib/auth/session";

/** Consistent JSON error envelope for route handlers. */
export function jsonError(message: string, status = 400, extra: Record<string, unknown> = {}) {
  return NextResponse.json({ ok: false, error: message, ...extra }, { status });
}

export function jsonOk<T extends Record<string, unknown>>(data: T, init?: ResponseInit) {
  return NextResponse.json({ ok: true, ...data }, init);
}

export function handleError(e: unknown) {
  if (e instanceof ZodError) return jsonError("errors.invalidInput", 422, { issues: e.issues.map((i) => ({ path: i.path.join("."), message: i.message })) });
  if (e instanceof AuthError) return jsonError(e.message, e.status);
  if (e && typeof e === "object" && "code" in e && typeof (e as any).code === "string" && (e as any).code.includes(".")) {
    const err = e as { code: string; vars?: Record<string, string | number> };
    return jsonError(err.code, 409, { vars: err.vars ?? {} });
  }
  console.error(e);
  return jsonError("common.somethingWrong", 500);
}
