import { PageHeader } from "@/components/admin/PageHeader";
import { requireStudio } from "@/lib/admin/session";
import { csrfToken } from "@/lib/admin/csrf";
import { db } from "@/lib/db";
import { getSetting } from "@/lib/settings";
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
  const [locale, dbRows, csrf] = await Promise.all([getSetting("locale"), db.translation.findMany(), csrfToken()]);

  const flatEn = flatten(en);
  const flatBn = flatten(bn);

  // Overrides are stored as (locale, namespace, key); rebuild the dotted key.
  const overrideMap = new Map<string, Record<string, string>>();
  for (const row of dbRows) {
    const fullKey = row.namespace === "common" && !flatEn[`common.${row.key}`] ? row.key : `${row.namespace}.${row.key}`;
    const entry = overrideMap.get(fullKey) ?? {};
    entry[row.locale] = row.value;
    overrideMap.set(fullKey, entry);
  }

  const keys = [...new Set([...Object.keys(flatEn), ...Object.keys(flatBn)])].sort();
  const rows: TranslationRow[] = keys.map((key) => ({
    key,
    source: flatEn[key] ?? "",
    shipped: flatBn[key] ?? "",
    overrides: overrideMap.get(key) ?? {},
  }));

  // English is the source of truth, so it is never overridable here.
  const editable = locale.enabled.filter((l) => l !== "en");
  const overriddenCount = rows.filter((r) => Object.keys(r.overrides).length > 0).length;

  return (
    <div>
      <PageHeader
        title="Translations"
        description={`${rows.length} interface strings. English is the source; overrides are stored in the database and win over the shipped files. ${overriddenCount} key${overriddenCount === 1 ? "" : "s"} currently overridden.`}
      />
      {editable.length === 0 ? (
        <div className="card px-6 py-16 text-center text-sm text-muted">
          Only English is enabled. Turn on another language under Currencies &amp; locales to start translating.
        </div>
      ) : (
        <TranslationsTable rows={rows} locales={editable} csrf={csrf} />
      )}
    </div>
  );
}
