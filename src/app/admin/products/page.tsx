import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { Pagination } from "@/components/admin/Pagination";
import { SearchInput, FilterSelect } from "@/components/admin/SearchInput";
import { ProductStatusBadge } from "@/components/admin/StatusBadge";
import { FeaturedToggle, ProductRowActions } from "./ProductRowActions";
import { requireStudio } from "@/lib/admin/session";
import { db } from "@/lib/db";
import { csrfToken } from "@/lib/admin/csrf";
import { i18nText } from "@/lib/json";
import { formatMoney } from "@/lib/money";
import { PRODUCT_STATUSES } from "@/lib/constants";

export const dynamic = "force-dynamic";
const PAGE_SIZE = 20;
const str = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);

export default async function ProductsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireStudio("products.write", "/admin/products");
  const sp = await searchParams;
  const q = str(sp.q) ?? "";
  const status = str(sp.status) ?? "";
  const category = str(sp.category) ?? "";
  const page = Math.max(1, Number(str(sp.page) ?? "1") || 1);

  const where: Prisma.ProductWhereInput = {};
  if (status && (PRODUCT_STATUSES as readonly string[]).includes(status)) where.status = status;
  if (category) where.categoryId = category;
  if (q) where.OR = [{ name: { contains: q } }, { slug: { contains: q } }, { sku: { contains: q } }, { tags: { contains: q } }];

  const [categories, total, products, csrf] = await Promise.all([
    db.category.findMany({ orderBy: { sortOrder: "asc" }, select: { id: true, name: true } }),
    db.product.count({ where }),
    db.product.findMany({
      where,
      orderBy: [{ updatedAt: "desc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        images: { orderBy: { position: "asc" }, take: 1 },
        variants: { select: { stock: true, isActive: true } },
        category: { select: { name: true } },
        _count: { select: { variants: true } },
      },
    }),
    csrfToken(),
  ]);

  return (
    <div className="mx-auto max-w-[1500px]">
      <PageHeader
        title="Products"
        description={`${total} product${total === 1 ? "" : "s"} in the catalogue.`}
        actions={
          <Link href="/admin/products/new" className="btn px-4 py-2.5 text-[0.65rem]">
            <Plus className="h-3.5 w-3.5" />
            Add product
          </Link>
        }
      />

      <div className="mb-4 flex flex-wrap items-end gap-2.5">
        <SearchInput param="q" placeholder="Search name, slug, SKU or tag…" className="min-w-[15rem] flex-1" />
        <FilterSelect param="status" label="Status" options={[{ value: "", label: "Any" }, ...PRODUCT_STATUSES.map((s) => ({ value: s, label: s }))]} />
        <FilterSelect
          param="category"
          label="Category"
          options={[{ value: "", label: "Any" }, ...categories.map((c) => ({ value: c.id, label: i18nText(c.name, "en") }))]}
        />
      </div>

      {products.length === 0 ? (
        <div className="card px-6 py-20 text-center">
          <p className="text-sm text-muted">No products match these filters.</p>
          <Link href="/admin/products/new" className="btn mt-4 inline-flex px-4 py-2.5 text-[0.65rem]">
            <Plus className="h-3.5 w-3.5" />
            Add the first product
          </Link>
        </div>
      ) : (
        <>
          <div className="card overflow-hidden">
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[54rem] border-collapse text-sm">
                <thead className="bg-bone/80">
                  <tr className="text-[0.6rem] uppercase tracking-[0.14em] text-muted">
                    <th className="w-14 border-b border-line px-3 py-2.5" />
                    <th className="border-b border-line px-3 py-2.5 text-left font-semibold">Product</th>
                    <th className="border-b border-line px-3 py-2.5 text-left font-semibold">Category</th>
                    <th className="border-b border-line px-3 py-2.5 text-right font-semibold">Price</th>
                    <th className="border-b border-line px-3 py-2.5 text-right font-semibold">Stock</th>
                    <th className="border-b border-line px-3 py-2.5 text-center font-semibold">Featured</th>
                    <th className="border-b border-line px-3 py-2.5 text-left font-semibold">Status</th>
                    <th className="w-12 border-b border-line px-3 py-2.5" />
                  </tr>
                </thead>
                <tbody>
                  {products.map((p) => {
                    const stock = p.variants.filter((v) => v.isActive).reduce((a, v) => a + v.stock, 0);
                    return (
                      <tr key={p.id} className="border-b border-line/60 last:border-0 hover:bg-bone/50">
                        <td className="px-3 py-2">
                          <Link href={`/admin/products/${p.id}`} className="block h-12 w-9 overflow-hidden border border-line bg-bone">
                            {p.images[0] ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={p.images[0].url} alt="" className="h-full w-full object-cover" />
                            ) : null}
                          </Link>
                        </td>
                        <td className="max-w-[20rem] px-3 py-2">
                          <Link href={`/admin/products/${p.id}`} className="block truncate underline-offset-4 hover:underline">
                            {i18nText(p.name, "en")}
                          </Link>
                          <span className="block truncate font-mono text-[0.68rem] text-muted">
                            {p.slug}
                            {p.sku ? ` · ${p.sku}` : ""} · {p._count.variants} variant{p._count.variants === 1 ? "" : "s"}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-xs text-muted">{p.category ? i18nText(p.category.name, "en") : "—"}</td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {formatMoney(p.price)}
                          {p.compareAtPrice ? <span className="block text-[0.68rem] text-muted line-through">{formatMoney(p.compareAtPrice)}</span> : null}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          <span className={stock === 0 ? "text-danger" : stock <= 5 ? "text-warning" : ""}>{stock}</span>
                        </td>
                        <td className="px-3 py-2 text-center">
                          <FeaturedToggle id={p.id} featured={p.featured} />
                        </td>
                        <td className="px-3 py-2">
                          <ProductStatusBadge status={p.status} />
                        </td>
                        <td className="px-3 py-2 text-right">
                          <ProductRowActions id={p.id} csrf={csrf} status={p.status} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <ul className="divide-y divide-line md:hidden">
              {products.map((p) => {
                const stock = p.variants.filter((v) => v.isActive).reduce((a, v) => a + v.stock, 0);
                return (
                  <li key={p.id} className="flex gap-3 px-4 py-3">
                    <Link href={`/admin/products/${p.id}`} className="block h-16 w-12 shrink-0 overflow-hidden border border-line bg-bone">
                      {p.images[0] ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.images[0].url} alt="" className="h-full w-full object-cover" />
                      ) : null}
                    </Link>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <Link href={`/admin/products/${p.id}`} className="min-w-0 truncate text-sm">
                          {i18nText(p.name, "en")}
                        </Link>
                        <ProductRowActions id={p.id} csrf={csrf} status={p.status} />
                      </div>
                      <p className="truncate font-mono text-[0.66rem] text-muted">{p.slug}</p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs">
                        <ProductStatusBadge status={p.status} />
                        <span className="tabular-nums">{formatMoney(p.price)}</span>
                        <span className={stock === 0 ? "text-danger" : stock <= 5 ? "text-warning" : "text-muted"}>{stock} in stock</span>
                        <FeaturedToggle id={p.id} featured={p.featured} />
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
          <div className="mt-4">
            <Pagination basePath="/admin/products" params={{ q, status, category }} page={page} pageSize={PAGE_SIZE} total={total} />
          </div>
        </>
      )}
    </div>
  );
}
