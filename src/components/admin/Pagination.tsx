import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/** Build a URL keeping every existing search param except `page`. */
export function pageHref(basePath: string, params: Record<string, string | undefined>, page: number) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) sp.set(k, v);
  if (page > 1) sp.set("page", String(page));
  const q = sp.toString();
  return q ? `${basePath}?${q}` : basePath;
}

export function Pagination({
  basePath,
  params,
  page,
  pageSize,
  total,
}: {
  basePath: string;
  params: Record<string, string | undefined>;
  page: number;
  pageSize: number;
  total: number;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (total === 0) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);

  const window: number[] = [];
  for (let p = Math.max(1, page - 2); p <= Math.min(pages, page + 2); p++) window.push(p);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-xs text-muted">
        {from}–{to} of {total}
      </p>
      {pages > 1 && (
        <nav className="flex items-center gap-1" aria-label="Pagination">
          <PageLink href={pageHref(basePath, params, page - 1)} disabled={page <= 1} aria-label="Previous page">
            <ChevronLeft className="h-3.5 w-3.5" />
          </PageLink>
          {window[0] > 1 && (
            <>
              <PageLink href={pageHref(basePath, params, 1)}>1</PageLink>
              {window[0] > 2 && <span className="px-1 text-xs text-muted">…</span>}
            </>
          )}
          {window.map((p) => (
            <PageLink key={p} href={pageHref(basePath, params, p)} active={p === page}>
              {p}
            </PageLink>
          ))}
          {window[window.length - 1] < pages && (
            <>
              {window[window.length - 1] < pages - 1 && <span className="px-1 text-xs text-muted">…</span>}
              <PageLink href={pageHref(basePath, params, pages)}>{pages}</PageLink>
            </>
          )}
          <PageLink href={pageHref(basePath, params, page + 1)} disabled={page >= pages} aria-label="Next page">
            <ChevronRight className="h-3.5 w-3.5" />
          </PageLink>
        </nav>
      )}
    </div>
  );
}

function PageLink({
  href,
  children,
  active,
  disabled,
  ...rest
}: {
  href: string;
  children: React.ReactNode;
  active?: boolean;
  disabled?: boolean;
  "aria-label"?: string;
}) {
  const cls = cn(
    "inline-flex h-8 min-w-8 items-center justify-center border px-2 text-xs transition",
    active ? "border-ink bg-ink text-paper" : "border-line hover:border-ink",
    disabled && "pointer-events-none opacity-40",
  );
  if (disabled) return <span className={cls}>{children}</span>;
  return (
    <Link href={href} className={cls} {...rest}>
      {children}
    </Link>
  );
}

export default Pagination;
