import { cn } from "@/lib/utils";

/**
 * Slow infinite marquee. Decorative — the duplicated track is aria-hidden and
 * the readable text is exposed once to assistive tech.
 */
export function Marquee({ text, className, duration = 46, separator = "·" }: { text: string; className?: string; duration?: number; separator?: string }) {
  const item = (
    <span className="flex shrink-0 items-center">
      <span className="display whitespace-nowrap px-6 text-[clamp(1.5rem,3.4vw,3.25rem)] tracking-[-0.01em]">{text}</span>
      <span aria-hidden className="text-oxide">
        {separator}
      </span>
    </span>
  );
  return (
    <div className={cn("mask-fade-x relative overflow-hidden border-y border-line py-6", className)}>
      <span className="sr-only">{text}</span>
      <div aria-hidden className="flex w-max animate-marquee items-center" style={{ animationDuration: `${duration}s` }}>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <span key={i} className="flex">
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}
