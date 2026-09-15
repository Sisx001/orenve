import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { Download } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { Pagination } from "@/components/admin/Pagination";
import { SearchInput } from "@/components/admin/SearchInput";
import { InventoryTable, type InventoryRow } from "./InventoryTable";
import { requireStudio } from "@/lib/admin/session";
import { db } from "@/lib/db";
import { i18nText } from "@/lib/json";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";
const PAGE_SIZE = 50;
const str = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);

export default async function InventoryPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireStudio("products.write", "/admin/inventory");

  const sp = await searchParams;
  const q = str(sp.q) ?? "";
  const low = str(sp.low) === "1";
  const out = str(sp.out) === "1";
  const page = Math.max(1, Number(str(sp.page) ?? "1") || 1);

  const where: Prisma.ProductVariantWhereInput = {};
  if (q) {
    where.OR = [{ title: { contains: q } }, { sku: { contains: q } }, { product: { name: { contains: q } } }, { product: { slug: { contains: q } } }];
  }
  if (out) where.stock = 0;
  else if (low) where.stock = { lte: 5 };

  const [total, variants, lowCount, outCount, allCount] = await Promise.all([
    db.productVariant.count({ where }),
    db.productVariant.findMany({
      where,
      orderBy: low || out ? [{ stock: "asc" }] : [{ productId: "asc" }, { position: "asc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        image: { select: { url: true } },
        product: { select: { id: true, name: true, slug: true, price: true, images: { orderBy: { position: "asc" }, take: 1, select: { url: true } } } },
      },
    }),
    db.productVariant.count({ where: { stock: { lte: 5 } } }),
    db.productVariant.count({ where: { stock: 0 } }),
    db.productVariant.count(),
  ]);

  const rows: InventoryRow[] = variants.map((v) => ({
    id: v.id,
    productId: v.product.id,
    product: i18nText(v.product.name, "en"),
    productSlug: v.product.slug,
    title: v.title,
    sku: v.sku,
    price: v.price ?? v.product.price,
    stock: v.stock,
    lowStockAt: v.lowStockAt,
    isActive: v.isActive,
    image: v.image?.url ?? v.product.images[0]?.url ?? null,
  }));

  const filters = [
    { href: "/admin/inventory", label: "All variants", count: allCount, active: !low && !out },
    { href: "/admin/inventory?low=1", label: "Low stock (≤ 5)", count: lowCount, active: low && !out },
    { href: "/admin/inventory?out=1", label: "Out of stock", count: outCount, active: out },
  ];

  return (
    <div className="mx-auto max-w-[1500px]">
      <PageHeader
        title="Inventory"
        description="Edit stock inline — changes save as soon as you leave the field."
        actions={
          // A route handler that streams a file: next/link would soft-navigate instead of downloading.
          // eslint-disable-next-line @next/next/no-html-link-for-pages
          <a href="/api/admin/inventory/export" className="btn-outline px-4 py-2.5 text-[0.65rem]">
            <Download className="h-3.5 w-3.5" />
            Export CSV
          </a>
        }
      />

      <div className="mb-4 flex flex-wrap items-end gap-2.5">
        <div className="flex gap-1">
          {filters.map((f) => (
            <Link
              key={f.href}
              href={f.href}
              className={cn(
                "flex items-center gap-1.5 border px-3 py-2 text-[0.62rem] font-semibold uppercase tracking-[0.14em] transition",
                f.active ? "border-ink bg-ink text-paper" : "border-line text-muted hover:border-ink hover:text-ink",
              )}
            >
              {f.label}
              <span className="tabular-nums">{f.count}</span>
            </Link>
          ))}
        </div>
        <SearchInput param="q" placeholder="Search product, variant or SKU…" className="min-w-[14rem] flex-1" />
      </div>

      <InventoryTable rows={rows} />

      <div className="mt-4">
        <Pagination basePath="/admin/inventory" params={{ q, low: low ? "1" : undefined, out: out ? "1" : undefined }} page={page} pageSize={PAGE_SIZE} total={total} />
      </div>
    </div>
  );
}
