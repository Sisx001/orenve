import "server-only";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies, headers } from "next/headers";
import { COOKIE_CSRF } from "@/lib/constants";

/**
 * Double-submit CSRF: a random signed token in a cookie, echoed back in the
 * `x-csrf-token` header (fetch) or `_csrf` form field (server actions/forms).
 * Mutating requests must additionally carry an Origin/Referer matching APP_URL.
 *
 * Next 15 only allows cookie writes in Server Actions and Route Handlers, so
 * `getCsrfToken()` returns the existing token when called from a layout/page
 * and the client mints one lazily via GET /api/csrf when missing.
 */
const secret = () => process.env.SESSION_SECRET ?? "dev-secret-change-me";
const sign = (v: string) => createHmac("sha256", secret()).update(v).digest("base64url");

export function mintCsrfToken(): string {
  const raw = randomBytes(24).toString("base64url");
  return `${raw}.${sign(raw)}`;
}

export function csrfCookieOptions() {
  return {
    httpOnly: false as const, // readable by the client to echo in a header
    sameSite: "lax" as const,
    secure: (process.env.APP_URL ?? "").startsWith("https://"),
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  };
}

/** Returns the current token; tries to set one (works in actions/route handlers, silently no-ops elsewhere). */
export async function getCsrfToken(): Promise<string> {
  const jar = await cookies();
  const existing = jar.get(COOKIE_CSRF)?.value;
  if (existing && validToken(existing)) return existing;
  const token = mintCsrfToken();
  try {
    jar.set(COOKIE_CSRF, token, csrfCookieOptions());
  } catch {
    /* read-only context (layout/page render): the client will call /api/csrf */
  }
  return token;
}

function validToken(token: string | null | undefined) {
  if (!token || !token.includes(".")) return false;
  const [raw, sig] = token.split(".");
  const expected = sign(raw);
  return sig.length === expected.length && timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
}

export async function verifyCsrf(formToken?: string | null): Promise<boolean> {
  const jar = await cookies();
  const h = await headers();
  const cookieToken = jar.get(COOKIE_CSRF)?.value;
  const provided = formToken ?? h.get("x-csrf-token");
  if (!cookieToken || !provided || cookieToken !== provided || !validToken(provided)) return false;

  const appOrigin = new URL(process.env.APP_URL ?? "http://localhost:3000").origin;
  const origin = h.get("origin") ?? (h.get("referer") ? new URL(h.get("referer")!).origin : null);
  if (origin && origin !== appOrigin && process.env.NODE_ENV === "production") return false;
  return true;
}
