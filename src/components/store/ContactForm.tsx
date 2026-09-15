"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useT } from "@/lib/i18n/client";
import { apiFetch } from "@/lib/store/api";
import { Button, Input, Textarea } from "@/components/ui";
import { LocaleLink } from "@/components/store/LocaleLink";

export function ContactForm() {
  const t = useT();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [honeypot, setHoneypot] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await apiFetch("/api/contact", { method: "POST", json: { name, email, phone, subject, message, website: honeypot } });
      setSent(true);
      toast.success(t("contact.sent"));
    } catch (err) {
      const e2 = err as Error & { vars?: Record<string, string | number> };
      const msg = t(e2.message, e2.vars);
      setError(msg);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <div className="border border-line bg-bone/40 p-8">
        <h2 className="display text-display-sm">{t("contact.sent")}</h2>
        <p className="mt-4 text-muted">{t("contact.sentText")}</p>
        <button
          type="button"
          onClick={() => {
            setSent(false);
            setMessage("");
            setSubject("");
          }}
          className="btn-ghost mt-6 text-oxide"
        >
          {t("contact.sendAnother")}
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-6">
      <div className="grid gap-6 sm:grid-cols-2">
        <Input label={t("contact.name")} value={name} onChange={(e) => setName(e.target.value)} required autoComplete="name" />
        <Input label={t("contact.email")} type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
        <Input label={t("contact.phone")} value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" autoComplete="tel" />
        <Input label={t("contact.subject")} value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={160} />
      </div>
      <Textarea label={t("contact.message")} value={message} onChange={(e) => setMessage(e.target.value)} required minLength={10} maxLength={4000} className="min-h-[9rem]" />
      <input type="text" name="website" value={honeypot} onChange={(e) => setHoneypot(e.target.value)} tabIndex={-1} aria-hidden autoComplete="off" className="hidden" />

      {error && (
        <p className="text-xs text-danger" role="alert">
          {error}
        </p>
      )}

      <p className="text-[0.68rem] leading-relaxed text-muted">
        {t("contact.privacyNote")}{" "}
        <LocaleLink href="/privacy" className="underline decoration-line underline-offset-4 hover:decoration-oxide">
          {t("checkout.privacy")}
        </LocaleLink>
      </p>

      <Button type="submit" loading={busy} className="self-start">
        {busy ? t("contact.sending") : t("contact.send")}
      </Button>
    </form>
  );
}
