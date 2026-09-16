"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Check, Languages, ListChecks, Loader2, Pencil, Sparkles, Trash2, X } from "lucide-react";
import { CsrfInput } from "@/components/admin/Csrf";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { SelectField, SubmitButton, TextField, ToggleRow } from "@/components/admin/Fields";
import { idleState } from "@/lib/admin/action-state";
import { apiFetch } from "@/lib/api";
import { deleteLanguageAction, toggleBuiltInLocaleAction, updateLanguageAction } from "@/lib/admin/actions/i18n";
import type { LocaleInfo } from "@/lib/i18n/registry";
import type { ContentStep, Coverage, DictionaryStep } from "@/lib/i18n/translate";
import { cn } from "@/lib/utils";

export type LanguageRow = LocaleInfo & { coverage: Coverage | null };

type Progress = { code: string; label: string; pct: number };

const pct = (done: number, total: number) => (total > 0 ? Math.round((done / total) * 100) : 0);

const FRIENDLY: Record<string, string> = {
  "ai.offline": "Connect an AI model first (Settings → AI concierge).",
  "ai.error": "The AI provider returned an error. Check the model and key.",
  "i18n.rateLimited": "Too many translation calls this hour. Try again later.",
  "errors.csrf": "Your session expired — reload the page and try again.",
  "common.somethingWrong": "Something went wrong.",
};
const message = (e: unknown) => {
  const raw = e instanceof Error ? e.message : String(e);
  return FRIENDLY[raw] ?? raw;
};

function Pill({ tone, children }: { tone: "on" | "off" | "machine" | "muted"; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 border px-1.5 py-0.5 text-[0.55rem] font-semibold uppercase tracking-[0.12em]",
        tone === "on" && "border-success/40 bg-success/10 text-success",
        tone === "off" && "border-line bg-line/30 text-muted",
        tone === "machine" && "border-warning/40 bg-warning/10 text-warning",
        tone === "muted" && "border-line text-muted",
      )}
    >
      {children}
    </span>
  );
}

function Meter({ label, value, total }: { label: string; value: number; total: number }) {
  const p = pct(value, total);
  return (
    <div className="min-w-[7rem]">
      <div className="flex items-baseline justify-between gap-2 text-[0.55rem] uppercase tracking-[0.12em] text-muted">
        <span>{label}</span>
        <span className="tabular-nums">{p}%</span>
      </div>
      <div className="mt-1 h-1 w-full bg-line/60">
        <div className={cn("h-1", p >= 100 ? "bg-success" : "bg-oxide")} style={{ width: `${p}%` }} />
      </div>
    </div>
  );
}

/* ───────────────────────────── one row ───────────────────────────── */

function QuickToggle({ row, csrf }: { row: LanguageRow; csrf: string }) {
  const action = row.builtIn ? toggleBuiltInLocaleAction : updateLanguageAction;
  const [state, formAction] = useActionState(action, idleState);
  useEffect(() => {
    if (state.error) toast.error(state.error);
    else if (state.ok && state.message) toast.success(state.message);
  }, [state]);

  if (row.code === "en") return <Pill tone="on">source</Pill>;

  return (
    <form action={formAction} className="inline-flex">
      <CsrfInput value={csrf} />
      <input type="hidden" name="code" value={row.code} />
      <input type="hidden" name="enabled" value={row.enabled ? "off" : "on"} />
      <SubmitButton variant="ghost" size="sm" className="px-2 py-1 text-[0.55rem]">
        {row.enabled ? (
          <>
            <X className="h-3 w-3" aria-hidden /> Disable
          </>
        ) : (
          <>
            <Check className="h-3 w-3" aria-hidden /> Enable
          </>
        )}
      </SubmitButton>
    </form>
  );
}

function EditForm({ row, csrf, onDone }: { row: LanguageRow; csrf: string; onDone: () => void }) {
  const [state, formAction] = useActionState(updateLanguageAction, idleState);
  const router = useRouter();
  useEffect(() => {
    if (state.error) toast.error(state.error);
    else if (state.ok && state.message) {
      toast.success(state.message);
      onDone();
      router.refresh();
    }
  }, [state, onDone, router]);

  return (
    <form action={formAction} className="grid gap-3 border-t border-line bg-bone/40 p-4 sm:grid-cols-2">
      <CsrfInput value={csrf} />
      <input type="hidden" name="code" value={row.code} />
      <TextField name="name" label="English name" defaultValue={row.name} />
      <TextField name="nativeName" label="Native name" defaultValue={row.nativeName} hint="Shown in the storefront switcher." />
      <SelectField
        name="dir"
        label="Script direction"
        defaultValue={row.dir}
        options={[
          { value: "ltr", label: "Left to right" },
          { value: "rtl", label: "Right to left" },
        ]}
      />
      <TextField name="font" label="Google Font" defaultValue={row.font ?? ""} hint="Family name, e.g. Noto Sans Devanagari. Leave blank to use the brand font." />
      <TextField name="flag" label="Flag" defaultValue={row.flag ?? ""} />
      <div className="sm:col-span-2">
        <ToggleRow name="enabled" label="Live on the storefront" hint={`Off means /${row.code} returns 404.`} defaultChecked={row.enabled} />
        <ToggleRow name="isMachine" label="Machine translated" hint="Drives the optional footer notice. Turn off once the dictionary is fully reviewed." defaultChecked={row.isMachine} />
      </div>
      <div className="flex items-center gap-2 sm:col-span-2">
        <SubmitButton size="sm" pendingLabel="Saving…">
          Save {row.name}
        </SubmitButton>
        <button type="button" onClick={onDone} className="btn-ghost px-4 py-2.5 text-[0.65rem]">
          Cancel
        </button>
      </div>
    </form>
  );
}

function DeleteButton({ row, csrf }: { row: LanguageRow; csrf: string }) {
  const [state, formAction] = useActionState(deleteLanguageAction, idleState);
  const ref = useRef<HTMLFormElement>(null);
  const router = useRouter();
  useEffect(() => {
    if (state.error) toast.error(state.error);
    else if (state.ok && state.message) {
      toast.success(state.message);
      router.refresh();
    }
  }, [state, router]);

  return (
    <form ref={ref} action={formAction} className="inline-flex">
      <CsrfInput value={csrf} />
      <input type="hidden" name="code" value={row.code} />
      <ConfirmDialog
        trigger={
          <button type="button" aria-label={`Delete ${row.name}`} className="p-1.5 text-muted transition hover:text-danger">
            <Trash2 className="h-3.5 w-3.5" aria-hidden />
          </button>
        }
        title={`Delete ${row.name}?`}
        body={`Every ${row.name} interface string and content translation is removed. English and Bangla are untouched. This cannot be undone.`}
        confirmLabel="Delete language"
        onConfirm={() => ref.current?.requestSubmit()}
      />
    </form>
  );
}

/* ───────────────────────────── the table ───────────────────────────── */

export function LanguagesManager({
  rows,
  csrf,
  aiConfigured,
  contentModels,
}: {
  rows: LanguageRow[];
  csrf: string;
  aiConfigured: boolean;
  contentModels: { value: string; label: string }[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<string | null>(null);
  const [progress, setProgress] = useState<Progress | null>(null);
  const busy = progress !== null;

  /** Loop the dictionary endpoint until it reports done. */
  async function generateDictionary(row: LanguageRow) {
    setProgress({ code: row.code, label: "Starting…", pct: 0 });
    let cursor: string | null = null;
    let translated = 0;
    try {
      for (let guard = 0; guard < 500; guard++) {
        const res: { step: DictionaryStep } = await apiFetch<{ step: DictionaryStep }>("/api/admin/i18n/generate", {
          method: "POST",
          json: { locale: row.code, cursor },
        });
        const step = res.step;
        translated += step.translated;
        setProgress({
          code: row.code,
          label: `Interface — ${step.processed} of ${step.total} strings`,
          pct: pct(step.processed, step.total),
        });
        if (step.done || !step.nextCursor) break;
        cursor = step.nextCursor;
      }
      toast.success(`${row.nativeName}: ${translated} interface string${translated === 1 ? "" : "s"} translated. Review them before going live.`);
    } catch (e) {
      toast.error(message(e));
    } finally {
      setProgress(null);
      router.refresh();
    }
  }

  /** Loop one content model, one record per request. */
  async function translateContent(row: LanguageRow, model: { value: string; label: string }) {
    setProgress({ code: row.code, label: `${model.label} — starting…`, pct: 0 });
    let cursor: string | null = null;
    let fields = 0;
    try {
      for (let guard = 0; guard < 2000; guard++) {
        const res: { step: ContentStep } = await apiFetch<{ step: ContentStep }>("/api/admin/i18n/translate-content", {
          method: "POST",
          json: { locale: row.code, model: model.value, cursor },
        });
        const step = res.step;
        fields += step.fieldsTranslated;
        setProgress({
          code: row.code,
          label: `${model.label} — ${step.processed} of ${step.total}${step.recordLabel ? ` · ${step.recordLabel}` : ""}`,
          pct: pct(step.processed, step.total),
        });
        if (step.done || !step.nextCursor) break;
        cursor = step.nextCursor;
      }
      toast.success(`${row.nativeName}: ${fields} ${model.label.toLowerCase()} field${fields === 1 ? "" : "s"} translated.`);
    } catch (e) {
      toast.error(message(e));
    } finally {
      setProgress(null);
      router.refresh();
    }
  }

  return (
    <div className="space-y-3">
      {rows.map((row) => {
        const cov = row.coverage;
        const isEditing = editing === row.code;
        const rowBusy = progress?.code === row.code;
        return (
          <div key={row.code} className={cn("border border-line", row.enabled ? "bg-paper" : "bg-bone/30")}>
            <div className="flex flex-wrap items-start gap-4 p-4">
              <div className="min-w-[10rem] flex-1">
                <p className="flex items-center gap-2 text-sm font-medium">
                  {row.flag && <span aria-hidden>{row.flag}</span>}
                  <span lang={row.code}>{row.nativeName}</span>
                  <span className="font-mono text-[0.6rem] uppercase text-muted">{row.code}</span>
                </p>
                <p className="mt-0.5 text-xs text-muted">
                  {row.name} · {row.dir.toUpperCase()}
                  {row.font ? ` · ${row.font}` : ""}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  {row.enabled ? <Pill tone="on">live</Pill> : <Pill tone="off">off</Pill>}
                  {row.builtIn && <Pill tone="muted">built in</Pill>}
                  {!row.builtIn && row.isMachine && <Pill tone="machine">machine</Pill>}
                </div>
              </div>

              {cov && row.code !== "en" && (
                <div className="flex flex-wrap gap-4">
                  <Meter label="Interface" value={cov.uiTranslated} total={cov.uiTotal} />
                  <Meter label="Content" value={cov.contentTranslated} total={cov.contentTotal} />
                  <Meter label="Reviewed" value={cov.uiApproved + cov.contentApproved} total={cov.uiTotal + cov.contentTotal} />
                </div>
              )}

              <div className="flex flex-wrap items-center gap-1.5">
                {!row.builtIn && (
                  <button
                    type="button"
                    disabled={busy || !aiConfigured}
                    onClick={() => void generateDictionary(row)}
                    className="btn-outline px-3 py-2 text-[0.6rem] disabled:opacity-50"
                    title={aiConfigured ? "Translate the whole interface dictionary" : "Connect an AI model first"}
                  >
                    {rowBusy ? <Loader2 className="h-3 w-3 animate-spin" aria-hidden /> : <Sparkles className="h-3 w-3" aria-hidden />}
                    Generate
                  </button>
                )}
                {row.code !== "en" && (
                  <Link href={`/admin/settings/languages/${row.code}`} className="btn-ghost px-3 py-2 text-[0.6rem]">
                    <ListChecks className="h-3 w-3" aria-hidden />
                    Review
                  </Link>
                )}
                <QuickToggle row={row} csrf={csrf} />
                {!row.builtIn && (
                  <>
                    <button
                      type="button"
                      onClick={() => setEditing(isEditing ? null : row.code)}
                      aria-label={`Edit ${row.name}`}
                      className="p-1.5 text-muted transition hover:text-ink"
                    >
                      <Pencil className="h-3.5 w-3.5" aria-hidden />
                    </button>
                    <DeleteButton row={row} csrf={csrf} />
                  </>
                )}
              </div>
            </div>

            {row.code !== "en" && (
              <div className="flex flex-wrap items-center gap-1.5 border-t border-line/70 px-4 py-2.5">
                <span className="mr-1 text-[0.55rem] font-semibold uppercase tracking-[0.12em] text-muted">Translate content</span>
                {contentModels.map((m) => (
                  <button
                    key={m.value}
                    type="button"
                    disabled={busy || !aiConfigured}
                    onClick={() => void translateContent(row, m)}
                    className="border border-line px-2 py-1 text-[0.58rem] uppercase tracking-[0.1em] text-muted transition hover:border-ink hover:text-ink disabled:opacity-40"
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            )}

            {rowBusy && progress && (
              <div className="border-t border-line/70 px-4 py-3">
                <div className="flex items-center justify-between gap-3 text-xs text-muted">
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
                    {progress.label}
                  </span>
                  <span className="tabular-nums">{progress.pct}%</span>
                </div>
                <div className="mt-2 h-1 w-full bg-line/60">
                  <div className="h-1 bg-oxide transition-all" style={{ width: `${progress.pct}%` }} />
                </div>
                <p className="mt-2 text-[0.6rem] text-muted">Keep this tab open — the studio resumes from where it stopped if you leave.</p>
              </div>
            )}

            {isEditing && <EditForm row={row} csrf={csrf} onDone={() => setEditing(null)} />}
          </div>
        );
      })}

      {rows.length === 0 && (
        <p className="flex items-center gap-2 px-1 py-8 text-sm text-muted">
          <Languages className="h-4 w-4" aria-hidden /> No languages registered.
        </p>
      )}
    </div>
  );
}

export default LanguagesManager;
