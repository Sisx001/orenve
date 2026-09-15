/**
 * Client-safe API helpers (no server-only imports). Route handlers use
 * src/lib/api-server.ts for the response envelope.
 */

/** Read the CSRF token from the cookie on the client. */
export function readCsrfCookie(): string {
  if (typeof document === "undefined") return "";
  const m = document.cookie.match(/(?:^|; )ory_csrf=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : "";
}

/** Ensure a CSRF cookie exists (layouts cannot set cookies in Next 15, so it is minted lazily). */
export async function ensureCsrf(): Promise<string> {
  const existing = readCsrfCookie();
  if (existing) return existing;
  try {
    const res = await fetch("/api/csrf", { credentials: "same-origin", cache: "no-store" });
    const data = await res.json().catch(() => ({}));
    return (data?.token as string) || readCsrfCookie();
  } catch {
    return readCsrfCookie();
  }
}

export type ApiError = Error & { vars?: Record<string, string | number>; status: number; issues?: unknown };

/** Client helper: JSON fetch with CSRF header and typed envelope. Errors carry an i18n key in `message`. */
export async function apiFetch<T = any>(url: string, init: RequestInit & { json?: unknown } = {}): Promise<T & { ok: true }> {
  const headers: Record<string, string> = { ...(init.headers as Record<string, string>) };
  let body = init.body;
  if (init.json !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(init.json);
  }
  if ((init.method ?? "GET").toUpperCase() !== "GET") headers["x-csrf-token"] = await ensureCsrf();
  const res = await fetch(url, { ...init, headers, body, credentials: "same-origin" });
  const data = await res.json().catch(() => ({ ok: false, error: "common.somethingWrong" }));
  if (!res.ok || !data.ok) {
    const err = new Error(data.error ?? "common.somethingWrong") as ApiError;
    err.vars = data.vars;
    err.status = res.status;
    err.issues = data.issues;
    throw err;
  }
  return data;
}
