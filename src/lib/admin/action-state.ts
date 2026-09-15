/**
 * Client-safe form-action contract.
 *
 * `src/lib/admin/guard.ts` is server-only (it imports `server-only`,
 * `next/cache` and the session/CSRF modules), but client components need the
 * *shape* of an action result to seed `useActionState`. Those pieces live here
 * so a `"use client"` file can import them without dragging server code into
 * the browser bundle — which is a hard `next build` failure.
 *
 * Server actions keep importing from `guard.ts`, which re-exports everything
 * below.
 */

/** Uniform shape every studio form action returns, consumed by useActionState. */
export type ActionState = {
  ok?: boolean;
  error?: string | null;
  message?: string | null;
  /** field name → message */
  fieldErrors?: Record<string, string>;
  /** opaque payload (new id, generated password, tracking code…) */
  data?: Record<string, string> | null;
};

/** Initial value for `useActionState` — nothing submitted yet. */
export const idleState: ActionState = {};

export function fail(error: string, fieldErrors?: Record<string, string>): ActionState {
  return { ok: false, error, fieldErrors };
}

export function succeed(message?: string, data?: Record<string, string>): ActionState {
  return { ok: true, message: message ?? "Saved.", data: data ?? null };
}
