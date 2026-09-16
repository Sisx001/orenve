import "server-only";
import { parseI18n, type I18nString } from "@/lib/json";
import { getEnabledLocaleCodes } from "@/lib/i18n/registry";

/**
 * Form helpers for studio editors that must handle any number of languages.
 *
 * An i18n field posts one input per language: `<name>_en`, `<name>_bn`,
 * `<name>_hi`, … `readI18nField` reads them all back, `mergeI18n` keeps
 * translations for languages the form did not render.
 */

const MAX_FIELD = 6000;

/** Read `${name}_${code}` for every code, dropping empty values. */
export function readI18nField(fd: FormData, name: string, locales: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const code of locales) {
    const raw = fd.get(`${name}_${code}`);
    if (raw === null) continue;
    const value = String(raw).slice(0, MAX_FIELD);
    if (value.trim() === "") continue;
    out[code] = value;
  }
  return out;
}

/**
 * Merge submitted values over the stored JSON: languages present in the form
 * win (an empty field clears them), languages absent from the form are kept.
 */
export function mergeI18n(existingJson: string | null | undefined | I18nString, incoming: Record<string, string>, submittedLocales?: string[]): Record<string, string> {
  const existing = typeof existingJson === "string" || existingJson == null ? parseI18n(existingJson) : { ...existingJson };
  const submitted = submittedLocales ?? Object.keys(incoming);
  const out: Record<string, string> = {};
  for (const [code, value] of Object.entries(existing)) {
    if (submitted.includes(code)) continue; // the form is authoritative for these
    if (value && value.trim() !== "") out[code] = value;
  }
  for (const [code, value] of Object.entries(incoming)) {
    if (value && value.trim() !== "") out[code] = value;
  }
  return out;
}

/** Languages the studio should render editors for (enabled, English first). */
export async function getStudioLocaleCodes(): Promise<string[]> {
  const codes = await getEnabledLocaleCodes();
  return codes.length ? codes : ["en"];
}
