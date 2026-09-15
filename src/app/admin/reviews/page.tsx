import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { Star } from "lucide-react";
import { Badge } from "@/components/ui";
import { PageHeader } from "@/components/admin/PageHeader";
import { Pagination } from "@/components/admin/Pagination";
import { ReviewActions } from "./ReviewActions";
import { requireStudio } from "@/lib/admin/session";
import { csrfToken } from "@/lib/admin/csrf";
import { db } from "@/lib/db";
import { i18nText } from "@/lib/json";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";
const PAGE_SIZE = 20;
const str = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);

export default async function ReviewsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireStudio("content.write", "/admin/reviews");
  const sp = await searchParams;
  const filter = str(sp.filter) ?? "pending";
  const page = Math.max(1, Number(str(sp.page) ?? "1") || 1);

  const where: Prisma.ReviewWhereInput = filter === "approved" ? { isApproved: true } : filter === "all" ? {} : { isApproved: false };

  const [pending, approved, total, reviews, csrf] = await Promise.all([
    db.review.count({ where: { isApproved: false } }),
    db.review.count({ where: { isApproved: true } }),
    db.review.count({ where }),
    db.review.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { product: { select: { id: true, name: true, slug: true } } },
    }),
    csrfToken(),
  ]);

  const tabs = [
    { key: "pending", label: "Awaiting approval", count: pending },
    { key: "approved", label: "Published", count: approved },
    { key: "all", label: "All", count: pending + approved },
  ];

  return (
    <div className="mx-auto max-w-[1100px]">
      <PageHeader title="Reviews" description="Customer reviews stay hidden until you approve them." />

      <div className="mb-4 flex gap-1 border-b border-line">
        {tabs.map((t) => (
          <Link
            key={t.key}
            href={t.key === "pending" ? "/admin/reviews" : `/admin/reviews?filter=${t.key}`}
            className={cn(
              "-mb-px flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-[0.68rem] font-semibold uppercase tracking-[0.14em] transition",
              filter === t.key ? "border-oxide text-ink" : "border-transparent text-muted hover:text-ink",
            )}
          >
            {t.label}
            <span className={cn("tabular-nums", filter === t.key ? "text-oxide" : "text-muted/70")}>{t.count}</span>
          </Link>
        ))}
      </div>

      {reviews.length === 0 ? (
        <div className="card px-6 py-20 text-center text-sm text-muted">
          {filter === "pending" ? "Nothing waiting for you — every review has been reviewed." : "No reviews here."}
        </div>
      ) : (
        <>
          <ul className="space-y-3">
            {reviews.map((r) => (
              <li key={r.id} className="card p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="flex items-center gap-0.5" aria-label={`${r.rating} out of 5`}>
                        {[1, 2, 3, 4, 5].map((i) => (
                          <Star key={i} className={cn("h-3.5 w-3.5", i <= r.rating ? "fill-brass text-brass" : "text-line")} />
                        ))}
                      </span>
                      <span className="text-sm font-medium">{r.customerName}</span>
                      <Badge tone={r.isApproved ? "success" : "warning"}>{r.isApproved ? "Published" : "Pending"}</Badge>
                    </div>
                    <p className="mt-1.5 text-xs text-muted">
                      on{" "}
                      <Link href={`/admin/products/${r.product.id}`} className="underline-offset-4 hover:underline">
                        {i18nText(r.product.name, "en")}
                      </Link>{" "}
                      · {r.createdAt.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                    </p>
                    {r.title && <p className="mt-2.5 text-sm font-medium">{r.title}</p>}
                    <p className="mt-1 whitespace-pre-line text-sm">{r.body}</p>
                  </div>
                  <ReviewActions id={r.id} csrf={csrf} isApproved={r.isApproved} />
                </div>
              </li>
            ))}
          </ul>
          <div className="mt-4">
            <Pagination basePath="/admin/reviews" params={{ filter: filter === "pending" ? undefined : filter }} page={page} pageSize={PAGE_SIZE} total={total} />
          </div>
        </>
      )}
    </div>
  );
}
