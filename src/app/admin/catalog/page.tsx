import { PageHeader } from "@/components/admin/PageHeader";
import { requireStudio } from "@/lib/admin/session";
import { csrfToken } from "@/lib/admin/csrf";
import { db } from "@/lib/db";
import { parseI18n } from "@/lib/json";
import { CatalogManager, type CatalogRow } from "./CatalogManager";

export const dynamic = "force-dynamic";

export default async function CatalogPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireStudio("products.write", "/admin/catalog");
  const sp = await searchParams;
  const initialTab = sp.tab === "categories" ? "categories" : "collections";

  const [categories, collections, csrf] = await Promise.all([
    db.category.findMany({ orderBy: { sortOrder: "asc" }, include: { _count: { select: { products: true } } } }),
    db.collection.findMany({ orderBy: { sortOrder: "asc" }, include: { _count: { select: { products: true } } } }),
    csrfToken(),
  ]);

  const toRow = (r: {
    id: string;
    slug: string;
    name: string;
    description: string | null;
    image: string | null;
    sortOrder: number;
    parentId?: string | null;
    isActive?: boolean;
    isPublished?: boolean;
    _count: { products: number };
  }): CatalogRow => {
    const name = parseI18n(r.name);
    const description = parseI18n(r.description);
    return {
      id: r.id,
      slug: r.slug,
      nameEn: name.en ?? "",
      nameBn: name.bn ?? "",
      descriptionEn: description.en ?? "",
      descriptionBn: description.bn ?? "",
      image: r.image,
      parentId: r.parentId ?? null,
      isActive: r.isActive,
      isPublished: r.isPublished,
      sortOrder: r.sortOrder,
      products: r._count.products,
    };
  };

  return (
    <div className="mx-auto max-w-[1100px]">
      <PageHeader title="Collections & categories" description="How the shop is organised, and how products are grouped for the homepage." />
      <CatalogManager categories={categories.map(toRow)} collections={collections.map(toRow)} csrf={csrf} initialTab={initialTab} />
    </div>
  );
}
