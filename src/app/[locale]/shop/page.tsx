import type { Metadata } from "next";
import { getTranslator } from "@/lib/i18n/server";
import { getPublicConfig } from "@/lib/settings";
import type { ShopSearchParams } from "@/lib/store/shopParams";
import { ShopBrowser } from "@/components/store/ShopBrowser";
import { SectionHeading } from "@/components/store/SectionHeading";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const [t, config] = await Promise.all([getTranslator(locale), getPublicConfig()]);
  const brand = config.brand.name || "ORYNVE";
  return {
    title: `${t("shop.title")} | ${brand}`,
    description: t("shop.intro"),
    alternates: { canonical: `/${locale}/shop`, languages: { en: "/en/shop", bn: "/bn/shop" } },
    openGraph: { title: `${t("shop.title")} | ${brand}`, description: t("shop.intro"), images: [config.seo.ogImage || "/brand/og.jpg"] },
  };
}

export default async function ShopPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<ShopSearchParams>;
}) {
  const [{ locale }, sp] = await Promise.all([params, searchParams]);
  const t = await getTranslator(locale);

  return (
    <div className="container-page pb-24 pt-14 md:pt-20">
      <SectionHeading eyebrow={t("shop.eyebrow")} title={sp.q ? `“${sp.q}”` : t("shop.title")} subtitle={t("shop.intro")} size="lg" className="mb-12" />
      <ShopBrowser locale={locale} searchParams={sp} />
    </div>
  );
}
