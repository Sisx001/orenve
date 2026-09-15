/**
 * Helpers for the JSON-in-String columns used for cross-database portability.
 */
export function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (value === null || value === undefined || value === "") return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export function toJson(value: unknown): string {
  return JSON.stringify(value ?? null);
}

/** i18n string stored as {"en":"…","bn":"…"} (or a plain string for legacy). */
export type I18nString = Record<string, string>;

export function parseI18n(value: string | null | undefined): I18nString {
  if (!value) return {};
  if (!value.trim().startsWith("{")) return { en: value };
  return parseJson<I18nString>(value, { en: value });
}

export function i18nText(value: string | null | undefined | I18nString, locale: string, fallbackLocale = "en"): string {
  const obj = typeof value === "string" || value == null ? parseI18n(value) : value;
  return obj[locale] ?? obj[fallbackLocale] ?? Object.values(obj)[0] ?? "";
}
