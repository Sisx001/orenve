import type { MetadataRoute } from "next";
import { listCollections, listProducts, getPages } from "@/lib/catalog";
import { getSetting } from "@/lib/settings";
import { getEnabledLocaleCodes } from "@/lib/i18n/registry";
import { DEFAULT_LOCALE } from "@/lib/constants";
import { absoluteUrl } from "@/lib/utils";

const STATIC_PATHS = ["", "/shop", "/collections", "/lookbook", "/track", "/contact"];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [seo, products, collections, pages, locales] = await Promise.all([
    getSetting("seo"),
    listProducts(DEFAULT_LOCALE),
    listCollections(DEFAULT_LOCALE),
    getPages(DEFAULT_LOCALE),
    getEnabledLocaleCodes(),
  ]);

  if (!seo.robotsIndex) return [];

  const paths = [
    ...STATIC_PATHS,
    ...collections.map((c) => `/collections/${c.slug}`),
    ...products.map((p) => `/product/${p.slug}`),
    ...pages.map((p) => `/${p.slug}`),
  ];

  const entries: MetadataRoute.Sitemap = [];
  for (const path of paths) {
    for (const locale of locales) {
      entries.push({
        url: absoluteUrl(`/${locale}${path}`),
        lastModified: new Date(),
        changeFrequency: path === "" ? "daily" : path.startsWith("/product/") ? "weekly" : "monthly",
        priority: path === "" ? 1 : path.startsWith("/product/") ? 0.8 : 0.6,
        alternates: {
          languages: Object.fromEntries(locales.map((l) => [l, absoluteUrl(`/${l}${path}`)])),
        },
      });
    }
  }
  return entries;
}
