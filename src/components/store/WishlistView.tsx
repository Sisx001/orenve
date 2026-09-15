"use client";

import { useEffect, useState } from "react";
import type { ProductCard } from "@/types";
import { useCart } from "@/hooks/useCart";
import { useT, useLocale } from "@/lib/i18n/client";
import { apiFetch } from "@/lib/store/api";
import { ProductGrid } from "@/components/store/ProductGrid";
import { LocaleLink } from "@/components/store/LocaleLink";
import { EmptyState, Spinner } from "@/components/ui";

/** Saved pieces, hydrated from the local wishlist ids. */
export function WishlistView() {
  const cart = useCart();
  const t = useT();
  const locale = useLocale();
  const ids = cart.wishlist.join(",");

  const [products, setProducts] = useState<ProductCard[] | null>(null);

  useEffect(() => {
    if (!ids) {
      setProducts([]);
      return;
    }
    let cancelled = false;
    apiFetch<{ products: ProductCard[] }>(`/api/products?ids=${encodeURIComponent(ids)}&locale=${encodeURIComponent(locale)}`)
      .then((r) => {
        if (!cancelled) setProducts(r.products);
      })
      .catch(() => {
        if (!cancelled) setProducts([]);
      });
    return () => {
      cancelled = true;
    };
  }, [ids, locale]);

  if (products === null) {
    return (
      <div className="flex justify-center py-24">
        <Spinner />
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <EmptyState
        title={t("wishlist.empty")}
        text={t("wishlist.emptyText")}
        action={
          <LocaleLink href="/shop" className="btn">
            {t("cart.explore")}
          </LocaleLink>
        }
      />
    );
  }

  return (
    <>
      <p className="mb-10 text-[0.68rem] uppercase tracking-[0.16em] text-muted">{t("shop.results", { count: products.length })}</p>
      <ProductGrid products={products} />
    </>
  );
}
