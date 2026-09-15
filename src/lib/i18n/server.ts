import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { db } from "@/lib/db";
import { COOKIE_LOCALE, DEFAULT_LOCALE } from "@/lib/constants";
import { buildDictionary, createTranslator, normalizeLocale, type Locale, type Translator } from "./index";

/** Translation overrides saved from the studio, keyed "namespace.key" → value. */
const loadOverrides = cache(async (locale: Locale): Promise<Record<string, string>> => {
  try {
    const rows = await db.translation.findMany({ where: { locale } });
    return Object.fromEntries(rows.map((r) => [r.namespace === "common" ? r.key : `${r.namespace}.${r.key}`, r.value]));
  } catch {
    return {};
  }
});

export const getTranslator = cache(async (locale: Locale): Promise<Translator> => {
  const l = normalizeLocale(locale);
  const overrides = await loadOverrides(l);
  return createTranslator(l, buildDictionary(l, overrides));
});

/** Resolve locale for routes outside the [locale] segment (admin, API). */
export async function detectLocale(): Promise<Locale> {
  const jar = await cookies();
  const c = jar.get(COOKIE_LOCALE)?.value;
  if (c) return normalizeLocale(c);
  const h = await headers();
  const accept = h.get("accept-language") ?? "";
  const first = accept.split(",")[0]?.trim();
  return normalizeLocale(first || DEFAULT_LOCALE);
}
