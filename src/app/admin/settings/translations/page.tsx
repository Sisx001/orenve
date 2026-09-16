import { PageHeader } from "@/components/admin/PageHeader";
import { requireStudio } from "@/lib/admin/session";
import { csrfToken } from "@/lib/admin/csrf";
import Link from "next/link";
import { db } from "@/lib/db";
import { getEnabledLocales } from "@/lib/i18n/registry";
import { TranslationsTable, type TranslationRow } from "./TranslationsTable";
import en from "@/../messages/en.json";
import bn from "@/../messages/bn.json";

export const dynamic = "force-dynamic";

/** Flatten a nested message catalogue into dotted keys. */
function flatten(obj: unknown, prefix = "", out: Record<string, string> = {}): Record<string, string> {
  if (!obj || typeof obj !== "object") return out;
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v)) flatten(v, key, out);
    else out[key] = typeof v === "string" ? v : JSON.stringify(v);
  }
  return out;
}

export default async function TranslationsSettingsPage() {
  await requireStudio("settings.write", "/admin/settings/translations");
  const [locales, dbRows, csrf] = await Promise.all([getEnabledLocales(), db.translation.findMany(), csrfToken()]);

  const flatEn = flatten(en);
  const flatBn = flatten(bn);

  // Overrides are stored as (locale, namespace, key); rebuild the dotted key.
  const overrideMap = new Map<string, Record<string, string>>();
  const machineMap = new Map<string, Record<string, boolean>>();
  for (const row of dbRows) {
    const fullKey = row.namespace === "common" && !flatEn[`common.${row.key}`] ? row.key : `${row.namespace}.${row.key}`;
    const entry = overrideMap.get(fullKey) ?? {};
    entry[row.locale] = row.value;
    overrideMap.set(fullKey, entry);
    if (row.machine && !row.approved) {
      const flags = machineMap.get(fullKey) ?? {};
      flags[row.locale] = true;
      machineMap.set(fullKey, flags);
    }
  }

  const keys = [...new Set([...Object.keys(flatEn), ...Object.keys(flatBn)])].sort();
  const rows: TranslationRow[] = keys.map((key) => ({
    key,
    source: flatEn[key] ?? "",
    shipped: flatBn[key] ?? "",
    overrides: overrideMap.get(key) ?? {},
    machine: machineMap.get(key) ?? {},
  }));

  // English is the source of truth, so it is never overridable here.
  const editable = locales.filter((l) => l.code !== "en").map((l) => ({ code: l.code, label: l.nativeName }));
  const overriddenCount = rows.filter((r) => Object.keys(r.overrides).length > 0).length;

  return (
    <div>
      <PageHeader
        title="Translations"
        description={`${rows.length} interface strings. English is the source; overrides are stored in the database and win over the shipped files. ${overriddenCount} key${overriddenCount === 1 ? "" : "s"} currently overridden.`}
      />
      {editable.length === 0 ? (
        <div className="card px-6 py-16 text-center text-sm text-muted">
          Only English is enabled.{" "}
          <Link href="/admin/settings/languages" className="font-semibold text-ink underline underline-offset-4">
            Add or switch on a language
          </Link>{" "}
          to start translating.
        </div>
      ) : (
        <TranslationsTable rows={rows} locales={editable} csrf={csrf} />
      )}
    </div>
  );
}
