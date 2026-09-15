import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getProduct, getRelated, getShippingZones } from "@/lib/catalog";
import { getTranslator } from "@/lib/i18n/server";
import { getPublicConfig } from "@/lib/settings";
import { minorToMajor } from "@/lib/money";
import { absoluteUrl } from "@/lib/utils";
import { ProductView } from "@/components/store/ProductView";
import { ProductsBlock } from "@/components/store/blocks/ProductsBlock";
import { Reviews } from "@/components/store/Reviews";

export async function generateMetadata({ params }: { params: Promise<{ locale: string; slug: string }> }): Promise<Metadata> {
  const { locale, slug } = await params;
  const [product, config] = await Promise.all([getProduct(slug, locale), getPublicConfig()]);
  if (!product) return { title: "404" };
  const image = product.images[0]?.url ?? config.seo.ogImage ?? "/brand/og.jpg";
  return {
    title: product.seoTitle,
    description: product.seoDescription,
    alternates: {
      canonical: `/${locale}/product/${slug}`,
      languages: { en: `/en/product/${slug}`, bn: `/bn/product/${slug}` },
    },
    openGraph: {
      type: "website",
      title: product.seoTitle,
      description: product.seoDescription,
      images: [{ url: image, alt: product.name }],
    },
    twitter: { card: "summary_large_image", title: product.seoTitle, description: product.seoDescription, images: [image] },
  };
}

export default async function ProductPage({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale, slug } = await params;
  const product = await getProduct(slug, locale);
  if (!product) notFound();

  const [t, config, related, zones] = await Promise.all([
    getTranslator(locale),
    getPublicConfig(),
    getRelated(product.id, locale, 4),
    getShippingZones(locale),
  ]);

  const zone = zones[0] ?? null;
  const delivery = zone ? { name: zone.name, etaMinDays: zone.etaMinDays, etaMaxDays: zone.etaMaxDays } : null;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.seoDescription,
    sku: product.variants[0]?.sku ?? undefined,
    image: product.images.map((i) => i.url),
    brand: { "@type": "Brand", name: config.brand.name || "ORYNVE" },
    category: product.category ?? undefined,
    ...(product.rating.count > 0
      ? { aggregateRating: { "@type": "AggregateRating", ratingValue: product.rating.average, reviewCount: product.rating.count } }
      : {}),
    offers: {
      "@type": "Offer",
      url: absoluteUrl(`/${locale}/product/${product.slug}`),
      priceCurrency: "BDT",
      price: minorToMajor(product.price).toFixed(2),
      availability: product.inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      itemCondition: "https://schema.org/NewCondition",
      seller: { "@type": "Organization", name: config.brand.name || "ORYNVE" },
    },
  };

  return (
    <article className="pb-28 md:pb-0">
      <script type="application/ld+json" suppressHydrationWarning>
        {JSON.stringify(jsonLd).replace(/</g, "\\u003c")}
      </script>

      <div className="container-page pt-8 md:pt-12">
        <ProductView product={product} delivery={delivery} />
      </div>

      {config.features.reviews && <Reviews productId={product.id} reviews={product.reviews} rating={product.rating} />}

      {related.length > 0 && (
        <div className="border-t border-line">
          <ProductsBlock eyebrow={t("product.relatedEyebrow")} title={t("product.related")} products={related} viewAllLabel={t("common.viewAll")} />
        </div>
      )}
    </article>
  );
}
