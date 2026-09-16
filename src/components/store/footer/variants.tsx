"use client";

/**
 * The four footer variants. `editorial` is the shipped default and reproduces
 * the original SiteFooter exactly; the others trade the statement block for
 * denser link layouts.
 */
import { useT, useLocale } from "@/lib/i18n/client";
import { useConfig } from "@/components/providers/ConfigProvider";
import { i18nText } from "@/lib/json";
import { headlineLines } from "@/lib/store/richtext";
import { Wordmark } from "@/components/brand/Logo";
import { LocaleLink } from "@/components/store/LocaleLink";
import { NewsletterForm } from "@/components/store/NewsletterForm";
import { cn } from "@/lib/utils";
import { BackToTop, Copyright, FooterGroup, MachineNote, PaymentChips, SocialList, useFooterData, type FooterPage } from "./parts";

const SHELL = "relative mt-auto border-t border-line bg-bone/40";
const META_ROW = "flex flex-col-reverse items-start justify-between gap-6 border-t border-line pt-8 text-[0.66rem] uppercase tracking-[0.16em] text-muted sm:flex-row sm:items-center";

function BrandLink() {
  const { config } = useConfig();
  return (
    <LocaleLink href="/" aria-label={config.brand.name || "ORYNVE"} className="inline-block">
      <Wordmark name={config.brand.name} height={20} />
    </LocaleLink>
  );
}

/* ─────────────────────────── editorial (shipped default) ─────────────────────────── */

export function EditorialFooter({ pages }: { pages: FooterPage[] }) {
  const t = useT();
  const locale = useLocale();
  const { config } = useConfig();
  const { explore, clientServices, detailItems, payments, socials, showMachineNote } = useFooterData(pages);
  const statementLines = headlineLines(t("footer.statement"));

  return (
    <footer className={SHELL}>
      <div className="container-page py-16 md:py-24">
        <div className="grid gap-14 lg:grid-cols-[1.3fr_1fr_1fr_1fr]">
          <div className="max-w-sm">
            <BrandLink />
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

          <FooterGroup title={t("footer.explore")} items={explore} />
          <FooterGroup title={t("footer.clientServices")} items={clientServices} />

          <div className="flex flex-col gap-8">
            <FooterGroup title={t("footer.details")} items={detailItems} />
            {socials.length > 0 && (
              <div>
                <p className="eyebrow mb-3">{t("contact.studio")}</p>
                <SocialList socials={socials} />
              </div>
            )}
          </div>
        </div>

        {payments.length > 0 && (
          <div className="mt-16 border-t border-line pt-8">
            <PaymentChips payments={payments} />
          </div>
        )}

        <MachineNote show={showMachineNote} />

        <div className={cn(META_ROW, showMachineNote ? "mt-8 border-t-0 pt-0" : "mt-10")}>
          <Copyright />
          <p className="flex items-center gap-3">
            <span>{t("common.madeInBangladesh")}</span>
            <span aria-hidden className="text-line">
              /
            </span>
            <span>{t("common.est")}</span>
          </p>
          <BackToTop />
        </div>
      </div>
    </footer>
  );
}

/* ─────────────────────────── columns ─────────────────────────── */

/** Four link columns with the newsletter pulled into its own banded row. */
export function ColumnsFooter({ pages }: { pages: FooterPage[] }) {
  const t = useT();
  const { config } = useConfig();
  const { explore, clientServices, detailItems, payments, socials, showMachineNote } = useFooterData(pages);

  return (
    <footer className={SHELL}>
      {config.features.newsletter && (
        <div className="border-b border-line">
          <div className="container-page flex flex-col gap-6 py-10 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="eyebrow mb-2">{t("newsletter.eyebrow")}</p>
              <p className="display text-display-sm">{t("newsletter.title")}</p>
            </div>
            <div className="w-full max-w-sm">
              <NewsletterForm showConsent={false} />
            </div>
          </div>
        </div>
      )}

      <div className="container-page py-14">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <BrandLink />
            <div className="mt-5">
              <SocialList socials={socials} />
            </div>
          </div>
          <FooterGroup title={t("footer.explore")} items={explore} />
          <FooterGroup title={t("footer.clientServices")} items={clientServices} />
          <FooterGroup title={t("footer.details")} items={detailItems} />
        </div>

        {payments.length > 0 && (
          <div className="mt-12 border-t border-line pt-8">
            <PaymentChips payments={payments} />
          </div>
        )}

        <MachineNote show={showMachineNote} />

        <div className={cn(META_ROW, showMachineNote ? "mt-8 border-t-0 pt-0" : "mt-10")}>
          <Copyright />
          <BackToTop />
        </div>
      </div>
    </footer>
  );
}

/* ─────────────────────────── compact ─────────────────────────── */

/** One row: wordmark, essential links, socials, payment chips. */
export function CompactFooter({ pages }: { pages: FooterPage[] }) {
  const t = useT();
  const { explore, clientServices, detailItems, payments, socials, showMachineNote } = useFooterData(pages);
  const links = [...explore.slice(0, 3), ...clientServices.slice(0, 2), ...detailItems];

  return (
    <footer className={SHELL}>
      <div className="container-page py-10">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <BrandLink />
          <nav aria-label={t("footer.explore")} className="flex flex-wrap items-center gap-x-5 gap-y-2">
            {links.map((l) => (
              <LocaleLink key={l.href} href={l.href} className="text-[0.66rem] font-semibold uppercase tracking-[0.14em] text-muted transition hover:text-ink">
                {l.label}
              </LocaleLink>
            ))}
          </nav>
          <div className="flex items-center gap-6">
            <SocialList socials={socials} inline />
            <PaymentChips payments={payments} withLabel={false} />
          </div>
        </div>

        <MachineNote show={showMachineNote} />

        <div className={cn(META_ROW, showMachineNote ? "mt-8 border-t-0 pt-0" : "mt-8")}>
          <Copyright />
          <BackToTop />
        </div>
      </div>
    </footer>
  );
}

/* ─────────────────────────── minimal ─────────────────────────── */

/** Copyright plus the legal/essential links, nothing else. */
export function MinimalFooter({ pages }: { pages: FooterPage[] }) {
  const t = useT();
  const { clientServices, detailItems, showMachineNote } = useFooterData(pages);
  const links = [clientServices[0], ...detailItems].filter(Boolean);

  return (
    <footer className="relative mt-auto border-t border-line">
      <div className="container-page flex flex-col items-start gap-4 py-8 text-[0.66rem] uppercase tracking-[0.16em] text-muted sm:flex-row sm:items-center sm:justify-between">
        <Copyright />
        <nav aria-label={t("footer.details")} className="flex flex-wrap items-center gap-x-5 gap-y-2">
          {links.map((l) => (
            <LocaleLink key={l.href} href={l.href} className="transition hover:text-ink">
              {l.label}
            </LocaleLink>
          ))}
        </nav>
        <BackToTop />
      </div>
      <div className="container-page pb-6">
        <MachineNote show={showMachineNote} />
      </div>
    </footer>
  );
}
