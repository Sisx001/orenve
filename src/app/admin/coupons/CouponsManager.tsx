"use client";

import { CsrfInput } from "@/components/admin/Csrf";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Modal, Badge } from "@/components/ui";
import { MoneyInput, SelectField, SubmitButton, TextField, ToggleRow } from "@/components/admin/Fields";
import { deleteCouponAction, saveCouponAction } from "@/lib/admin/actions/commerce";
import { idleState } from "@/lib/admin/action-state";
import { COUPON_TYPES } from "@/lib/constants";
import { formatMoney } from "@/lib/money";

export type CouponRow = {
  id: string;
  code: string;
  type: string;
  value: number;
  minSubtotal: number;
  maxUses: number | null;
  usedCount: number;
  perCustomer: number | null;
  startsAt: string;
  endsAt: string;
  isActive: boolean;
  state: "active" | "scheduled" | "expired" | "used-up" | "off";
};

const TYPE_LABELS: Record<string, string> = { percent: "Percentage off", fixed: "Fixed amount off", free_shipping: "Free shipping" };

function describe(c: CouponRow) {
  if (c.type === "percent") return `${c.value}% off`;
  if (c.type === "fixed") return `${formatMoney(c.value)} off`;
  return "Free delivery";
}

export function CouponsManager({ rows, csrf }: { rows: CouponRow[]; csrf: string }) {
  const [state, action] = useActionState(saveCouponAction, idleState);
  const [delState, delAction] = useActionState(deleteCouponAction, idleState);
  const [editing, setEditing] = useState<CouponRow | null>(null);
  const [open, setOpen] = useState(false);
  const [type, setType] = useState("percent");

  useEffect(() => {
    if (state.error) toast.error(state.error);
    else if (state.ok && state.message) {
      toast.success(state.message);
      setOpen(false);
    }
  }, [state]);
  useEffect(() => {
    if (delState.error) toast.error(delState.error);
    else if (delState.ok && delState.message) toast.success(delState.message);
  }, [delState]);

  const openNew = () => {
    setEditing(null);
    setType("percent");
    setOpen(true);
  };
  const openEdit = (c: CouponRow) => {
    setEditing(c);
    setType(c.type);
    setOpen(true);
  };

  return (
    <>
      <div className="mb-4 flex justify-end">
        <button type="button" onClick={openNew} className="btn px-4 py-2.5 text-[0.65rem]">
          <Plus className="h-3.5 w-3.5" />
          New coupon
        </button>
      </div>

      {rows.length === 0 ? (
        <div className="card px-6 py-20 text-center">
          <p className="text-sm text-muted">No coupons yet.</p>
          <button type="button" onClick={openNew} className="btn mt-4 px-4 py-2.5 text-[0.65rem]">
            Create the first one
          </button>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[46rem] border-collapse text-sm">
              <thead className="bg-bone/80">
                <tr className="text-[0.6rem] uppercase tracking-[0.14em] text-muted">
                  <th className="border-b border-line px-3 py-2.5 text-left font-semibold">Code</th>
                  <th className="border-b border-line px-3 py-2.5 text-left font-semibold">Discount</th>
                  <th className="border-b border-line px-3 py-2.5 text-right font-semibold">Min subtotal</th>
                  <th className="border-b border-line px-3 py-2.5 text-right font-semibold">Used</th>
                  <th className="border-b border-line px-3 py-2.5 text-left font-semibold">Window</th>
                  <th className="border-b border-line px-3 py-2.5 text-left font-semibold">State</th>
                  <th className="w-20 border-b border-line px-3 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => (
                  <tr key={c.id} className="border-b border-line/60 last:border-0 hover:bg-bone/50">
                    <td className="px-3 py-2.5 font-mono text-xs">{c.code}</td>
                    <td className="px-3 py-2.5">{describe(c)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{c.minSubtotal ? formatMoney(c.minSubtotal) : "—"}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">
                      {c.usedCount}
                      {c.maxUses ? ` / ${c.maxUses}` : ""}
                    </td>
                    <td className="px-3 py-2.5 text-xs text-muted">
                      {c.startsAt || c.endsAt ? `${c.startsAt || "—"} → ${c.endsAt || "—"}` : "Always"}
                    </td>
                    <td className="px-3 py-2.5">
                      <Badge tone={c.state === "active" ? "success" : c.state === "scheduled" ? "brass" : c.state === "off" ? "neutral" : "danger"}>{c.state}</Badge>
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button type="button" onClick={() => openEdit(c)} aria-label={`Edit ${c.code}`} className="p-1 text-muted hover:text-ink">
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <form action={delAction}>
                          <CsrfInput value={csrf} />
                          <input type="hidden" name="couponId" value={c.id} />
                          <button
                            type="submit"
                            aria-label={`Delete ${c.code}`}
                            onClick={(e) => {
                              if (!window.confirm(`Delete coupon ${c.code}?`)) e.preventDefault();
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
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-mono text-sm">{c.code}</p>
                    <p className="text-xs text-muted">
                      {describe(c)}
                      {c.minSubtotal ? ` · min ${formatMoney(c.minSubtotal)}` : ""} · used {c.usedCount}
                      {c.maxUses ? `/${c.maxUses}` : ""}
                    </p>
                    <div className="mt-1.5">
                      <Badge tone={c.state === "active" ? "success" : c.state === "scheduled" ? "brass" : c.state === "off" ? "neutral" : "danger"}>{c.state}</Badge>
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <button type="button" onClick={() => openEdit(c)} aria-label="Edit" className="p-1 text-muted">
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <form action={delAction}>
                      <CsrfInput value={csrf} />
                      <input type="hidden" name="couponId" value={c.id} />
                      <button
                        type="submit"
                        aria-label="Delete"
                        onClick={(e) => {
                          if (!window.confirm(`Delete coupon ${c.code}?`)) e.preventDefault();
                        }}
                        className="p-1 text-muted hover:text-danger"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </form>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? `Edit ${editing.code}` : "New coupon"}>
        <form action={action} className="space-y-4" key={editing?.id ?? "new"}>
          <CsrfInput value={csrf} />
          {editing && <input type="hidden" name="id" value={editing.id} />}
          <TextField
            name="code"
            label="Code"
            defaultValue={editing?.code ?? ""}
            required
            placeholder="WELCOME10"
            hint="Stored uppercase. Letters, numbers, dashes and underscores."
            error={state.fieldErrors?.code}
            inputClassName="font-mono uppercase"
          />
          <SelectField
            name="type"
            label="Type"
            value={type}
            onChange={(e) => setType(e.target.value)}
            options={COUPON_TYPES.map((t) => ({ value: t, label: TYPE_LABELS[t] ?? t }))}
          />
          {type === "percent" && (
            <TextField
              name="value"
              label="Percentage off"
              type="number"
              min={0}
              max={100}
              defaultValue={editing && editing.type === "percent" ? String(editing.value) : "10"}
              required
              hint="0–100."
            />
          )}
          {type === "fixed" && <MoneyInput name="value" label="Amount off" defaultMinor={editing && editing.type === "fixed" ? editing.value : null} required />}
          {type === "free_shipping" && <p className="border border-line bg-bone/60 px-3 py-2 text-xs text-muted">Delivery is set to free. No value needed.</p>}

          <MoneyInput name="minSubtotal" label="Minimum subtotal" defaultMinor={editing?.minSubtotal ?? null} hint="Leave empty for no minimum." />
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField name="maxUses" label="Maximum uses" type="number" min={0} defaultValue={editing?.maxUses ? String(editing.maxUses) : ""} hint="Blank = unlimited." />
            <TextField name="perCustomer" label="Uses per customer" type="number" min={0} defaultValue={editing?.perCustomer ? String(editing.perCustomer) : ""} hint="Blank = unlimited." />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField name="startsAt" label="Starts" type="date" defaultValue={editing?.startsAt ?? ""} />
            <TextField name="endsAt" label="Ends" type="date" defaultValue={editing?.endsAt ?? ""} />
          </div>
          <ToggleRow name="isActive" label="Active" hint="Switch off to pause without deleting." defaultChecked={editing ? editing.isActive : true} />

          <div className="flex justify-end gap-2 border-t border-line pt-4">
            <button type="button" onClick={() => setOpen(false)} className="btn-outline px-4 py-2.5 text-[0.65rem]">
              Cancel
            </button>
            <SubmitButton size="sm" pendingLabel="Saving…">
              {editing ? "Save coupon" : "Create coupon"}
            </SubmitButton>
          </div>
        </form>
      </Modal>
    </>
  );
}

export default CouponsManager;
