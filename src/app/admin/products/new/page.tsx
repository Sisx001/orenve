import { PageHeader } from "@/components/admin/PageHeader";
import { requireStudio } from "@/lib/admin/session";
import { csrfToken } from "@/lib/admin/csrf";
import { emptyProduct, loadEditorLookups } from "@/lib/admin/product-editor";
import { ProductEditor } from "../ProductEditor";

export const dynamic = "force-dynamic";

export default async function NewProductPage() {
  await requireStudio("products.write", "/admin/products/new");
  const [csrf, lookups] = await Promise.all([csrfToken(), loadEditorLookups()]);

  return (
    <div className="mx-auto max-w-[1500px]">
      <PageHeader title="New product" description="Fill in the essentials, add photos, then generate variants. Save as a draft until you are ready." />
      <ProductEditor data={emptyProduct()} csrf={csrf} categories={lookups.categories} collections={lookups.collections} />
    </div>
  );
}
