"use client";

import { CsrfInput } from "@/components/admin/Csrf";
import { useActionState, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { RotateCcw, Save, Search } from "lucide-react";
import { SubmitButton } from "@/components/admin/Fields";
import { saveTranslationsAction } from "@/lib/admin/actions/settings";
import { idleState } from "@/lib/admin/action-state";
import { cn } from "@/lib/utils";

export type TranslationRow = {
  key: string;
  /** English source string from messages/en.json */
  source: string;
  /** shipped bn.json value */
  shipped: string;
  /** per-locale DB override, keyed by locale */
  overrides: Record<string, string>;
  /** locales whose override is an unreviewed machine translation */
  machine: Record<string, boolean>;
};

export type TranslationLocale = { code: string; label: string };

export function TranslationsTable({ rows, locales, csrf }: { rows: TranslationRow[]; locales: TranslationLocale[]; csrf: string }) {
  const [state, action] = useActionState(saveTranslationsAction, idleState);
  const [q, setQ] = useState("");
  const [onlyOverridden, setOnlyOverridden] = useState(false);
  const [onlyMissing, setOnlyMissing] = useState(false);
  const [edits, setEdits] = useState<Record<string, string>>({});

  useEffect(() => {
    if (state.error) toast.error(state.error);
    else if (state.ok && state.message) {
      toast.success(state.message);
      setEdits({});
    }
  }, [state]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (needle && !r.key.toLowerCase().includes(needle) && !r.source.toLowerCase().includes(needle) && !r.shipped.toLowerCase().includes(needle)) return false;
      if (onlyOverridden && !locales.some((l) => r.overrides[l.code])) return false;
      if (onlyMissing && locales.every((l) => (l.code === "bn" ? r.shipped || r.overrides[l.code] : r.overrides[l.code]))) return false;
      return true;
    });
  }, [rows, q, onlyOverridden, onlyMissing, locales]);

  const cellKey = (locale: string, key: string) => `${locale}::${key}`;

  const valueFor = (r: TranslationRow, locale: string) => {
    const k = cellKey(locale, r.key);
    if (k in edits) return edits[k];
    return r.overrides[locale] ?? "";
  };

  const payload = Object.entries(edits).map(([k, value]) => {
    const [locale, ...rest] = k.split("::");
    return { locale, key: rest.join("::"), value };
  });

  return (
    <form action={action}>
      <CsrfInput value={csrf} />
      <input type="hidden" name="overrides" value={JSON.stringify(payload)} />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative min-w-[16rem] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search keys or text…" className="field-box pl-9" />
        </div>
        <label className="flex items-center gap-1.5 text-xs">
          <input type="checkbox" checked={onlyOverridden} onChange={(e) => setOnlyOverridden(e.target.checked)} className="h-3.5 w-3.5 accent-[rgb(var(--c-oxide))]" />
          Overridden only
        </label>
        <label className="flex items-center gap-1.5 text-xs">
          <input type="checkbox" checked={onlyMissing} onChange={(e) => setOnlyMissing(e.target.checked)} className="h-3.5 w-3.5 accent-[rgb(var(--c-oxide))]" />
          Missing only
        </label>
        <span className="text-xs text-muted">
          {filtered.length} of {rows.length} keys
          {payload.length > 0 && <span className="ml-2 text-oxide">{payload.length} unsaved</span>}
        </span>
      </div>

      <div className="card overflow-hidden">
        <div className="max-h-[68vh] overflow-auto">
          <table className="w-full border-collapse text-sm">
            <thead className="sticky top-0 z-10 bg-bone/95 backdrop-blur">
              <tr className="text-[0.58rem] uppercase tracking-[0.14em] text-muted">
                <th className="w-[18rem] border-b border-line px-3 py-2.5 text-left font-semibold">Key</th>
                <th className="border-b border-line px-3 py-2.5 text-left font-semibold">English (source)</th>
                {locales.map((l) => (
                  <th key={l.code} className="border-b border-line px-3 py-2.5 text-left font-semibold">
                    <span lang={l.code}>{l.label}</span> override
                  </th>
                ))}
                <th className="w-10 border-b border-line px-3 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => {
                const dirty = locales.some((l) => cellKey(l.code, r.key) in edits);
                return (
                  <tr key={r.key} className={cn("border-b border-line/60 last:border-0", dirty && "bg-oxide/[0.04]")}>
                    <td className="px-3 py-2 align-top">
                      <span className="block break-all font-mono text-[0.66rem] text-muted">{r.key}</span>
                    </td>
                    <td className="px-3 py-2 align-top">
                      <span className="block whitespace-pre-line text-xs">{r.source}</span>
                    </td>
                    {locales.map((l) => (
                      <td key={l.code} className="px-3 py-2 align-top">
                        <textarea
                          value={valueFor(r, l.code)}
                          onChange={(e) => setEdits((s) => ({ ...s, [cellKey(l.code, r.key)]: e.target.value }))}
                          rows={1}
                          lang={l.code}
                          placeholder={l.code === "bn" ? r.shipped || "—" : "—"}
                          aria-label={`${l.code} translation for ${r.key}`}
                          className={cn("field-box min-h-[2.2rem] resize-y py-1.5 text-xs", l.code === "bn" && "font-bangla")}
                        />
                        {r.machine[l.code] && (
                          <span className="mt-1 inline-block border border-warning/40 bg-warning/10 px-1.5 py-0.5 text-[0.52rem] font-semibold uppercase tracking-[0.12em] text-warning">
                            machine
                          </span>
                        )}
                      </td>
                    ))}
                    <td className="px-3 py-2 text-right align-top">
                      <button
                        type="button"
                        aria-label="Reset overrides for this key"
                        title="Clear the override and fall back to the shipped translation"
                        onClick={() => {
                          setEdits((s) => {
                            const next = { ...s };
                            for (const l of locales) next[cellKey(l.code, r.key)] = "";
                            return next;
                          });
                        }}
                        className="p-1 text-muted hover:text-ink"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted">
          An empty field clears the override, so the shipped translation from <span className="font-mono">messages/bn.json</span> is used again.
        </p>
        <SubmitButton disabled={payload.length === 0} pendingLabel="Saving…">
          <Save className="h-3.5 w-3.5" />
          Save {payload.length > 0 ? `${payload.length} change${payload.length === 1 ? "" : "s"}` : "overrides"}
        </SubmitButton>
      </div>
    </form>
  );
}

export default TranslationsTable;
