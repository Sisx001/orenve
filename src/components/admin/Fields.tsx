"use client";

import { useId, useMemo, useState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { minorToMajor } from "@/lib/money";
import { useStudioLocales } from "@/components/admin/StudioLocales";
import { type AiWriteConfig, useAiWrite } from "@/components/admin/AiWrite";

/* ───────────────────────────── Field shell ───────────────────────────── */

export function Field({
  label,
  hint,
  error,
  required,
  children,
  htmlFor,
  className,
}: {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  required?: boolean;
  children: ReactNode;
  htmlFor?: string;
  className?: string;
}) {
  return (
    <div className={cn("block", className)}>
      {label && (
        <label htmlFor={htmlFor} className="mb-1.5 block text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-muted">
          {label}
          {required && <span className="text-oxide"> *</span>}
        </label>
      )}
      {children}
      {hint && !error && <p className="mt-1 text-xs text-muted">{hint}</p>}
      {error && (
        <p className="mt-1 text-xs text-danger" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

/* ───────────────────────────── Text / textarea / select ───────────────────────────── */

type TextFieldProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, "className"> & {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  className?: string;
  inputClassName?: string;
};

export function TextField({ label, hint, error, className, inputClassName, id, ...props }: TextFieldProps) {
  const auto = useId();
  const fid = id ?? auto;
  return (
    <Field label={label} hint={hint} error={error} required={props.required} htmlFor={fid} className={className}>
      <input id={fid} {...props} aria-invalid={!!error} className={cn("field-box", error && "border-danger", inputClassName)} />
    </Field>
  );
}

type TextAreaFieldProps = Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, "className"> & {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  className?: string;
  inputClassName?: string;
};

export function TextAreaField({ label, hint, error, className, inputClassName, id, ...props }: TextAreaFieldProps) {
  const auto = useId();
  const fid = id ?? auto;
  return (
    <Field label={label} hint={hint} error={error} required={props.required} htmlFor={fid} className={className}>
      <textarea id={fid} {...props} aria-invalid={!!error} className={cn("field-box min-h-[110px] resize-y", error && "border-danger", inputClassName)} />
    </Field>
  );
}

type SelectFieldProps = Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "className" | "children"> & {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  className?: string;
  options: { value: string; label: string; disabled?: boolean }[];
};

export function SelectField({ label, hint, error, className, options, id, ...props }: SelectFieldProps) {
  const auto = useId();
  const fid = id ?? auto;
  return (
    <Field label={label} hint={hint} error={error} required={props.required} htmlFor={fid} className={className}>
      <select id={fid} {...props} className={cn("field-box pr-8", error && "border-danger")}>
        {options.map((o) => (
          <option key={o.value} value={o.value} disabled={o.disabled}>
            {o.label}
          </option>
        ))}
      </select>
    </Field>
  );
}

/* ───────────────────────────── Checkbox / toggle rows ───────────────────────────── */

export function CheckboxField({
  name,
  label,
  hint,
  defaultChecked,
  checked,
  onChange,
  value = "on",
  disabled,
}: {
  name?: string;
  label: ReactNode;
  hint?: ReactNode;
  defaultChecked?: boolean;
  checked?: boolean;
  onChange?: (v: boolean) => void;
  value?: string;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <div className="flex items-start gap-2.5">
      <input
        id={id}
        type="checkbox"
        name={name}
        value={value}
        disabled={disabled}
        defaultChecked={defaultChecked}
        checked={checked}
        onChange={onChange ? (e) => onChange(e.target.checked) : undefined}
        className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-[rgb(var(--c-oxide))]"
      />
      <label htmlFor={id} className="cursor-pointer select-none">
        <span className="block text-sm leading-snug">{label}</span>
        {hint && <span className="mt-0.5 block text-xs text-muted">{hint}</span>}
      </label>
    </div>
  );
}

/** Form-friendly switch: a hidden checkbox styled as a toggle row. */
export function ToggleRow({
  name,
  label,
  hint,
  defaultChecked,
  disabled,
}: {
  name: string;
  label: ReactNode;
  hint?: ReactNode;
  defaultChecked?: boolean;
  disabled?: boolean;
}) {
  const id = useId();
  const [on, setOn] = useState(Boolean(defaultChecked));
  return (
    <div className="flex items-start justify-between gap-4 border-b border-line/70 py-3 last:border-0">
      <label htmlFor={id} className="cursor-pointer select-none pr-2">
        <span className="block text-sm font-medium leading-snug">{label}</span>
        {hint && <span className="mt-0.5 block text-xs text-muted">{hint}</span>}
      </label>
      <input id={id} type="checkbox" name={name} checked={on} onChange={(e) => setOn(e.target.checked)} disabled={disabled} className="peer sr-only" />
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-labelledby={id}
        disabled={disabled}
        onClick={() => setOn((v) => !v)}
        className={cn("relative mt-0.5 h-5 w-9 shrink-0 rounded-full border transition", on ? "border-oxide bg-oxide" : "border-line bg-line/50")}
      >
        <span className={cn("absolute top-0.5 h-3.5 w-3.5 rounded-full bg-paper transition", on ? "left-[18px]" : "left-0.5")} />
      </button>
    </div>
  );
}

/* ───────────────────────────── Money (major ↔ minor) ───────────────────────────── */

/**
 * Money input. The user types BDT major units; the visible field carries the
 * form `name`, and the action converts with `readMoney()`.
 */
export function MoneyInput({
  name,
  label,
  hint,
  error,
  defaultMinor,
  required,
  className,
  placeholder = "0",
  disabled,
}: {
  name: string;
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  defaultMinor?: number | null;
  required?: boolean;
  className?: string;
  placeholder?: string;
  disabled?: boolean;
}) {
  const id = useId();
  const initial = defaultMinor == null ? "" : String(minorToMajor(defaultMinor));
  return (
    <Field label={label} hint={hint} error={error} required={required} htmlFor={id} className={className}>
      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted">৳</span>
        <input
          id={id}
          name={name}
          type="text"
          inputMode="decimal"
          defaultValue={initial}
          required={required}
          disabled={disabled}
          placeholder={placeholder}
          className={cn("field-box pl-7 font-mono tabular-nums", error && "border-danger")}
        />
      </div>
    </Field>
  );
}

/* ───────────────────────────── i18n pair ───────────────────────────── */

/**
 * Bilingual (or multi-lingual) text input. Posts `<name>_<code>` for every
 * registered studio locale (e.g. `name_en`, `name_bn`), read server-side by
 * `readI18n(formData, name)`.
 *
 * Props:
 *  - `values`  – preferred way: `{ en: "…", bn: "…", … }`
 *  - `en`, `bn` – kept for backwards compat; merged into `values`
 *  - `ai`      – when provided, renders compact AI-write buttons
 */
export function I18nInput({
  name,
  label,
  hint,
  error,
  values,
  en,
  bn,
  multiline,
  rows = 4,
  required,
  placeholder,
  className,
  layout = "tabs",
  ai,
}: {
  name: string;
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  /** Preferred: record of locale code → initial value. */
  values?: Record<string, string>;
  /** Compat: English initial value. */
  en?: string;
  /** Compat: Bangla initial value. */
  bn?: string;
  multiline?: boolean;
  rows?: number;
  required?: boolean;
  placeholder?: string;
  className?: string;
  layout?: "tabs" | "stack";
  /** When provided, shows AI write buttons. */
  ai?: AiWriteConfig;
}) {
  const locales = useStudioLocales();
  const { write } = useAiWrite();

  /* Initialise controlled state once from props */
  const [vals, setVals] = useState<Record<string, string>>(() => {
    const base: Record<string, string> = {};
    for (const loc of locales) {
      base[loc.code] =
        values?.[loc.code] ??
        (loc.code === "en" ? (en ?? "") : loc.code === "bn" ? (bn ?? "") : "");
    }
    return base;
  });
  const [tab, setTab] = useState<string>(locales[0]?.code ?? "en");
  const [aiLocale, setAiLocale] = useState<string | null>(null);

  const inputCls = "field-box";

  /* ── helpers ── */

  function setVal(code: string, v: string) {
    setVals((prev) => ({ ...prev, [code]: v }));
  }

  const localeMap = useMemo(
    () => Object.fromEntries(locales.map((l) => [l.code, l])),
    [locales],
  );

  async function runAi(
    mode: "write" | "improve" | "translate",
    localeCode: string,
  ) {
    if (!ai) return;
    setAiLocale(localeCode);
    try {
      const result = await write({
        task: ai.task,
        locale: localeCode,
        context: ai.context,
        mode,
        text: mode === "improve" ? (vals[localeCode] ?? "") : undefined,
        sourceText: mode === "translate" ? (vals["en"] ?? "") : undefined,
        maxWords: ai.maxWords,
      });
      setVal(localeCode, result);
      toast.success("AI copy ready");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "AI write failed";
      if (msg === "ai.offline" || msg.includes("ai.offline")) {
        toast.info("AI not configured");
      } else {
        toast.error(msg);
      }
    } finally {
      setAiLocale(null);
    }
  }

  async function runAllLanguages() {
    if (!ai) return;
    const enText = vals["en"] ?? "";
    const targets = locales.filter((l) => l.code !== "en" && !(vals[l.code] ?? "").trim());
    for (const loc of targets) {
      setAiLocale(loc.code);
      try {
        const result = await write({
          task: ai.task,
          locale: loc.code,
          context: ai.context,
          mode: "translate",
          sourceText: enText,
          maxWords: ai.maxWords,
        });
        setVals((prev) => ({ ...prev, [loc.code]: result }));
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "AI write failed";
        if (msg === "ai.offline" || msg.includes("ai.offline")) {
          toast.info("AI not configured");
          break;
        } else {
          toast.error(`${loc.code}: ${msg}`);
        }
      }
    }
    setAiLocale(null);
    if (targets.length > 0) toast.success("All languages filled");
  }

  /* ── AI button row (tabs layout) ── */
  function AiRow({ localeCode }: { localeCode: string }) {
    if (!ai) return null;
    const isBusy = aiLocale !== null;
    const thisBusy = aiLocale === localeCode;
    return (
      <div className="mb-1.5 flex flex-wrap items-center gap-1">
        <AiBtn
          label="Write"
          busy={thisBusy}
          disabled={isBusy}
          onClick={() => runAi("write", localeCode)}
        />
        <AiBtn
          label="Improve"
          busy={false}
          disabled={isBusy || !(vals[localeCode] ?? "").trim()}
          onClick={() => runAi("improve", localeCode)}
        />
        {localeCode !== "en" && (
          <AiBtn
            label="Translate from English"
            busy={thisBusy}
            disabled={isBusy || !(vals["en"] ?? "").trim()}
            onClick={() => runAi("translate", localeCode)}
          />
        )}
        {localeCode === "en" && locales.length > 1 && (
          <AiBtn
            label="All languages"
            busy={aiLocale !== null && aiLocale !== "en"}
            disabled={isBusy || !(vals["en"] ?? "").trim()}
            onClick={runAllLanguages}
          />
        )}
      </div>
    );
  }

  /* ── single field renderer ── */
  function renderField(localeCode: string, hidden: boolean) {
    const loc = localeMap[localeCode];
    const isBn = localeCode === "bn";
    const isRtl = loc?.dir === "rtl";
    const fontFam = loc?.font ?? undefined;
    const commonCls = cn(
      inputCls,
      error && "border-danger",
      isBn && "font-bangla",
    );
    const commonProps = {
      name: `${name}_${localeCode}`,
      value: vals[localeCode] ?? "",
      onChange: (
        e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
      ) => setVal(localeCode, e.target.value),
      placeholder,
      required: required && localeCode === "en",
      lang: localeCode,
      dir: isRtl ? ("rtl" as const) : undefined,
      style: fontFam ? { fontFamily: fontFam } : undefined,
      className: commonCls,
    };
    return (
      <div className={cn(hidden && "hidden")}>
        {multiline ? (
          <textarea
            {...commonProps}
            rows={rows}
            className={cn(commonCls, "min-h-[110px] resize-y")}
          />
        ) : (
          <input type="text" {...commonProps} />
        )}
      </div>
    );
  }

  /* ── stack layout ── */
  if (layout === "stack") {
    const cols = locales.length === 1 ? 1 : 2;
    return (
      <Field label={label} hint={hint} error={error} required={required} className={className}>
        {ai && (
          <div className="mb-2 flex flex-wrap items-center gap-1">
            <AiBtn
              label="All languages"
              busy={aiLocale !== null}
              disabled={aiLocale !== null || !(vals["en"] ?? "").trim()}
              onClick={runAllLanguages}
            />
          </div>
        )}
        <div className={cn("grid gap-2", cols === 2 && "sm:grid-cols-2")}>
          {locales.map((loc) => (
            <div key={loc.code}>
              <span className="mb-1 block text-[0.58rem] uppercase tracking-[0.14em] text-muted">
                {loc.nativeName}
              </span>
              {ai && <AiRow localeCode={loc.code} />}
              {renderField(loc.code, false)}
            </div>
          ))}
        </div>
      </Field>
    );
  }

  /* ── tabs layout (default) ── */
  return (
    <Field label={label} hint={hint} error={error} required={required} className={className}>
      <div className="mb-1.5 flex flex-wrap gap-1">
        {locales.map((loc) => (
          <button
            key={loc.code}
            type="button"
            onClick={() => setTab(loc.code)}
            className={cn(
              "border px-2 py-0.5 text-[0.58rem] font-semibold uppercase tracking-[0.14em] transition",
              tab === loc.code
                ? "border-ink bg-ink text-paper"
                : "border-line text-muted hover:border-ink hover:text-ink",
            )}
          >
            {loc.nativeName}
          </button>
        ))}
      </div>
      {ai && <AiRow localeCode={tab} />}
      {locales.map((loc) => renderField(loc.code, tab !== loc.code))}
    </Field>
  );
}

/* ── tiny internal AI button ── */

function AiBtn({
  label,
  busy,
  disabled,
  onClick,
}: {
  label: string;
  busy: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || busy}
      className="inline-flex items-center gap-1 border border-line px-2 py-0.5 text-[0.58rem] font-semibold uppercase tracking-[0.14em] text-muted transition hover:border-oxide hover:text-oxide disabled:opacity-40"
    >
      {busy ? (
        <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
      ) : (
        <Sparkles className="h-3 w-3" aria-hidden />
      )}
      {label}
    </button>
  );
}

/* ───────────────────────────── Submit ───────────────────────────── */

export function SubmitButton({
  children = "Save",
  variant = "solid",
  size = "md",
  className,
  disabled,
  formAction,
  name,
  value,
  pendingLabel,
}: {
  children?: ReactNode;
  variant?: "solid" | "outline" | "ghost" | "accent" | "danger";
  size?: "sm" | "md";
  className?: string;
  disabled?: boolean;
  formAction?: string | ((fd: FormData) => void | Promise<void>);
  name?: string;
  value?: string;
  pendingLabel?: string;
}) {
  const { pending } = useFormStatus();
  const base =
    variant === "outline"
      ? "btn-outline"
      : variant === "ghost"
        ? "btn-ghost"
        : variant === "accent"
          ? "btn-accent"
          : variant === "danger"
            ? "btn border-danger bg-danger hover:bg-ink hover:border-ink"
            : "btn";
  return (
    <button
      type="submit"
      name={name}
      value={value}
      formAction={formAction as never}
      disabled={pending || disabled}
      className={cn(base, size === "sm" ? "px-4 py-2.5 text-[0.65rem]" : "", className)}
    >
      {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />}
      {pending && pendingLabel ? pendingLabel : children}
    </button>
  );
}

/* ───────────────────────────── Feedback banner ───────────────────────────── */

export function FormBanner({ state }: { state: { ok?: boolean; error?: string | null; message?: string | null } }) {
  if (!state.error && !state.message) return null;
  const bad = state.ok === false || Boolean(state.error);
  return (
    <div
      role="status"
      className={cn(
        "mb-4 border px-3.5 py-2.5 text-sm",
        bad ? "border-danger/40 bg-danger/10 text-danger" : "border-success/40 bg-success/10 text-success",
      )}
    >
      {state.error ?? state.message}
    </div>
  );
}
