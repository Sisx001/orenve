import Link from "next/link";
import { ExternalLink, Plus } from "lucide-react";
import { Badge } from "@/components/ui";
import { PageHeader } from "@/components/admin/PageHeader";
import { PageRowActions } from "./PageRowActions";
import { requireStudio } from "@/lib/admin/session";
import { csrfToken } from "@/lib/admin/csrf";
import { db } from "@/lib/db";
import { i18nText } from "@/lib/json";

export const dynamic = "force-dynamic";

export default async function PagesListPage() {
  await requireStudio("content.write", "/admin/pages");
  const [pages, csrf] = await Promise.all([db.page.findMany({ orderBy: { slug: "asc" } }), csrfToken()]);

  return (
    <div className="mx-auto max-w-[1100px]">
      <PageHeader
        title="Pages"
        description="Static content — about, shipping, returns, size guide, privacy. The AI concierge reads published policy pages."
        actions={
          <Link href="/admin/pages/new" className="btn px-4 py-2.5 text-[0.65rem]">
            <Plus className="h-3.5 w-3.5" />
            New page
          </Link>
        }
      />

      {pages.length === 0 ? (
        <div className="card px-6 py-20 text-center">
          <p className="text-sm text-muted">No pages yet.</p>
          <Link href="/admin/pages/new" className="btn mt-4 inline-flex px-4 py-2.5 text-[0.65rem]">
            Create the first page
          </Link>
        </div>
      ) : (
        <ul className="space-y-2">
          {pages.map((p) => (
            <li key={p.id} className="card flex flex-wrap items-center gap-3 p-3.5">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Link href={`/admin/pages/${p.id}`} className="text-sm font-medium underline-offset-4 hover:underline">
                    {i18nText(p.title, "en")}
                  </Link>
                  <Badge tone={p.isPublished ? "success" : "neutral"}>{p.isPublished ? "Published" : "Draft"}</Badge>
                  {p.showInFooter && <Badge tone="brass">Footer</Badge>}
                  <Badge tone="neutral">{p.template}</Badge>
                </div>
                <p className="mt-1 font-mono text-[0.68rem] text-muted">
                  /{p.slug} · updated {p.updatedAt.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {p.isPublished && (
                  <a href={`/en/${p.slug}`} target="_blank" rel="noreferrer" aria-label="View on storefront" className="p-1.5 text-muted hover:text-ink">
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                )}
                <PageRowActions id={p.id} csrf={csrf} isPublished={p.isPublished} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
