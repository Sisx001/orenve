"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, X, CornerDownLeft } from "lucide-react";
import type { ProductCard } from "@/types";
import { useCart } from "@/hooks/useCart";
import { useT, useLocale } from "@/lib/i18n/client";
import { useConfig } from "@/components/providers/ConfigProvider";
import { apiFetch } from "@/lib/store/api";
import { localizedPath } from "@/lib/i18n";
import { Modal, Spinner } from "@/components/ui";
import { cn } from "@/lib/utils";

const RECENT_KEY = "orynve.recentSearches";

function loadRecent(): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]");
    return Array.isArray(raw) ? raw.filter((x): x is string => typeof x === "string").slice(0, 6) : [];
  } catch {
    return [];
  }
}

function scoreProduct(p: ProductCard, q: string) {
  const name = p.name.toLowerCase();
  if (name.startsWith(q)) return 100;
  if (name.includes(q)) return 70;
  const haystack = [p.category ?? "", ...p.tags, ...p.colors.map((c) => c.value)].join(" ").toLowerCase();
  if (haystack.includes(q)) return 40;
  return 0;
}

/** Full-screen search over a lightweight client-side product index. */
export function SearchOverlay() {
  const cart = useCart();
  const t = useT();
  const locale = useLocale();
  const router = useRouter();
  const { money, config } = useConfig();

  const [index, setIndex] = useState<ProductCard[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");
  const [cursor, setCursor] = useState(0);
  const [recent, setRecent] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!cart.searchOpen) return;
    setRecent(loadRecent());
    setTimeout(() => inputRef.current?.focus(), 60);
    if (index !== null || loading) return;
    setLoading(true);
    apiFetch<{ products: ProductCard[] }>(`/api/products?all=1&locale=${encodeURIComponent(locale)}`)
      .then((r) => setIndex(r.products))
      .catch(() => setIndex([]))
      .finally(() => setLoading(false));
  }, [cart.searchOpen, index, loading, locale]);

  const results = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!index || query.length < 1) return [];
    return index
      .map((p) => ({ p, s: scoreProduct(p, query) }))
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s)
      .slice(0, 10)
      .map((x) => x.p);
  }, [index, q]);

  useEffect(() => {
    setCursor(0);
  }, [q]);

  function remember(term: string) {
    const next = [term, ...recent.filter((r) => r !== term)].slice(0, 6);
    setRecent(next);
    try {
      localStorage.setItem(RECENT_KEY, JSON.stringify(next));
    } catch {
      /* storage unavailable — recents are a nicety */
    }
  }

  function open(p: ProductCard) {
    remember(q.trim() || p.name);
    cart.openSearch(false);
    router.push(localizedPath(`/product/${p.slug}`, locale));
  }

  function submitAll() {
    const term = q.trim();
    if (!term) return;
    remember(term);
    cart.openSearch(false);
    router.push(`${localizedPath("/shop", locale)}?q=${encodeURIComponent(term)}`);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setCursor((c) => Math.min(c + 1, Math.max(0, results.length - 1)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setCursor((c) => Math.max(0, c - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const hit = results[cursor];
      if (hit) open(hit);
      else submitAll();
    }
  }

  if (!config.features.search) return null;

  return (
    <Modal open={cart.searchOpen} onClose={() => cart.openSearch(false)} side="bottom" title={t("search.title")} className="max-h-[88dvh] rounded-t-none" testId="search-overlay">
      <div className="mx-auto w-full max-w-3xl">
        <div className="flex items-center gap-3 border-b border-line pb-3">
          <Search className="h-4 w-4 shrink-0 text-muted" aria-hidden />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={t("search.placeholder")}
            aria-label={t("common.search")}
            className="w-full border-0 bg-transparent py-2 text-lg outline-none placeholder:text-muted/70"
            autoComplete="off"
            enterKeyHint="search"
          />
          {q && (
            <button type="button" onClick={() => setQ("")} aria-label={t("common.close")} className="p-1 text-muted hover:text-ink">
              <X className="h-4 w-4" aria-hidden />
            </button>
          )}
        </div>

        {loading && (
          <div className="flex justify-center py-14">
            <Spinner />
          </div>
        )}

        {!loading && q.trim().length === 0 && recent.length > 0 && (
          <div className="py-6">
            <p className="eyebrow mb-3">{t("search.recent")}</p>
            <div className="flex flex-wrap gap-2">
              {recent.map((r) => (
                <button key={r} type="button" onClick={() => setQ(r)} className="border border-line px-3 py-1.5 text-xs text-muted transition hover:border-ink hover:text-ink">
                  {r}
                </button>
              ))}
            </div>
          </div>
        )}

        {!loading && q.trim().length > 0 && results.length === 0 && <p className="py-14 text-center text-sm text-muted">{t("search.noResults")}</p>}

        {results.length > 0 && (
          <ul className="divide-y divide-line py-2" role="listbox" aria-label={t("search.title")}>
            {results.map((p, i) => (
              <li key={p.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={i === cursor}
                  onMouseEnter={() => setCursor(i)}
                  onClick={() => open(p)}
                  className={cn("flex w-full items-center gap-4 px-2 py-3 text-left transition", i === cursor && "bg-bone")}
                >
                  <span className="block w-12 shrink-0 bg-bone">
                    <span className="block aspect-[3/4] w-full">
                      {p.images[0] ? (
                        <img src={p.images[0].url} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
                      ) : (
                        <span className="skeleton block h-full w-full" />
                      )}
                    </span>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="display block truncate">{p.name}</span>
                    {p.category && <span className="eyebrow block">{p.category}</span>}
                  </span>
                  <span className="shrink-0 text-sm tabular-nums">{money(p.price)}</span>
                  {i === cursor && <CornerDownLeft className="h-3.5 w-3.5 shrink-0 text-muted" aria-hidden />}
                </button>
              </li>
            ))}
          </ul>
        )}

        {q.trim().length > 0 && (
          <button type="button" onClick={submitAll} className="btn-ghost mt-4 text-oxide">
            {t("search.seeAll", { q: q.trim() })}
          </button>
        )}

        <p className="mt-6 text-[0.62rem] uppercase tracking-[0.16em] text-muted">{t("search.hint")}</p>
      </div>
    </Modal>
  );
}
