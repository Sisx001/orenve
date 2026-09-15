"use client";

import { useState } from "react";
import { toast } from "sonner";
import type { ProductDetail } from "@/types";
import { useT, useLocale } from "@/lib/i18n/client";
import { apiFetch } from "@/lib/store/api";
import { Button, Input, Textarea } from "@/components/ui";
import { RatingStars } from "@/components/store/RatingStars";
import { SectionHeading } from "@/components/store/SectionHeading";
import { Reveal } from "@/components/store/Reveal";
import { cn } from "@/lib/utils";

type Review = ProductDetail["reviews"][number];

export function Reviews({ productId, reviews, rating }: { productId: string; reviews: Review[]; rating: ProductDetail["rating"] }) {
  const t = useT();
  const locale = useLocale();
  const [open, setOpen] = useState(false);

  const dateFmt = new Intl.DateTimeFormat(locale === "bn" ? "bn-BD" : "en-GB", { day: "numeric", month: "short", year: "numeric" });

  return (
    <section id="reviews" className="section border-t border-line" aria-labelledby="reviews-heading">
      <div className="container-page">
        <SectionHeading
          id="reviews-heading"
          eyebrow={t("product.reviews")}
          title={rating.count > 0 ? t("product.reviewCount", { count: rating.count }) : t("product.noReviews")}
          size="sm"
          action={
            <Button variant="outline" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
              {t("product.writeReview")}
            </Button>
          }
        />

        {rating.count > 0 && (
          <div className="mt-8 flex items-center gap-4">
            <span className="display text-display-sm tabular-nums">{rating.average}</span>
            <div>
              <RatingStars value={rating.average} size={16} />
              <p className="mt-1 text-xs text-muted">{t("product.reviewCount", { count: rating.count })}</p>
            </div>
          </div>
        )}

        {open && (
          <div className="mt-10 max-w-xl border border-line p-6">
            <ReviewForm productId={productId} onDone={() => setOpen(false)} />
          </div>
        )}

        {reviews.length > 0 && (
          <ul className="mt-14 grid gap-px bg-line md:grid-cols-2 xl:grid-cols-3">
            {reviews.map((r, i) => (
              <li key={r.id} className="bg-paper">
                <Reveal delay={Math.min(i * 0.06, 0.4)} className="flex h-full flex-col gap-3 p-7">
                  <RatingStars value={r.rating} />
                  {r.title && <p className="display text-lg leading-snug">{r.title}</p>}
                  <p className="flex-1 text-sm leading-relaxed text-muted">{r.body}</p>
                  <p className="eyebrow">
                    {r.customerName} · {dateFmt.format(new Date(r.createdAt))}
                  </p>
                </Reveal>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

export function ReviewForm({ productId, onDone }: { productId: string; onDone?: () => void }) {
  const t = useT();
  const [rating, setRating] = useState(5);
  const [name, setName] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await apiFetch("/api/reviews", { method: "POST", json: { productId, customerName: name, rating, title, body, website: "" } });
      setDone(true);
      toast.success(t("product.reviewSubmitted"));
      onDone?.();
    } catch (err) {
      const e2 = err as Error & { vars?: Record<string, string | number> };
      const msg = t(e2.message, e2.vars);
      setError(msg);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  if (done) return <p className="text-sm text-success">{t("product.reviewSubmitted")}</p>;

  return (
    <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
      <fieldset>
        <legend className="eyebrow mb-2">{t("product.rating")}</legend>
        <div className="flex items-center gap-1.5">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setRating(n)}
              aria-label={`${n}`}
              aria-pressed={rating === n}
              className={cn("p-1 transition", n <= rating ? "text-brass" : "text-line hover:text-muted")}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <path d="M12 2.5l2.9 6.05 6.6.83-4.82 4.56 1.2 6.56L12 17.35 6.12 20.5l1.2-6.56L2.5 9.38l6.6-.83L12 2.5z" />
              </svg>
            </button>
          ))}
        </div>
      </fieldset>
      <Input label={t("product.yourName")} value={name} onChange={(e) => setName(e.target.value)} required minLength={2} maxLength={80} />
      <Input label={t("product.reviewTitle")} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} />
      <Textarea label={t("product.reviewBody")} value={body} onChange={(e) => setBody(e.target.value)} required minLength={10} maxLength={2000} />
      <input type="text" name="website" value="" onChange={() => {}} tabIndex={-1} aria-hidden className="hidden" autoComplete="off" />
      {error && (
        <p className="text-xs text-danger" role="alert">
          {error}
        </p>
      )}
      <Button type="submit" loading={busy}>
        {t("product.writeReview")}
      </Button>
    </form>
  );
}
