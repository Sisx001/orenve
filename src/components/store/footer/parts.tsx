"use client";

/**
 * Shared footer data + building blocks. `useFooterData()` derives every list
 * once (explore, client services, details, socials, payments) so the four
 * variants only decide how to arrange them.
 */
import { ArrowUp, Facebook, Instagram, Mail, MessageCircle, Phone } from "lucide-react";
import { useMemo } from "react";
import { useLocale, useT } from "@/lib/i18n/client";
import { useConfig } from "@/components/providers/ConfigProvider";
import { LocaleLink } from "@/components/store/LocaleLink";
import { cn } from "@/lib/utils";

export type FooterPage = { slug: string; title: string };
export type FooterItem = { href: string; label: string };
export type FooterSocial = { href: string; label: string; Icon: typeof Instagram };

const SERVICE_SLUGS = ["shipping", "returns", "size-guide", "faq"];
const DETAIL_SLUGS = ["privacy", "terms"];

export function useFooterData(pages: FooterPage[]) {
  const t = useT();
  const locale = useLocale();
  const { config } = useConfig();

  return useMemo(() => {
    const contact = config.contact;
    const checkout = config.checkout;
    const bySlug = new Map(pages.map((p) => [p.slug, p]));
    const services = SERVICE_SLUGS.map((s) => bySlug.get(s)).filter((p): p is FooterPage => !!p);
    const details = DETAIL_SLUGS.map((s) => bySlug.get(s)).filter((p): p is FooterPage => !!p);

    const explore: FooterItem[] = [
      { href: "/shop", label: t("nav.shop") },
      { href: "/collections", label: t("nav.collections") },
      { href: "/lookbook", label: t("nav.lookbook") },
      ...(bySlug.has("about") ? [{ href: "/about", label: bySlug.get("about")!.title }] : []),
    ];

    const clientServices: FooterItem[] = [
      { href: "/contact", label: t("nav.contact") },
      ...(config.features.orderTracking ? [{ href: "/track", label: t("nav.track") }] : []),
      ...services.map((p) => ({ href: `/${p.slug}`, label: p.title })),
    ];

    const detailItems: FooterItem[] = details.map((p) => ({ href: `/${p.slug}`, label: p.title }));

    const payments = [
      checkout.cod ? "COD" : null,
      checkout.bkash ? "bKash" : null,
      checkout.nagad ? "Nagad" : null,
      checkout.sslcommerz ? "Visa" : null,
      checkout.sslcommerz ? "Mastercard" : null,
      checkout.stripe ? "Stripe" : null,
    ].filter((x): x is string => !!x);

    const socials: FooterSocial[] = [
      contact.instagram ? { href: contact.instagram, label: "Instagram", Icon: Instagram } : null,
      contact.facebook ? { href: contact.facebook, label: "Facebook", Icon: Facebook } : null,
      contact.whatsapp ? { href: `https://wa.me/${contact.whatsapp.replace(/\D/g, "")}`, label: "WhatsApp", Icon: MessageCircle } : null,
      contact.email ? { href: `mailto:${contact.email}`, label: contact.email, Icon: Mail } : null,
      contact.phone ? { href: `tel:${contact.phone.replace(/\s/g, "")}`, label: contact.phone, Icon: Phone } : null,
    ].filter((x): x is FooterSocial => !!x);

    // Honest labelling: unreviewed machine languages say so, built-ins never do.
    const current = config.locales.find((l) => l.code === locale);
    const showMachineNote = config.i18n.showMachineBadge && Boolean(current && current.isMachine && !current.builtIn);

    return { explore, clientServices, detailItems, payments, socials, showMachineNote };
  }, [config, pages, t, locale]);
}

export function FooterGroup({ title, items }: { title: string; items: FooterItem[] }) {
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

export function SocialList({ socials, inline = false }: { socials: FooterSocial[]; inline?: boolean }) {
  if (socials.length === 0) return null;
  return (
    <ul className={cn(inline ? "flex flex-wrap items-center gap-4" : "flex flex-col gap-2")}>
      {socials.map((s) => (
        <li key={s.label}>
          <a
            href={s.href}
            target={s.href.startsWith("http") ? "_blank" : undefined}
            rel={s.href.startsWith("http") ? "noopener noreferrer" : undefined}
            aria-label={s.label}
            className="flex items-center gap-2 text-sm text-muted transition hover:text-ink"
          >
            <s.Icon className="h-3.5 w-3.5" aria-hidden />
            {!inline && s.label}
          </a>
        </li>
      ))}
    </ul>
  );
}

export function PaymentChips({ payments, withLabel = true }: { payments: string[]; withLabel?: boolean }) {
  const t = useT();
  if (payments.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      {withLabel && <span className="eyebrow">{t("footer.payments")}</span>}
      {payments.map((p) => (
        <span key={p} className="border border-line px-2.5 py-1 text-[0.62rem] font-semibold uppercase tracking-[0.12em] text-muted">
          {p}
        </span>
      ))}
    </div>
  );
}

export function BackToTop({ className }: { className?: string }) {
  const t = useT();
  return (
    <button type="button" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} className={cn("flex items-center gap-2 transition hover:text-ink", className)}>
      <ArrowUp className="h-3 w-3" aria-hidden />
      {t("common.backToTop")}
    </button>
  );
}

export function Copyright() {
  const t = useT();
  const { config } = useConfig();
  return <p>{t("footer.copyright", { year: new Date().getFullYear(), brand: config.brand.name || "ORYNVE" })}</p>;
}

export function MachineNote({ show }: { show: boolean }) {
  const t = useT();
  if (!show) return null;
  return <p className="mt-10 border-t border-line pt-8 text-xs text-muted">{t("common.machineTranslated")}</p>;
}
