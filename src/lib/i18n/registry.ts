import "server-only";
import { cache } from "react";
import { db } from "@/lib/db";
import { parseJson } from "@/lib/json";
import { DEFAULT_LOCALE, LOCALE_SEGMENT_RE, SUPPORTED_LOCALES } from "@/lib/constants";
import { localeMeta } from "./index";

/**
 * The locale registry: the single source of truth for "which languages exist".
 *
 * Built-in en/bn ship as messages/*.json and are toggled through the
 * `locale.enabled` setting. Every other language is a `Language` row added from
 * the studio, with its dictionary in `Translation` rows.
 *
 * Nothing in here throws: if the database is unreachable (build time, first
 * boot, misconfigured DATABASE_URL) the built-ins are returned so the
 * storefront still renders.
 */
export type LocaleInfo = {
  code: string;
  name: string;
  nativeName: string;
  dir: "ltr" | "rtl";
  font: string | null;
  flag: string | null;
  enabled: boolean;
  /** dictionary was produced by the AI translation engine */
  isMachine: boolean;
  /** shipped as messages/<code>.json (en, bn) */
  builtIn: boolean;
};

const dirOf = (v: unknown): "ltr" | "rtl" => (v === "rtl" ? "rtl" : "ltr");

function builtInInfo(code: string, enabled: boolean): LocaleInfo {
  const meta = localeMeta[code];
  return {
    code,
    name: meta?.name ?? code.toUpperCase(),
    nativeName: meta?.nativeName ?? code,
    dir: meta?.dir ?? "ltr",
    font: null,
    flag: meta?.flag ?? null,
    enabled,
    isMachine: false,
    builtIn: true,
  };
}

function fallbackRegistry(): { locales: LocaleInfo[]; defaultCode: string } {
  return {
    locales: SUPPORTED_LOCALES.map((c) => builtInInfo(c, true)),
    defaultCode: DEFAULT_LOCALE,
  };
}

const loadRegistry = cache(async (): Promise<{ locales: LocaleInfo[]; defaultCode: string }> => {
  const [settingRow, rows] = await Promise.all([
    db.setting.findUnique({ where: { key: "locale" } }).catch(() => null),
    db.language.findMany({ orderBy: [{ sortOrder: "asc" }, { code: "asc" }] }).catch(() => null),
  ]);
  if (settingRow === null && rows === null) return fallbackRegistry();

  const stored = parseJson<{ default?: unknown; enabled?: unknown }>(settingRow?.value, {});
  const enabledBuiltIn = Array.isArray(stored.enabled)
    ? stored.enabled.filter((v): v is string => typeof v === "string")
    : [...SUPPORTED_LOCALES];

  const locales: LocaleInfo[] = SUPPORTED_LOCALES.map((code) =>
    // English is the source of truth and can never be switched off.
    builtInInfo(code, code === DEFAULT_LOCALE || enabledBuiltIn.includes(code)),
  );

  for (const row of rows ?? []) {
    if (!LOCALE_SEGMENT_RE.test(row.code)) continue;
    if (locales.some((l) => l.code === row.code)) continue; // never shadow a built-in
    locales.push({
      code: row.code,
      name: row.name || row.code.toUpperCase(),
      nativeName: row.nativeName || row.name || row.code,
      dir: dirOf(row.dir),
      font: row.font || null,
      flag: row.flag || null,
      enabled: row.enabled,
      isMachine: row.isMachine,
      builtIn: false,
    });
  }

  const wanted = typeof stored.default === "string" ? stored.default : DEFAULT_LOCALE;
  const defaultCode = locales.some((l) => l.code === wanted && l.enabled) ? wanted : DEFAULT_LOCALE;
  return { locales, defaultCode };
});

/** Every registered language, built-ins first, disabled ones included. */
export async function getLocales(): Promise<LocaleInfo[]> {
  return (await loadRegistry()).locales;
}

/** Languages reachable on the storefront. */
export async function getEnabledLocales(): Promise<LocaleInfo[]> {
  return (await loadRegistry()).locales.filter((l) => l.enabled);
}

/** Codes of every registered language (enabled or not) — used for locale normalisation. */
export async function getKnownLocaleCodes(): Promise<string[]> {
  return (await loadRegistry()).locales.map((l) => l.code);
}

export async function getEnabledLocaleCodes(): Promise<string[]> {
  return (await getEnabledLocales()).map((l) => l.code);
}

export async function isKnownLocale(code: string | null | undefined): Promise<boolean> {
  if (!code) return false;
  return (await loadRegistry()).locales.some((l) => l.code === code);
}

export async function getLocaleInfo(code: string | null | undefined): Promise<LocaleInfo | null> {
  if (!code) return null;
  return (await loadRegistry()).locales.find((l) => l.code === code) ?? null;
}

export async function getDefaultLocale(): Promise<string> {
  return (await loadRegistry()).defaultCode;
}
