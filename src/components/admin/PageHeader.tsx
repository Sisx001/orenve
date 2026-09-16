import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * PageHeader — full-width hero-style header for studio pages.
 *
 * All props are identical to the previous version; only `aside` is added
 * to Section (non-breaking).
 */
export function PageHeader({
  title,
  description,
  actions,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between", className)}>
      <div className="min-w-0">
        <h1 className="display text-[1.6rem] leading-tight tracking-tight sm:text-[1.9rem]">{title}</h1>
        {description && <p className="mt-1.5 max-w-2xl text-sm text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/**
 * Section — a card with an optional header row.
 *
 * Props (all optional, backwards-compatible):
 *  - title      — section heading
 *  - description — small text under the title
 *  - aside      — content placed inline with the title (e.g. a count chip)
 *  - actions    — right-aligned buttons / links
 *  - children   — body content
 *  - className  — additional classes on the card root
 */
export function Section({
  title,
  description,
  aside,
  actions,
  children,
  className,
}: {
  title?: ReactNode;
  description?: ReactNode;
  aside?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const hasHeader = title || actions || aside;
  return (
    <section className={cn("card", className)}>
      {hasHeader && (
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3 sm:px-5">
          <div className="flex min-w-0 items-center gap-2">
            {title && (
              <h2 className="text-[0.72rem] font-semibold uppercase tracking-[0.16em]">{title}</h2>
            )}
            {aside && <span className="shrink-0">{aside}</span>}
            {description && <p className="mt-0.5 text-xs text-muted">{description}</p>}
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className="p-4 sm:p-5">{children}</div>
    </section>
  );
}

export default PageHeader;
