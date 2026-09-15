"use client";

import { CsrfInput } from "@/components/admin/Csrf";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { Ban, Check, Plus, Save, Trash2, Truck, X } from "lucide-react";
import { Modal } from "@/components/ui";
import { Field, SubmitButton, TextField, SelectField, TextAreaField, I18nInput, CheckboxField } from "@/components/admin/Fields";
import { idleState } from "@/lib/admin/action-state";
import {
  addOrderEventAction,
  cancelOrderAction,
  deleteOrderEventAction,
  markOrderPaidAction,
  setOrderStatusAction,
  updateCourierAction,
  updateInternalNotesAction,
  updateOrderCustomerAction,
  updateOrderItemsAction,
  verifyPaymentAction,
} from "@/lib/admin/actions/orders";
import { COURIERS, PAYMENT_METHOD_LABELS, STATUS_FLOW, STATUS_LABELS } from "@/lib/admin/constants";
import { BD_DISTRICTS } from "@/lib/constants";
import type { OrderStatus } from "@/lib/constants";
import { formatMoney, majorToMinor, minorToMajor } from "@/lib/money";
import { cn } from "@/lib/utils";

/** Toast whatever the action returned, once per state change. */
function useActionToast(state: { ok?: boolean; error?: string | null; message?: string | null }) {
  useEffect(() => {
    if (state.ok && state.message) toast.success(state.message);
    else if (state.error) toast.error(state.error);
  }, [state]);
}

/* ───────────────────────────── status actions ───────────────────────────── */

export function StatusActions({
  orderId,
  status,
  csrf,
  paymentStatus,
  paymentMethod,
  canVerify,
}: {
  orderId: string;
  status: string;
  csrf: string;
  paymentStatus: string;
  paymentMethod: string;
  canVerify: boolean;
}) {
  const [state, action] = useActionState(setOrderStatusAction, idleState);
  const [cancelState, cancelAction] = useActionState(cancelOrderAction, idleState);
  const [paidState, paidAction] = useActionState(markOrderPaidAction, idleState);
  const [cancelOpen, setCancelOpen] = useState(false);
  useActionToast(state);
  useActionToast(cancelState);
  useActionToast(paidState);

  useEffect(() => {
    if (cancelState.ok) setCancelOpen(false);
  }, [cancelState.ok]);

  const next = (STATUS_FLOW[status as OrderStatus] ?? []).filter((s) => s !== "cancelled");
  const canCancel = (STATUS_FLOW[status as OrderStatus] ?? []).includes("cancelled");

  return (
    <div className="flex flex-wrap items-center gap-2">
      {next.map((s) => (
        <form key={s} action={action}>
          <CsrfInput value={csrf} />
          <input type="hidden" name="orderId" value={orderId} />
          <input type="hidden" name="status" value={s} />
          <SubmitButton size="sm" variant={s === "delivered" ? "accent" : "solid"} pendingLabel="Working…">
            <Check className="h-3.5 w-3.5" />
            Mark {STATUS_LABELS[s]?.toLowerCase() ?? s}
          </SubmitButton>
        </form>
      ))}

      {canVerify && paymentStatus !== "paid" && paymentStatus !== "refunded" && (
        <form action={paidAction}>
          <CsrfInput value={csrf} />
          <input type="hidden" name="orderId" value={orderId} />
          <SubmitButton size="sm" variant="outline" pendingLabel="Saving…">
            Mark paid ({PAYMENT_METHOD_LABELS[paymentMethod] ?? paymentMethod})
          </SubmitButton>
        </form>
      )}

      {canCancel && (
        <>
          <button type="button" onClick={() => setCancelOpen(true)} className="btn-outline border-danger px-4 py-2.5 text-[0.65rem] text-danger hover:bg-danger hover:text-paper">
            <Ban className="h-3.5 w-3.5" />
            Cancel order
          </button>
          <Modal open={cancelOpen} onClose={() => setCancelOpen(false)} title="Cancel this order?" description="Stock is returned and the customer sees the reason on their tracking page.">
            <form action={cancelAction} className="space-y-4">
              <CsrfInput value={csrf} />
              <input type="hidden" name="orderId" value={orderId} />
              <TextAreaField name="reason" label="Reason shown to the customer" required placeholder="Out of stock in the size you ordered — we have refunded in full." />
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setCancelOpen(false)} className="btn-outline px-4 py-2.5 text-[0.65rem]">
                  Keep order
                </button>
                <SubmitButton size="sm" variant="danger" pendingLabel="Cancelling…">
                  Cancel order
                </SubmitButton>
              </div>
            </form>
          </Modal>
        </>
      )}
    </div>
  );
}

/* ───────────────────────────── customer & address ───────────────────────────── */

export type OrderAddress = { line1: string; line2: string; city: string; district: string; postalCode: string; country: string; division?: string; upazila?: string; area?: string };

export function CustomerBlock({
  orderId,
  csrf,
  customerName,
  phone,
  email,
  notes,
  address,
}: {
  orderId: string;
  csrf: string;
  customerName: string;
  phone: string;
  email: string;
  notes: string;
  address: OrderAddress;
}) {
  const [state, action] = useActionState(updateOrderCustomerAction, idleState);
  useActionToast(state);

  return (
    <form action={action} className="space-y-3">
      <CsrfInput value={csrf} />
      <input type="hidden" name="orderId" value={orderId} />
      <input type="hidden" name="country" value={address.country || "BD"} />
      <div className="grid gap-3 sm:grid-cols-2">
        <TextField name="customerName" label="Name" defaultValue={customerName} required error={state.fieldErrors?.customerName} />
        <TextField name="phone" label="Phone" defaultValue={phone} required error={state.fieldErrors?.phone} />
      </div>
      <TextField name="email" type="email" label="Email" defaultValue={email} placeholder="Optional" />
      <TextField name="line1" label="Address line 1" defaultValue={address.line1} required error={state.fieldErrors?.["address.line1"]} />
      <TextField name="line2" label="Address line 2" defaultValue={address.line2} placeholder="Apartment, floor, landmark" />
      <div className="grid gap-3 sm:grid-cols-3">
        <TextField name="city" label="City / area" defaultValue={address.city} required error={state.fieldErrors?.["address.city"]} />
        <SelectField
          name="district"
          label="District"
          defaultValue={address.district}
          options={[{ value: "", label: "Select…" }, ...BD_DISTRICTS.map((d) => ({ value: d, label: d }))]}
          error={state.fieldErrors?.["address.district"]}
        />
        <TextField name="postalCode" label="Postal code" defaultValue={address.postalCode} placeholder="Optional" />
      </div>
      <TextAreaField name="notes" label="Customer note" defaultValue={notes} placeholder="Anything the customer told us" inputClassName="min-h-[72px]" />
      <SubmitButton size="sm" pendingLabel="Saving…">
        <Save className="h-3.5 w-3.5" />
        Save customer details
      </SubmitButton>
    </form>
  );
}

/* ───────────────────────────── items editor ───────────────────────────── */

export type OrderItemRow = {
  id: string;
  name: string;
  variantTitle: string | null;
  sku: string | null;
  image: string | null;
  unitPrice: number;
  quantity: number;
};

export function ItemsEditor({
  orderId,
  csrf,
  items,
  shipping,
  discount,
  editable,
  currencyNote,
}: {
  orderId: string;
  csrf: string;
  items: OrderItemRow[];
  shipping: number;
  discount: number;
  editable: boolean;
  currencyNote?: string;
}) {
  const [state, action] = useActionState(updateOrderItemsAction, idleState);
  useActionToast(state);
  const [rows, setRows] = useState(items.map((i) => ({ ...i, priceMajor: String(minorToMajor(i.unitPrice)) })));
  const [shipMajor, setShipMajor] = useState(String(minorToMajor(shipping)));
  const [discMajor, setDiscMajor] = useState(String(minorToMajor(discount)));

  const subtotal = rows.reduce((a, r) => a + majorToMinor(r.priceMajor) * r.quantity, 0);
  const shipMinor = majorToMinor(shipMajor);
  const discMinor = majorToMinor(discMajor);
  const total = Math.max(0, subtotal - discMinor + shipMinor);

  const payload = rows.map((r) => ({ id: r.id, quantity: r.quantity, unitPrice: majorToMinor(r.priceMajor) }));

  return (
    <form action={action}>
      <CsrfInput value={csrf} />
      <input type="hidden" name="orderId" value={orderId} />
      <input type="hidden" name="items" value={JSON.stringify(payload)} />
      <input type="hidden" name="shipping_minor" value={shipMinor} />
      <input type="hidden" name="discount_minor" value={discMinor} />

      <div className="-mx-4 overflow-x-auto sm:-mx-5">
        <table className="w-full min-w-[34rem] border-collapse text-sm">
          <thead>
            <tr className="border-b border-line text-[0.6rem] uppercase tracking-[0.14em] text-muted">
              <th className="px-4 py-2 text-left font-semibold sm:px-5">Item</th>
              <th className="px-3 py-2 text-right font-semibold">Unit price</th>
              <th className="px-3 py-2 text-right font-semibold">Qty</th>
              <th className="px-4 py-2 text-right font-semibold sm:px-5">Line total</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, idx) => (
              <tr key={r.id} className={cn("border-b border-line/60 last:border-0", r.quantity === 0 && "opacity-40")}>
                <td className="px-4 py-2.5 sm:px-5">
                  <div className="flex items-center gap-2.5">
                    {r.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={r.image} alt="" className="h-10 w-8 shrink-0 border border-line object-cover" />
                    ) : (
                      <span className="h-10 w-8 shrink-0 border border-line bg-bone" />
                    )}
                    <div className="min-w-0">
                      <p className="truncate text-sm">{r.name}</p>
                      <p className="truncate text-xs text-muted">
                        {r.variantTitle ?? "—"}
                        {r.sku ? ` · ${r.sku}` : ""}
                      </p>
                    </div>
                  </div>
                </td>
                <td className="px-3 py-2.5 text-right">
                  {editable ? (
                    <input
                      value={r.priceMajor}
                      onChange={(e) => setRows((s) => s.map((x, i) => (i === idx ? { ...x, priceMajor: e.target.value } : x)))}
                      inputMode="decimal"
                      className="field-box w-24 py-1.5 text-right font-mono text-xs"
                      aria-label={`Unit price for ${r.name}`}
                    />
                  ) : (
                    <span className="tabular-nums">{formatMoney(r.unitPrice)}</span>
                  )}
                </td>
                <td className="px-3 py-2.5 text-right">
                  {editable ? (
                    <input
                      type="number"
                      min={0}
                      value={r.quantity}
                      onChange={(e) => setRows((s) => s.map((x, i) => (i === idx ? { ...x, quantity: Math.max(0, Number(e.target.value) || 0) } : x)))}
                      className="field-box w-16 py-1.5 text-right font-mono text-xs"
                      aria-label={`Quantity for ${r.name}`}
                    />
                  ) : (
                    <span className="tabular-nums">{r.quantity}</span>
                  )}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums sm:px-5">{formatMoney(majorToMinor(r.priceMajor) * r.quantity)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <dl className="mt-4 ml-auto max-w-xs space-y-1.5 text-sm">
        <div className="flex justify-between gap-4">
          <dt className="text-muted">Subtotal</dt>
          <dd className="tabular-nums">{formatMoney(subtotal)}</dd>
        </div>
        <div className="flex items-center justify-between gap-4">
          <dt className="text-muted">Shipping</dt>
          <dd>
            {editable ? (
              <input value={shipMajor} onChange={(e) => setShipMajor(e.target.value)} inputMode="decimal" className="field-box w-24 py-1 text-right font-mono text-xs" aria-label="Shipping" />
            ) : (
              <span className="tabular-nums">{formatMoney(shipping)}</span>
            )}
          </dd>
        </div>
        <div className="flex items-center justify-between gap-4">
          <dt className="text-muted">Discount</dt>
          <dd>
            {editable ? (
              <input value={discMajor} onChange={(e) => setDiscMajor(e.target.value)} inputMode="decimal" className="field-box w-24 py-1 text-right font-mono text-xs" aria-label="Discount" />
            ) : (
              <span className="tabular-nums">−{formatMoney(discount)}</span>
            )}
          </dd>
        </div>
        <div className="flex justify-between gap-4 border-t border-line pt-1.5 text-base font-medium">
          <dt>Total</dt>
          <dd className="tabular-nums">{formatMoney(total)}</dd>
        </div>
      </dl>
      {currencyNote && <p className="mt-2 text-right text-xs text-muted">{currencyNote}</p>}

      {editable ? (
        <div className="mt-4 flex items-center justify-end gap-3">
          <p className="text-xs text-muted">Changing a quantity adjusts variant stock by the difference.</p>
          <SubmitButton size="sm" pendingLabel="Saving…">
            <Save className="h-3.5 w-3.5" />
            Save items
          </SubmitButton>
        </div>
      ) : (
        <p className="mt-3 text-right text-xs text-muted">Items can only be edited while the order is pending.</p>
      )}
    </form>
  );
}

/* ───────────────────────────── payments ───────────────────────────── */

export type PaymentRow = {
  id: string;
  method: string;
  provider: string | null;
  amount: number;
  status: string;
  transactionId: string | null;
  senderNumber: string | null;
  verifiedBy: string | null;
  verifiedAt: string | null;
  createdAt: string;
};

export function PaymentsList({ payments, csrf, canVerify }: { payments: PaymentRow[]; csrf: string; canVerify: boolean }) {
  const [state, action] = useActionState(verifyPaymentAction, idleState);
  useActionToast(state);

  if (payments.length === 0) return <p className="py-4 text-sm text-muted">No payment records yet.</p>;

  return (
    <ul className="divide-y divide-line/70">
      {payments.map((p) => (
        <li key={p.id} className="py-3 first:pt-0 last:pb-0">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm">
                {PAYMENT_METHOD_LABELS[p.method] ?? p.method} · <span className="tabular-nums">{formatMoney(p.amount)}</span>
              </p>
              <p className="mt-0.5 text-xs text-muted">
                {p.transactionId ? `TrxID ${p.transactionId}` : "No transaction id"}
                {p.senderNumber ? ` · from ${p.senderNumber}` : ""} · {p.createdAt}
              </p>
              {p.verifiedBy && (
                <p className="mt-0.5 text-xs text-muted">
                  {p.status === "paid" ? "Verified" : "Reviewed"} by {p.verifiedBy}
                  {p.verifiedAt ? ` · ${p.verifiedAt}` : ""}
                </p>
              )}
            </div>
            <span
              className={cn(
                "shrink-0 border px-2 py-0.5 text-[0.6rem] font-semibold uppercase tracking-[0.14em]",
                p.status === "paid"
                  ? "border-success/40 bg-success/10 text-success"
                  : p.status === "failed"
                    ? "border-danger/40 bg-danger/10 text-danger"
                    : "border-warning/40 bg-warning/10 text-warning",
              )}
            >
              {p.status.replace(/_/g, " ")}
            </span>
          </div>

          {canVerify && p.status === "pending_verification" && (
            <form action={action} className="mt-3 flex flex-wrap items-end gap-2 border-t border-line/70 pt-3">
              <CsrfInput value={csrf} />
              <input type="hidden" name="paymentId" value={p.id} />
              <input name="note" placeholder="Note if rejecting (shown to customer)" className="field-box min-w-[12rem] flex-1 py-2 text-xs" />
              <SubmitButton size="sm" name="decision" value="paid" pendingLabel="Saving…">
                <Check className="h-3.5 w-3.5" />
                Verify
              </SubmitButton>
              <SubmitButton size="sm" variant="outline" name="decision" value="failed" className="border-danger text-danger hover:bg-danger hover:text-paper">
                <X className="h-3.5 w-3.5" />
                Reject
              </SubmitButton>
            </form>
          )}
        </li>
      ))}
    </ul>
  );
}

/* ───────────────────────────── courier ───────────────────────────── */

export function CourierBlock({
  orderId,
  csrf,
  courier,
  tracking,
  url,
}: {
  orderId: string;
  csrf: string;
  courier: string;
  tracking: string;
  url: string;
}) {
  const [state, action] = useActionState(updateCourierAction, idleState);
  useActionToast(state);
  const [name, setName] = useState(courier);
  const [code, setCode] = useState(tracking);
  const auto = (() => {
    const found = COURIERS.find((c) => c.value === name);
    return found && code ? found.url(code) : "";
  })();

  return (
    <form action={action} className="space-y-3">
      <CsrfInput value={csrf} />
      <input type="hidden" name="orderId" value={orderId} />
      <SelectField
        name="courier"
        label="Courier"
        value={name}
        onChange={(e) => setName(e.target.value)}
        options={[{ value: "", label: "Not dispatched" }, ...COURIERS.map((c) => ({ value: c.value, label: c.label }))]}
      />
      <TextField name="courierTracking" label="Tracking / consignment id" value={code} onChange={(e) => setCode(e.target.value)} placeholder="e.g. 7D91X2K" />
      <Field label="Tracking link" hint={auto ? "Filled automatically for this courier — edit if the link differs." : "Paste a link if the courier is not listed."}>
        <input name="courierUrl" defaultValue={url || auto} key={auto} className="field-box text-xs" placeholder="https://…" />
      </Field>
      <SubmitButton size="sm" pendingLabel="Saving…">
        <Truck className="h-3.5 w-3.5" />
        Save courier
      </SubmitButton>
    </form>
  );
}

/* ───────────────────────────── timeline ───────────────────────────── */

export type EventRow = {
  id: string;
  type: string;
  title: string;
  message: string | null;
  isPublic: boolean;
  by: string | null;
  createdAt: string;
};

export function Timeline({ orderId, csrf, events }: { orderId: string; csrf: string; events: EventRow[] }) {
  const [state, action] = useActionState(addOrderEventAction, idleState);
  const [delState, delAction] = useActionState(deleteOrderEventAction, idleState);
  const [open, setOpen] = useState(false);
  useActionToast(state);
  useActionToast(delState);

  useEffect(() => {
    if (state.ok) setOpen(false);
  }, [state.ok]);

  return (
    <div>
      <ol className="relative space-y-4 border-l border-line pl-5">
        {events.map((e) => (
          <li key={e.id} className="relative">
            <span className={cn("absolute -left-[1.42rem] top-1.5 h-2 w-2 rounded-full", e.isPublic ? "bg-oxide" : "bg-line")} />
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-medium">{e.title}</p>
                {e.message && <p className="mt-0.5 whitespace-pre-line text-xs text-muted">{e.message}</p>}
                <p className="mt-1 text-[0.6rem] uppercase tracking-[0.14em] text-muted">
                  {e.createdAt} · {e.type}
                  {e.by ? ` · ${e.by}` : ""}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <span
                  className={cn(
                    "border px-1.5 py-0.5 text-[0.55rem] font-semibold uppercase tracking-[0.14em]",
                    e.isPublic ? "border-oxide/40 bg-oxide/10 text-oxide" : "border-line bg-bone text-muted",
                  )}
                >
                  {e.isPublic ? "Customer" : "Internal"}
                </span>
                <form action={delAction}>
                  <CsrfInput value={csrf} />
                  <input type="hidden" name="eventId" value={e.id} />
                  <button
                    type="submit"
                    aria-label="Delete event"
                    className="p-1 text-muted transition hover:text-danger"
                    onClick={(ev) => {
                      if (!window.confirm("Remove this timeline entry?")) ev.preventDefault();
                    }}
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </form>
              </div>
            </div>
          </li>
        ))}
        {events.length === 0 && <li className="text-sm text-muted">No events yet.</li>}
      </ol>

      <button type="button" onClick={() => setOpen(true)} className="btn-outline mt-5 px-4 py-2.5 text-[0.65rem]">
        <Plus className="h-3.5 w-3.5" />
        Add event
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="Add a timeline event" description="Public events appear on the customer's tracking page and are read by the AI concierge.">
        <form action={action} className="space-y-4">
          <CsrfInput value={csrf} />
          <input type="hidden" name="orderId" value={orderId} />
          <SelectField
            name="type"
            label="Type"
            defaultValue="note"
            options={[
              { value: "status", label: "Status update" },
              { value: "shipping", label: "Shipping" },
              { value: "payment", label: "Payment" },
              { value: "note", label: "Note" },
              { value: "message", label: "Message to customer" },
            ]}
          />
          <I18nInput name="title" label="Title" required layout="stack" placeholder="Handed to courier" />
          <I18nInput name="message" label="Message" multiline rows={3} layout="stack" placeholder="Pathao picked up your parcel this afternoon." />
          <CheckboxField name="isPublic" label="Visible to the customer" hint="Uncheck to keep this entry for staff only." defaultChecked />
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setOpen(false)} className="btn-outline px-4 py-2.5 text-[0.65rem]">
              Cancel
            </button>
            <SubmitButton size="sm" pendingLabel="Adding…">
              Add event
            </SubmitButton>
          </div>
        </form>
      </Modal>
    </div>
  );
}

/* ───────────────────────────── internal notes ───────────────────────────── */

export function InternalNotes({ orderId, csrf, value }: { orderId: string; csrf: string; value: string }) {
  const [state, action] = useActionState(updateInternalNotesAction, idleState);
  useActionToast(state);
  return (
    <form action={action} className="space-y-3">
      <CsrfInput value={csrf} />
      <input type="hidden" name="orderId" value={orderId} />
      <TextAreaField
        name="internalNotes"
        defaultValue={value}
        placeholder="Anything the team should know — customer preferences, courier quirks, follow-up reminders."
        inputClassName="min-h-[120px]"
        hint="Never shown to the customer or the concierge."
      />
      <SubmitButton size="sm" variant="outline" pendingLabel="Saving…">
        Save note
      </SubmitButton>
    </form>
  );
}
