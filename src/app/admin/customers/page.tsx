import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { PageHeader } from "@/components/admin/PageHeader";
import { Pagination } from "@/components/admin/Pagination";
import { SearchInput } from "@/components/admin/SearchInput";
import { requireStudio } from "@/lib/admin/session";
import { db } from "@/lib/db";
import { parseJson } from "@/lib/json";
import { formatMoney } from "@/lib/money";
import { normalizeBdPhone } from "@/lib/orders/service";

export const dynamic = "force-dynamic";
const PAGE_SIZE = 25;
const str = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);

export default async function CustomersPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireStudio("customers.read", "/admin/customers");
  const sp = await searchParams;
  const q = str(sp.q) ?? "";
  const page = Math.max(1, Number(str(sp.page) ?? "1") || 1);

  const where: Prisma.CustomerWhereInput = {};
  if (q) {
    const digits = q.replace(/\D/g, "");
    where.OR = [
      { name: { contains: q } },
      { email: { contains: q } },
      ...(digits.length >= 3 ? [{ phone: { contains: digits } }, { phone: { contains: normalizeBdPhone(q) } }] : []),
    ];
  }

  const [total, customers] = await Promise.all([
    db.customer.count({ where }),
    db.customer.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        _count: { select: { orders: true } },
        orders: { select: { total: true, status: true, placedAt: true }, orderBy: { placedAt: "desc" } },
      },
    }),
  ]);

  return (
    <div className="mx-auto max-w-[1300px]">
      <PageHeader title="Customers" description={`${total} customer record${total === 1 ? "" : "s"}, created automatically as orders arrive.`} />

      <div className="mb-4">
        <SearchInput param="q" placeholder="Search name, phone or email…" className="max-w-md" />
      </div>

      {customers.length === 0 ? (
        <div className="card px-6 py-20 text-center text-sm text-muted">No customers match that search.</div>
      ) : (
        <>
          <div className="card overflow-hidden">
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[46rem] border-collapse text-sm">
                <thead className="bg-bone/80">
                  <tr className="text-[0.6rem] uppercase tracking-[0.14em] text-muted">
                    <th className="border-b border-line px-3 py-2.5 text-left font-semibold">Customer</th>
                    <th className="border-b border-line px-3 py-2.5 text-left font-semibold">Phone</th>
                    <th className="border-b border-line px-3 py-2.5 text-left font-semibold">Email</th>
                    <th className="border-b border-line px-3 py-2.5 text-right font-semibold">Orders</th>
                    <th className="border-b border-line px-3 py-2.5 text-right font-semibold">Lifetime</th>
                    <th className="border-b border-line px-3 py-2.5 text-left font-semibold">Tags</th>
                    <th className="border-b border-line px-3 py-2.5 text-right font-semibold">Last order</th>
                  </tr>
                </thead>
                <tbody>
                  {customers.map((c) => {
                    const lifetime = c.orders.filter((o) => o.status !== "cancelled" && o.status !== "refunded").reduce((a, o) => a + o.total, 0);
                    const tags = parseJson<string[]>(c.tags, []);
                    return (
                      <tr key={c.id} className="border-b border-line/60 last:border-0 hover:bg-bone/50">
                        <td className="px-3 py-2.5">
                          <Link href={`/admin/customers/${c.id}`} className="underline-offset-4 hover:underline">
                            {c.name}
                          </Link>
                        </td>
                        <td className="px-3 py-2.5 font-mono text-xs">{c.phone ?? "—"}</td>
                        <td className="max-w-[14rem] truncate px-3 py-2.5 text-xs text-muted">{c.email ?? "—"}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums">{c._count.orders}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums">{formatMoney(lifetime)}</td>
                        <td className="px-3 py-2.5">
                          <span className="flex flex-wrap gap-1">
                            {tags.slice(0, 3).map((t) => (
                              <span key={t} className="border border-line bg-bone px-1.5 py-0.5 text-[0.58rem] uppercase tracking-[0.1em]">
                                {t}
                              </span>
                            ))}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-3 py-2.5 text-right text-xs text-muted">
                          {c.orders[0] ? c.orders[0].placedAt.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "2-digit" }) : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <ul className="divide-y divide-line md:hidden">
              {customers.map((c) => {
                const lifetime = c.orders.filter((o) => o.status !== "cancelled" && o.status !== "refunded").reduce((a, o) => a + o.total, 0);
                return (
                  <li key={c.id} className="px-4 py-3">
                    <Link href={`/admin/customers/${c.id}`} className="block text-sm">
                      {c.name}
                    </Link>
                    <p className="truncate text-xs text-muted">
                      {c.phone ?? c.email ?? "—"} · {c._count.orders} order{c._count.orders === 1 ? "" : "s"} · {formatMoney(lifetime)} lifetime
                    </p>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="mt-4">
            <Pagination basePath="/admin/customers" params={{ q }} page={page} pageSize={PAGE_SIZE} total={total} />
          </div>
        </>
      )}
    </div>
  );
}
