"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Check, Loader2 } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";

export type InventoryRow = {
  id: string;
  productId: string;
  product: string;
  productSlug: string;
  title: string;
  sku: string | null;
  price: number;
  stock: number;
  lowStockAt: number;
  isActive: boolean;
  image: string | null;
};

/** Inline number field that saves on blur / Enter through the JSON route. */
function StockCell({ row, field }: { row: InventoryRow; field: "stock" | "lowStockAt" }) {
  const [value, setValue] = useState(String(row[field]));
  const [saved, setSaved] = useState<null | boolean>(null);
  const [busy, setBusy] = useState(false);

  const commit = async () => {
    const n = Math.max(0, Math.round(Number(value) || 0));
    if (n === row[field]) return;
    setBusy(true);
    try {
      await apiFetch("/api/admin/inventory", { method: "PATCH", json: { variantId: row.id, [field]: n } });
      row[field] = n;
      setSaved(true);
      setTimeout(() => setSaved(null), 1400);
    } catch (e) {
      setValue(String(row[field]));
      toast.error(e instanceof Error ? e.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <span className="relative inline-flex items-center gap-1">
      <input
        type="number"
        min={0}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            (e.target as HTMLInputElement).blur();
          }
        }}
        aria-label={`${field === "stock" ? "Stock" : "Low stock threshold"} for ${row.product} ${row.title}`}
        className={cn(
          "field-box w-[4.5rem] py-1.5 text-right font-mono text-xs",
          field === "stock" && Number(value) === 0 && "border-danger/60 text-danger",
          field === "stock" && Number(value) > 0 && Number(value) <= row.lowStockAt && "border-warning/60 text-warning",
        )}
      />
      {busy && <Loader2 className="h-3 w-3 animate-spin text-muted" />}
      {saved && <Check className="h-3 w-3 text-success" />}
    </span>
  );
}

function ActiveToggle({ row }: { row: InventoryRow }) {
  const [on, setOn] = useState(row.isActive);
  const [busy, setBusy] = useState(false);
  return (
    <input
      type="checkbox"
      checked={on}
      disabled={busy}
      aria-label={`Variant ${row.title} active`}
      onChange={async (e) => {
        const next = e.target.checked;
        setOn(next);
        setBusy(true);
        try {
          await apiFetch("/api/admin/inventory", { method: "PATCH", json: { variantId: row.id, isActive: next } });
        } catch (err) {
          setOn(!next);
          toast.error(err instanceof Error ? err.message : "Could not save.");
        } finally {
          setBusy(false);
        }
      }}
      className="h-3.5 w-3.5 accent-[rgb(var(--c-oxide))]"
    />
  );
}

export function InventoryTable({ rows }: { rows: InventoryRow[] }) {
  if (rows.length === 0) {
    return <div className="card px-6 py-16 text-center text-sm text-muted">No variants match this filter.</div>;
  }
  return (
    <div className="card overflow-hidden">
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[46rem] border-collapse text-sm">
          <thead className="bg-bone/80">
            <tr className="text-[0.6rem] uppercase tracking-[0.14em] text-muted">
              <th className="w-12 border-b border-line px-3 py-2.5" />
              <th className="border-b border-line px-3 py-2.5 text-left font-semibold">Product</th>
              <th className="border-b border-line px-3 py-2.5 text-left font-semibold">Variant</th>
              <th className="border-b border-line px-3 py-2.5 text-left font-semibold">SKU</th>
              <th className="border-b border-line px-3 py-2.5 text-right font-semibold">Price</th>
              <th className="border-b border-line px-3 py-2.5 text-right font-semibold">Stock</th>
              <th className="border-b border-line px-3 py-2.5 text-right font-semibold">Low at</th>
              <th className="border-b border-line px-3 py-2.5 text-center font-semibold">Active</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-line/60 last:border-0 hover:bg-bone/50">
                <td className="px-3 py-2">
                  <span className="block h-10 w-8 overflow-hidden border border-line bg-bone">
                    {r.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={r.image} alt="" className="h-full w-full object-cover" />
                    ) : null}
                  </span>
                </td>
                <td className="max-w-[16rem] px-3 py-2">
                  <Link href={`/admin/products/${r.productId}`} className="block truncate underline-offset-4 hover:underline">
                    {r.product}
                  </Link>
                </td>
                <td className="px-3 py-2">{r.title}</td>
                <td className="px-3 py-2 font-mono text-xs text-muted">{r.sku ?? "—"}</td>
                <td className="px-3 py-2 text-right tabular-nums">{formatMoney(r.price)}</td>
                <td className="px-3 py-2 text-right">
                  <StockCell row={r} field="stock" />
                </td>
                <td className="px-3 py-2 text-right">
                  <StockCell row={r} field="lowStockAt" />
                </td>
                <td className="px-3 py-2 text-center">
                  <ActiveToggle row={r} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="divide-y divide-line md:hidden">
        {rows.map((r) => (
          <li key={r.id} className="px-4 py-3">
            <Link href={`/admin/products/${r.productId}`} className="block truncate text-sm">
              {r.product}
            </Link>
            <p className="truncate text-xs text-muted">
              {r.title}
              {r.sku ? ` · ${r.sku}` : ""} · {formatMoney(r.price)}
            </p>
            <div className="mt-2 flex items-center gap-4">
              <label className="flex items-center gap-1.5 text-[0.6rem] uppercase tracking-[0.14em] text-muted">
                Stock
                <StockCell row={r} field="stock" />
              </label>
              <label className="flex items-center gap-1.5 text-[0.6rem] uppercase tracking-[0.14em] text-muted">
                Low at
                <StockCell row={r} field="lowStockAt" />
              </label>
              <label className="flex items-center gap-1.5 text-[0.6rem] uppercase tracking-[0.14em] text-muted">
                Active
                <ActiveToggle row={r} />
              </label>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default InventoryTable;
