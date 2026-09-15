"use client";

import { useEffect, useState } from "react";
import type { ProductDetail } from "@/types";
import { useCart } from "@/hooks/useCart";
import { useT, useLocale } from "@/lib/i18n/client";
import { useFeatures } from "@/components/providers/ConfigProvider";
import { apiFetch } from "@/lib/store/api";
import { Modal, Spinner } from "@/components/ui";
import { ProductInfo } from "@/components/store/ProductInfo";

/** Modal preview of a product, opened from cards and lookbook hotspots. */
export function QuickView() {
  const cart = useCart();
  const t = useT();
  const locale = useLocale();
  const features = useFeatures();
  const slug = cart.quickView;

  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [color, setColor] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) {
      setProduct(null);
      setError(null);
      setColor(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    apiFetch<{ product: ProductDetail }>(`/api/products?slug=${encodeURIComponent(slug)}&locale=${encodeURIComponent(locale)}`)
      .then((r) => {
        if (!cancelled) setProduct(r.product);
      })
      .catch((e: Error) => {
        if (!cancelled) setError(t(e.message));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [slug, locale, t]);

  if (!features.quickView) return null;

  const images = product ? (color ? (product.images.filter((i) => i.colorName === color).length > 0 ? product.images.filter((i) => i.colorName === color) : product.images) : product.images) : [];

  return (
    <Modal
      open={!!slug}
      onClose={() => cart.setQuickView(null)}
      side="center"
      title={t("shop.quickView")}
      className="max-h-[92dvh] w-full max-w-5xl"
      testId="quick-view"
    >
      {loading && (
        <div className="flex min-h-[40vh] items-center justify-center">
          <Spinner />
        </div>
      )}
      {error && !loading && <p className="py-16 text-center text-sm text-danger">{error}</p>}
      {product && !loading && (
        <div className="grid gap-8 md:grid-cols-2">
          <div className="no-scrollbar -mx-2 flex snap-x snap-mandatory gap-2 overflow-x-auto px-2 md:mx-0 md:grid md:grid-cols-1 md:gap-2 md:overflow-visible md:px-0">
            {images.slice(0, 2).map((img, i) => (
              <span key={`${img.url}-${i}`} className="block aspect-[3/4] w-[78%] shrink-0 snap-center bg-bone md:w-full">
                <img src={img.url} alt={img.alt} loading="lazy" decoding="async" className="h-full w-full object-cover" />
              </span>
            ))}
          </div>
          <ProductInfo product={product} mode="quick" onColorChange={setColor} />
        </div>
      )}
    </Modal>
  );
}
