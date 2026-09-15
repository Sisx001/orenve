import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { ProductStatusBadge } from "@/components/admin/StatusBadge";
import { requireStudio } from "@/lib/admin/session";
import { csrfToken } from "@/lib/admin/csrf";
import { loadEditorLookups, loadProductForEditor } from "@/lib/admin/product-editor";
import { ProductEditor } from "../ProductEditor";

export const dynamic = "force-dynamic";

export default async function EditProductPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  await requireStudio("products.write", `/admin/products/${id}`);
  const sp = await searchParams;
  const justCreated = sp.created === "1";

  const [data, csrf, lookups] = await Promise.all([loadProductForEditor(id), csrfToken(), loadEditorLookups()]);
  if (!data) notFound();

  return (
    <div className="mx-auto max-w-[1500px]">
      <PageHeader
        title={data.name.en || data.slug}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <ProductStatusBadge status={data.status} />
            <span className="font-mono text-xs">{data.slug}</span>
          </span>
        }
        actions={
          <>
            {data.status === "published" && (
              <a href={`/en/product/${data.slug}`} target="_blank" rel="noreferrer" className="btn-outline px-4 py-2.5 text-[0.65rem]">
                <ExternalLink className="h-3.5 w-3.5" />
                View on storefront
              </a>
            )}
            <Link href="/admin/products" className="btn-ghost text-[0.65rem] text-muted">
              All products
            </Link>
          </>
        }
      />
      {justCreated && (
        <div className="mb-5 border border-success/40 bg-success/10 px-3.5 py-2.5 text-sm text-success">
          Product created. Add photos and variants, then set the status to published.
        </div>
      )}
      <ProductEditor data={data} csrf={csrf} categories={lookups.categories} collections={lookups.collections} />
    </div>
  );
}
