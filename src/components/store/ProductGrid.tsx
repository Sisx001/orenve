"use client";

import type { ProductCard as ProductCardType } from "@/types";
import { ProductCard, type ProductCardView } from "@/components/store/ProductCard";
import { cn } from "@/lib/utils";

const GRIDS: Record<ProductCardView, string> = {
  grid: "grid grid-cols-2 gap-x-4 gap-y-12 md:grid-cols-3 md:gap-x-6 xl:grid-cols-4 3xl:grid-cols-5 tv:grid-cols-6",
  editorial: "grid grid-cols-1 gap-x-8 gap-y-16 sm:grid-cols-2 xl:grid-cols-3 3xl:grid-cols-4",
  list: "flex flex-col gap-10",
};

/** Responsive product grid with staggered reveal. */
export function ProductGrid({
  products,
  view = "grid",
  className,
  priorityCount = 4,
}: {
  products: ProductCardType[];
  view?: ProductCardView;
  className?: string;
  priorityCount?: number;
}) {
  // `product-grid` lets `[data-grid="2|3"]` pin the column count from md up
  // (see globals.css). `data-grid="4"` keeps the responsive ladder above.
  return (
    <div className={cn(GRIDS[view], view === "grid" && "product-grid", className)}>
      {products.map((p, i) => (
        <ProductCard key={p.id} product={p} index={i % 6} view={view} priority={i < priorityCount} />
      ))}
    </div>
  );
}
