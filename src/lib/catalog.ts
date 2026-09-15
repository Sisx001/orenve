import "server-only";
import { cache } from "react";
import { db } from "@/lib/db";
import { i18nText, parseJson } from "@/lib/json";
import type { OptionValue, ProductCard, ProductDetail } from "@/types";

const cardInclude = {
  images: { orderBy: { position: "asc" as const } },
  options: { orderBy: { position: "asc" as const } },
  variants: { where: { isActive: true } },
  category: true,
} as const;

type ProductRow = NonNullable<Awaited<ReturnType<typeof db.product.findFirst<{ include: typeof cardInclude }>>>>;

export function toCard(p: ProductRow, locale: string): ProductCard {
  const colorOpt = p.options.find((o) => o.name.toLowerCase() === "color" || o.name.toLowerCase() === "colour");
  const sizeOpt = p.options.find((o) => o.name.toLowerCase() === "size");
  const totalStock = p.variants.reduce((a, v) => a + v.stock, 0);
  return {
    id: p.id,
    slug: p.slug,
    name: i18nText(p.name, locale),
    price: p.price,
    compareAtPrice: p.compareAtPrice,
    badge: p.badge ? i18nText(p.badge, locale) : null,
    images: p.images.map((i) => ({ url: i.url, alt: i.alt ? i18nText(i.alt, locale) : i18nText(p.name, locale), colorName: i.colorName })),
    colors: colorOpt ? parseJson<OptionValue[]>(colorOpt.values, []) : [],
    sizes: sizeOpt ? parseJson<OptionValue[]>(sizeOpt.values, []).map((v) => v.value) : [],
    inStock: totalStock > 0,
    totalStock,
    featured: p.featured,
    category: p.category ? i18nText(p.category.name, locale) : null,
    tags: parseJson<string[]>(p.tags, []),
  };
}

export type ShopFilters = {
  category?: string; // slug
  collection?: string; // slug
  size?: string;
  color?: string;
  maxPrice?: number; // minor
  inStock?: boolean;
  onSale?: boolean;
  sort?: "featured" | "newest" | "price_asc" | "price_desc";
  q?: string;
};

export const listProducts = cache(async (locale: string, f: ShopFilters = {}): Promise<ProductCard[]> => {
  const rows = await db.product.findMany({
    where: {
      status: "published",
      ...(f.category ? { category: { slug: f.category } } : {}),
      ...(f.collection ? { collections: { some: { collection: { slug: f.collection, isPublished: true } } } } : {}),
      ...(f.maxPrice ? { price: { lte: f.maxPrice } } : {}),
      ...(f.onSale ? { compareAtPrice: { not: null } } : {}),
    },
    include: cardInclude,
    orderBy:
      f.sort === "newest"
        ? [{ publishedAt: "desc" }, { createdAt: "desc" }]
        : f.sort === "price_asc"
          ? [{ price: "asc" }]
          : f.sort === "price_desc"
            ? [{ price: "desc" }]
            : [{ featured: "desc" }, { sortOrder: "asc" }, { createdAt: "desc" }],
  });
  let cards = rows.map((r) => toCard(r, locale));
  if (f.size) cards = cards.filter((c) => rows.find((r) => r.id === c.id)!.variants.some((v) => parseJson<Record<string, string>>(v.options, {}).Size === f.size && v.stock > 0));
  if (f.color) cards = cards.filter((c) => c.colors.some((col) => col.value.toLowerCase() === f.color!.toLowerCase()));
  if (f.inStock) cards = cards.filter((c) => c.inStock);
  if (f.q) {
    const q = f.q.toLowerCase();
    cards = cards.filter((c) => [c.name, c.category ?? "", ...c.tags, ...c.colors.map((x) => x.value)].join(" ").toLowerCase().includes(q));
  }
  return cards;
});

export const getProduct = cache(async (slug: string, locale: string): Promise<ProductDetail | null> => {
  const p = await db.product.findFirst({
    where: { slug, status: "published" },
    include: {
      ...cardInclude,
      variants: { where: { isActive: true }, include: { image: true }, orderBy: { position: "asc" } },
      reviews: { where: { isApproved: true }, orderBy: { createdAt: "desc" }, take: 20 },
      collections: { include: { collection: true } },
    },
  });
  if (!p) return null;
  const card = toCard(p as unknown as ProductRow, locale);
  const details = parseJson<Record<string, Record<string, string>>>(p.details, {});
  const avg = p.reviews.length ? p.reviews.reduce((a, r) => a + r.rating, 0) / p.reviews.length : 0;
  return {
    ...card,
    description: i18nText(p.description, locale),
    details: Object.fromEntries(Object.entries(details).map(([k, v]) => [k, i18nText(v, locale)])),
    options: p.options.map((o) => ({ name: o.name, values: parseJson<OptionValue[]>(o.values, []) })),
    variants: p.variants.map((v) => ({
      id: v.id,
      sku: v.sku,
      title: v.title,
      options: parseJson<Record<string, string>>(v.options, {}),
      price: v.price ?? p.price,
      stock: v.stock,
      lowStockAt: v.lowStockAt,
      imageUrl: v.image?.url ?? null,
    })),
    video: p.video,
    sizeGuide: parseJson(p.sizeGuide, null),
    reviews: p.reviews.map((r) => ({ id: r.id, customerName: r.customerName, rating: r.rating, title: r.title, body: r.body, createdAt: r.createdAt.toISOString() })),
    rating: { average: Math.round(avg * 10) / 10, count: p.reviews.length },
    seoTitle: p.seoTitle ? i18nText(p.seoTitle, locale) : `${card.name} | ORYNVE`,
    seoDescription: p.seoDescription ? i18nText(p.seoDescription, locale) : i18nText(p.description, locale).slice(0, 155),
    collections: p.collections.filter((c) => c.collection.isPublished).map((c) => ({ slug: c.collection.slug, name: i18nText(c.collection.name, locale) })),
  };
});

export const getRelated = cache(async (productId: string, locale: string, take = 4) => {
  const p = await db.product.findUnique({ where: { id: productId }, select: { categoryId: true } });
  const rows = await db.product.findMany({
    where: { status: "published", id: { not: productId }, ...(p?.categoryId ? { categoryId: p.categoryId } : {}) },
    include: cardInclude,
    take,
    orderBy: [{ featured: "desc" }, { sortOrder: "asc" }],
  });
  if (rows.length < take) {
    const more = await db.product.findMany({
      where: { status: "published", id: { notIn: [productId, ...rows.map((r) => r.id)] } },
      include: cardInclude,
      take: take - rows.length,
      orderBy: [{ featured: "desc" }],
    });
    rows.push(...more);
  }
  return rows.map((r) => toCard(r, locale));
});

export const listCollections = cache(async (locale: string) => {
  const rows = await db.collection.findMany({ where: { isPublished: true }, orderBy: { sortOrder: "asc" }, include: { _count: { select: { products: true } } } });
  return rows.map((c) => ({
    id: c.id,
    slug: c.slug,
    name: i18nText(c.name, locale),
    description: c.description ? i18nText(c.description, locale) : "",
    image: c.image,
    count: c._count.products,
  }));
});

export const getCollection = cache(async (slug: string, locale: string) => {
  const c = await db.collection.findFirst({ where: { slug, isPublished: true } });
  return c ? { id: c.id, slug: c.slug, name: i18nText(c.name, locale), description: c.description ? i18nText(c.description, locale) : "", image: c.image } : null;
});

export const listCategories = cache(async (locale: string) => {
  const rows = await db.category.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" }, include: { _count: { select: { products: { where: { status: "published" } } } } } });
  return rows.map((c) => ({ id: c.id, slug: c.slug, name: i18nText(c.name, locale), image: c.image, count: c._count.products }));
});

export const getFilterFacets = cache(async () => {
  const variants = await db.productVariant.findMany({ where: { isActive: true, product: { status: "published" } }, select: { options: true, product: { select: { price: true } } } });
  const sizes = new Set<string>();
  const colors = new Map<string, string | undefined>();
  let maxPrice = 0;
  for (const v of variants) {
    const o = parseJson<Record<string, string>>(v.options, {});
    if (o.Size) sizes.add(o.Size);
    if (o.Color) colors.set(o.Color, undefined);
    maxPrice = Math.max(maxPrice, v.product.price);
  }
  const order = ["XS", "S", "M", "L", "XL", "XXL", "3XL"];
  return {
    sizes: [...sizes].sort((a, b) => (order.indexOf(a) === -1 ? 99 : order.indexOf(a)) - (order.indexOf(b) === -1 ? 99 : order.indexOf(b))),
    colors: [...colors.keys()],
    maxPrice,
  };
});

export const getPages = cache(async (locale: string) => {
  const rows = await db.page.findMany({ where: { isPublished: true }, orderBy: { createdAt: "asc" } });
  return rows.map((p) => ({ slug: p.slug, title: i18nText(p.title, locale), showInFooter: p.showInFooter, template: p.template }));
});

export const getPage = cache(async (slug: string, locale: string) => {
  const p = await db.page.findFirst({ where: { slug, isPublished: true } });
  if (!p) return null;
  return {
    slug: p.slug,
    title: i18nText(p.title, locale),
    body: i18nText(p.body, locale),
    template: p.template,
    seoTitle: p.seoTitle ? i18nText(p.seoTitle, locale) : `${i18nText(p.title, locale)} | ORYNVE`,
    seoDescription: p.seoDescription ? i18nText(p.seoDescription, locale) : i18nText(p.body, locale).slice(0, 155),
  };
});

export const getBlocks = cache(async (page = "home") => {
  const rows = await db.block.findMany({ where: { page, isEnabled: true }, orderBy: { position: "asc" } });
  return rows.map((b) => ({ id: b.id, type: b.type, data: parseJson<Record<string, any>>(b.data, {}) }));
});

export const getShippingZones = cache(async (locale: string) => {
  const rows = await db.shippingZone.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" } });
  return rows.map((z) => ({ id: z.id, name: i18nText(z.name, locale), districts: parseJson<string[]>(z.districts, []), rate: z.rate, freeAbove: z.freeAbove, etaMinDays: z.etaMinDays, etaMaxDays: z.etaMaxDays }));
});
