import "server-only";
import { ZodError } from "zod";
import { requireUser, AuthError, type SessionUser } from "@/lib/auth/session";
import { verifyCsrf } from "@/lib/auth/csrf";
import { revalidatePath } from "next/cache";
import { fail, idleState, succeed, type ActionState } from "@/lib/admin/action-state";

/**
 * Server-only half of the studio action contract: permission + CSRF checks,
 * error funnelling and revalidation.
 *
 * The result *shape* (`ActionState`, `idleState`, `fail`, `succeed`) lives in
 * `@/lib/admin/action-state` so client components can import it. It is
 * re-exported here for the server actions that already depend on this module.
 */
export { fail, idleState, succeed };
export type { ActionState };

/** Turn a ZodError into per-field messages for inline display. */
export function zodFieldErrors(e: ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of e.issues) {
    const key = issue.path.join(".") || "_form";
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

/**
 * Authorise a form submission: permission check + double-submit CSRF.
 * Throws so callers can wrap in `runAction`.
 */
export async function authorize(permission: string, fd: FormData): Promise<SessionUser> {
  const user = await requireUser(permission);
  const okCsrf = await verifyCsrf(fd.get("_csrf") as string | null);
  if (!okCsrf) throw new AuthError("Your session expired — reload the page and try again.", 403);
  return user;
}

/** Wrap an action body so thrown errors become ActionState instead of a crash. */
export async function runAction(fn: () => Promise<ActionState>): Promise<ActionState> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof ZodError) {
      const fieldErrors = zodFieldErrors(e);
      return { ok: false, error: fieldErrors._form ?? "Please check the highlighted fields.", fieldErrors };
    }
    if (e instanceof AuthError) return { ok: false, error: e.message };
    // Next's redirect()/notFound() signal through thrown objects — let them bubble.
    if (e && typeof e === "object" && "digest" in e && typeof (e as { digest?: unknown }).digest === "string") throw e;
    if (e && typeof e === "object" && "code" in e) {
      const code = String((e as { code?: unknown }).code);
      if (code === "P2002") return { ok: false, error: "That value is already taken — pick another." };
      if (code === "P2025") return { ok: false, error: "That record no longer exists." };
    }
    console.error("[admin action]", e);
    return { ok: false, error: e instanceof Error ? e.message : "Something went wrong." };
  }
}

/** Revalidate the studio path plus the whole storefront tree. */
export function revalidateStudio(...paths: string[]) {
  for (const p of paths) revalidatePath(p);
  revalidatePath("/", "layout");
}
