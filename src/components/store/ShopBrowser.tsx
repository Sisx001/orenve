import { getFilterFacets, listCategories, listProducts } from "@/lib/catalog";
import { getTranslator } from "@/lib/i18n/server";
import { parseView, toFilters, type ShopSearchParams } from "@/lib/store/shopParams";
import { ShopToolbar } from "@/components/store/ShopToolbar";
import { ProductGrid } from "@/components/store/ProductGrid";
import { LocaleLink } from "@/components/store/LocaleLink";
import { EmptyState } from "@/components/ui";

/**
 * Server-rendered product browser shared by /shop and /collections/[slug].
 * All filtering happens here; the toolbar only rewrites the URL.
 */
export async function ShopBrowser({
  locale,
  searchParams,
  presetCollection,
}: {
  locale: string;
  searchParams: ShopSearchParams;
  presetCollection?: string;
}) {
  const t = await getTranslator(locale);
  const filters = toFilters(searchParams, presetCollection);

  const [products, facets, categories] = await Promise.all([listProducts(locale, filters), getFilterFacets(), listCategories(locale)]);
  const view = parseView(searchParams.view);

  return (
    <>
      <ShopToolbar
        searchParams={searchParams}
        categories={categories.map((c) => ({ slug: c.slug, name: c.name, count: c.count }))}
        facets={facets}
        resultCount={products.length}
        lockCategory={false}
      />

      {products.length === 0 ? (
        <EmptyState
          title={t("shop.noResults")}
          text={t("shop.noResultsText")}
          action={
            <LocaleLink href="/shop" className="btn-outline">
              {t("nav.allPieces")}
            </LocaleLink>
          }
        />
      ) : (
        <>
          <ProductGrid products={products} view={view} className="mt-14" />
          <p className="mt-20 text-center text-[0.66rem] uppercase tracking-[0.18em] text-muted">{t("shop.endOfList", { count: products.length })}</p>
        </>
      )}
    </>
  );
}
