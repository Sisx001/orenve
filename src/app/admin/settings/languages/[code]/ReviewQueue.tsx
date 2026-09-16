"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, CheckCheck, Loader2, Save, Search } from "lucide-react";
import { apiFetch } from "@/lib/api";
import type { ContentReviewRow, Coverage, UiReviewRow } from "@/lib/i18n/translate";
import { cn } from "@/lib/utils";

type Tab = "ui" | "content";

const FRIENDLY: Record<string, string> = {
  "errors.csrf": "Your session expired — reload the page and try again.",
  "common.somethingWrong": "Something went wrong.",
};
const message = (e: unknown) => {
  const raw = e instanceof Error ? e.message : String(e);
  return FRIENDLY[raw] ?? raw;
};

const pct = (done: number, total: number) => (total > 0 ? Math.round((done / total) * 100) : 0);

function Meter({ label, value, total }: { label: string; value: number; total: number }) {
  const p = pct(value, total);
  return (
    <div className="min-w-[10rem] flex-1">
      <div className="flex items-baseline justify-between gap-2 text-[0.58rem] uppercase tracking-[0.12em] text-muted">
        <span>{label}</span>
        <span className="tabular-nums">
          {value} / {total} · {p}%
        </span>
      </div>
      <div className="mt-1.5 h-1.5 w-full bg-line/60">
        <div className={cn("h-1.5", p >= 100 ? "bg-success" : "bg-oxide")} style={{ width: `${p}%` }} />
      </div>
    </div>
  );
}

export function ReviewQueue({
  locale,
  dir,
  coverage,
  ui,
  content,
}: {
  locale: string;
  dir: "ltr" | "rtl";
  coverage: Coverage;
  ui: UiReviewRow[];
  content: ContentReviewRow[];
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("ui");
  const [q, setQ] = useState("");
  const [pendingOnly, setPendingOnly] = useState(true);
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [done, setDone] = useState<Record<string, true>>({});

  const needle = q.trim().toLowerCase();

  const uiRows = useMemo(
    () =>
      ui.filter((r) => {
        if (pendingOnly && (r.approved || done[r.id])) return false;
        if (!needle) return true;
        return r.key.toLowerCase().includes(needle) || r.source.toLowerCase().includes(needle) || r.value.toLowerCase().includes(needle);
      }),
    [ui, needle, pendingOnly, done],
  );

  const contentRows = useMemo(
    () =>
      content.filter((r) => {
        if (pendingOnly && (r.approved || done[r.id])) return false;
        if (!needle) return true;
        return (
          r.recordLabel.toLowerCase().includes(needle) ||
          r.field.toLowerCase().includes(needle) ||
          r.source.toLowerCase().includes(needle) ||
          r.value.toLowerCase().includes(needle)
        );
      }),
    [content, needle, pendingOnly, done],
  );

  async function review(row: { id: string; kind: Tab }, action: "approve" | "edit", value?: string) {
    setBusy(row.id);
    try {
      await apiFetch("/api/admin/i18n/review", {
        method: "POST",
        json: row.kind === "ui" ? { id: row.id, action, value } : { contentId: row.id, action, value },
      });
      setDone((s) => ({ ...s, [row.id]: true }));
      setEdits((s) => {
        const next = { ...s };
        delete next[row.id];
        return next;
      });
    } catch (e) {
      toast.error(message(e));
    } finally {
      setBusy(null);
    }
  }

  async function approveAllShown() {
    const rows: { id: string; kind: Tab }[] = tab === "ui" ? uiRows.map((r) => ({ id: r.id, kind: "ui" as const })) : contentRows.map((r) => ({ id: r.id, kind: "content" as const }));
    if (!rows.length) return;
    setBusy("bulk");
    let ok = 0;
    for (const row of rows) {
      try {
        const edited = edits[row.id];
        await apiFetch("/api/admin/i18n/review", {
          method: "POST",
          json: row.kind === "ui" ? { id: row.id, action: edited ? "edit" : "approve", value: edited } : { contentId: row.id, action: edited ? "edit" : "approve", value: edited },
        });
        setDone((s) => ({ ...s, [row.id]: true }));
        ok++;
      } catch (e) {
        toast.error(message(e));
        break;
      }
    }
    setBusy(null);
    if (ok) {
      toast.success(`${ok} translation${ok === 1 ? "" : "s"} approved.`);
      router.refresh();
    }
  }

  const valueOf = (id: string, fallback: string) => (id in edits ? edits[id] : fallback);
  const rtl = dir === "rtl";

  return (
    <div className="space-y-4">
      <section className="card flex flex-wrap items-end gap-6 p-4 sm:p-5">
        <Meter label="Interface translated" value={coverage.uiTranslated} total={coverage.uiTotal} />
        <Meter label="Interface reviewed" value={coverage.uiApproved} total={coverage.uiTotal} />
        <Meter label="Content translated" value={coverage.contentTranslated} total={coverage.contentTotal} />
        <Meter label="Content reviewed" value={coverage.contentApproved} total={coverage.contentTotal} />
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1">
          {(["ui", "content"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={cn(
                "border px-3 py-1.5 text-[0.6rem] font-semibold uppercase tracking-[0.14em] transition",
                tab === t ? "border-ink bg-ink text-paper" : "border-line text-muted hover:border-ink hover:text-ink",
              )}
            >
              {t === "ui" ? `Interface strings (${ui.length})` : `Content (${content.length})`}
            </button>
          ))}
        </div>

        <div className="relative min-w-[14rem] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" aria-hidden />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search key, English or translation…" className="field-box pl-9" />
        </div>

        <label className="flex items-center gap-1.5 text-xs">
          <input type="checkbox" checked={pendingOnly} onChange={(e) => setPendingOnly(e.target.checked)} className="h-3.5 w-3.5 accent-[rgb(var(--c-oxide))]" />
          Needs review only
        </label>

        <button
          type="button"
          onClick={() => void approveAllShown()}
          disabled={busy !== null || (tab === "ui" ? uiRows.length === 0 : contentRows.length === 0)}
          className="btn-outline px-3 py-2 text-[0.6rem] disabled:opacity-50"
        >
          {busy === "bulk" ? <Loader2 className="h-3 w-3 animate-spin" aria-hidden /> : <CheckCheck className="h-3 w-3" aria-hidden />}
          Approve all shown
        </button>
      </div>

      <div className="card divide-y divide-line/70">
        {tab === "ui" &&
          (uiRows.length === 0 ? (
            <p className="px-5 py-14 text-center text-sm text-muted">
              {ui.length === 0 ? "Nothing generated yet — run “Generate” on the languages screen." : "Everything here has been reviewed."}
            </p>
          ) : (
            uiRows.map((r) => (
              <div key={r.id} className={cn("grid gap-3 p-4 sm:grid-cols-2", done[r.id] && "opacity-50")}>
                <div>
                  <p className="break-all font-mono text-[0.6rem] text-muted">{r.key}</p>
                  <p className="mt-1 whitespace-pre-line text-sm">{r.source}</p>
                  <div className="mt-1.5 flex gap-1.5">
                    {r.machine && !r.approved && (
                      <span className="border border-warning/40 bg-warning/10 px-1.5 py-0.5 text-[0.55rem] font-semibold uppercase tracking-[0.12em] text-warning">machine</span>
                    )}
                    {r.approved && (
                      <span className="border border-success/40 bg-success/10 px-1.5 py-0.5 text-[0.55rem] font-semibold uppercase tracking-[0.12em] text-success">approved</span>
                    )}
                  </div>
                </div>
                <div>
                  <textarea
                    value={valueOf(r.id, r.value)}
                    onChange={(e) => setEdits((s) => ({ ...s, [r.id]: e.target.value }))}
                    rows={2}
                    lang={locale}
                    dir={rtl ? "rtl" : undefined}
                    aria-label={`${locale} translation for ${r.key}`}
                    className="field-box min-h-[2.6rem] resize-y text-sm"
                  />
                  <div className="mt-2 flex items-center gap-2">
                    {r.id in edits ? (
                      <button type="button" disabled={busy !== null} onClick={() => void review({ id: r.id, kind: "ui" }, "edit", edits[r.id])} className="btn px-3 py-2 text-[0.6rem] disabled:opacity-50">
                        {busy === r.id ? <Loader2 className="h-3 w-3 animate-spin" aria-hidden /> : <Save className="h-3 w-3" aria-hidden />}
                        Save & approve
                      </button>
                    ) : (
                      <button type="button" disabled={busy !== null || done[r.id]} onClick={() => void review({ id: r.id, kind: "ui" }, "approve")} className="btn-outline px-3 py-2 text-[0.6rem] disabled:opacity-50">
                        {busy === r.id ? <Loader2 className="h-3 w-3 animate-spin" aria-hidden /> : <Check className="h-3 w-3" aria-hidden />}
                        Approve
                      </button>
                    )}
                    {done[r.id] && <span className="text-[0.6rem] uppercase tracking-[0.12em] text-success">saved</span>}
                  </div>
                </div>
              </div>
            ))
          ))}

        {tab === "content" &&
          (contentRows.length === 0 ? (
            <p className="px-5 py-14 text-center text-sm text-muted">
              {content.length === 0 ? "No machine-translated content yet — use “Translate content” on the languages screen." : "Everything here has been reviewed."}
            </p>
          ) : (
            contentRows.map((r) => (
              <div key={r.id} className={cn("grid gap-3 p-4 sm:grid-cols-2", done[r.id] && "opacity-50")}>
                <div>
                  <p className="text-[0.58rem] font-semibold uppercase tracking-[0.12em] text-muted">
                    {r.model} · {r.recordLabel}
                  </p>
                  <p className="break-all font-mono text-[0.6rem] text-muted">{r.field}</p>
                  <p className="mt-1 whitespace-pre-line text-sm">{r.source || "—"}</p>
                  <div className="mt-1.5 flex gap-1.5">
                    {r.machine && !r.approved && (
                      <span className="border border-warning/40 bg-warning/10 px-1.5 py-0.5 text-[0.55rem] font-semibold uppercase tracking-[0.12em] text-warning">machine</span>
                    )}
                    {r.approved && (
                      <span className="border border-success/40 bg-success/10 px-1.5 py-0.5 text-[0.55rem] font-semibold uppercase tracking-[0.12em] text-success">approved</span>
                    )}
                    {r.stale && (
                      <span className="border border-danger/40 bg-danger/10 px-1.5 py-0.5 text-[0.55rem] font-semibold uppercase tracking-[0.12em] text-danger">English changed</span>
                    )}
                  </div>
                </div>
                <div>
                  <textarea
                    value={valueOf(r.id, r.value)}
                    onChange={(e) => setEdits((s) => ({ ...s, [r.id]: e.target.value }))}
                    rows={3}
                    lang={locale}
                    dir={rtl ? "rtl" : undefined}
                    aria-label={`${locale} translation for ${r.recordLabel} ${r.field}`}
                    className="field-box min-h-[3.4rem] resize-y text-sm"
                  />
                  <div className="mt-2 flex items-center gap-2">
                    {r.id in edits ? (
                      <button type="button" disabled={busy !== null} onClick={() => void review({ id: r.id, kind: "content" }, "edit", edits[r.id])} className="btn px-3 py-2 text-[0.6rem] disabled:opacity-50">
                        {busy === r.id ? <Loader2 className="h-3 w-3 animate-spin" aria-hidden /> : <Save className="h-3 w-3" aria-hidden />}
                        Save & approve
                      </button>
                    ) : (
                      <button type="button" disabled={busy !== null || done[r.id]} onClick={() => void review({ id: r.id, kind: "content" }, "approve")} className="btn-outline px-3 py-2 text-[0.6rem] disabled:opacity-50">
                        {busy === r.id ? <Loader2 className="h-3 w-3 animate-spin" aria-hidden /> : <Check className="h-3 w-3" aria-hidden />}
                        Approve
                      </button>
                    )}
                    {done[r.id] && <span className="text-[0.6rem] uppercase tracking-[0.12em] text-success">saved</span>}
                  </div>
                </div>
              </div>
            ))
          ))}
      </div>
    </div>
  );
}

export default ReviewQueue;
