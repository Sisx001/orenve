import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { cn } from "@/lib/utils";

export type Column<T> = {
  key: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  className?: string;
  align?: "left" | "right" | "center";
  /** when set, the header becomes a sort link (needs `sort` on the table) */
  sortKey?: string;
  /** hidden in the mobile card view */
  hideOnMobile?: boolean;
  /** rendered as the card heading on mobile */
  primary?: boolean;
};

export type TableSort = { by: string; dir: "asc" | "desc"; href: (key: string, dir: "asc" | "desc") => string };

const alignClass = { left: "text-left", right: "text-right", center: "text-center" } as const;

/**
 * Dense studio table. Renders a sticky-header table from `md` up and a stack of
 * label/value cards below that, so every list stays usable on a phone.
 */
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  rowHref,
  empty,
  sort,
  className,
  footer,
}: {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  rowHref?: (row: T) => string | undefined;
  empty?: ReactNode;
  sort?: TableSort;
  className?: string;
  footer?: ReactNode;
}) {
  if (rows.length === 0) {
    return (
      <div className="card px-6 py-16 text-center">
        <p className="text-sm text-muted">{empty ?? "Nothing here yet."}</p>
      </div>
    );
  }

  return (
    <div className={cn("card overflow-hidden", className)}>
      {/* desktop */}
      <div className="hidden max-h-[72vh] overflow-auto md:block">
        <table className="w-full border-collapse text-sm">
          <thead className="sticky top-0 z-10 bg-bone/95 backdrop-blur">
            <tr>
              {columns.map((c) => {
                const active = sort && c.sortKey === sort.by;
                const nextDir = active && sort.dir === "asc" ? "desc" : "asc";
                return (
                  <th
                    key={c.key}
                    scope="col"
                    className={cn(
                      "whitespace-nowrap border-b border-line px-3 py-2.5 text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-muted",
                      alignClass[c.align ?? "left"],
                      c.className,
                    )}
                  >
                    {c.sortKey && sort ? (
                      <Link href={sort.href(c.sortKey, nextDir)} className="inline-flex items-center gap-1 hover:text-ink">
                        {c.header}
                        {active ? (
                          sort.dir === "asc" ? (
                            <ArrowUp className="h-3 w-3" />
                          ) : (
                            <ArrowDown className="h-3 w-3" />
                          )
                        ) : null}
                      </Link>
                    ) : (
                      c.header
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const href = rowHref?.(row);
              return (
                <tr key={rowKey(row)} className="group border-b border-line/70 last:border-0 hover:bg-bone/60">
                  {columns.map((c, i) => (
                    <td key={c.key} className={cn("px-3 py-2.5 align-middle", alignClass[c.align ?? "left"], c.className)}>
                      {href && i === 0 ? (
                        <Link href={href} className="block underline-offset-4 hover:underline">
                          {c.cell(row)}
                        </Link>
                      ) : (
                        c.cell(row)
                      )}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* mobile */}
      <ul className="divide-y divide-line md:hidden">
        {rows.map((row) => {
          const href = rowHref?.(row);
          const primary = columns.find((c) => c.primary) ?? columns[0];
          const rest = columns.filter((c) => c !== primary && !c.hideOnMobile);
          return (
            <li key={rowKey(row)} className="px-4 py-3.5">
              <div className="mb-2 text-sm font-medium">
                {href ? <Link href={href}>{primary.cell(row)}</Link> : primary.cell(row)}
              </div>
              <dl className="grid grid-cols-[auto,1fr] gap-x-3 gap-y-1.5 text-xs">
                {rest.map((c) => (
                  <div key={c.key} className="col-span-2 flex items-start justify-between gap-3">
                    <dt className="text-[0.62rem] uppercase tracking-[0.14em] text-muted">{c.header}</dt>
                    <dd className="min-w-0 text-right">{c.cell(row)}</dd>
                  </div>
                ))}
              </dl>
            </li>
          );
        })}
      </ul>
      {footer && <div className="border-t border-line px-4 py-3">{footer}</div>}
    </div>
  );
}

export function EmptyRow({ children = "Nothing here yet." }: { children?: ReactNode }) {
  return <div className="card px-6 py-16 text-center text-sm text-muted">{children}</div>;
}

export default DataTable;
