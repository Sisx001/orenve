"use client";

import { CsrfInput } from "@/components/admin/Csrf";
import { useActionState, useEffect } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Check, ExternalLink, X } from "lucide-react";
import { resolveConciergeRequestAction, rejectConciergeRequestAction } from "@/lib/admin/actions/concierge";
import { idleState } from "@/lib/admin/action-state";
import { cn } from "@/lib/utils";
import type { RequestRow } from "./page";

const TYPE_LABELS: Record<string, string> = {
  cancel: "Cancellation",
  address: "Address change",
  other: "Other",
};

const STATUS_CLASSES: Record<string, string> = {
  open: "border-warning/40 bg-warning/10 text-warning",
  resolved: "border-success/40 bg-success/10 text-success",
  rejected: "border-muted/40 bg-muted/10 text-muted",
};

function ActionButtons({ row, csrf, canWrite }: { row: RequestRow; csrf: string; canWrite: boolean }) {
  const [resolveState, resolveAction] = useActionState(resolveConciergeRequestAction, idleState);
  const [rejectState, rejectAction] = useActionState(rejectConciergeRequestAction, idleState);

  useEffect(() => {
    if (resolveState.error) toast.error(resolveState.error);
    else if (resolveState.ok && resolveState.message) toast.success(resolveState.message);
  }, [resolveState]);

  useEffect(() => {
    if (rejectState.error) toast.error(rejectState.error);
    else if (rejectState.ok && rejectState.message) toast.success(rejectState.message);
  }, [rejectState]);

  if (!canWrite || row.status !== "open") return null;

  return (
    <div className="flex items-center gap-1">
      <form action={resolveAction}>
        <CsrfInput value={csrf} />
        <input type="hidden" name="requestId" value={row.id} />
        <button type="submit" title="Mark resolved" className="p-1.5 text-muted hover:text-success">
          <Check className="h-4 w-4" />
        </button>
      </form>
      <form action={rejectAction}>
        <CsrfInput value={csrf} />
        <input type="hidden" name="requestId" value={row.id} />
        <button type="submit" title="Reject" className="p-1.5 text-muted hover:text-danger">
          <X className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
}

export function RequestsClient({ rows, csrf, canWrite }: { rows: RequestRow[]; csrf: string; canWrite: boolean }) {
  if (rows.length === 0) {
    return (
      <div className="card px-6 py-20 text-center">
        <p className="text-sm text-muted">No concierge requests yet.</p>
      </div>
    );
  }

  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[52rem] border-collapse text-sm">
          <thead className="bg-bone/80">
            <tr className="text-[0.6rem] uppercase tracking-[0.14em] text-muted">
              <th className="border-b border-line px-3 py-2.5 text-left font-semibold">Order</th>
              <th className="border-b border-line px-3 py-2.5 text-left font-semibold">Type</th>
              <th className="border-b border-line px-3 py-2.5 text-left font-semibold">Details</th>
              <th className="border-b border-line px-3 py-2.5 text-left font-semibold">Status</th>
              <th className="border-b border-line px-3 py-2.5 text-left font-semibold">Submitted</th>
              <th className="w-20 border-b border-line px-3 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-line/60 last:border-0 hover:bg-bone/50">
                <td className="px-3 py-2.5">
                  <Link
                    href={`/admin/orders/${r.orderId}`}
                    className="inline-flex items-center gap-1 font-mono text-xs hover:text-oxide hover:underline"
                  >
                    {r.orderNumber}
                    <ExternalLink className="h-2.5 w-2.5" />
                  </Link>
                </td>
                <td className="px-3 py-2.5 text-xs">{TYPE_LABELS[r.type] ?? r.type}</td>
                <td className="max-w-[18rem] px-3 py-2.5">
                  <p className="line-clamp-2 text-xs text-muted">{r.details}</p>
                </td>
                <td className="px-3 py-2.5">
                  <span className={cn("border px-2 py-0.5 text-[0.58rem] font-semibold uppercase tracking-[0.12em]", STATUS_CLASSES[r.status] ?? "")}>
                    {r.status}
                  </span>
                </td>
                <td className="whitespace-nowrap px-3 py-2.5 text-xs text-muted">{r.createdAt}</td>
                <td className="px-3 py-2.5">
                  <ActionButtons row={r} csrf={csrf} canWrite={canWrite} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
