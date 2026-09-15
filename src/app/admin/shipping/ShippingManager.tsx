"use client";

import { CsrfInput } from "@/components/admin/Csrf";

import { useActionState, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Globe, Pencil, Plus, Trash2 } from "lucide-react";
import { Badge, Modal } from "@/components/ui";
import { I18nInput, MoneyInput, SubmitButton, TextField, ToggleRow } from "@/components/admin/Fields";
import { deleteShippingZoneAction, saveShippingZoneAction } from "@/lib/admin/actions/commerce";
import { idleState } from "@/lib/admin/action-state";
import { BD_DISTRICTS } from "@/lib/constants";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";

export type ZoneRow = {
  id: string;
  nameEn: string;
  nameBn: string;
  districts: string[];
  everywhereElse: boolean;
  rate: number;
  freeAbove: number | null;
  etaMinDays: number;
  etaMaxDays: number;
  isActive: boolean;
  sortOrder: number;
};

export function ShippingManager({ rows, csrf }: { rows: ZoneRow[]; csrf: string }) {
  const [state, action] = useActionState(saveShippingZoneAction, idleState);
  const [delState, delAction] = useActionState(deleteShippingZoneAction, idleState);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ZoneRow | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [everywhere, setEverywhere] = useState(false);
  const [filter, setFilter] = useState("");

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

  const covered = useMemo(() => new Set(rows.flatMap((r) => r.districts)), [rows]);
  const uncovered = BD_DISTRICTS.filter((d) => !covered.has(d));
  const hasCatchAll = rows.some((r) => r.everywhereElse && r.isActive);

  const openNew = () => {
    setEditing(null);
    setPicked([]);
    setEverywhere(false);
    setFilter("");
    setOpen(true);
  };
  const openEdit = (z: ZoneRow) => {
    setEditing(z);
    setPicked(z.districts);
    setEverywhere(z.everywhereElse);
    setFilter("");
    setOpen(true);
  };

  const visibleDistricts = BD_DISTRICTS.filter((d) => d.toLowerCase().includes(filter.toLowerCase()));

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        {!hasCatchAll && (
          <p className="border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning">
            No active zone covers “everywhere else” — orders from {uncovered.length} district{uncovered.length === 1 ? "" : "s"} will be charged nothing for delivery.
          </p>
        )}
        <button type="button" onClick={openNew} className="btn ml-auto px-4 py-2.5 text-[0.65rem]">
          <Plus className="h-3.5 w-3.5" />
          New zone
        </button>
      </div>

      {rows.length === 0 ? (
        <div className="card px-6 py-20 text-center">
          <p className="text-sm text-muted">No delivery zones yet — add one so checkout can quote a rate.</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {rows.map((z) => (
            <li key={z.id} className={cn("card p-4", !z.isActive && "opacity-60")}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-medium">{z.nameEn}</h3>
                    {z.everywhereElse && (
                      <Badge tone="brass">
                        <Globe className="h-3 w-3" />
                        Catch-all
                      </Badge>
                    )}
                    {!z.isActive && <Badge tone="neutral">Off</Badge>}
                  </div>
                  <p className="mt-1 text-xs text-muted">
                    {z.rate === 0 ? "Free delivery" : formatMoney(z.rate)}
                    {z.freeAbove ? ` · free above ${formatMoney(z.freeAbove)}` : ""} · {z.etaMinDays}–{z.etaMaxDays} business days
                  </p>
                  <p className="mt-1.5 text-xs text-muted">
                    {z.districts.length > 0
                      ? `${z.districts.slice(0, 8).join(", ")}${z.districts.length > 8 ? ` +${z.districts.length - 8} more` : ""}`
                      : z.everywhereElse
                        ? "Every district not covered by another zone"
                        : "No districts"}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button type="button" onClick={() => openEdit(z)} aria-label="Edit zone" className="p-1.5 text-muted hover:text-ink">
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <form action={delAction}>
                    <CsrfInput value={csrf} />
                    <input type="hidden" name="zoneId" value={z.id} />
                    <button
                      type="submit"
                      aria-label="Delete zone"
                      onClick={(e) => {
                        if (!window.confirm(`Delete the “${z.nameEn}” zone?`)) e.preventDefault();
                      }}
                      className="p-1.5 text-muted hover:text-danger"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </form>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? `Edit “${editing.nameEn}”` : "New delivery zone"} className="max-w-2xl">
        <form action={action} className="space-y-4" key={editing?.id ?? "new"}>
          <CsrfInput value={csrf} />
          {editing && <input type="hidden" name="id" value={editing.id} />}
          {picked.map((d) => (
            <input key={d} type="hidden" name="districts" value={d} />
          ))}
          <input type="hidden" name="everywhereElse" value={everywhere ? "on" : ""} />

          <I18nInput name="name" label="Zone name" en={editing?.nameEn} bn={editing?.nameBn} required layout="stack" placeholder="Inside Dhaka" error={state.fieldErrors?.name_en} />

          <div className="grid gap-4 sm:grid-cols-2">
            <MoneyInput name="rate" label="Delivery rate" defaultMinor={editing?.rate ?? 0} required hint="Set 0 for free delivery." />
            <MoneyInput name="freeAbove" label="Free above" defaultMinor={editing?.freeAbove ?? null} hint="Blank = never free." />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <TextField name="etaMinDays" label="Min days" type="number" min={0} defaultValue={String(editing?.etaMinDays ?? 2)} required />
            <TextField name="etaMaxDays" label="Max days" type="number" min={0} defaultValue={String(editing?.etaMaxDays ?? 5)} required />
            <TextField name="sortOrder" label="Order" type="number" min={0} defaultValue={String(editing?.sortOrder ?? rows.length)} hint="Lower matches first." />
          </div>

          <div className="border border-line p-3">
            <div className="mb-2 flex items-center justify-between gap-3">
              <p className="text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-muted">
                Districts <span className="text-oxide">{picked.length}</span>
              </p>
              <div className="flex gap-2">
                <button type="button" onClick={() => setPicked([...BD_DISTRICTS])} className="text-[0.62rem] uppercase tracking-[0.14em] text-oxide hover:underline">
                  Select all
                </button>
                <button type="button" onClick={() => setPicked([])} className="text-[0.62rem] uppercase tracking-[0.14em] text-muted hover:underline">
                  Clear
                </button>
              </div>
            </div>
            <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filter districts…" className="field-box mb-2 py-1.5 text-xs" />
            <div className="max-h-52 overflow-y-auto border border-line/70 p-2">
              <div className="grid grid-cols-2 gap-x-3 gap-y-1 sm:grid-cols-3">
                {visibleDistricts.map((d) => (
                  <label key={d} className="flex items-center gap-1.5 text-xs">
                    <input
                      type="checkbox"
                      checked={picked.includes(d)}
                      onChange={(e) => setPicked((s) => (e.target.checked ? [...s, d] : s.filter((x) => x !== d)))}
                      className="h-3 w-3 accent-[rgb(var(--c-oxide))]"
                    />
                    <span className="truncate">{d}</span>
                  </label>
                ))}
              </div>
            </div>
            <label className="mt-3 flex items-start gap-2 border-t border-line pt-3">
              <input type="checkbox" checked={everywhere} onChange={(e) => setEverywhere(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[rgb(var(--c-oxide))]" />
              <span>
                <span className="block text-sm">Everywhere else</span>
                <span className="block text-xs text-muted">Use this zone as the fallback for any district not matched by another zone.</span>
              </span>
            </label>
          </div>

          <ToggleRow name="isActive" label="Active" defaultChecked={editing ? editing.isActive : true} />

          <div className="flex justify-end gap-2 border-t border-line pt-4">
            <button type="button" onClick={() => setOpen(false)} className="btn-outline px-4 py-2.5 text-[0.65rem]">
              Cancel
            </button>
            <SubmitButton size="sm" pendingLabel="Saving…">
              {editing ? "Save zone" : "Create zone"}
            </SubmitButton>
          </div>
        </form>
      </Modal>
    </>
  );
}

export default ShippingManager;
