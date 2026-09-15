import { cn } from "@/lib/utils";

/** Five-star display. `value` is 0–5 and may be fractional. */
export function RatingStars({ value, size = 14, className, label }: { value: number; size?: number; className?: string; label?: string }) {
  const rounded = Math.max(0, Math.min(5, value));
  return (
    <span className={cn("inline-flex items-center gap-0.5 align-middle", className)} role="img" aria-label={label ?? `${rounded} / 5`}>
      {[0, 1, 2, 3, 4].map((i) => {
        const fill = Math.max(0, Math.min(1, rounded - i));
        return (
          <span key={i} className="relative inline-block" style={{ width: size, height: size }} aria-hidden>
            <Star size={size} className="text-line" />
            {fill > 0 && (
              <span className="absolute inset-0 overflow-hidden" style={{ width: `${fill * 100}%` }}>
                <Star size={size} className="text-brass" />
              </span>
            )}
          </span>
        );
      })}
    </span>
  );
}

function Star({ size, className }: { size: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={cn("block", className)} aria-hidden>
      <path d="M12 2.5l2.9 6.05 6.6.83-4.82 4.56 1.2 6.56L12 17.35 6.12 20.5l1.2-6.56L2.5 9.38l6.6-.83L12 2.5z" />
    </svg>
  );
}
