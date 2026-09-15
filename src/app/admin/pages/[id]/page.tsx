import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { requireStudio } from "@/lib/admin/session";
import { csrfToken } from "@/lib/admin/csrf";
import { db } from "@/lib/db";
import { parseI18n } from "@/lib/json";
import { PageEditor } from "../PageEditor";

export const dynamic = "force-dynamic";

export default async function EditPagePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireStudio("content.write", `/admin/pages/${id}`);
  const [page, csrf] = await Promise.all([db.page.findUnique({ where: { id } }), csrfToken()]);
  if (!page) notFound();

  const title = parseI18n(page.title);
  const body = parseI18n(page.body);
  const seoTitle = parseI18n(page.seoTitle);
  const seoDescription = parseI18n(page.seoDescription);

  return (
    <div className="mx-auto max-w-[1300px]">
      <PageHeader
        title={title.en ?? page.slug}
        description={`/${page.slug}`}
        actions={
          <>
            {page.isPublished && (
              <a href={`/en/${page.slug}`} target="_blank" rel="noreferrer" className="btn-outline px-4 py-2.5 text-[0.65rem]">
                <ExternalLink className="h-3.5 w-3.5" />
                View
              </a>
            )}
            <Link href="/admin/pages" className="btn-ghost text-[0.65rem] text-muted">
              All pages
            </Link>
          </>
        }
      />
      <PageEditor
        csrf={csrf}
        data={{
          id: page.id,
          slug: page.slug,
          titleEn: title.en ?? "",
          titleBn: title.bn ?? "",
          bodyEn: body.en ?? "",
          bodyBn: body.bn ?? "",
          template: page.template,
          isPublished: page.isPublished,
          showInFooter: page.showInFooter,
          seoTitleEn: seoTitle.en ?? "",
          seoTitleBn: seoTitle.bn ?? "",
          seoDescriptionEn: seoDescription.en ?? "",
          seoDescriptionBn: seoDescription.bn ?? "",
        }}
      />
    </div>
  );
}
