import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { Download, Mail } from "lucide-react";
import { Badge } from "@/components/ui";
import { PageHeader, Section } from "@/components/admin/PageHeader";
import { Pagination } from "@/components/admin/Pagination";
import { MessageActions, SubscriberDelete } from "./MessageActions";
import { requireStudio } from "@/lib/admin/session";
import { csrfToken } from "@/lib/admin/csrf";
import { db } from "@/lib/db";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";
const PAGE_SIZE = 20;
const str = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);

export default async function MessagesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireStudio("customers.read", "/admin/messages");
  const sp = await searchParams;
  const tab = str(sp.tab) === "subscribers" ? "subscribers" : "messages";
  const status = str(sp.status) ?? "new";
  const page = Math.max(1, Number(str(sp.page) ?? "1") || 1);

  const where: Prisma.ContactMessageWhereInput = status === "all" ? {} : { status };

  const [counts, total, messages, subscriberCount, subscribers, csrf] = await Promise.all([
    db.contactMessage.groupBy({ by: ["status"], _count: { _all: true } }),
    db.contactMessage.count({ where }),
    tab === "messages"
      ? db.contactMessage.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE })
      : Promise.resolve([]),
    db.subscriber.count(),
    tab === "subscribers"
      ? db.subscriber.findMany({ orderBy: { createdAt: "desc" }, skip: (page - 1) * 50, take: 50 })
      : Promise.resolve([]),
    csrfToken(),
  ]);

  const byStatus = Object.fromEntries(counts.map((c) => [c.status, c._count._all]));
  const statusTabs = [
    { key: "new", label: "New", count: byStatus.new ?? 0 },
    { key: "replied", label: "Replied", count: byStatus.replied ?? 0 },
    { key: "archived", label: "Archived", count: byStatus.archived ?? 0 },
    { key: "all", label: "All", count: counts.reduce((a, c) => a + c._count._all, 0) },
  ];

  return (
    <div className="mx-auto max-w-[1100px]">
      <PageHeader
        title="Messages"
        description="Contact form enquiries and the newsletter list."
        actions={
          tab === "subscribers" ? (
            // A route handler that streams a file: next/link would soft-navigate instead of downloading.
            // eslint-disable-next-line @next/next/no-html-link-for-pages
            <a href="/api/admin/subscribers/export" className="btn-outline px-4 py-2.5 text-[0.65rem]">
              <Download className="h-3.5 w-3.5" />
              Export CSV
            </a>
          ) : null
        }
      />

      <div className="mb-4 flex gap-1 border-b border-line">
        <Link
          href="/admin/messages"
          className={cn(
            "-mb-px flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-[0.68rem] font-semibold uppercase tracking-[0.14em] transition",
            tab === "messages" ? "border-oxide text-ink" : "border-transparent text-muted hover:text-ink",
          )}
        >
          Contact messages
          <span className={cn("tabular-nums", tab === "messages" ? "text-oxide" : "text-muted/70")}>{byStatus.new ?? 0}</span>
        </Link>
        <Link
          href="/admin/messages?tab=subscribers"
          className={cn(
            "-mb-px flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-[0.68rem] font-semibold uppercase tracking-[0.14em] transition",
            tab === "subscribers" ? "border-oxide text-ink" : "border-transparent text-muted hover:text-ink",
          )}
        >
          Subscribers
          <span className={cn("tabular-nums", tab === "subscribers" ? "text-oxide" : "text-muted/70")}>{subscriberCount}</span>
        </Link>
      </div>

      {tab === "messages" ? (
        <>
          <div className="mb-4 flex flex-wrap gap-1">
            {statusTabs.map((t) => (
              <Link
                key={t.key}
                href={t.key === "new" ? "/admin/messages" : `/admin/messages?status=${t.key}`}
                className={cn(
                  "flex items-center gap-1.5 border px-3 py-1.5 text-[0.62rem] font-semibold uppercase tracking-[0.14em] transition",
                  status === t.key ? "border-ink bg-ink text-paper" : "border-line text-muted hover:border-ink hover:text-ink",
                )}
              >
                {t.label}
                <span className="tabular-nums">{t.count}</span>
              </Link>
            ))}
          </div>

          {messages.length === 0 ? (
            <div className="card px-6 py-20 text-center text-sm text-muted">No messages here.</div>
          ) : (
            <>
              <ul className="space-y-3">
                {messages.map((m) => (
                  <li key={m.id} className="card p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-medium">{m.name}</p>
                          <Badge tone={m.status === "new" ? "warning" : m.status === "replied" ? "success" : "neutral"}>{m.status}</Badge>
                        </div>
                        <p className="mt-1 text-xs text-muted">
                          {m.email}
                          {m.phone ? ` · ${m.phone}` : ""} · {m.createdAt.toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                        </p>
                        {m.subject && <p className="mt-2.5 text-sm font-medium">{m.subject}</p>}
                        <p className="mt-1 whitespace-pre-line text-sm">{m.message}</p>
                        <a
                          href={`mailto:${m.email}?subject=${encodeURIComponent(`Re: ${m.subject || "Your message to ORYNVE"}`)}&body=${encodeURIComponent(`Hello ${m.name},\n\n`)}`}
                          className="mt-3 inline-flex items-center gap-1.5 text-[0.62rem] uppercase tracking-[0.14em] text-oxide hover:underline"
                        >
                          <Mail className="h-3 w-3" />
                          Reply by email
                        </a>
                      </div>
                      <MessageActions id={m.id} csrf={csrf} status={m.status} />
                    </div>
                  </li>
                ))}
              </ul>
              <div className="mt-4">
                <Pagination basePath="/admin/messages" params={{ status: status === "new" ? undefined : status }} page={page} pageSize={PAGE_SIZE} total={total} />
              </div>
            </>
          )}
        </>
      ) : (
        <Section title={`Newsletter subscribers (${subscriberCount})`} description="Exported CSV is ready for Mailchimp, Brevo or Resend imports.">
          {subscribers.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted">Nobody has subscribed yet.</p>
          ) : (
            <ul className="divide-y divide-line/70">
              {subscribers.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm">{s.email}</p>
                    <p className="text-xs text-muted">
                      {s.locale} · {s.source ?? "site"} · {s.createdAt.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                      {!s.isConfirmed && " · unconfirmed"}
                    </p>
                  </div>
                  <SubscriberDelete id={s.id} csrf={csrf} />
                </li>
              ))}
            </ul>
          )}
        </Section>
      )}
    </div>
  );
}
