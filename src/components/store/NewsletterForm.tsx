"use client";

import { useState } from "react";
import { ArrowRight, Check } from "lucide-react";
import { useT, useLocale } from "@/lib/i18n/client";
import { apiFetch } from "@/lib/store/api";
import { LocaleLink } from "@/components/store/LocaleLink";
import { cn } from "@/lib/utils";

/** Compact newsletter capture. `variant="inline"` is the footer / maintenance version. */
export function NewsletterForm({ variant = "inline", className, showConsent = true }: { variant?: "inline" | "stacked"; className?: string; showConsent?: boolean }) {
  const t = useT();
  const locale = useLocale();
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "done">("idle");
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState("busy");
    setError(null);
    try {
      await apiFetch("/api/newsletter", { method: "POST", json: { email, locale, website: "" } });
      setState("done");
      setEmail("");
    } catch (err) {
      const e2 = err as Error & { vars?: Record<string, string | number> };
      setError(t(e2.message, e2.vars));
      setState("idle");
    }
  }

  if (state === "done") {
    return (
      <p className={cn("flex items-center gap-2 text-sm text-success", className)} role="status">
        <Check className="h-4 w-4" aria-hidden />
        {t("newsletter.success")}
      </p>
    );
  }

  return (
    <form onSubmit={submit} className={cn("w-full", className)} noValidate>
      <div className={cn(variant === "stacked" ? "flex flex-col gap-3" : "flex items-end gap-3")}>
        <label className="flex-1">
          <span className="sr-only">{t("newsletter.placeholder")}</span>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t("newsletter.placeholder")}
            autoComplete="email"
            aria-invalid={!!error}
            className="field"
          />
        </label>
        <input type="text" name="website" value="" onChange={() => {}} tabIndex={-1} aria-hidden className="hidden" autoComplete="off" />
        <button type="submit" disabled={state === "busy"} className={cn(variant === "stacked" ? "btn w-full" : "btn-ghost shrink-0 pb-3 text-ink hover:text-oxide")}>
          {t("newsletter.subscribe")}
          {variant === "inline" && <ArrowRight className="h-3.5 w-3.5" aria-hidden />}
        </button>
      </div>
      {error && (
        <p className="mt-2 text-xs text-danger" role="alert">
          {error}
        </p>
      )}
      {showConsent && (
        <p className="mt-3 text-[0.68rem] leading-relaxed text-muted">
          {t("newsletter.consent")}{" "}
          <LocaleLink href="/privacy" className="underline decoration-line underline-offset-4 hover:decoration-oxide">
            {t("checkout.privacy")}
          </LocaleLink>
        </p>
      )}
    </form>
  );
}
