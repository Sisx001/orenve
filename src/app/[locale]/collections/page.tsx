import type { Metadata } from "next";
import { listCollections } from "@/lib/catalog";
import { getTranslator } from "@/lib/i18n/server";
import { getPublicConfig } from "@/lib/settings";
import { SectionHeading } from "@/components/store/SectionHeading";
import { CollectionsBlock } from "@/components/store/blocks/CollectionsBlock";
import { EmptyState } from "@/components/ui";
import { LocaleLink } from "@/components/store/LocaleLink";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const [t, config] = await Promise.all([getTranslator(locale), getPublicConfig()]);
  const brand = config.brand.name || "ORYNVE";
  return {
    title: `${t("collections.title")} | ${brand}`,
    description: t("collections.intro"),
    alternates: { canonical: `/${locale}/collections`, languages: { en: "/en/collections", bn: "/bn/collections" } },
  };
}

export default async function CollectionsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const [t, collections] = await Promise.all([getTranslator(locale), listCollections(locale)]);

  return (
    <div className="pb-10">
      <div className="container-page pt-14 md:pt-20">
        <SectionHeading eyebrow={t("nav.collections")} title={t("collections.title")} subtitle={t("collections.intro")} size="lg" />
      </div>

      {collections.length === 0 ? (
        <div className="container-page">
          <EmptyState
            title={t("shop.noResults")}
            text={t("shop.noResultsText")}
            action={
              <LocaleLink href="/shop" className="btn-outline">
                {t("nav.allPieces")}
              </LocaleLink>
            }
          />
        </div>
      ) : (
        <CollectionsBlock
          title={t("home.collectionsTitle")}
          eyebrow={t("nav.featuredCollections")}
          collections={collections}
          viewAllLabel={t("nav.allPieces")}
          piecesLabel={(count) => t("shop.results", { count })}
        />
      )}
    </div>
  );
}
