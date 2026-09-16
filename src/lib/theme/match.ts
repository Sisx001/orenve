/**
 * Path-pattern matching for `ThemeAssignment.pathPattern`. Environment-neutral:
 * the server resolver and the client `PageThemeSwitch` must agree exactly.
 *
 *   "*"                → every path
 *   "/collections/*"   → /collections and anything below it
 *   "/shop"            → exactly /shop
 *
 * The locale prefix is stripped and trailing slashes are dropped before
 * comparison, so "/bn/shop/" and "/shop" match the same patterns.
 */
import { stripLocale } from "@/lib/i18n";

export function normalisePath(path: string): string {
  const clean = (path || "/").split("?")[0].split("#")[0];
  const stripped = stripLocale(clean) || "/";
  return stripped.length > 1 ? stripped.replace(/\/+$/, "") : "/";
}

/** A pattern that applies to the whole storefront — resolved server-side. */
export function isGlobalPattern(pattern: string): boolean {
  const raw = (pattern ?? "").trim();
  return !raw || raw === "*" || raw === "/*";
}

export function pathMatches(pattern: string, path: string): boolean {
  const raw = (pattern ?? "").trim();
  if (isGlobalPattern(raw)) return true;
  const p = normalisePath(path);
  if (raw.endsWith("/*")) {
    const prefix = normalisePath(raw.slice(0, -2));
    return p === prefix || p.startsWith(`${prefix}/`);
  }
  return p === normalisePath(raw);
}
