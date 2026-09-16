import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { Settings } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { Pagination } from "@/components/admin/Pagination";
import { ConciergeList, type ConvoRow } from "./ConciergeList";
import { requireStudio } from "@/lib/admin/session";
import { csrfToken } from "@/lib/admin/csrf";
import { db } from "@/lib/db";
import { parseJson } from "@/lib/json";
import { getSetting } from "@/lib/settings";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";
const PAGE_SIZE = 25;
const str = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);

type Stored = { role: string; content: string; ts: number };

export default async function ConciergePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireStudio("ai.configure", "/admin/concierge");
  const sp = await searchParams;
  const onlyFlagged = str(sp.flagged) === "1";
  const page = Math.max(1, Number(str(sp.page) ?? "1") || 1);

  const where: Prisma.AiConversationWhereInput = onlyFlagged ? { flagged: true } : {};

  const [ai, total, flaggedCount, convos, csrf, openRequestCount] = await Promise.all([
    getSetting("ai"),
    db.aiConversation.count({ where }),
    db.aiConversation.count({ where: { flagged: true } }),
    db.aiConversation.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE }),
    csrfToken(),
    db.conciergeRequest.count({ where: { status: "open" } }),
  ]);

  const rows: ConvoRow[] = convos.map((c) => {
    const transcript = parseJson<Stored[]>(c.messages, []).map((m) => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: String(m.content ?? ""),
      ts: Number(m.ts ?? 0),
    }));
    const firstUser = transcript.find((m) => m.role === "user");
    return {
      id: c.id,
      locale: c.locale,
      messageCount: transcript.length,
      toolCalls: c.toolCalls,
      tokens: c.tokensIn + c.tokensOut,
      flagged: c.flagged,
      flagReason: c.flagReason,
      orderNumber: c.orderNumber,
      createdAt: c.createdAt.toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }),
      updatedAt: c.updatedAt.toISOString(),
      preview: firstUser?.content.slice(0, 140) ?? "",
      transcript,
    };
  });

  return (
    <div className="mx-auto max-w-[1300px]">
      <PageHeader
        title="Concierge"
        description={
          ai.logConversations
            ? "Every logged conversation, with the tools the assistant used and any order it verified."
            : "Conversation logging is switched off — only historic conversations are shown."
        }
        actions={
          <Link href="/admin/settings/ai" className="btn-outline px-4 py-2.5 text-[0.65rem]">
            <Settings className="h-3.5 w-3.5" />
            Concierge settings
          </Link>
        }
      />

      {/* Navigation tabs */}
      <div className="mb-4 flex flex-wrap gap-1">
        <Link
          href="/admin/concierge"
          className="border border-ink bg-ink px-3 py-2 text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-paper"
        >
          Conversations
        </Link>
        <Link
          href="/admin/concierge/requests"
          className={cn(
            "flex items-center gap-1.5 border px-3 py-2 text-[0.62rem] font-semibold uppercase tracking-[0.14em] transition",
            "border-line text-muted hover:border-ink hover:text-ink",
          )}
        >
          Requests
          {openRequestCount > 0 && (
            <span className="tabular-nums text-warning">{openRequestCount}</span>
          )}
        </Link>
        <Link
          href="/admin/concierge/test"
          className="border border-line px-3 py-2 text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-muted transition hover:border-ink hover:text-ink"
        >
          Test console
        </Link>
      </div>

      {/* Filter tabs */}
      <div className="mb-4 flex gap-1">
        <Link
          href="/admin/concierge"
          className={cn(
            "border px-3 py-2 text-[0.62rem] font-semibold uppercase tracking-[0.14em] transition",
            !onlyFlagged ? "border-ink bg-ink text-paper" : "border-line text-muted hover:border-ink hover:text-ink",
          )}
        >
          All conversations
        </Link>
        <Link
          href="/admin/concierge?flagged=1"
          className={cn(
            "flex items-center gap-1.5 border px-3 py-2 text-[0.62rem] font-semibold uppercase tracking-[0.14em] transition",
            onlyFlagged ? "border-ink bg-ink text-paper" : "border-line text-muted hover:border-ink hover:text-ink",
          )}
        >
          Flagged
          <span className="tabular-nums">{flaggedCount}</span>
        </Link>
      </div>

      <ConciergeList rows={rows} csrf={csrf} flaggedCount={onlyFlagged ? 0 : flaggedCount} />

      <div className="mt-4">
        <Pagination basePath="/admin/concierge" params={{ flagged: onlyFlagged ? "1" : undefined }} page={page} pageSize={PAGE_SIZE} total={total} />
      </div>
    </div>
  );
}
