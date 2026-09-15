import "server-only";
import { cookies } from "next/headers";
import { COOKIE_CSRF } from "@/lib/constants";

/**
 * Read-only CSRF token for server-rendered studio pages.
 *
 * Next 15 forbids writing cookies while rendering, so pages can only *read*
 * the double-submit token. When it is missing the client `<CsrfInput/>` mints
 * one through GET /api/csrf before the first submit.
 */
export async function csrfToken(): Promise<string> {
  const jar = await cookies();
  return jar.get(COOKIE_CSRF)?.value ?? "";
}
