import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { requireStudio } from "@/lib/admin/session";
import { getLocaleInfo } from "@/lib/i18n/registry";
import { contentReviewRows, coverage, uiReviewRows } from "@/lib/i18n/translate";
import { ReviewQueue } from "./ReviewQueue";

export const dynamic = "force-dynamic";

export default async function LanguageReviewPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  await requireStudio("i18n.write", `/admin/settings/languages/${code}`);

  const info = await getLocaleInfo(code);
  if (!info || info.code === "en") notFound();

  const [ui, content, cov] = await Promise.all([uiReviewRows(code), contentReviewRows(code), coverage(code)]);

  return (
    <div>
      <div className="mb-4">
        <Link href="/admin/settings/languages" className="inline-flex items-center gap-1.5 text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-muted transition hover:text-ink">
          <ArrowLeft className="h-3 w-3" aria-hidden /> Languages
        </Link>
      </div>

      <PageHeader
        title={
          <span className="flex items-center gap-2">
            {info.flag && <span aria-hidden>{info.flag}</span>}
            <span lang={info.code}>{info.nativeName}</span>
            <span className="font-mono text-sm uppercase text-muted">{info.code}</span>
          </span>
        }
        description={`Review ${info.name}. English is on the left, the machine translation on the right — correct anything that reads wrong, then approve it. Approved strings are never overwritten by the engine.`}
      />

      <ReviewQueue locale={info.code} dir={info.dir} coverage={cov} ui={ui} content={content} />
    </div>
  );
}
