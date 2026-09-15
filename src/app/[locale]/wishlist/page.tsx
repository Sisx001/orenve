import type { Metadata } from "next";
import { getTranslator } from "@/lib/i18n/server";
import { getPublicConfig } from "@/lib/settings";
import { SectionHeading } from "@/components/store/SectionHeading";
import { WishlistView } from "@/components/store/WishlistView";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const [t, config] = await Promise.all([getTranslator(locale), getPublicConfig()]);
  return { title: `${t("wishlist.title")} | ${config.brand.name || "ORYNVE"}`, robots: { index: false, follow: true } };
}

export default async function WishlistPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslator(locale);

  return (
    <div className="container-page py-14 md:py-20">
      <SectionHeading eyebrow={t("common.wishlist")} title={t("wishlist.title")} subtitle={t("wishlist.intro")} size="lg" className="mb-14" />
      <WishlistView />
    </div>
  );
}
