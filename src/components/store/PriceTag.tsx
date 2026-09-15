"use client";

import { useMoney } from "@/components/providers/ConfigProvider";
import { percentOff } from "@/lib/money";
import { useT } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";

/** Price + struck-through compare-at + saving badge, in the active currency. */
export function PriceTag({
  price,
  compareAt,
  size = "md",
  showPercent = true,
  className,
}: {
  price: number;
  compareAt?: number | null;
  size?: "sm" | "md" | "lg";
  showPercent?: boolean;
  className?: string;
}) {
  const money = useMoney();
  const t = useT();
  const off = percentOff(price, compareAt);
  const sizeClass = size === "lg" ? "text-xl" : size === "sm" ? "text-[0.8rem]" : "text-base";
  return (
    <span className={cn("inline-flex items-baseline gap-2", sizeClass, className)}>
      <span className="tabular-nums">{money(price)}</span>
      {off > 0 && compareAt != null && (
        <>
          <span className="text-muted line-through tabular-nums" aria-label={t("common.sale")}>
            {money(compareAt)}
          </span>
          {showPercent && <span className="text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-oxide">−{off}%</span>}
        </>
      )}
    </span>
  );
}
