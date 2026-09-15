import { getCsrfToken } from "@/lib/auth/csrf";
import { jsonOk } from "@/lib/api-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/csrf — mints the `ory_csrf` double-submit cookie.
 *
 * Next 15 forbids writing cookies while rendering a Server Component, so the
 * storefront layout can only *read* the token. The client fetch helper
 * (src/lib/store/api.ts) calls this once, lazily, before its first mutating
 * request when the cookie is missing.
 */
export async function GET() {
  const token = await getCsrfToken();
  return jsonOk({ token });
}
