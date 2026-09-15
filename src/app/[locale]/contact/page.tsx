import type { Metadata } from "next";
import { Mail, MapPin, MessageCircle, Phone, Clock } from "lucide-react";
import { getTranslator } from "@/lib/i18n/server";
import { getPublicConfig } from "@/lib/settings";
import { i18nText } from "@/lib/json";
import { SectionHeading } from "@/components/store/SectionHeading";
import { ContactForm } from "@/components/store/ContactForm";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const [t, config] = await Promise.all([getTranslator(locale), getPublicConfig()]);
  return {
    title: `${t("contact.title")} | ${config.brand.name || "ORYNVE"}`,
    description: t("contact.intro"),
    alternates: { canonical: `/${locale}/contact`, languages: { en: "/en/contact", bn: "/bn/contact" } },
  };
}

export default async function ContactPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const [t, config] = await Promise.all([getTranslator(locale), getPublicConfig()]);
  const c = config.contact;

  const whatsapp = c.whatsapp.replace(/\D/g, "");
  const messenger = c.messengerPage
    ? `https://m.me/${c.messengerPage.replace(/^https?:\/\/(m\.me|www\.facebook\.com|facebook\.com)\//, "").replace(/\/$/, "")}`
    : "";

  return (
    <div className="container-page py-14 md:py-20">
      <SectionHeading eyebrow={t("contact.eyebrow")} title={t("contact.title")} subtitle={t("contact.intro")} size="lg" className="mb-16" />

      <div className="grid gap-16 lg:grid-cols-[1fr_1.2fr] lg:gap-24">
        <aside>
          <h2 className="eyebrow mb-6">{t("contact.studio")}</h2>
          <ul className="flex flex-col gap-5 text-sm">
            {i18nText(c.address, locale) && (
              <li className="flex items-start gap-3">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-oxide" aria-hidden />
                <span>{i18nText(c.address, locale)}</span>
              </li>
            )}
            {i18nText(c.hours, locale) && (
              <li className="flex items-start gap-3">
                <Clock className="mt-0.5 h-4 w-4 shrink-0 text-oxide" aria-hidden />
                <span>{i18nText(c.hours, locale)}</span>
              </li>
            )}
            {c.phone && (
              <li className="flex items-start gap-3">
                <Phone className="mt-0.5 h-4 w-4 shrink-0 text-oxide" aria-hidden />
                <a href={`tel:${c.phone.replace(/\s/g, "")}`} className="hover:text-oxide">
                  {c.phone}
                </a>
              </li>
            )}
            {c.email && (
              <li className="flex items-start gap-3">
                <Mail className="mt-0.5 h-4 w-4 shrink-0 text-oxide" aria-hidden />
                <a href={`mailto:${c.email}`} className="hover:text-oxide">
                  {c.email}
                </a>
              </li>
            )}
          </ul>

          {(whatsapp || messenger) && (
            <div className="mt-10 flex flex-wrap gap-3">
              {whatsapp && (
                <a href={`https://wa.me/${whatsapp}`} target="_blank" rel="noopener noreferrer" className="btn-outline">
                  <MessageCircle className="h-3.5 w-3.5" aria-hidden />
                  {t("contact.whatsapp")}
                </a>
              )}
              {messenger && (
                <a href={messenger} target="_blank" rel="noopener noreferrer" className="btn-outline">
                  {t("contact.messenger")}
                </a>
              )}
            </div>
          )}

          {c.mapUrl && (
            <div className="mt-10 aspect-[4/3] w-full overflow-hidden border border-line">
              <iframe
                src={c.mapUrl}
                title={t("contact.studio")}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                className="h-full w-full border-0"
              />
            </div>
          )}
        </aside>

        <ContactForm />
      </div>
    </div>
  );
}
