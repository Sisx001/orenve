"use client";

import { useState } from "react";
import type { PublicOrderView } from "@/types";
import { useT, useLocale } from "@/lib/i18n/client";
import { apiFetch } from "@/lib/store/api";
import { Button, Input } from "@/components/ui";
import { OrderView } from "@/components/store/OrderView";

/** Public lookup form: reference + phone must both match. */
export function TrackForm() {
  const t = useT();
  const locale = useLocale();
  const [reference, setReference] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [order, setOrder] = useState<PublicOrderView | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await apiFetch<{ order: PublicOrderView }>("/api/track", { method: "POST", json: { reference: reference.trim(), phone: phone.trim(), locale } });
      setOrder(r.order);
    } catch (err) {
      const e2 = err as Error & { vars?: Record<string, string | number> };
      setError(t(e2.message, e2.vars));
      setOrder(null);
    } finally {
      setBusy(false);
    }
  }

  if (order) {
    return (
      <div>
        <OrderView order={order} />
        <div className="mx-auto mt-10 max-w-4xl">
          <button type="button" onClick={() => setOrder(null)} className="btn-ghost text-muted hover:text-ink">
            {t("tracking.find")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="mx-auto max-w-md">
      <div className="flex flex-col gap-6">
        <Input
          label={t("tracking.orderNumber")}
          value={reference}
          onChange={(e) => setReference(e.target.value)}
          required
          minLength={4}
          autoComplete="off"
          className="uppercase"
          placeholder="ORY-2026-000001"
        />
        <Input label={t("tracking.phone")} value={phone} onChange={(e) => setPhone(e.target.value)} required inputMode="tel" autoComplete="tel" placeholder="01XXXXXXXXX" />
      </div>
      {error && (
        <p className="mt-4 text-sm text-danger" role="alert">
          {error}
        </p>
      )}
      <Button type="submit" loading={busy} className="mt-8 w-full">
        {t("tracking.find")}
      </Button>
    </form>
  );
}
