"use client";

import { useState } from "react";
import type { ProductDetail } from "@/types";
import { Modal } from "@/components/ui";
import { useT } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";

type SizeGuide = NonNullable<ProductDetail["sizeGuide"]>;

function convert(value: string, from: "cm" | "in", to: "cm" | "in") {
  const n = Number(value.replace(/[^\d.]/g, ""));
  if (!Number.isFinite(n) || value.trim() === "") return value;
  if (from === to) return String(Math.round(n * 10) / 10);
  const converted = from === "cm" ? n / 2.54 : n * 2.54;
  return String(Math.round(converted * 10) / 10);
}

/** Garment measurement chart with a cm / in toggle. */
export function SizeGuideModal({ open, onClose, guide }: { open: boolean; onClose: () => void; guide: SizeGuide }) {
  const t = useT();
  const [unit, setUnit] = useState<"cm" | "in">(guide.unit);

  return (
    <Modal open={open} onClose={onClose} title={t("product.sizeGuideTitle")} description={t("product.garmentMeasurements")} className="max-w-2xl">
      <div className="mb-5 flex items-center gap-1 border border-line p-1" role="group" aria-label={t("product.sizeGuide")}>
        {(["cm", "in"] as const).map((u) => (
          <button
            key={u}
            type="button"
            onClick={() => setUnit(u)}
            aria-pressed={unit === u}
            className={cn(
              "flex-1 py-2 text-[0.65rem] font-semibold uppercase tracking-[0.16em] transition",
              unit === u ? "bg-ink text-paper" : "text-muted hover:text-ink",
            )}
          >
            {u}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[26rem] border-collapse text-sm">
          <thead>
            <tr>
              {guide.labels.map((l, i) => (
                <th key={i} scope="col" className="border-b border-line pb-2 text-left text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-muted">
                  {l}
                  {i > 0 && <span className="ml-1 normal-case text-line">({unit})</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {guide.rows.map((row, r) => (
              <tr key={r} className="border-b border-line/60">
                {row.map((cell, c) => (
                  <td key={c} className={cn("py-3 tabular-nums", c === 0 && "font-semibold uppercase tracking-[0.1em]")}>
                    {c === 0 ? cell : convert(cell, guide.unit, unit)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {guide.notes && <p className="mt-5 text-xs leading-relaxed text-muted">{guide.notes}</p>}
    </Modal>
  );
}
