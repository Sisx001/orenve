import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCollection } from "@/lib/catalog";
import { getTranslator } from "@/lib/i18n/server";
import { getPublicConfig } from "@/lib/settings";
import type { ShopSearchParams } from "@/lib/store/shopParams";
import { ShopBrowser } from "@/components/store/ShopBrowser";
import { headlineLines } from "@/lib/store/richtext";
import { cn } from "@/lib/utils";

export async function generateMetadata({ params }: { params: Promise<{ locale: string; slug: string }> }): Promise<Metadata> {
  const { locale, slug } = await params;
  const [collection, config] = await Promise.all([getCollection(slug, locale), getPublicConfig()]);
  if (!collection) return { title: "404" };
  const brand = config.brand.name || "ORYNVE";
  return {
    title: `${collection.name} | ${brand}`,
    description: collection.description || undefined,
    alternates: {
      canonical: `/${locale}/collections/${slug}`,
      languages: { en: `/en/collections/${slug}`, bn: `/bn/collections/${slug}` },
    },
    openGraph: {
      title: `${collection.name} | ${brand}`,
      description: collection.description || undefined,
      images: [collection.image || config.seo.ogImage || "/brand/og.jpg"],
    },
  };
}

export default async function CollectionPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; slug: string }>;
  searchParams: Promise<ShopSearchParams>;
}) {
  const [{ locale, slug }, sp] = await Promise.all([params, searchParams]);
  const [collection, t] = await Promise.all([getCollection(slug, locale), getTranslator(locale)]);
  if (!collection) notFound();

  const lines = headlineLines(collection.name);

  return (
    <div className="pb-24">
      {/* hero banner */}
      <section className="relative isolate flex min-h-[46dvh] items-end overflow-hidden bg-ink text-bone">
        {collection.image && (
          <>
            <img src={collection.image} alt="" aria-hidden className="absolute inset-0 -z-10 h-full w-full object-cover" />
            <span aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-t from-ink via-ink/40 to-ink/10" />
          </>
        )}
        <span aria-hidden className="grain absolute inset-0 -z-10" />
        <div className="container-page pb-14 pt-32">
          <p className="eyebrow text-bone/60">{t("nav.collections")}</p>
          <h1 className="display mt-4 max-w-3xl text-balance text-display-lg">
            {lines.map((l, i) => (
              <span key={i} className={cn("block", i % 2 === 1 && "display-italic text-brass")}>
                {l}
              </span>
            ))}
          </h1>
          {collection.description && <p className="mt-6 max-w-xl leading-relaxed text-bone/75">{collection.description}</p>}
        </div>
      </section>

      <div className="container-page mt-12">
        <ShopBrowser locale={locale} searchParams={sp} presetCollection={slug} />
      </div>
    </div>
  );
}
