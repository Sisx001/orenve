"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, ExternalLink, MessageCircle, ShoppingBag } from "lucide-react";
import { useCart } from "@/hooks/useCart";
import { useT, useLocale } from "@/lib/i18n/client";
import { useConfig } from "@/components/providers/ConfigProvider";
import { apiFetch } from "@/lib/store/api";
import { i18nText } from "@/lib/json";
import { localizedPath } from "@/lib/i18n";
import { type PaymentMethod } from "@/lib/constants";
import { AddressFields } from "@/components/store/AddressFields";

import { Button, EmptyState, Input, Textarea } from "@/components/ui";
import { LocaleLink } from "@/components/store/LocaleLink";
import { CopyButton } from "@/components/store/CopyButton";
import { cn } from "@/lib/utils";

const REDIRECT_METHODS: PaymentMethod[] = ["sslcommerz", "stripe", "aamarpay", "shurjopay", "bkash_checkout", "nagad_checkout"];

type Quote = {
  subtotal: number;
  shipping: number;
  codFee: number;
  discount: number;
  total: number;
  zone: { id: string; etaMinDays: number; etaMaxDays: number; freeAbove: number | null } | null;
  coupon: { code: string; type: string; value: number } | null;
  methods: PaymentMethod[];
};

type Handoff = { whatsapp: string | null; messenger: string | null; message: string };
type Placed = { number: string; trackingCode: string; total: number; paymentMethod: string; paymentStatus: string };

type Errors = Partial<Record<"customerName" | "phone" | "email" | "line1" | "city" | "district" | "paymentMethod" | "trx" | "sender" | "consent", string>>;

const PHONE_RE = /^(\+?880|0)?1[3-9]\d{8}$/;
const STEPS = ["stepDetails", "stepDelivery", "stepPayment", "stepReview"] as const;
type StepKey = (typeof STEPS)[number];

export function CheckoutFlow({ initialChannel }: { initialChannel: "website" | "whatsapp" | "messenger" }) {
  const t = useT();
  const locale = useLocale();
  const router = useRouter();
  const cart = useCart();
  const { config, currency, money } = useConfig();
  const checkout = config.checkout;

  const [channel, setChannel] = useState<"website" | "whatsapp" | "messenger">(initialChannel);
  const conversational = channel !== "website";

  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [line1, setLine1] = useState("");
  const [line2, setLine2] = useState("");
  const [city, setCity] = useState("");
  const [district, setDistrict] = useState("");
  const [districtId, setDistrictId] = useState<string | undefined>(undefined);
  const [divisionId, setDivisionId] = useState<string | undefined>(undefined);
  const [division, setDivision] = useState("");
  const [upazila, setUpazila] = useState("");
  const [area, setArea] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [notes, setNotes] = useState("");
  const [coupon, setCoupon] = useState(cart.couponCode);
  const [method, setMethod] = useState<PaymentMethod | "">("");
  const [trx, setTrx] = useState("");
  const [sender, setSender] = useState("");
  const [consent, setConsent] = useState(false);
  const [honeypot, setHoneypot] = useState("");

  const [quote, setQuote] = useState<Quote | null>(null);
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);
  const [handoff, setHandoff] = useState<{ handoff: Handoff; order: Placed } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const items = useMemo(() => cart.lines.map((l) => ({ variantId: l.variantId, quantity: l.quantity })), [cart.lines]);
  const itemsKey = JSON.stringify(items);

  /* ── live quote ── */
  const fetchQuote = useCallback(
    async (dist: string, code: string, pay: string) => {
      if (items.length === 0) return;
      try {
        const r = await apiFetch<Quote>("/api/checkout/quote", {
          method: "POST",
          json: { items, district: dist || undefined, couponCode: code || undefined, locale, paymentMethod: pay || undefined },
        });
        setQuote(r);
      } catch (e) {
        const err = e as Error & { vars?: Record<string, string | number> };
        if (code) toast.error(t(err.message, err.vars));
      }
    },
    // items identity is captured through itemsKey
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [itemsKey, locale, t],
  );

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void fetchQuote(district, coupon.trim().toUpperCase(), method), 350);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [district, coupon, method, fetchQuote]);

  /* ── default payment method once methods are known ── */
  useEffect(() => {
    if (conversational) {
      setMethod("none");
      return;
    }
    if (!quote) return;
    if (method === "none" || (method && !quote.methods.includes(method))) setMethod(quote.methods[0] ?? "");
    if (!method) setMethod(quote.methods[0] ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quote, conversational]);

  /* ── validation ── */
  const stepKeys: readonly StepKey[] = conversational ? (["stepDetails", "stepDelivery", "stepReview"] as const) : STEPS;

  function validate(through: readonly StepKey[]): Errors {
    const e: Errors = {};
    if (through.includes("stepDetails")) {
      if (name.trim().length < 2) e.customerName = t("checkout.errName");
      if (!PHONE_RE.test(phone.replace(/[\s-]/g, ""))) e.phone = t("checkout.errPhone");
      if ((checkout.requireEmail || email.trim()) && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) e.email = t("checkout.errEmail");
    }

    if (through.includes("stepDelivery")) {
      if (!district) e.district = t("checkout.errDistrict");
      if (!conversational) {
        if (line1.trim().length < 3) e.line1 = t("checkout.errLine1");
        if (city.trim().length < 2) e.city = t("checkout.errCity");
      }
    }

    if (through.includes("stepPayment") && !conversational) {
      if (!method) e.paymentMethod = t("checkout.errPayment");
      if (method === "bkash" || method === "nagad") {
        if (trx.trim().length < 6) e.trx = t("checkout.errTrx");
        if (sender.trim().length < 8) e.sender = t("checkout.errSender");
      }
    }

    if (through.includes("stepReview") && !consent) e.consent = t("checkout.errConsent");
    return e;
  }

  function next() {
    const e = validate(stepKeys.slice(0, step + 1));
    setErrors(e);
    if (Object.keys(e).length > 0) {
      toast.error(t("errors.invalidInput"));
      return;
    }
    setStep((s) => Math.min(stepKeys.length - 1, s + 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function submit(ev: React.FormEvent) {
    ev.preventDefault();
    const e = validate(stepKeys);
    setErrors(e);
    if (Object.keys(e).length > 0) {
      toast.error(t("errors.invalidInput"));
      return;
    }
    setBusy(true);
    try {
      const body: Record<string, unknown> = {
        items,
        customerName: name.trim(),
        phone: phone.replace(/[\s-]/g, ""),
        email: email.trim() || undefined,
        address: {
          line1: conversational ? (line1.trim() || district) : line1.trim(),
          line2: line2.trim() || undefined,
          city: conversational ? (city.trim() || district) : city.trim(),
          district,
          division: division || undefined,
          upazila: upazila || undefined,
          area: area || undefined,
          postalCode: postalCode.trim() || undefined,
          country: "BD",
        },
        notes: notes.trim() || undefined,
        couponCode: coupon.trim().toUpperCase() || undefined,
        paymentMethod: conversational ? "none" : method,
        currency: currency.code,
        locale,
        channel,
        ...(method === "bkash" || method === "nagad" ? { mfs: { transactionId: trx.trim(), senderNumber: sender.trim() } } : {}),
        website: honeypot,
      };

      const res = await apiFetch<{
        order: Placed;
        payment: { kind: "none" } | { kind: "redirect"; url: string } | { kind: "instructions"; number: string; instructions: { en: string; bn: string } };
        handoff: Handoff | null;
      }>("/api/checkout", { method: "POST", json: body });

      cart.clear();

      if (res.payment.kind === "redirect") {
        window.location.assign(res.payment.url);
        return;
      }
      if (res.handoff) {
        setHandoff({ handoff: res.handoff, order: res.order });
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }
      router.push(`${localizedPath(`/order/${res.order.trackingCode}`, locale)}?placed=1`);
    } catch (err) {
      const e2 = err as Error & { vars?: Record<string, string | number> };
      const msg = t(e2.message, e2.vars);
      toast.error(msg);
      setErrors((prev) => ({ ...prev, paymentMethod: msg }));
    } finally {
      setBusy(false);
    }
  }

  /* ── handoff panel ── */
  if (handoff) {
    const url = channel === "messenger" ? handoff.handoff.messenger : handoff.handoff.whatsapp;
    return (
      <div className="container-page section">
        <div className="mx-auto max-w-xl">
          <p className="eyebrow">{t("checkout.eyebrow")}</p>
          <h1 className="display mt-4 text-display-md">{t("checkout.whatsappTitle")}</h1>
          <p className="mt-5 text-muted">{t("checkout.whatsappText")}</p>

          <div className="mt-8 border border-line bg-bone/40 p-5">
            <p className="eyebrow mb-2">{t("checkout.trackingCodeLabel")}</p>
            <p className="display text-display-sm tracking-[0.1em]">{handoff.order.trackingCode}</p>
            <CopyButton value={handoff.order.trackingCode} className="mt-2" />
          </div>

          <pre className="mt-6 whitespace-pre-wrap border border-line bg-paper p-5 font-sans text-sm leading-relaxed text-muted">{handoff.handoff.message}</pre>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            {url && (
              <a href={url} target="_blank" rel="noopener noreferrer" className="btn">
                <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                {channel === "messenger" ? t("checkout.openMessenger") : t("checkout.openWhatsapp")}
              </a>
            )}
            <CopyButton value={handoff.handoff.message} label={t("checkout.copySummary")} className="text-ink" />
            <LocaleLink href={`/order/${handoff.order.trackingCode}`} className="btn-ghost text-oxide">
              {t("checkout.viewOrder")}
            </LocaleLink>
          </div>

          <p className="mt-8 text-xs leading-relaxed text-muted">{t("checkout.inquiryNote")}</p>
        </div>
      </div>
    );
  }

  if (cart.lines.length === 0) {
    return (
      <div className="container-page">
        <EmptyState
          title={t("cart.empty")}
          text={t("cart.emptyText")}
          action={
            <LocaleLink href="/shop" className="btn">
              {t("cart.explore")}
            </LocaleLink>
          }
        />
      </div>
    );
  }

  const methods = conversational ? [] : (quote?.methods ?? []);
  const zone = quote?.zone ?? null;
  const total = quote?.total ?? cart.subtotal;

  const methodLabel: Record<PaymentMethod, string> = {
    cod: t("checkout.cod"),
    bkash: t("checkout.bkash"),
    nagad: t("checkout.nagad"),
    bkash_checkout: t("checkout.bkash_checkout"),
    nagad_checkout: t("checkout.nagad_checkout"),
    sslcommerz: t("checkout.sslcommerz"),
    aamarpay: t("checkout.aamarpay"),
    shurjopay: t("checkout.shurjopay"),
    stripe: t("checkout.stripe"),
    none: t("tracking.methods.none"),
  };
  const methodHint: Record<PaymentMethod, string> = {
    cod: t("checkout.codHint"),
    bkash: t("checkout.mfsHint"),
    nagad: t("checkout.mfsHint"),
    bkash_checkout: t("checkout.bkash_checkoutHint"),
    nagad_checkout: t("checkout.nagad_checkoutHint"),
    sslcommerz: t("checkout.sslcommerzHint"),
    aamarpay: t("checkout.aamarpayHint"),
    shurjopay: t("checkout.shurjopayHint"),
    stripe: t("checkout.stripeHint"),
    none: "",
  };

  const showStep = (key: StepKey) => (stepKeys[step] === key ? "" : "hidden lg:block");

  return (
    <div className="container-page pb-24 pt-12">
      <div className="mx-auto max-w-6xl">
        <p className="eyebrow">{t("checkout.eyebrow")}</p>
        <h1 className="display mt-4 text-display-md">{t("checkout.title")}</h1>

        {/* channel switch */}
        {(checkout.whatsapp || checkout.messenger) && config.contact.whatsapp && (
          <div className="mt-8 inline-flex border border-line p-1" role="group" aria-label={t("checkout.eyebrow")}>
            {checkout.website && (
              <button
                type="button"
                onClick={() => setChannel("website")}
                aria-pressed={channel === "website"}
                className={cn("px-4 py-2.5 text-[0.66rem] font-semibold uppercase tracking-[0.14em] transition", channel === "website" ? "bg-ink text-paper" : "text-muted hover:text-ink")}
              >
                {t("checkout.channelWebsite")}
              </button>
            )}
            {checkout.whatsapp && (
              <button
                type="button"
                onClick={() => setChannel("whatsapp")}
                aria-pressed={channel === "whatsapp"}
                className={cn("flex items-center gap-2 px-4 py-2.5 text-[0.66rem] font-semibold uppercase tracking-[0.14em] transition", channel === "whatsapp" ? "bg-ink text-paper" : "text-muted hover:text-ink")}
              >
                <MessageCircle className="h-3.5 w-3.5" aria-hidden />
                {t("product.orderWhatsapp")}
              </button>
            )}
            {checkout.messenger && config.contact.messengerPage && (
              <button
                type="button"
                onClick={() => setChannel("messenger")}
                aria-pressed={channel === "messenger"}
                className={cn("px-4 py-2.5 text-[0.66rem] font-semibold uppercase tracking-[0.14em] transition", channel === "messenger" ? "bg-ink text-paper" : "text-muted hover:text-ink")}
              >
                {t("product.orderMessenger")}
              </button>
            )}
          </div>
        )}

        {conversational && <p className="mt-5 max-w-xl text-sm text-muted">{t("checkout.whatsappText")}</p>}

        {/* mobile stepper */}
        <ol className="mt-10 flex items-center gap-2 lg:hidden" aria-label={t("checkout.eyebrow")}>
          {stepKeys.map((s, i) => (
            <li key={s} className="flex flex-1 items-center gap-2">
              <button
                type="button"
                onClick={() => i < step && setStep(i)}
                aria-current={step === i}
                className={cn(
                  "flex h-7 w-7 shrink-0 items-center justify-center border text-[0.6rem] font-semibold",
                  i < step ? "border-oxide bg-oxide text-snow" : step === i ? "border-ink text-ink" : "border-line text-muted",
                )}
              >
                {i < step ? <Check className="h-3 w-3" aria-hidden /> : i + 1}
              </button>
              {i < stepKeys.length - 1 && <span aria-hidden className={cn("h-px flex-1", i < step ? "bg-oxide" : "bg-line")} />}
            </li>
          ))}
        </ol>
        <p className="mt-3 text-[0.68rem] uppercase tracking-[0.16em] text-muted lg:hidden">{t(`checkout.${stepKeys[step]}`)}</p>

        <form onSubmit={submit} noValidate className="mt-10 grid gap-14 lg:grid-cols-[1.35fr_1fr] lg:gap-20">
          <div className="flex flex-col gap-14">
            {/* 1 — details */}
            <section className={showStep("stepDetails")} aria-labelledby="co-details">
              <h2 id="co-details" className="display mb-6 text-display-sm">
                {t("checkout.contact")}
              </h2>
              <div className="grid gap-6 sm:grid-cols-2">
                <Input label={t("checkout.name")} value={name} onChange={(e) => setName(e.target.value)} error={errors.customerName} required autoComplete="name" className="sm:col-span-2" />
                <Input
                  label={t("checkout.phone")}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  error={errors.phone}
                  hint={t("checkout.phoneHint")}
                  required
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="01XXXXXXXXX"
                />
                <Input
                  label={`${t("checkout.email")}${checkout.requireEmail ? "" : ` (${t("common.optional")})`}`}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  error={errors.email}
                  hint={t("checkout.emailHint")}
                  type="email"
                  autoComplete="email"
                  required={checkout.requireEmail}
                />
              </div>
            </section>

            {/* 2 — delivery */}
            <section className={showStep("stepDelivery")} aria-labelledby="co-delivery">
              <h2 id="co-delivery" className="display mb-6 text-display-sm">
                {conversational ? t("checkout.deliveryMethod") : t("checkout.address")}
              </h2>
              <div className="grid gap-6 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <AddressFields
                    value={{ divisionId, division, districtId, district, upazila, area, postalCode: postalCode || undefined, city }}
                    onChange={(v) => {
                      setDivisionId(v.divisionId);
                      setDivision(v.division ?? "");
                      setDistrictId(v.districtId);
                      setDistrict(v.district);
                      setUpazila(v.upazila ?? "");
                      setArea(v.area ?? "");
                      setPostalCode(v.postalCode ?? "");
                      setCity(v.city || v.area || v.upazila || "");
                    }}
                    levels={conversational ? ["district", "upazila"] : (config.geo?.addressLevels ?? ["district", "upazila", "area", "postcode"])}
                    autoDetect={config.geo?.autoDetect ?? true}
                    allowCustomArea={config.geo?.allowCustomArea ?? true}
                    requirePostcode={config.geo?.requirePostcode ?? false}
                    errors={{ district: errors.district, city: errors.city }}
                    boxed={false}
                  />
                </div>
                {!conversational && (
                  <>
                    <Input
                      label={t("checkout.line1")}
                      value={line1}
                      onChange={(e) => setLine1(e.target.value)}
                      error={errors.line1}
                      required
                      autoComplete="address-line1"
                      className="sm:col-span-2"
                    />
                    <Input label={t("checkout.line2")} value={line2} onChange={(e) => setLine2(e.target.value)} autoComplete="address-line2" className="sm:col-span-2" />
                  </>
                )}
                {checkout.notesEnabled && (
                  <Textarea
                    label={t("checkout.notes")}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder={t("checkout.notesPlaceholder")}
                    maxLength={1500}
                    className="sm:col-span-2"
                  />
                )}
              </div>
              {zone && (
                <p className="mt-5 text-sm text-oxide">{t("product.deliveryEstimate", { min: zone.etaMinDays, max: zone.etaMaxDays })}</p>
              )}
            </section>

            {/* 3 — payment */}
            <section className={cn(showStep("stepPayment"), conversational && "hidden lg:hidden")} aria-labelledby="co-payment">
              <h2 id="co-payment" className="display mb-6 text-display-sm">
                {t("checkout.paymentMethod")}
              </h2>

              {methods.length === 0 ? (
                <p className="text-sm text-muted">{t("errors.paymentNotConfigured")}</p>
              ) : (
                <div className="flex flex-col gap-2.5">
                  {methods.map((m) => (
                    <label
                      key={m}
                      className={cn(
                        "flex cursor-pointer items-start gap-3 border p-4 transition",
                        method === m ? "border-ink bg-bone/40" : "border-line hover:border-muted",
                      )}
                    >
                      <input type="radio" name="paymentMethod" value={m} checked={method === m} onChange={() => setMethod(m)} className="mt-1 accent-[rgb(var(--c-oxide))]" />
                      <span>
                        <span className="block text-sm font-semibold">{methodLabel[m]}</span>
                        <span className="mt-0.5 block text-xs text-muted">{methodHint[m]}</span>
                      </span>
                    </label>
                  ))}
                </div>
              )}
              {errors.paymentMethod && (
                <p className="mt-3 text-xs text-danger" role="alert">
                  {errors.paymentMethod}
                </p>
              )}

              {(method === "bkash" || method === "nagad") && (
                <div className="mt-6 border border-line bg-bone/40 p-5">
                  <p className="eyebrow">{t("checkout.sendTo")}</p>
                  <p className="display mt-2 text-display-sm tabular-nums tracking-[0.04em]">
                    {method === "bkash" ? checkout.bkashNumber || "—" : checkout.nagadNumber || "—"}
                  </p>
                  {(method === "bkash" ? checkout.bkashNumber : checkout.nagadNumber) && (
                    <CopyButton value={method === "bkash" ? checkout.bkashNumber : checkout.nagadNumber} className="mt-1" />
                  )}
                  <p className="mt-4 text-sm leading-relaxed text-muted">{i18nText(checkout.mfsInstructions, locale)}</p>
                  <div className="mt-5 grid gap-5 sm:grid-cols-2">
                    <Input label={t("checkout.trxId")} value={trx} onChange={(e) => setTrx(e.target.value)} error={errors.trx} required boxed autoComplete="off" />
                    <Input
                      label={t("checkout.senderNumber", { method: methodLabel[method] })}
                      value={sender}
                      onChange={(e) => setSender(e.target.value)}
                      error={errors.sender}
                      required
                      boxed
                      inputMode="tel"
                    />
                  </div>
                </div>
              )}
            </section>

            {/* 4 — review */}
            <section className={showStep("stepReview")} aria-labelledby="co-review">
              <h2 id="co-review" className="display mb-6 text-display-sm">
                {t("checkout.stepReview")}
              </h2>
              <dl className="grid gap-3 border border-line p-5 text-sm">
                <Row label={t("checkout.name")} value={name || "—"} />
                <Row label={t("checkout.phone")} value={phone || "—"} />
                {email && <Row label={t("checkout.email")} value={email} />}
                <Row label={t("checkout.district")} value={district || "—"} />
                {!conversational && <Row label={t("checkout.address")} value={[line1, line2, city, postalCode].filter(Boolean).join(", ") || "—"} />}
                <Row label={t("checkout.paymentMethod")} value={conversational ? t("checkout.whatsappTitle") : method ? methodLabel[method] : "—"} />
              </dl>

              <label className="mt-6 flex cursor-pointer items-start gap-3 text-sm">
                <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-1 accent-[rgb(var(--c-oxide))]" />
                <span className="text-muted">
                  {t("checkout.agree")}{" "}
                  <LocaleLink href="/terms" className="underline decoration-oxide underline-offset-4">
                    {t("checkout.terms")}
                  </LocaleLink>{" "}
                  {t("common.and")}{" "}
                  <LocaleLink href="/privacy" className="underline decoration-oxide underline-offset-4">
                    {t("checkout.privacy")}
                  </LocaleLink>
                  .
                </span>
              </label>
              {errors.consent && (
                <p className="mt-2 text-xs text-danger" role="alert">
                  {errors.consent}
                </p>
              )}

              {/* honeypot */}
              <input
                type="text"
                name="website"
                value={honeypot}
                onChange={(e) => setHoneypot(e.target.value)}
                tabIndex={-1}
                aria-hidden
                autoComplete="off"
                className="hidden"
              />
            </section>

            {/* mobile navigation */}
            <div className="flex items-center justify-between gap-3 lg:hidden">
              {step > 0 ? (
                <Button type="button" variant="ghost" onClick={() => setStep((s) => s - 1)}>
                  {t("common.back")}
                </Button>
              ) : (
                <span />
              )}
              {step < stepKeys.length - 1 ? (
                <Button type="button" onClick={next}>
                  {t("common.next")}
                </Button>
              ) : (
                <Button type="submit" loading={busy}>
                  {conversational ? t("checkout.openWhatsapp") : REDIRECT_METHODS.includes(method as PaymentMethod) ? t("checkout.payNow") : t("checkout.placeOrder")}
                </Button>
              )}
            </div>
          </div>

          {/* summary */}
          <aside className="lg:sticky lg:top-[calc(var(--header-h)+2rem)] lg:self-start">
            <div className="border border-line">
              <div className="flex items-center gap-2 border-b border-line px-5 py-4">
                <ShoppingBag className="h-4 w-4 text-oxide" aria-hidden />
                <h2 className="eyebrow">{t("checkout.summary")}</h2>
              </div>

              <ul className="divide-y divide-line px-5">
                {cart.lines.map((l) => (
                  <li key={l.key} className="flex gap-3 py-4">
                    <span className="block w-14 shrink-0 bg-bone">
                      <span className="block aspect-[3/4] w-full">
                        {l.image ? (
                          <img src={l.image} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
                        ) : (
                          <span className="skeleton block h-full w-full" />
                        )}
                      </span>
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="display block truncate text-sm">{l.name}</span>
                      <span className="eyebrow mt-0.5 block">
                        {l.variantTitle} × {l.quantity}
                      </span>
                    </span>
                    <span className="shrink-0 text-sm tabular-nums">{money(l.unitPrice * l.quantity)}</span>
                  </li>
                ))}
              </ul>

              {config.features.coupons && (
                <div className="border-t border-line px-5 py-4">
                  <Input label={t("cart.couponCode")} value={coupon} onChange={(e) => setCoupon(e.target.value)} className="uppercase" autoComplete="off" hint={quote?.coupon ? t("cart.couponApplied") : undefined} />
                </div>
              )}

              <dl className="flex flex-col gap-2 border-t border-line px-5 py-4 text-sm">
                <div className="flex justify-between">
                  <dt className="text-muted">{t("cart.subtotal")}</dt>
                  <dd className="tabular-nums">{money(quote?.subtotal ?? cart.subtotal)}</dd>
                </div>
                {!!quote?.discount && (
                  <div className="flex justify-between text-oxide">
                    <dt>{t("cart.discount")}</dt>
                    <dd className="tabular-nums">−{money(quote.discount)}</dd>
                  </div>
                )}
                <div className="flex justify-between">
                  <dt className="text-muted">{t("cart.shipping")}</dt>
                  <dd className="tabular-nums">{district ? (quote?.shipping ? money(quote.shipping) : t("common.free")) : t("cart.shippingCalculated")}</dd>
                </div>
                {!!quote?.codFee && (
                  <div className="flex justify-between">
                    <dt className="text-muted">{t("checkout.codFeeLine")}</dt>
                    <dd className="tabular-nums">{money(quote.codFee)}</dd>
                  </div>
                )}
                <div className="mt-2 flex justify-between border-t border-line pt-3 text-base">
                  <dt className="display">{t("cart.total")}</dt>
                  <dd className="display tabular-nums">{money(total)}</dd>
                </div>
              </dl>

              {currency.code !== "BDT" && <p className="px-5 pb-4 text-[0.66rem] leading-relaxed text-muted">{t("cart.convertedNote")}</p>}

              <div className="hidden border-t border-line px-5 py-5 lg:block">
                <Button type="submit" loading={busy} className="w-full">
                  {conversational ? t("checkout.openWhatsapp") : REDIRECT_METHODS.includes(method as PaymentMethod) ? t("checkout.payNow") : t("checkout.placeOrder")}
                </Button>
                {busy && <p className="mt-3 text-center text-xs text-muted">{t("checkout.processing")}</p>}
              </div>
            </div>
          </aside>
        </form>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-6">
      <dt className="text-muted">{label}</dt>
      <dd className="text-right">{value}</dd>
    </div>
  );
}
