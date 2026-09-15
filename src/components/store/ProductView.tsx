"use client";

import { useMemo, useState } from "react";
import type { ProductDetail } from "@/types";
import { Gallery } from "@/components/store/Gallery";
import { ProductInfo, type DeliveryZone } from "@/components/store/ProductInfo";

/**
 * Couples the gallery to the colour selector: choosing a colour narrows the
 * frames to the images tagged with that colour (when the owner tagged any).
 */
export function ProductView({ product, delivery }: { product: ProductDetail; delivery: DeliveryZone }) {
  const [color, setColor] = useState<string | null>(null);

  const images = useMemo(() => {
    if (!color) return product.images;
    const matched = product.images.filter((i) => i.colorName === color);
    return matched.length > 0 ? matched : product.images;
  }, [color, product.images]);

  return (
    <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:gap-16 3xl:gap-24">
      <Gallery images={images} video={product.video} />
      <div className="lg:sticky lg:top-[calc(var(--header-h)+2.5rem)] lg:self-start">
        <ProductInfo product={product} delivery={delivery} onColorChange={setColor} />
      </div>
    </div>
  );
}
