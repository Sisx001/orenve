"use client";

import { CsrfInput } from "@/components/admin/Csrf";

import { useActionState, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { useEffect } from "react";
import { ORDER_STATUSES } from "@/lib/constants";
import { bulkOrderStatusAction } from "@/lib/admin/actions/orders";
import { idleState } from "@/lib/admin/action-state";
import { SubmitButton } from "@/components/admin/Fields";
import { ChannelBadge, PaymentBadge, StatusBadge } from "@/components/admin/StatusBadge";
import { STATUS_LABELS } from "@/lib/admin/constants";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";

export type OrderRow = {
  id: string;
  number: string;
  customerName: string;
  phone: string;
  items: number;
  total: number;
  channel: string;
  paymentStatus: string;
  paymentMethod: string;
  status: string;
  placedAt: string;
};

export function OrdersTable({ rows, csrf }: { rows: OrderRow[]; csrf: string }) {
  const [state, action] = useActionState(bulkOrderStatusAction, idleState);
  const [selected, setSelected] = useState<string[]>([]);

  useEffect(() => {
    if (state.ok && state.message) {
      toast.success(state.message);
      setSelected([]);
    } else if (state.error) toast.error(state.error);
  }, [state]);

  const allSelected = rows.length > 0 && selected.length === rows.length;
  const toggle = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  return (
    <form action={action}>
      <CsrfInput value={csrf} />
      {selected.map((id) => (
        <input key={id} type="hidden" name="ids" value={id} />
      ))}

      {selected.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-3 border border-ink bg-ink px-3.5 py-2.5 text-paper">
          <span className="text-xs">{selected.length} selected</span>
          <select name="status" defaultValue="confirmed" className="border border-bone/30 bg-transparent px-2 py-1.5 text-xs text-paper [&>option]:text-ink">
            {ORDER_STATUSES.map((s) => (
              <option key={s} value={s}>
                Move to {STATUS_LABELS[s] ?? s}
              </option>
            ))}
          </select>
          <SubmitButton size="sm" className="border-bone bg-bone text-ink hover:border-oxide hover:bg-oxide hover:text-paper" pendingLabel="Applying…">
            Apply
          </SubmitButton>
          <button type="button" onClick={() => setSelected([])} className="text-xs text-bone/60 underline-offset-4 hover:underline">
            Clear
          </button>
        </div>
      )}

      <div className="card overflow-hidden">
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full min-w-[60rem] border-collapse text-sm">
            <thead className="bg-bone/80">
              <tr className="text-[0.6rem] uppercase tracking-[0.14em] text-muted">
                <th className="w-9 border-b border-line px-3 py-2.5">
                  <input
                    type="checkbox"
                    aria-label="Select all"
                    checked={allSelected}
                    onChange={() => setSelected(allSelected ? [] : rows.map((r) => r.id))}
                    className="h-3.5 w-3.5 accent-[rgb(var(--c-oxide))]"
                  />
                </th>
                <th className="border-b border-line px-3 py-2.5 text-left font-semibold">Order</th>
                <th className="border-b border-line px-3 py-2.5 text-left font-semibold">Customer</th>
                <th className="border-b border-line px-3 py-2.5 text-right font-semibold">Items</th>
                <th className="border-b border-line px-3 py-2.5 text-right font-semibold">Total</th>
                <th className="border-b border-line px-3 py-2.5 text-left font-semibold">Channel</th>
                <th className="border-b border-line px-3 py-2.5 text-left font-semibold">Payment</th>
                <th className="border-b border-line px-3 py-2.5 text-left font-semibold">Status</th>
                <th className="border-b border-line px-3 py-2.5 text-right font-semibold">Placed</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((o) => (
                <tr key={o.id} className={cn("border-b border-line/60 last:border-0 hover:bg-bone/50", selected.includes(o.id) && "bg-oxide/[0.04]")}>
                  <td className="px-3 py-2.5">
                    <input
                      type="checkbox"
                      aria-label={`Select ${o.number}`}
                      checked={selected.includes(o.id)}
                      onChange={() => toggle(o.id)}
                      className="h-3.5 w-3.5 accent-[rgb(var(--c-oxide))]"
                    />
                  </td>
                  <td className="px-3 py-2.5">
                    <Link href={`/admin/orders/${o.id}`} className="font-mono text-xs underline-offset-4 hover:underline">
                      {o.number}
                    </Link>
                  </td>
                  <td className="max-w-[14rem] px-3 py-2.5">
                    <span className="block truncate">{o.customerName}</span>
                    <span className="block truncate text-xs text-muted">{o.phone}</span>
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{o.items}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{formatMoney(o.total)}</td>
                  <td className="px-3 py-2.5">
                    <ChannelBadge channel={o.channel} />
                  </td>
                  <td className="px-3 py-2.5">
                    <PaymentBadge status={o.paymentStatus} method={o.paymentMethod} />
                  </td>
                  <td className="px-3 py-2.5">
                    <StatusBadge status={o.status} />
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-right text-xs text-muted">{o.placedAt}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* mobile */}
        <ul className="divide-y divide-line md:hidden">
          {rows.map((o) => (
            <li key={o.id} className="flex gap-3 px-4 py-3.5">
              <input
                type="checkbox"
                aria-label={`Select ${o.number}`}
                checked={selected.includes(o.id)}
                onChange={() => toggle(o.id)}
                className="mt-1 h-3.5 w-3.5 shrink-0 accent-[rgb(var(--c-oxide))]"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <Link href={`/admin/orders/${o.id}`} className="font-mono text-xs underline-offset-4 hover:underline">
                    {o.number}
                  </Link>
                  <span className="text-sm tabular-nums">{formatMoney(o.total)}</span>
                </div>
                <p className="mt-0.5 truncate text-sm">{o.customerName}</p>
                <p className="truncate text-xs text-muted">
                  {o.phone} · {o.items} item{o.items === 1 ? "" : "s"} · {o.placedAt}
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <StatusBadge status={o.status} />
                  <PaymentBadge status={o.paymentStatus} />
                  <ChannelBadge channel={o.channel} />
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </form>
  );
}

export default OrdersTable;
