import { cn } from "@/lib/utils";
import { minorToMajor } from "@/lib/money";

/**
 * Dependency-free 30-day trend: area + line for revenue with an order-count
 * bar underlay. Drawn in a fixed viewBox and scaled by CSS.
 */
export function Sparkline({
  series,
  className,
  height = 120,
}: {
  series: { date: string; revenue: number; orders: number }[];
  className?: string;
  height?: number;
}) {
  const W = 600;
  const H = height;
  const pad = 4;
  const n = Math.max(1, series.length);
  const maxRev = Math.max(1, ...series.map((s) => s.revenue));
  const maxOrders = Math.max(1, ...series.map((s) => s.orders));
  const x = (i: number) => pad + (i * (W - pad * 2)) / Math.max(1, n - 1);
  const y = (v: number) => H - pad - (v / maxRev) * (H - pad * 2);

  const line = series.map((s, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(s.revenue).toFixed(1)}`).join(" ");
  const area = `${line} L${x(n - 1).toFixed(1)},${H - pad} L${x(0).toFixed(1)},${H - pad} Z`;
  const barW = Math.max(1.5, (W - pad * 2) / n - 2);

  return (
    <div className={cn("w-full", className)}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} role="img" aria-label="Revenue and orders, last 30 days" preserveAspectRatio="none">
        {/* order bars */}
        {series.map((s, i) => {
          const h = (s.orders / maxOrders) * (H - pad * 2) * 0.55;
          return <rect key={s.date} x={x(i) - barW / 2} y={H - pad - h} width={barW} height={Math.max(0, h)} fill="rgb(var(--c-line))" opacity="0.9" />;
        })}
        {/* revenue area + line */}
        <path d={area} fill="rgb(var(--c-oxide))" opacity="0.1" />
        <path d={line} fill="none" stroke="rgb(var(--c-oxide))" strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        {series.length > 0 && (
          <circle cx={x(n - 1)} cy={y(series[n - 1].revenue)} r="3" fill="rgb(var(--c-oxide))" />
        )}
      </svg>
      <div className="mt-2 flex items-center justify-between text-[0.6rem] uppercase tracking-[0.14em] text-muted">
        <span>{series[0]?.date ?? ""}</span>
        <span className="flex items-center gap-3">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-[2px] w-4 bg-oxide" /> Revenue (peak ৳{minorToMajor(maxRev).toLocaleString("en-US")})
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2 bg-line" /> Orders (peak {maxOrders})
          </span>
        </span>
        <span>{series[series.length - 1]?.date ?? ""}</span>
      </div>
    </div>
  );
}

export default Sparkline;
