"use client";

import { useCallback, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { LayoutGrid, List, Rows3, SlidersHorizontal, X } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { useMoney } from "@/components/providers/ConfigProvider";
import { Modal, Switch } from "@/components/ui";
import { activeFilterCount, parseSort, parseView, type ShopSearchParams, type ShopView } from "@/lib/store/shopParams";
import { cn } from "@/lib/utils";

export type Facets = { sizes: string[]; colors: string[]; maxPrice: number };
export type ToolbarCategory = { slug: string; name: string; count: number };

/**
 * Filter / sort / view controls. Every change is written to the URL so results
 * stay shareable and the server does the filtering.
 */
export function ShopToolbar({
  searchParams,
  categories,
  facets,
  resultCount,
  lockCategory = false,
}: {
  searchParams: ShopSearchParams;
  categories: ToolbarCategory[];
  facets: Facets;
  resultCount: number;
  lockCategory?: boolean;
}) {
  const t = useT();
  const router = useRouter();
  const pathname = usePathname();
  const money = useMoney();
  const [panel, setPanel] = useState(false);

  const view = parseView(searchParams.view);
  const sort = parseSort(searchParams.sort);
  const activeCount = activeFilterCount(searchParams);

  const push = useCallback(
    (patch: Partial<ShopSearchParams>) => {
      const next = new URLSearchParams();
      const merged: ShopSearchParams = { ...searchParams, ...patch };
      (Object.keys(merged) as (keyof ShopSearchParams)[]).forEach((k) => {
        const v = merged[k];
        if (v) next.set(k, String(v));
      });
      const qs = next.toString();
      router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [searchParams, pathname, router],
  );

  const clear = () => router.push(searchParams.view ? `${pathname}?view=${searchParams.view}` : pathname, { scroll: false });

  const sortOptions = useMemo(
    () => [
      { value: "featured", label: t("shop.sortFeatured") },
      { value: "newest", label: t("shop.sortNewest") },
      { value: "price_asc", label: t("shop.sortPriceAsc") },
      { value: "price_desc", label: t("shop.sortPriceDesc") },
    ],
    [t],
  );

  const views: { value: ShopView; label: string; Icon: typeof LayoutGrid }[] = [
    { value: "grid", label: t("shop.viewGrid"), Icon: LayoutGrid },
    { value: "list", label: t("shop.viewList"), Icon: List },
    { value: "editorial", label: t("shop.viewEditorial"), Icon: Rows3 },
  ];

  const renderFilters = (layout: "row" | "stack") => (
    <div className={cn(layout === "row" ? "grid grid-cols-2 items-start gap-x-10 gap-y-7 xl:grid-cols-4" : "flex flex-col gap-8")}>
      {facets.sizes.length > 0 && (
        <fieldset>
          <legend className="eyebrow mb-3">{t("shop.size")}</legend>
          <div className="flex flex-wrap gap-2">
            {facets.sizes.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => push({ size: searchParams.size === s ? "" : s })}
                aria-pressed={searchParams.size === s}
                className={cn(
                  "min-w-[3rem] border px-3 py-2 text-[0.68rem] font-semibold uppercase tracking-[0.12em] transition",
                  searchParams.size === s ? "border-ink bg-ink text-paper" : "border-line hover:border-ink",
                )}
              >
                {s}
              </button>
            ))}
          </div>
        </fieldset>
      )}

      {facets.colors.length > 0 && (
        <fieldset>
          <legend className="eyebrow mb-3">{t("shop.color")}</legend>
          <div className="flex flex-wrap gap-2">
            {facets.colors.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => push({ color: searchParams.color === c ? "" : c })}
                aria-pressed={searchParams.color === c}
                className={cn(
                  "border px-3 py-2 text-xs transition",
                  searchParams.color?.toLowerCase() === c.toLowerCase() ? "border-ink bg-ink text-paper" : "border-line text-muted hover:border-ink hover:text-ink",
                )}
              >
                {c}
              </button>
            ))}
          </div>
        </fieldset>
      )}

      {facets.maxPrice > 0 && (
        <fieldset>
          <legend className="eyebrow mb-3">{t("shop.maxPrice")}</legend>
          <input
            type="range"
            min={Math.round(facets.maxPrice / 100 / 10)}
            max={Math.round(facets.maxPrice / 100)}
            step={100}
            value={searchParams.max ? Number(searchParams.max) : Math.round(facets.maxPrice / 100)}
            onChange={(e) => push({ max: e.target.value })}
            className="w-full accent-[rgb(var(--c-oxide))]"
            aria-label={t("shop.maxPrice")}
          />
          <p className="mt-2 text-sm tabular-nums text-muted">
            {money((searchParams.max ? Number(searchParams.max) : Math.round(facets.maxPrice / 100)) * 100)}
          </p>
        </fieldset>
      )}

      <div className={cn("flex flex-col gap-4", layout === "stack" && "border-t border-line pt-6")}>
        <Switch checked={searchParams.stock === "1"} onChange={(v) => push({ stock: v ? "1" : "" })} label={t("shop.inStockOnly")} />
        <Switch checked={searchParams.sale === "1"} onChange={(v) => push({ sale: v ? "1" : "" })} label={t("shop.onSale")} />
      </div>

      {activeCount > 0 && (
        <button type="button" onClick={clear} className={cn("btn-ghost self-start text-oxide", layout === "row" && "col-span-2 xl:col-span-4")}>
          <X className="h-3.5 w-3.5" aria-hidden />
          {t("shop.clearFilters")}
        </button>
      )}
    </div>
  );

  return (
    <div className="border-y border-line">
      {/* category tabs */}
      {!lockCategory && categories.length > 0 && (
        <div className="no-scrollbar flex gap-1 overflow-x-auto border-b border-line py-1" role="tablist" aria-label={t("shop.category")}>
          <button
            type="button"
            role="tab"
            aria-selected={!searchParams.category}
            onClick={() => push({ category: "" })}
            className={cn(
              "whitespace-nowrap px-3 py-2.5 text-[0.68rem] font-semibold uppercase tracking-[0.14em] transition",
              !searchParams.category ? "text-ink underline decoration-oxide decoration-2 underline-offset-[10px]" : "text-muted hover:text-ink",
            )}
          >
            {t("nav.allPieces")}
          </button>
          {categories.map((c) => (
            <button
              key={c.slug}
              type="button"
              role="tab"
              aria-selected={searchParams.category === c.slug}
              onClick={() => push({ category: searchParams.category === c.slug ? "" : c.slug })}
              className={cn(
                "whitespace-nowrap px-3 py-2.5 text-[0.68rem] font-semibold uppercase tracking-[0.14em] transition",
                searchParams.category === c.slug ? "text-ink underline decoration-oxide decoration-2 underline-offset-[10px]" : "text-muted hover:text-ink",
              )}
            >
              {c.name}
              <span className="ml-1.5 text-[0.6rem] text-muted">{c.count}</span>
            </button>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between gap-4 py-3">
        <div className="flex items-center gap-4">
          <button type="button" onClick={() => setPanel(true)} aria-expanded={panel} className="btn-ghost lg:hidden">
            <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden />
            {t("shop.filters")}
            {activeCount > 0 && <span className="ml-1 bg-oxide px-1.5 text-[0.55rem] font-bold leading-4 text-snow">{activeCount}</span>}
          </button>
          <p className="text-[0.68rem] uppercase tracking-[0.14em] text-muted" aria-live="polite">
            {t("shop.results", { count: resultCount })}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2">
            <span className="sr-only">{t("shop.sort")}</span>
            <select
              value={sort}
              onChange={(e) => push({ sort: e.target.value })}
              className="border-0 bg-transparent text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-muted outline-none hover:text-ink"
            >
              {sortOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>

          <div className="hidden items-center gap-0.5 border border-line sm:flex" role="group" aria-label={t("shop.viewGrid")}>
            {views.map((v) => (
              <button
                key={v.value}
                type="button"
                onClick={() => push({ view: v.value })}
                aria-label={v.label}
                aria-pressed={view === v.value}
                className={cn("p-2 transition", view === v.value ? "bg-ink text-paper" : "text-muted hover:text-ink")}
              >
                <v.Icon className="h-3.5 w-3.5" aria-hidden />
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* desktop inline filters */}
      <div className="hidden border-t border-line py-7 lg:block">{renderFilters("row")}</div>

      {/* mobile sheet */}
      <Modal open={panel} onClose={() => setPanel(false)} side="bottom" title={t("shop.filters")}>
        {renderFilters("stack")}
        <button type="button" onClick={() => setPanel(false)} className="btn mt-8 w-full">
          {t("shop.results", { count: resultCount })}
        </button>
      </Modal>
    </div>
  );
}
