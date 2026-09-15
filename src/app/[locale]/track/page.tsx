import type { Metadata } from "next";
import { getTranslator } from "@/lib/i18n/server";
import { getPublicConfig } from "@/lib/settings";
import { SectionHeading } from "@/components/store/SectionHeading";
import { TrackForm } from "@/components/store/TrackForm";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const [t, config] = await Promise.all([getTranslator(locale), getPublicConfig()]);
  return {
    title: `${t("tracking.title")} | ${config.brand.name || "ORYNVE"}`,
    description: t("tracking.intro"),
    alternates: { canonical: `/${locale}/track`, languages: { en: "/en/track", bn: "/bn/track" } },
  };
}

export default async function TrackPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslator(locale);

  return (
    <div className="container-page py-14 md:py-20">
      <SectionHeading eyebrow={t("tracking.eyebrow")} title={t("tracking.title")} subtitle={t("tracking.intro")} align="center" className="mb-14" />
      <TrackForm />
    </div>
  );
}
