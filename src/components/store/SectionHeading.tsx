import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { headlineLines } from "@/lib/store/richtext";

/**
 * Editorial section heading. Multi-line titles alternate roman / italic so
 * every headline on the site has the same rhythm.
 */
export function SectionHeading({
  eyebrow,
  title,
  subtitle,
  action,
  align = "left",
  size = "md",
  className,
  id,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  action?: ReactNode;
  align?: "left" | "center";
  size?: "sm" | "md" | "lg";
  className?: string;
  id?: string;
}) {
  const lines = headlineLines(title);
  const sizeClass = size === "lg" ? "text-display-lg" : size === "sm" ? "text-display-sm" : "text-display-md";
  return (
    <div className={cn("flex flex-col gap-5", align === "center" ? "items-center text-center" : "md:flex-row md:items-end md:justify-between", className)}>
      <div className={cn("max-w-3xl", align === "center" && "mx-auto")}>
        {eyebrow && <p className="eyebrow mb-4">{eyebrow}</p>}
        <h2 id={id} className={cn("display text-balance", sizeClass)}>
          {lines.map((line, i) => (
            <span key={i} className={cn("block", i % 2 === 1 && "display-italic text-muted")}>
              {line}
            </span>
          ))}
        </h2>
        {subtitle && <p className={cn("mt-5 max-w-xl text-muted", align === "center" && "mx-auto")}>{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
