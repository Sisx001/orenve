import en from "../../../messages/en.json";
import bn from "../../../messages/bn.json";
import { DEFAULT_LOCALE, SUPPORTED_LOCALES } from "@/lib/constants";

export type Locale = string;
export type Dictionary = typeof en;

const BUILT_IN: Record<string, Record<string, unknown>> = { en, bn };

export const localeMeta: Record<string, { name: string; nativeName: string; dir: "ltr" | "rtl"; flag: string }> = {
  en: { name: "English", nativeName: "English", dir: "ltr", flag: "🇬🇧" },
  bn: { name: "Bangla", nativeName: "বাংলা", dir: "ltr", flag: "🇧🇩" },
  // Add more locales here + a messages/<code>.json file (or via the studio translations editor).
};

export function isSupportedLocale(l: string | undefined | null): l is Locale {
  return !!l && (SUPPORTED_LOCALES as readonly string[]).includes(l);
}

export function normalizeLocale(l: string | undefined | null): Locale {
  if (!l) return DEFAULT_LOCALE;
  const short = l.toLowerCase().split(/[-_]/)[0];
  return isSupportedLocale(short) ? short : DEFAULT_LOCALE;
}

function deepGet(obj: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, k) => (acc && typeof acc === "object" ? (acc as any)[k] : undefined), obj);
}

function deepMerge<T extends Record<string, any>>(base: T, override: Record<string, any>): T {
  const out: Record<string, any> = { ...base };
  for (const [k, v] of Object.entries(override)) {
    out[k] = v && typeof v === "object" && !Array.isArray(v) ? deepMerge(out[k] ?? {}, v) : v;
  }
  return out as T;
}

/** Build a dictionary for a locale with English fallback and optional DB overrides. */
export function buildDictionary(locale: Locale, overrides: Record<string, string> = {}): Dictionary {
  const base = deepMerge(en as Record<string, any>, BUILT_IN[locale] ?? {});
  const withOverrides = { ...base } as Record<string, any>;
  for (const [key, value] of Object.entries(overrides)) {
    const parts = key.split(".");
    let cur = withOverrides;
    for (let i = 0; i < parts.length - 1; i++) {
      cur[parts[i]] = { ...(cur[parts[i]] ?? {}) };
      cur = cur[parts[i]];
    }
    cur[parts[parts.length - 1]] = value;
  }
  return withOverrides as Dictionary;
}

export type Translator = ((key: string, vars?: Record<string, string | number>) => string) & { locale: Locale; dict: Dictionary };

export function createTranslator(locale: Locale, dict: Dictionary): Translator {
  const t = ((key: string, vars?: Record<string, string | number>) => {
    let value = deepGet(dict, key);
    if (typeof value !== "string") value = deepGet(en, key);
    if (typeof value !== "string") return key;
    if (vars) {
      for (const [k, v] of Object.entries(vars)) value = (value as string).replaceAll(`{${k}}`, String(v));
    }
    return value as string;
  }) as Translator;
  t.locale = locale;
  t.dict = dict;
  return t;
}

export function localizedPath(path: string, locale: Locale) {
  const clean = path.replace(/^\/(en|bn)(?=\/|$)/, "") || "/";
  return `/${locale}${clean === "/" ? "" : clean}`;
}

export function stripLocale(pathname: string) {
  return pathname.replace(/^\/(en|bn)(?=\/|$)/, "") || "/";
}

export { en as defaultDictionary };
