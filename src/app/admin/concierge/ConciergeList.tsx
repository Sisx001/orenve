"use client";

import { CsrfInput } from "@/components/admin/Csrf";
import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { AlertTriangle, Bot, Flag, Trash2, User } from "lucide-react";
import { Badge, Modal } from "@/components/ui";
import { deleteConversationAction, unflagConversationAction } from "@/lib/admin/actions/settings";
import { idleState } from "@/lib/admin/action-state";
import { cn } from "@/lib/utils";

export type ConvoRow = {
  id: string;
  locale: string;
  messageCount: number;
  toolCalls: number;
  tokens: number;
  flagged: boolean;
  flagReason: string | null;
  orderNumber: string | null;
  createdAt: string;
  updatedAt: string;
  preview: string;
  transcript: { role: string; content: string; ts: number }[];
};

export function ConciergeList({ rows, csrf, flaggedCount }: { rows: ConvoRow[]; csrf: string; flaggedCount: number }) {
  const [delState, delAction] = useActionState(deleteConversationAction, idleState);
  const [unflagState, unflagAction] = useActionState(unflagConversationAction, idleState);
  const [open, setOpen] = useState<ConvoRow | null>(null);

  useEffect(() => {
    for (const s of [delState, unflagState]) {
      if (s.error) toast.error(s.error);
      else if (s.ok && s.message) toast.success(s.message);
    }
    if (delState.ok) setOpen(null);
  }, [delState, unflagState]);

  return (
    <>
      {flaggedCount > 0 && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border border-warning/40 bg-warning/10 px-3.5 py-2.5">
          <p className="flex items-center gap-2 text-sm text-warning">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            {flaggedCount} conversation{flaggedCount === 1 ? "" : "s"} matched a prompt-injection pattern. The concierge refused, but it is worth a look.
          </p>
          <form action={delAction}>
            <CsrfInput value={csrf} />
            <input type="hidden" name="conversationId" value="all-flagged" />
            <button
              type="submit"
              onClick={(e) => {
                if (!window.confirm("Delete every flagged conversation?")) e.preventDefault();
              }}
              className="btn-outline px-3 py-2 text-[0.62rem]"
            >
              Delete all flagged
            </button>
          </form>
        </div>
      )}

      {rows.length === 0 ? (
        <div className="card px-6 py-20 text-center">
          <Bot className="mx-auto mb-3 h-5 w-5 text-muted" />
          <p className="text-sm text-muted">No conversations logged yet.</p>
          <Link href="/admin/settings/ai" className="mt-3 inline-block text-[0.65rem] uppercase tracking-[0.14em] text-oxide hover:underline">
            Concierge settings
          </Link>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[48rem] border-collapse text-sm">
              <thead className="bg-bone/80">
                <tr className="text-[0.6rem] uppercase tracking-[0.14em] text-muted">
                  <th className="border-b border-line px-3 py-2.5 text-left font-semibold">When</th>
                  <th className="border-b border-line px-3 py-2.5 text-left font-semibold">First message</th>
                  <th className="border-b border-line px-3 py-2.5 text-center font-semibold">Locale</th>
                  <th className="border-b border-line px-3 py-2.5 text-right font-semibold">Messages</th>
                  <th className="border-b border-line px-3 py-2.5 text-right font-semibold">Tools</th>
                  <th className="border-b border-line px-3 py-2.5 text-right font-semibold">Tokens</th>
                  <th className="border-b border-line px-3 py-2.5 text-left font-semibold">Order</th>
                  <th className="w-24 border-b border-line px-3 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => (
                  <tr key={c.id} className={cn("border-b border-line/60 last:border-0 hover:bg-bone/50", c.flagged && "bg-warning/[0.05]")}>
                    <td className="whitespace-nowrap px-3 py-2.5 text-xs text-muted">{c.createdAt}</td>
                    <td className="max-w-[20rem] px-3 py-2.5">
                      <button type="button" onClick={() => setOpen(c)} className="block max-w-full truncate text-left underline-offset-4 hover:underline">
                        {c.preview || "(empty)"}
                      </button>
                      {c.flagged && (
                        <span className="mt-1 inline-flex items-center gap-1 text-[0.6rem] uppercase tracking-[0.14em] text-warning">
                          <Flag className="h-3 w-3" />
                          {c.flagReason ?? "flagged"}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-center text-xs uppercase">{c.locale}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{c.messageCount}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{c.toolCalls}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-xs text-muted">{c.tokens.toLocaleString("en-US")}</td>
                    <td className="px-3 py-2.5 font-mono text-xs">{c.orderNumber ?? "—"}</td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center justify-end gap-1">
                        {c.flagged && (
                          <form action={unflagAction}>
                            <CsrfInput value={csrf} />
                            <input type="hidden" name="conversationId" value={c.id} />
                            <button type="submit" aria-label="Clear flag" title="Clear flag" className="p-1 text-muted hover:text-ink">
                              <Flag className="h-3.5 w-3.5" />
                            </button>
                          </form>
                        )}
                        <form action={delAction}>
                          <CsrfInput value={csrf} />
                          <input type="hidden" name="conversationId" value={c.id} />
                          <button
                            type="submit"
                            aria-label="Delete conversation"
                            onClick={(e) => {
                              if (!window.confirm("Delete this conversation?")) e.preventDefault();
                            }}
                            className="p-1 text-muted hover:text-danger"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </form>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="divide-y divide-line md:hidden">
            {rows.map((c) => (
              <li key={c.id} className="px-4 py-3">
                <button type="button" onClick={() => setOpen(c)} className="block w-full text-left">
                  <p className="truncate text-sm">{c.preview || "(empty)"}</p>
                  <p className="mt-0.5 text-xs text-muted">
                    {c.createdAt} · {c.messageCount} messages · {c.locale.toUpperCase()}
                    {c.orderNumber ? ` · ${c.orderNumber}` : ""}
                  </p>
                </button>
                {c.flagged && (
                  <div className="mt-1.5">
                    <Badge tone="warning">{c.flagReason ?? "flagged"}</Badge>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <Modal
        open={!!open}
        onClose={() => setOpen(null)}
        title="Conversation"
        description={open ? `${open.createdAt} · ${open.locale.toUpperCase()} · ${open.tokens.toLocaleString("en-US")} tokens` : undefined}
        className="max-w-2xl"
      >
        {open && (
          <>
            {open.flagged && (
              <div className="mb-4 border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning">
                Flagged: {open.flagReason ?? "prompt injection pattern"}
              </div>
            )}
            {open.orderNumber && (
              <p className="mb-4 text-xs text-muted">
                Verified order{" "}
                <span className="font-mono">{open.orderNumber}</span> during this chat.
              </p>
            )}
            <ol className="space-y-3">
              {open.transcript.map((m, i) => (
                <li key={i} className={cn("flex gap-2.5", m.role === "user" ? "" : "flex-row-reverse text-right")}>
                  <span className={cn("mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center border", m.role === "user" ? "border-line bg-bone" : "border-oxide/40 bg-oxide/10")}>
                    {m.role === "user" ? <User className="h-3 w-3 text-muted" /> : <Bot className="h-3 w-3 text-oxide" />}
                  </span>
                  <div className={cn("min-w-0 border px-3 py-2 text-sm", m.role === "user" ? "border-line bg-bone/40" : "border-oxide/20 bg-oxide/[0.04]")}>
                    <p className="whitespace-pre-line">{m.content}</p>
                    {m.ts > 0 && (
                      <p className="mt-1 text-[0.58rem] uppercase tracking-[0.14em] text-muted">
                        {new Date(m.ts).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ol>
            <div className="mt-6 flex justify-between gap-2 border-t border-line pt-4">
              <form action={delAction}>
                <CsrfInput value={csrf} />
                <input type="hidden" name="conversationId" value={open.id} />
                <button
                  type="submit"
                  onClick={(e) => {
                    if (!window.confirm("Delete this conversation?")) e.preventDefault();
                  }}
                  className="btn-ghost text-[0.65rem] text-danger"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete
                </button>
              </form>
              <button type="button" onClick={() => setOpen(null)} className="btn-outline px-4 py-2.5 text-[0.65rem]">
                Close
              </button>
            </div>
          </>
        )}
      </Modal>
    </>
  );
}

export default ConciergeList;
