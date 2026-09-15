import "server-only";
import { db } from "@/lib/db";
import { parseI18n, parseJson } from "@/lib/json";
import { minorToMajor } from "@/lib/money";
import type { EditorSizeGuide, Pair, ProductEditorData } from "@/app/admin/products/ProductEditor";

const pair = (value: string | null | undefined): Pair => {
  const o = parseI18n(value);
  return { en: o.en ?? "", bn: o.bn ?? "" };
};

export function emptyProduct(): ProductEditorData {
  return {
    id: null,
    name: { en: "", bn: "" },
    slug: "",
    sku: "",
    status: "draft",
    categoryId: "",
    collectionIds: [],
    featured: false,
    badge: { en: "", bn: "" },
    tags: "",
    price: null,
    compareAtPrice: null,
    costPrice: null,
    description: { en: "", bn: "" },
    details: {
      material: { en: "", bn: "" },
      fit: { en: "", bn: "" },
      care: { en: "", bn: "" },
      shipping: { en: "", bn: "" },
      returns: { en: "", bn: "" },
    },
    video: "",
    sizeGuide: null,
    seoTitle: { en: "", bn: "" },
    seoDescription: { en: "", bn: "" },
    images: [],
    options: [
      { name: "Size", values: [{ value: "S" }, { value: "M" }, { value: "L" }, { value: "XL" }] },
      { name: "Colour", values: [{ value: "Onyx", hex: "#262521" }] },
    ],
    variants: [],
  };
}

export async function loadProductForEditor(id: string): Promise<ProductEditorData | null> {
  const p = await db.product.findUnique({
    where: { id },
    include: {
      images: { orderBy: { position: "asc" } },
      options: { orderBy: { position: "asc" } },
      variants: { orderBy: { position: "asc" }, include: { image: { select: { url: true } } } },
      collections: { select: { collectionId: true } },
    },
  });
  if (!p) return null;

  const details = parseJson<Record<string, Record<string, string>>>(p.details, {});
  const detail = (key: string): Pair => ({ en: details[key]?.en ?? "", bn: details[key]?.bn ?? "" });

  const rawGuide = parseJson<Partial<EditorSizeGuide> | null>(p.sizeGuide, null);
  const sizeGuide: EditorSizeGuide | null = rawGuide
    ? {
        unit: rawGuide.unit === "in" ? "in" : "cm",
        labels: Array.isArray(rawGuide.labels) ? rawGuide.labels.map(String) : [],
        rows: Array.isArray(rawGuide.rows) ? rawGuide.rows.map((r) => (Array.isArray(r) ? r.map(String) : [])) : [],
        notes: typeof rawGuide.notes === "string" ? rawGuide.notes : "",
      }
    : null;

  return {
    id: p.id,
    name: pair(p.name),
    slug: p.slug,
    sku: p.sku ?? "",
    status: p.status,
    categoryId: p.categoryId ?? "",
    collectionIds: p.collections.map((c) => c.collectionId),
    featured: p.featured,
    badge: pair(p.badge),
    tags: parseJson<string[]>(p.tags, []).join(", "),
    price: p.price,
    compareAtPrice: p.compareAtPrice,
    costPrice: p.costPrice,
    description: pair(p.description),
    details: {
      material: detail("material"),
      fit: detail("fit"),
      care: detail("care"),
      shipping: detail("shipping"),
      returns: detail("returns"),
    },
    video: p.video ?? "",
    sizeGuide,
    seoTitle: pair(p.seoTitle),
    seoDescription: pair(p.seoDescription),
    images: p.images.map((i) => ({ id: i.id, url: i.url, alt: pair(i.alt), colorName: i.colorName })),
    options: p.options.map((o) => ({
      name: o.name,
      values: parseJson<{ value: string; hex?: string }[]>(o.values, []).map((v) => ({ value: String(v.value ?? ""), ...(v.hex ? { hex: v.hex } : {}) })),
    })),
    variants: p.variants.map((v) => ({
      id: v.id,
      sku: v.sku ?? "",
      title: v.title,
      options: parseJson<Record<string, string>>(v.options, {}),
      priceMajor: v.price == null ? "" : String(minorToMajor(v.price)),
      stock: v.stock,
      lowStockAt: v.lowStockAt,
      isActive: v.isActive,
      imageUrl: v.image?.url ?? null,
    })),
  };
}

export async function loadEditorLookups() {
  const [categories, collections] = await Promise.all([
    db.category.findMany({ orderBy: { sortOrder: "asc" }, select: { id: true, name: true } }),
    db.collection.findMany({ orderBy: { sortOrder: "asc" }, select: { id: true, name: true } }),
  ]);
  return {
    categories: categories.map((c) => ({ id: c.id, name: parseI18n(c.name).en ?? c.id })),
    collections: collections.map((c) => ({ id: c.id, name: parseI18n(c.name).en ?? c.id })),
  };
}
