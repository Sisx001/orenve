"use client";

import { useId, useState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { minorToMajor } from "@/lib/money";

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
 * English + Bangla pair. Posts `<name>_en` and `<name>_bn`, read back by
 * `readI18n(formData, name)`.
 */
export function I18nInput({
  name,
  label,
  hint,
  error,
  en,
  bn,
  multiline,
  rows = 4,
  required,
  placeholder,
  className,
  layout = "tabs",
}: {
  name: string;
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  en?: string;
  bn?: string;
  multiline?: boolean;
  rows?: number;
  required?: boolean;
  placeholder?: string;
  className?: string;
  layout?: "tabs" | "stack";
}) {
  const [tab, setTab] = useState<"en" | "bn">("en");
  const inputCls = "field-box";

  const field = (locale: "en" | "bn", hidden: boolean) => {
    const common = {
      name: `${name}_${locale}`,
      defaultValue: locale === "en" ? (en ?? "") : (bn ?? ""),
      placeholder: placeholder,
      required: required && locale === "en",
      lang: locale,
      className: cn(inputCls, error && "border-danger", locale === "bn" && "font-bangla"),
    };
    return (
      <div className={cn(hidden && "hidden")}>
        {multiline ? <textarea {...common} rows={rows} className={cn(common.className, "min-h-[110px] resize-y")} /> : <input type="text" {...common} />}
      </div>
    );
  };

  if (layout === "stack") {
    return (
      <Field label={label} hint={hint} error={error} required={required} className={className}>
        <div className="grid gap-2 sm:grid-cols-2">
          <div>
            <span className="mb-1 block text-[0.58rem] uppercase tracking-[0.14em] text-muted">English</span>
            {field("en", false)}
          </div>
          <div>
            <span className="mb-1 block text-[0.58rem] uppercase tracking-[0.14em] text-muted">বাংলা</span>
            {field("bn", false)}
          </div>
        </div>
      </Field>
    );
  }

  return (
    <Field label={label} hint={hint} error={error} required={required} className={className}>
      <div className="mb-1.5 flex gap-1">
        {(["en", "bn"] as const).map((l) => (
          <button
            key={l}
            type="button"
            onClick={() => setTab(l)}
            className={cn(
              "border px-2 py-0.5 text-[0.58rem] font-semibold uppercase tracking-[0.14em] transition",
              tab === l ? "border-ink bg-ink text-paper" : "border-line text-muted hover:border-ink hover:text-ink",
            )}
          >
            {l === "en" ? "English" : "বাংলা"}
          </button>
        ))}
      </div>
      {field("en", tab !== "en")}
      {field("bn", tab !== "bn")}
    </Field>
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
