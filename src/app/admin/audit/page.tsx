import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { PageHeader } from "@/components/admin/PageHeader";
import { Pagination } from "@/components/admin/Pagination";
import { SearchInput, FilterSelect } from "@/components/admin/SearchInput";
import { JsonView } from "@/components/admin/JsonView";
import { requireStudio } from "@/lib/admin/session";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
const PAGE_SIZE = 40;
const str = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);

/** Link an audit row back to the thing it touched, when we can. */
function entityHref(entity: string, entityId: string | null): string | null {
  if (!entityId) return null;
  switch (entity) {
    case "order":
      return `/admin/orders/${entityId}`;
    case "product":
      return `/admin/products/${entityId}`;
    case "customer":
      return `/admin/customers/${entityId}`;
    case "page":
      return `/admin/pages/${entityId}`;
    default:
      return null;
  }
}

export default async function AuditPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireStudio("audit.read", "/admin/audit");
  const sp = await searchParams;
  const q = str(sp.q) ?? "";
  const entity = str(sp.entity) ?? "";
  const userId = str(sp.user) ?? "";
  const page = Math.max(1, Number(str(sp.page) ?? "1") || 1);

  const where: Prisma.AuditLogWhereInput = {};
  if (entity) where.entity = entity;
  if (userId) where.userId = userId;
  if (q) where.OR = [{ action: { contains: q } }, { entityId: { contains: q } }, { meta: { contains: q } }, { ip: { contains: q } }];

  const [total, logs, entities, users] = await Promise.all([
    db.auditLog.count({ where }),
    db.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { user: { select: { name: true, email: true } } },
    }),
    db.auditLog.findMany({ distinct: ["entity"], select: { entity: true }, orderBy: { entity: "asc" } }),
    db.user.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="mx-auto max-w-[1300px]">
      <PageHeader title="Audit log" description="Every consequential action, who did it and from where. Read-only by design." />

      <div className="mb-4 flex flex-wrap items-end gap-2.5">
        <SearchInput param="q" placeholder="Search action, id, IP or details…" className="min-w-[15rem] flex-1" />
        <FilterSelect param="entity" label="Entity" options={[{ value: "", label: "Any" }, ...entities.map((e) => ({ value: e.entity, label: e.entity }))]} />
        <FilterSelect param="user" label="User" options={[{ value: "", label: "Anyone" }, ...users.map((u) => ({ value: u.id, label: u.name }))]} />
      </div>

      {logs.length === 0 ? (
        <div className="card px-6 py-20 text-center text-sm text-muted">Nothing matches these filters.</div>
      ) : (
        <>
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[46rem] border-collapse text-sm">
                <thead className="bg-bone/80">
                  <tr className="text-[0.58rem] uppercase tracking-[0.14em] text-muted">
                    <th className="border-b border-line px-3 py-2.5 text-left font-semibold">When</th>
                    <th className="border-b border-line px-3 py-2.5 text-left font-semibold">Who</th>
                    <th className="border-b border-line px-3 py-2.5 text-left font-semibold">Action</th>
                    <th className="border-b border-line px-3 py-2.5 text-left font-semibold">Entity</th>
                    <th className="border-b border-line px-3 py-2.5 text-left font-semibold">IP</th>
                    <th className="border-b border-line px-3 py-2.5 text-left font-semibold">Details</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((l) => {
                    const href = entityHref(l.entity, l.entityId);
                    return (
                      <tr key={l.id} className="border-b border-line/60 align-top last:border-0 hover:bg-bone/50">
                        <td className="whitespace-nowrap px-3 py-2.5 text-xs text-muted">
                          {l.createdAt.toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                        </td>
                        <td className="px-3 py-2.5 text-xs">{l.user ? l.user.name : "system"}</td>
                        <td className="px-3 py-2.5">
                          <span className="font-mono text-xs">{l.action}</span>
                        </td>
                        <td className="px-3 py-2.5 text-xs">
                          {href ? (
                            <Link href={href} className="underline-offset-4 hover:underline">
                              {l.entity}
                            </Link>
                          ) : (
                            l.entity
                          )}
                          {l.entityId && <span className="block font-mono text-[0.6rem] text-muted">{l.entityId.slice(0, 12)}</span>}
                        </td>
                        <td className="px-3 py-2.5 font-mono text-[0.66rem] text-muted">{l.ip ?? "—"}</td>
                        <td className="max-w-[24rem] px-3 py-2.5">
                          {l.meta ? (
                            <details>
                              <summary className="cursor-pointer text-[0.62rem] uppercase tracking-[0.14em] text-oxide">View</summary>
                              <JsonView value={l.meta} className="mt-1.5 max-h-40" />
                            </details>
                          ) : (
                            <span className="text-xs text-muted">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
          <div className="mt-4">
            <Pagination basePath="/admin/audit" params={{ q, entity, user: userId }} page={page} pageSize={PAGE_SIZE} total={total} />
          </div>
        </>
      )}
    </div>
  );
}
