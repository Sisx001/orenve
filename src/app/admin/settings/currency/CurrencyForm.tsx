"use client";

import { CsrfInput } from "@/components/admin/Csrf";
import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { Lock, Plus, Save, Trash2 } from "lucide-react";
import { CheckboxField, SelectField, SubmitButton, ToggleRow } from "@/components/admin/Fields";
import { Section } from "@/components/admin/PageHeader";
import { saveCurrencyAction } from "@/lib/admin/actions/settings";
import { idleState } from "@/lib/admin/action-state";
import { SUPPORTED_LOCALES } from "@/lib/constants";
import { cn } from "@/lib/utils";

export type CurrencyRow = { code: string; symbol: string; rate: number; decimals: number; enabled: boolean };

const LOCALE_LABELS: Record<string, string> = { en: "English", bn: "বাংলা (Bangla)" };

export function CurrencyForm({
  display,
  locale,
  csrf,
}: {
  display: CurrencyRow[];
  locale: { default: string; enabled: string[]; autoDetect: boolean };
  csrf: string;
}) {
  const [state, action] = useActionState(saveCurrencyAction, idleState);
  const [rows, setRows] = useState<CurrencyRow[]>(display);
  const [enabledLocales, setEnabledLocales] = useState<string[]>(locale.enabled);

  useEffect(() => {
    if (state.error) toast.error(state.error);
    else if (state.ok && state.message) toast.success(state.message);
  }, [state]);

  const patch = (i: number, next: Partial<CurrencyRow>) => setRows((s) => s.map((r, j) => (j === i ? { ...r, ...next } : r)));

  return (
    <form action={action} className="space-y-5">
      <CsrfInput value={csrf} />
      <input type="hidden" name="display" value={JSON.stringify(rows)} />
      {enabledLocales.map((l) => (
        <input key={l} type="hidden" name="locales" value={l} />
      ))}

      <Section
        title="Display currencies"
        description="BDT is the store currency — every price is stored in paisa. The others are indicative conversions you maintain."
        actions={
          <button
            type="button"
            onClick={() => setRows((s) => [...s, { code: "", symbol: "", rate: 0.01, decimals: 2, enabled: false }])}
            className="btn-outline px-3 py-2 text-[0.62rem]"
          >
            <Plus className="h-3 w-3" />
            Add currency
          </button>
        }
      >
        <div className="-mx-4 overflow-x-auto sm:-mx-5">
          <table className="w-full min-w-[40rem] border-collapse text-sm">
            <thead>
              <tr className="border-b border-line text-[0.58rem] uppercase tracking-[0.14em] text-muted">
                <th className="px-4 py-2 text-left font-semibold sm:px-5">Code</th>
                <th className="px-2 py-2 text-left font-semibold">Symbol</th>
                <th className="px-2 py-2 text-right font-semibold">Units per ৳1</th>
                <th className="px-2 py-2 text-right font-semibold">Decimals</th>
                <th className="px-2 py-2 text-center font-semibold">Shown</th>
                <th className="w-10 px-2 py-2" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const isBase = r.code.toUpperCase() === "BDT";
                return (
                  <tr key={`${r.code}-${i}`} className="border-b border-line/60 last:border-0">
                    <td className="px-4 py-2 sm:px-5">
                      <div className="flex items-center gap-1.5">
                        <input
                          value={r.code}
                          onChange={(e) => patch(i, { code: e.target.value.toUpperCase().slice(0, 3) })}
                          readOnly={isBase}
                          maxLength={3}
                          aria-label="Currency code"
                          className={cn("field-box w-20 py-1.5 font-mono text-xs uppercase", isBase && "bg-bone text-muted")}
                        />
                        {isBase && (
                          <span title="Store currency">
                            <Lock className="h-3 w-3 shrink-0 text-muted" />
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-2 py-2">
                      <input value={r.symbol} onChange={(e) => patch(i, { symbol: e.target.value.slice(0, 4) })} aria-label="Symbol" className="field-box w-16 py-1.5 text-xs" />
                    </td>
                    <td className="px-2 py-2 text-right">
                      <input
                        value={isBase ? "1" : String(r.rate)}
                        onChange={(e) => patch(i, { rate: Number(e.target.value) || 0 })}
                        readOnly={isBase}
                        inputMode="decimal"
                        aria-label="Rate"
                        className={cn("field-box w-28 py-1.5 text-right font-mono text-xs", isBase && "bg-bone text-muted")}
                      />
                    </td>
                    <td className="px-2 py-2 text-right">
                      <input
                        type="number"
                        min={0}
                        max={2}
                        value={r.decimals}
                        onChange={(e) => patch(i, { decimals: Math.min(2, Math.max(0, Number(e.target.value) || 0)) })}
                        aria-label="Decimals"
                        className="field-box w-16 py-1.5 text-right font-mono text-xs"
                      />
                    </td>
                    <td className="px-2 py-2 text-center">
                      <input
                        type="checkbox"
                        checked={isBase ? true : r.enabled}
                        disabled={isBase}
                        onChange={(e) => patch(i, { enabled: e.target.checked })}
                        aria-label="Shown in the switcher"
                        className="h-3.5 w-3.5 accent-[rgb(var(--c-oxide))]"
                      />
                    </td>
                    <td className="px-2 py-2 text-right">
                      {!isBase && (
                        <button type="button" onClick={() => setRows((s) => s.filter((_, j) => j !== i))} aria-label="Remove currency" className="p-1 text-muted hover:text-danger">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-muted">
          Example: at 0.0082 USD per ৳1, a ৳8,900 overshirt shows as $72.98. Orders are always charged in BDT — the rate is stored on the order for your records.
        </p>
      </Section>

      <Section title="Languages" description="Built-in languages only. Add more languages, generate translations and review them under Settings → Languages & translation.">
        <div className="space-y-2">
          {SUPPORTED_LOCALES.map((l) => (
            <CheckboxField
              key={l}
              label={LOCALE_LABELS[l] ?? l}
              checked={enabledLocales.includes(l)}
              onChange={(v) => setEnabledLocales((s) => (v ? [...s, l] : s.filter((x) => x !== l)))}
              hint={l === "en" ? "Required as the fallback language." : undefined}
              disabled={l === "en"}
            />
          ))}
        </div>
        <SelectField
          name="defaultLocale"
          label="Default language"
          defaultValue={locale.default}
          options={SUPPORTED_LOCALES.filter((l) => enabledLocales.includes(l)).map((l) => ({ value: l, label: LOCALE_LABELS[l] ?? l }))}
          className="mt-4"
          hint="Used when the visitor's browser gives no hint."
        />
        <div className="mt-2">
          <ToggleRow name="autoDetect" label="Detect the visitor's language" hint="Reads Accept-Language on the first visit, then remembers the choice." defaultChecked={locale.autoDetect} />
        </div>
      </Section>

      <div className="flex justify-end">
        <SubmitButton pendingLabel="Saving…">
          <Save className="h-3.5 w-3.5" />
          Save currencies & locales
        </SubmitButton>
      </div>
    </form>
  );
}

export default CurrencyForm;
