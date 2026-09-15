/**
 * Client-side JSON fetch with double-submit CSRF.
 *
 * Mirrors `apiFetch` from src/lib/api.ts, but without importing that module:
 * src/lib/api.ts also exports the route-handler helpers, which pull in
 * "server-only" code through @/lib/auth/session and therefore cannot be
 * bundled into a client component.
 *
 * Thrown errors carry the API's i18n key as `message` plus optional `vars`,
 * so callers render them with `t(err.message, err.vars)`.
 */
export type ApiError = Error & {
  vars?: Record<string, string | number>;
  status: number;
  issues?: { path: string; message: string }[];
};

export function readCsrfCookie(): string {
  if (typeof document === "undefined") return "";
  const m = document.cookie.match(/(?:^|; )ory_csrf=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : "";
}

/**
 * Cookies cannot be written while rendering a Server Component in Next 15, so
 * the token is minted lazily by GET /api/csrf the first time it is needed.
 */
let csrfBootstrap: Promise<string> | null = null;
async function ensureCsrfToken(): Promise<string> {
  const existing = readCsrfCookie();
  if (existing) return existing;
  csrfBootstrap ??= fetch("/api/csrf", { credentials: "same-origin" })
    .then(() => readCsrfCookie())
    .catch(() => "")
    .finally(() => {
      csrfBootstrap = null;
    });
  return csrfBootstrap;
}

export async function apiFetch<T = unknown>(url: string, init: RequestInit & { json?: unknown } = {}): Promise<T & { ok: true }> {
  const headers: Record<string, string> = { ...((init.headers as Record<string, string> | undefined) ?? {}) };
  let body = init.body;
  if (init.json !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(init.json);
  }
  if ((init.method ?? "GET").toUpperCase() !== "GET") headers["x-csrf-token"] = await ensureCsrfToken();

  const res = await fetch(url, { ...init, headers, body, credentials: "same-origin" });
  const data = (await res.json().catch(() => ({ ok: false, error: "common.somethingWrong" }))) as {
    ok?: boolean;
    error?: string;
    vars?: Record<string, string | number>;
    issues?: { path: string; message: string }[];
  };

  if (!res.ok || !data.ok) {
    const err = new Error(data.error ?? "common.somethingWrong") as ApiError;
    err.vars = data.vars;
    err.status = res.status;
    err.issues = data.issues;
    throw err;
  }
  return data as T & { ok: true };
}
