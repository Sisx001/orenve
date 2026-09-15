import type { ShopFilters } from "@/lib/catalog";

export type ShopView = "grid" | "list" | "editorial";
export type ShopSort = NonNullable<ShopFilters["sort"]>;

export type ShopSearchParams = {
  category?: string;
  collection?: string;
  size?: string;
  color?: string;
  max?: string;
  stock?: string;
  sale?: string;
  sort?: string;
  q?: string;
  view?: string;
};

const SORTS: ShopSort[] = ["featured", "newest", "price_asc", "price_desc"];
const VIEWS: ShopView[] = ["grid", "list", "editorial"];

export function parseView(v: string | undefined): ShopView {
  return VIEWS.includes(v as ShopView) ? (v as ShopView) : "grid";
}

export function parseSort(v: string | undefined): ShopSort {
  return SORTS.includes(v as ShopSort) ? (v as ShopSort) : "featured";
}

/** Turns raw URL search params into the catalog filter shape (prices in minor units). */
export function toFilters(sp: ShopSearchParams, presetCollection?: string): ShopFilters {
  const maxMajor = sp.max ? Number(sp.max) : NaN;
  return {
    category: sp.category || undefined,
    collection: presetCollection ?? (sp.collection || undefined),
    size: sp.size || undefined,
    color: sp.color || undefined,
    maxPrice: Number.isFinite(maxMajor) && maxMajor > 0 ? Math.round(maxMajor * 100) : undefined,
    inStock: sp.stock === "1",
    onSale: sp.sale === "1",
    sort: parseSort(sp.sort),
    q: sp.q || undefined,
  };
}

export function activeFilterCount(sp: ShopSearchParams): number {
  return [sp.category, sp.collection, sp.size, sp.color, sp.max, sp.stock === "1" ? "1" : "", sp.sale === "1" ? "1" : "", sp.q].filter(
    (v) => !!v,
  ).length;
}
