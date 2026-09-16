import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { db } from "@/lib/db";
import { COOKIE_LOCALE } from "@/lib/constants";
import { buildDictionary, createTranslator, normalizeLocale, type Locale, type Translator } from "./index";
import { getDefaultLocale, getKnownLocaleCodes } from "./registry";

/** Translation overrides saved from the studio, keyed "namespace.key" → value. */
const loadOverrides = cache(async (locale: Locale): Promise<Record<string, string>> => {
  try {
    const rows = await db.translation.findMany({ where: { locale } });
    return Object.fromEntries(rows.map((r) => [r.namespace === "common" ? r.key : `${r.namespace}.${r.key}`, r.value]));
  } catch {
    return {};
  }
});

/** Resolve an arbitrary locale string against the registry, falling back to the default language. */
async function resolve(locale: string | null | undefined): Promise<Locale> {
  const [known, fallback] = await Promise.all([getKnownLocaleCodes(), getDefaultLocale()]);
  const short = (locale ?? "").toLowerCase().split(/[-_]/)[0];
  // normalizeLocale hard-codes English as its fallback; prefer the owner's
  // default language when the requested code is not registered.
  return known.includes(short) ? normalizeLocale(locale, known) : fallback;
}

export const getTranslator = cache(async (locale: Locale): Promise<Translator> => {
  const l = await resolve(locale);
  const overrides = await loadOverrides(l);
  // buildDictionary layers en → built-in locale file → DB overrides, so missing
  // keys always fall back to English.
  return createTranslator(l, buildDictionary(l, overrides));
});

/** Resolve locale for routes outside the [locale] segment (admin, API). */
export async function detectLocale(): Promise<Locale> {
  const jar = await cookies();
  const c = jar.get(COOKIE_LOCALE)?.value;
  if (c) return resolve(c);
  const h = await headers();
  const accept = h.get("accept-language") ?? "";
  const first = accept.split(",")[0]?.trim();
  return resolve(first);
}
