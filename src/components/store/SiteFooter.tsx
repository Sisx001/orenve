"use client";

import { ArrowUp, Instagram, Facebook, Mail, Phone, MessageCircle } from "lucide-react";
import { useT, useLocale } from "@/lib/i18n/client";
import { useConfig } from "@/components/providers/ConfigProvider";
import { i18nText } from "@/lib/json";
import { headlineLines } from "@/lib/store/richtext";
import { Wordmark } from "@/components/brand/Logo";
import { LocaleLink } from "@/components/store/LocaleLink";
import { NewsletterForm } from "@/components/store/NewsletterForm";
import { cn } from "@/lib/utils";

export type FooterPage = { slug: string; title: string };

const SERVICE_SLUGS = ["shipping", "returns", "size-guide", "faq"];
const DETAIL_SLUGS = ["privacy", "terms"];

export function SiteFooter({ pages }: { pages: FooterPage[] }) {
  const t = useT();
  const locale = useLocale();
  const { config } = useConfig();
  const contact = config.contact;
  const checkout = config.checkout;

  const bySlug = new Map(pages.map((p) => [p.slug, p]));
  const services = SERVICE_SLUGS.map((s) => bySlug.get(s)).filter((p): p is FooterPage => !!p);
  const details = DETAIL_SLUGS.map((s) => bySlug.get(s)).filter((p): p is FooterPage => !!p);

  const explore: FooterPage[] = [
    { slug: "shop", title: t("nav.shop") },
    { slug: "collections", title: t("nav.collections") },
    { slug: "lookbook", title: t("nav.lookbook") },
    ...(bySlug.has("about") ? [{ slug: "about", title: bySlug.get("about")!.title }] : []),
  ];

  const payments = [
    checkout.cod ? "COD" : null,
    checkout.bkash ? "bKash" : null,
    checkout.nagad ? "Nagad" : null,
    checkout.sslcommerz ? "Visa" : null,
    checkout.sslcommerz ? "Mastercard" : null,
    checkout.stripe ? "Stripe" : null,
  ].filter((x): x is string => !!x);

  const socials = [
    contact.instagram ? { href: contact.instagram, label: "Instagram", Icon: Instagram } : null,
    contact.facebook ? { href: contact.facebook, label: "Facebook", Icon: Facebook } : null,
    contact.whatsapp ? { href: `https://wa.me/${contact.whatsapp.replace(/\D/g, "")}`, label: "WhatsApp", Icon: MessageCircle } : null,
    contact.email ? { href: `mailto:${contact.email}`, label: contact.email, Icon: Mail } : null,
    contact.phone ? { href: `tel:${contact.phone.replace(/\s/g, "")}`, label: contact.phone, Icon: Phone } : null,
  ].filter((x): x is { href: string; label: string; Icon: typeof Instagram } => !!x);

  const statementLines = headlineLines(t("footer.statement"));

  return (
    <footer className="relative mt-auto border-t border-line bg-bone/40">
      <div className="container-page py-16 md:py-24">
        <div className="grid gap-14 lg:grid-cols-[1.3fr_1fr_1fr_1fr]">
          {/* statement + newsletter */}
          <div className="max-w-sm">
            <LocaleLink href="/" aria-label={config.brand.name || "ORYNVE"} className="inline-block">
              <Wordmark name={config.brand.name} height={20} />
            </LocaleLink>
            <h2 className="display mt-6 text-display-sm text-balance">
              {statementLines.map((l, i) => (
                <span key={i} className={cn("block", i % 2 === 1 && "display-italic text-muted")}>
                  {l}
                </span>
              ))}
            </h2>
            <p className="mt-4 text-sm text-muted">{i18nText(config.brand.tagline, locale)}</p>
            {config.features.newsletter && (
              <div className="mt-8">
                <p className="eyebrow mb-3">{t("newsletter.eyebrow")}</p>
                <NewsletterForm showConsent={false} />
              </div>
            )}
          </div>

          <FooterGroup title={t("footer.explore")} items={explore.map((p) => ({ href: p.slug === "about" ? "/about" : `/${p.slug}`, label: p.title }))} />

          <FooterGroup
            title={t("footer.clientServices")}
            items={[
              { href: "/contact", label: t("nav.contact") },
              ...(config.features.orderTracking ? [{ href: "/track", label: t("nav.track") }] : []),
              ...services.map((p) => ({ href: `/${p.slug}`, label: p.title })),
            ]}
          />

          <div className="flex flex-col gap-8">
            <FooterGroup title={t("footer.details")} items={details.map((p) => ({ href: `/${p.slug}`, label: p.title }))} />

            {socials.length > 0 && (
              <div>
                <p className="eyebrow mb-3">{t("contact.studio")}</p>
                <ul className="flex flex-col gap-2">
                  {socials.map((s) => (
                    <li key={s.label}>
                      <a
                        href={s.href}
                        target={s.href.startsWith("http") ? "_blank" : undefined}
                        rel={s.href.startsWith("http") ? "noopener noreferrer" : undefined}
                        className="flex items-center gap-2 text-sm text-muted transition hover:text-ink"
                      >
                        <s.Icon className="h-3.5 w-3.5" aria-hidden />
                        {s.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>

        {payments.length > 0 && (
          <div className="mt-16 flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-line pt-8">
            <span className="eyebrow">{t("footer.payments")}</span>
            {payments.map((p) => (
              <span key={p} className="border border-line px-2.5 py-1 text-[0.62rem] font-semibold uppercase tracking-[0.12em] text-muted">
                {p}
              </span>
            ))}
          </div>
        )}

        <div className="mt-10 flex flex-col-reverse items-start justify-between gap-6 border-t border-line pt-8 text-[0.66rem] uppercase tracking-[0.16em] text-muted sm:flex-row sm:items-center">
          <p>{t("footer.copyright", { year: new Date().getFullYear(), brand: config.brand.name || "ORYNVE" })}</p>
          <p className="flex items-center gap-3">
            <span>{t("common.madeInBangladesh")}</span>
            <span aria-hidden className="text-line">
              /
            </span>
            <span>{t("common.est")}</span>
          </p>
          <button
            type="button"
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            className="flex items-center gap-2 transition hover:text-ink"
          >
            <ArrowUp className="h-3 w-3" aria-hidden />
            {t("common.backToTop")}
          </button>
        </div>
      </div>
    </footer>
  );
}

function FooterGroup({ title, items }: { title: string; items: { href: string; label: string }[] }) {
  if (items.length === 0) return null;
  return (
    <nav aria-label={title}>
      <p className="eyebrow mb-4">{title}</p>
      <ul className="flex flex-col gap-2.5">
        {items.map((i) => (
          <li key={i.href}>
            <LocaleLink href={i.href} className="text-sm text-muted transition hover:text-ink">
              {i.label}
            </LocaleLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
