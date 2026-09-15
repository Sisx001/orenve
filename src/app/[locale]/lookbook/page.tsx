import type { Metadata } from "next";
import { getBlocks, listProducts } from "@/lib/catalog";
import { getTranslator } from "@/lib/i18n/server";
import { getPublicConfig } from "@/lib/settings";
import { i18nText } from "@/lib/json";
import { SectionHeading } from "@/components/store/SectionHeading";
import { LookbookGrid, type LookbookItem } from "@/components/store/LookbookGrid";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const [t, config] = await Promise.all([getTranslator(locale), getPublicConfig()]);
  return {
    title: `${t("nav.lookbook")} | ${config.brand.name || "ORYNVE"}`,
    description: t("lookbook.intro"),
    alternates: { canonical: `/${locale}/lookbook`, languages: { en: "/en/lookbook", bn: "/bn/lookbook" } },
  };
}

export default async function LookbookPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const [t, blocks, products] = await Promise.all([getTranslator(locale), getBlocks("home"), listProducts(locale)]);

  // Campaign frames first, then every product image as an editorial masonry.
  const frames: LookbookItem[] = [];
  for (const b of blocks) {
    if (b.type !== "lookbook") continue;
    const list = Array.isArray(b.data.frames) ? (b.data.frames as unknown[]) : [];
    for (const raw of list) {
      if (!raw || typeof raw !== "object") continue;
      const f = raw as Record<string, unknown>;
      if (typeof f.image !== "string") continue;
      frames.push({
        image: f.image,
        slug: typeof f.productSlug === "string" ? f.productSlug : undefined,
        caption: typeof f.caption === "string" || (f.caption && typeof f.caption === "object") ? i18nText(f.caption as Record<string, string>, locale) : undefined,
      });
    }
  }

  const gallery: LookbookItem[] = products.flatMap((p) => p.images.map((img) => ({ image: img.url, slug: p.slug, caption: p.name })));

  const items = [...frames, ...gallery];

  return (
    <div className="pb-24">
      <div className="container-page pt-14 md:pt-20">
        <SectionHeading eyebrow={t("home.campaignEyebrow")} title={t("home.lookbookTitle")} subtitle={t("lookbook.intro")} size="lg" className="mb-14" />
      </div>
      <div className="container-page">
        <LookbookGrid items={items} />
      </div>
    </div>
  );
}
