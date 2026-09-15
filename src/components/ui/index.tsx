"use client";

import { forwardRef, useEffect, useId, useRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

/* ─────────────────────────── Buttons ─────────────────────────── */
type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "solid" | "outline" | "ghost" | "accent" | "danger"; size?: "sm" | "md" | "lg"; loading?: boolean };
export const Button = forwardRef<HTMLButtonElement, BtnProps>(function Button({ className, variant = "solid", size = "md", loading, children, disabled, ...props }, ref) {
  const base = variant === "outline" ? "btn-outline" : variant === "ghost" ? "btn-ghost" : variant === "accent" ? "btn-accent" : variant === "danger" ? "btn border-danger bg-danger hover:bg-ink hover:border-ink" : "btn";
  const sz = size === "sm" ? "px-4 py-2.5 text-[0.65rem]" : size === "lg" ? "px-8 py-4.5 text-[0.75rem]" : "";
  return (
    <button ref={ref} className={cn(base, sz, className)} disabled={disabled || loading} {...props}>
      {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />}
      {children}
    </button>
  );
});

/* ─────────────────────────── Fields ─────────────────────────── */
type FieldWrapProps = { label?: ReactNode; hint?: ReactNode; error?: ReactNode; required?: boolean; children: ReactNode; className?: string; id?: string };
export function FieldWrap({ label, hint, error, required, children, className, id }: FieldWrapProps) {
  return (
    <label className={cn("block", className)} htmlFor={id}>
      {label && (
        <span className="eyebrow mb-2 block">
          {label}
          {required && <span className="text-oxide"> *</span>}
        </span>
      )}
      {children}
      {hint && !error && <span className="mt-1.5 block text-xs text-muted">{hint}</span>}
      {error && (
        <span className="mt-1.5 block text-xs text-danger" role="alert">
          {error}
        </span>
      )}
    </label>
  );
}

type InputProps = InputHTMLAttributes<HTMLInputElement> & { label?: ReactNode; hint?: ReactNode; error?: ReactNode; boxed?: boolean };
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input({ label, hint, error, boxed, className, id, required, ...props }, ref) {
  const auto = useId();
  const inputId = id ?? auto;
  return (
    <FieldWrap label={label} hint={hint} error={error} required={required} id={inputId}>
      <input ref={ref} id={inputId} required={required} aria-invalid={!!error} className={cn(boxed ? "field-box" : "field", error && "border-danger", className)} {...props} />
    </FieldWrap>
  );
});

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: ReactNode; hint?: ReactNode; error?: ReactNode; boxed?: boolean };
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea({ label, hint, error, boxed, className, id, required, ...props }, ref) {
  const auto = useId();
  const inputId = id ?? auto;
  return (
    <FieldWrap label={label} hint={hint} error={error} required={required} id={inputId}>
      <textarea ref={ref} id={inputId} required={required} aria-invalid={!!error} className={cn(boxed ? "field-box" : "field", "min-h-[96px] resize-y", error && "border-danger", className)} {...props} />
    </FieldWrap>
  );
});

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & { label?: ReactNode; hint?: ReactNode; error?: ReactNode; boxed?: boolean; options: { value: string; label: string }[] };
export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select({ label, hint, error, boxed, className, id, options, required, ...props }, ref) {
  const auto = useId();
  const inputId = id ?? auto;
  return (
    <FieldWrap label={label} hint={hint} error={error} required={required} id={inputId}>
      <select ref={ref} id={inputId} required={required} className={cn(boxed ? "field-box" : "field", "appearance-none bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2212%22 height=%2212%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22currentColor%22 stroke-width=%222%22><path d=%22m6 9 6 6 6-6%22/></svg>')] bg-[length:12px] bg-[right_0.25rem_center] bg-no-repeat pr-6", className)} {...props}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </FieldWrap>
  );
});

export function Switch({ checked, onChange, label, hint, disabled, id }: { checked: boolean; onChange: (v: boolean) => void; label?: ReactNode; hint?: ReactNode; disabled?: boolean; id?: string }) {
  const auto = useId();
  const sid = id ?? auto;
  return (
    <div className="flex items-start justify-between gap-4">
      {(label || hint) && (
        <label htmlFor={sid} className="cursor-pointer">
          {label && <span className="block text-sm font-medium">{label}</span>}
          {hint && <span className="block text-xs text-muted">{hint}</span>}
        </label>
      )}
      <button
        id={sid}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn("relative h-6 w-11 shrink-0 rounded-full border transition", checked ? "border-oxide bg-oxide" : "border-line bg-line/60")}
      >
        <span className={cn("absolute top-0.5 h-[18px] w-[18px] rounded-full bg-paper shadow transition", checked ? "left-[22px]" : "left-0.5")} />
      </button>
    </div>
  );
}

/* ─────────────────────────── Badges / misc ─────────────────────────── */
export function Badge({ children, tone = "neutral", className }: { children: ReactNode; tone?: "neutral" | "accent" | "success" | "danger" | "warning" | "brass"; className?: string }) {
  const tones = {
    neutral: "bg-bone text-ink border-line",
    accent: "bg-oxide text-snow border-oxide",
    success: "bg-success/10 text-success border-success/30",
    danger: "bg-danger/10 text-danger border-danger/30",
    warning: "bg-warning/10 text-warning border-warning/30",
    brass: "bg-brass/15 text-ink border-brass/40",
  };
  return <span className={cn("inline-flex items-center gap-1 border px-2 py-0.5 text-[0.62rem] font-semibold uppercase tracking-[0.14em]", tones[tone], className)}>{children}</span>;
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn("h-5 w-5 animate-spin text-muted", className)} aria-label="Loading" />;
}

export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn("eyebrow", className)}>{children}</span>;
}

/* ─────────────────────────── Modal / Drawer ─────────────────────────── */
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  side = "center",
  className,
  testId,
}: {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  side?: "center" | "right" | "left" | "bottom";
  className?: string;
  testId?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    setTimeout(() => ref.current?.querySelector<HTMLElement>("button, input, [tabindex]")?.focus(), 30);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      prev?.focus?.();
    };
  }, [open, onClose]);

  const variants = {
    center: { initial: { opacity: 0, y: 16, scale: 0.98 }, animate: { opacity: 1, y: 0, scale: 1 }, exit: { opacity: 0, y: 8, scale: 0.98 } },
    right: { initial: { x: "100%" }, animate: { x: 0 }, exit: { x: "100%" } },
    left: { initial: { x: "-100%" }, animate: { x: 0 }, exit: { x: "-100%" } },
    bottom: { initial: { y: "100%" }, animate: { y: 0 }, exit: { y: "100%" } },
  }[side];

  const position = {
    center: "inset-0 flex items-center justify-center p-4",
    right: "inset-y-0 right-0 flex justify-end",
    left: "inset-y-0 left-0 flex",
    bottom: "inset-x-0 bottom-0 flex items-end",
  }[side];

  const panel = {
    center: "w-full max-w-lg max-h-[90dvh]",
    right: "h-full w-full max-w-md sm:max-w-lg",
    left: "h-full w-full max-w-sm",
    bottom: "w-full max-h-[92dvh] rounded-t-2xl",
  }[side];

  return (
    <AnimatePresence>
      {open && (
        <div className={cn("fixed z-[90]", position)} role="dialog" aria-modal="true" data-testid={testId}>
          <motion.div className="fixed inset-0 bg-coal/60 backdrop-blur-[2px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.div
            ref={ref}
            className={cn("relative flex flex-col overflow-hidden bg-paper text-ink shadow-2xl", panel, className)}
            initial={variants.initial}
            animate={variants.animate}
            exit={variants.exit}
            transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="flex items-start justify-between gap-4 border-b border-line px-6 py-4">
              <div>
                {title && <h2 className="display text-xl">{title}</h2>}
                {description && <p className="mt-1 text-xs text-muted">{description}</p>}
              </div>
              <button onClick={onClose} aria-label="Close" className="-mr-2 p-2 text-muted hover:text-ink">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

/* ─────────────────────────── Empty state ─────────────────────────── */
export function EmptyState({ title, text, action }: { title: ReactNode; text?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center py-24 text-center">
      <span aria-hidden className="display text-5xl text-line">O/</span>
      <h2 className="display mt-6 text-display-sm">{title}</h2>
      {text && <p className="mt-3 max-w-md text-muted">{text}</p>}
      {action && <div className="mt-8">{action}</div>}
    </div>
  );
}

/* ─────────────────────────── Tabs ─────────────────────────── */
export function Tabs<T extends string>({ value, onChange, items, className }: { value: T; onChange: (v: T) => void; items: { value: T; label: ReactNode; count?: number }[]; className?: string }) {
  return (
    <div className={cn("no-scrollbar flex gap-1 overflow-x-auto border-b border-line", className)} role="tablist">
      {items.map((it) => (
        <button
          key={it.value}
          role="tab"
          aria-selected={value === it.value}
          onClick={() => onChange(it.value)}
          className={cn("-mb-px whitespace-nowrap border-b-2 px-3 py-2.5 text-[0.7rem] font-semibold uppercase tracking-[0.14em] transition", value === it.value ? "border-oxide text-ink" : "border-transparent text-muted hover:text-ink")}
        >
          {it.label}
          {it.count != null && <span className="ml-1.5 text-muted">{it.count}</span>}
        </button>
      ))}
    </div>
  );
}
