"use client";

import { CsrfInput } from "@/components/admin/Csrf";

import { useActionState, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Check, Copy, Loader2, Plus, Search, Trash2, UserCheck } from "lucide-react";
import { Modal } from "@/components/ui";
import { Field, SelectField, SubmitButton, TextAreaField, TextField, CheckboxField } from "@/components/admin/Fields";
import { Section } from "@/components/admin/PageHeader";
import { createManualOrderAction } from "@/lib/admin/actions/orders";
import { idleState } from "@/lib/admin/action-state";
import { apiFetch } from "@/lib/api";
import { BD_DISTRICTS, ORDER_CHANNELS, ORDER_STATUSES, PAYMENT_METHODS, PAYMENT_STATUSES } from "@/lib/constants";
import { CHANNEL_LABELS, PAYMENT_METHOD_LABELS, PAYMENT_STATUS_LABELS, STATUS_LABELS } from "@/lib/admin/constants";
import type { CustomerPick, ProductPick } from "@/lib/admin/types";
import { formatMoney, majorToMinor, minorToMajor } from "@/lib/money";
import { cn } from "@/lib/utils";

type Line = {
  key: string;
  variantId: string;
  productName: string;
  variantTitle: string;
  sku: string | null;
  image: string | null;
  stock: number;
  quantity: number;
  priceMajor: string;
};

export function ManualOrderForm({ csrf }: { csrf: string }) {
  const [state, action] = useActionState(createManualOrderAction, idleState);
  const [lines, setLines] = useState<Line[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [customerOpen, setCustomerOpen] = useState(false);

  const [customerId, setCustomerId] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [line1, setLine1] = useState("");
  const [line2, setLine2] = useState("");
  const [city, setCity] = useState("");
  const [district, setDistrict] = useState("");
  const [postalCode, setPostalCode] = useState("");

  const [shipMajor, setShipMajor] = useState("0");
  const [discMajor, setDiscMajor] = useState("0");
  const [zoneName, setZoneName] = useState("");
  const [zoneBusy, setZoneBusy] = useState(false);
  const [shipTouched, setShipTouched] = useState(false);

  const subtotal = useMemo(() => lines.reduce((a, l) => a + majorToMinor(l.priceMajor) * l.quantity, 0), [lines]);
  const shipMinor = majorToMinor(shipMajor);
  const discMinor = majorToMinor(discMajor);
  const total = Math.max(0, subtotal - discMinor + shipMinor);

  // Auto-quote shipping from the zone table until the owner overrides it.
  useEffect(() => {
    if (!district || shipTouched) return;
    let cancelled = false;
    setZoneBusy(true);
    apiFetch<{ rate: number; name: string }>(`/api/admin/shipping/quote?district=${encodeURIComponent(district)}&subtotal=${subtotal}`)
      .then((r) => {
        if (cancelled) return;
        setShipMajor(String(minorToMajor(r.rate)));
        setZoneName(r.name);
      })
      .catch(() => undefined)
      .finally(() => !cancelled && setZoneBusy(false));
    return () => {
      cancelled = true;
    };
  }, [district, subtotal, shipTouched]);

  useEffect(() => {
    if (state.error) toast.error(state.error);
    if (state.ok && state.message) toast.success(state.message);
  }, [state]);

  const addVariant = useCallback((p: ProductPick, variantId: string) => {
    const v = p.variants.find((x) => x.id === variantId);
    if (!v) return;
    setLines((s) => {
      const existing = s.find((l) => l.variantId === variantId);
      if (existing) return s.map((l) => (l.variantId === variantId ? { ...l, quantity: l.quantity + 1 } : l));
      return [
        ...s,
        {
          key: `${variantId}-${Date.now()}`,
          variantId,
          productName: p.name,
          variantTitle: v.title,
          sku: v.sku,
          image: p.image,
          stock: v.stock,
          quantity: 1,
          priceMajor: String(minorToMajor(v.price)),
        },
      ];
    });
  }, []);

  const applyCustomer = (c: CustomerPick) => {
    setCustomerId(c.id);
    setName(c.name);
    setPhone(c.phone ?? "");
    setEmail(c.email ?? "");
    if (c.address) {
      setLine1(c.address.line1);
      setLine2(c.address.line2);
      setCity(c.address.city);
      setDistrict(c.address.district);
      setPostalCode(c.address.postalCode);
    }
    setCustomerOpen(false);
  };

  const payload = lines.filter((l) => l.quantity > 0).map((l) => ({ variantId: l.variantId, quantity: l.quantity, unitPrice: majorToMinor(l.priceMajor) }));

  if (state.ok && state.data?.trackingCode) {
    return <Created data={state.data} />;
  }

  return (
    <form action={action} className="grid gap-5 xl:grid-cols-3">
      <CsrfInput value={csrf} />
      <input type="hidden" name="items" value={JSON.stringify(payload)} />
      <input type="hidden" name="shipping_minor" value={shipMinor} />
      <input type="hidden" name="discount_minor" value={discMinor} />
      <input type="hidden" name="customerId" value={customerId} />
      <input type="hidden" name="country" value="BD" />

      <div className="space-y-5 xl:col-span-2">
        <Section
          title="Customer"
          actions={
            <button type="button" onClick={() => setCustomerOpen(true)} className="inline-flex items-center gap-1.5 text-[0.62rem] uppercase tracking-[0.14em] text-oxide hover:underline">
              <Search className="h-3 w-3" />
              Find existing
            </button>
          }
        >
          {customerId && (
            <p className="mb-3 inline-flex items-center gap-1.5 border border-success/40 bg-success/10 px-2 py-1 text-xs text-success">
              <UserCheck className="h-3 w-3" />
              Linked to an existing customer
              <button type="button" onClick={() => setCustomerId("")} className="ml-1 underline">
                unlink
              </button>
            </p>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <TextField name="customerName" label="Name" value={name} onChange={(e) => setName(e.target.value)} required error={state.fieldErrors?.customerName} />
            <TextField
              name="phone"
              label="Phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
              placeholder="01XXXXXXXXX"
              error={state.fieldErrors?.phone}
            />
          </div>
          <TextField name="email" type="email" label="Email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Optional" className="mt-3" />
        </Section>

        <Section title="Delivery address">
          <div className="space-y-3">
            <TextField name="line1" label="Address line 1" value={line1} onChange={(e) => setLine1(e.target.value)} required error={state.fieldErrors?.["address.line1"]} />
            <TextField name="line2" label="Address line 2" value={line2} onChange={(e) => setLine2(e.target.value)} placeholder="Apartment, floor, landmark" />
            <div className="grid gap-3 sm:grid-cols-3">
              <TextField name="city" label="City / area" value={city} onChange={(e) => setCity(e.target.value)} required error={state.fieldErrors?.["address.city"]} />
              <SelectField
                name="district"
                label="District"
                value={district}
                onChange={(e) => setDistrict(e.target.value)}
                options={[{ value: "", label: "Select…" }, ...BD_DISTRICTS.map((d) => ({ value: d, label: d }))]}
                error={state.fieldErrors?.["address.district"]}
                hint={zoneName ? `Zone: ${zoneName}` : undefined}
              />
              <TextField name="postalCode" label="Postal code" value={postalCode} onChange={(e) => setPostalCode(e.target.value)} placeholder="Optional" />
            </div>
          </div>
        </Section>

        <Section
          title="Line items"
          actions={
            <button type="button" onClick={() => setPickerOpen(true)} className="btn-outline px-3 py-2 text-[0.62rem]">
              <Plus className="h-3 w-3" />
              Add product
            </button>
          }
        >
          {lines.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted">No items yet — add a product to begin.</p>
          ) : (
            <div className="-mx-4 overflow-x-auto sm:-mx-5">
              <table className="w-full min-w-[34rem] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-line text-[0.6rem] uppercase tracking-[0.14em] text-muted">
                    <th className="px-4 py-2 text-left font-semibold sm:px-5">Item</th>
                    <th className="px-3 py-2 text-right font-semibold">Unit price</th>
                    <th className="px-3 py-2 text-right font-semibold">Qty</th>
                    <th className="px-3 py-2 text-right font-semibold">Total</th>
                    <th className="w-10 px-3 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l, idx) => (
                    <tr key={l.key} className="border-b border-line/60 last:border-0">
                      <td className="px-4 py-2.5 sm:px-5">
                        <div className="flex items-center gap-2.5">
                          {l.image ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={l.image} alt="" className="h-10 w-8 shrink-0 border border-line object-cover" />
                          ) : (
                            <span className="h-10 w-8 shrink-0 border border-line bg-bone" />
                          )}
                          <div className="min-w-0">
                            <p className="truncate">{l.productName}</p>
                            <p className="truncate text-xs text-muted">
                              {l.variantTitle}
                              {l.sku ? ` · ${l.sku}` : ""} · {l.stock} in stock
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <input
                          value={l.priceMajor}
                          onChange={(e) => setLines((s) => s.map((x, i) => (i === idx ? { ...x, priceMajor: e.target.value } : x)))}
                          inputMode="decimal"
                          aria-label={`Unit price for ${l.productName}`}
                          className="field-box w-24 py-1.5 text-right font-mono text-xs"
                        />
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <input
                          type="number"
                          min={1}
                          value={l.quantity}
                          onChange={(e) => setLines((s) => s.map((x, i) => (i === idx ? { ...x, quantity: Math.max(1, Number(e.target.value) || 1) } : x)))}
                          aria-label={`Quantity for ${l.productName}`}
                          className={cn("field-box w-16 py-1.5 text-right font-mono text-xs", l.quantity > l.stock && "border-warning")}
                        />
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{formatMoney(majorToMinor(l.priceMajor) * l.quantity)}</td>
                      <td className="px-3 py-2.5 text-right">
                        <button type="button" onClick={() => setLines((s) => s.filter((_, i) => i !== idx))} aria-label="Remove line" className="p-1 text-muted hover:text-danger">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {lines.some((l) => l.quantity > l.stock) && (
            <p className="mt-3 border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning">
              One or more lines exceed the stock on hand. The order will still be created — stock can go negative if you keep
              &ldquo;reduce stock&rdquo; on.
            </p>
          )}
        </Section>

        <Section title="Notes">
          <TextAreaField name="notes" label="Customer note" placeholder="Anything the customer asked for" inputClassName="min-h-[72px]" />
          <TextAreaField name="internalNotes" label="Internal note" placeholder="Staff only" className="mt-3" inputClassName="min-h-[72px]" />
        </Section>
      </div>

      {/* sidebar */}
      <div className="space-y-5">
        <Section title="Order source">
          <SelectField
            name="channel"
            label="Channel"
            defaultValue="whatsapp"
            options={ORDER_CHANNELS.map((c) => ({ value: c, label: CHANNEL_LABELS[c] ?? c }))}
            hint="Where the customer placed this order."
          />
          <SelectField name="locale" label="Customer language" defaultValue="en" options={[{ value: "en", label: "English" }, { value: "bn", label: "বাংলা" }]} className="mt-3" />
        </Section>

        <Section title="Payment">
          <SelectField name="paymentMethod" label="Method" defaultValue="cod" options={PAYMENT_METHODS.map((m) => ({ value: m, label: PAYMENT_METHOD_LABELS[m] ?? m }))} />
          <SelectField
            name="paymentStatus"
            label="Payment status"
            defaultValue="unpaid"
            options={PAYMENT_STATUSES.map((s) => ({ value: s, label: PAYMENT_STATUS_LABELS[s] ?? s }))}
            className="mt-3"
          />
          <SelectField
            name="status"
            label="Order status"
            defaultValue="confirmed"
            options={ORDER_STATUSES.filter((s) => s !== "refunded").map((s) => ({ value: s, label: STATUS_LABELS[s] ?? s }))}
            className="mt-3"
          />
          <div className="mt-4 border-t border-line pt-3">
            <CheckboxField name="decrementStock" label="Reduce variant stock" hint="Leave on unless the stock was already taken out elsewhere." defaultChecked />
          </div>
        </Section>

        <Section title="Totals">
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Subtotal</dt>
              <dd className="tabular-nums">{formatMoney(subtotal)}</dd>
            </div>
            <Field label="Shipping" hint={zoneBusy ? "Checking zone…" : zoneName ? `Auto from “${zoneName}”` : undefined}>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted">৳</span>
                <input
                  value={shipMajor}
                  onChange={(e) => {
                    setShipTouched(true);
                    setShipMajor(e.target.value);
                  }}
                  inputMode="decimal"
                  className="field-box pl-7 text-right font-mono text-sm"
                  aria-label="Shipping"
                />
              </div>
            </Field>
            <Field label="Discount">
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted">৳</span>
                <input value={discMajor} onChange={(e) => setDiscMajor(e.target.value)} inputMode="decimal" className="field-box pl-7 text-right font-mono text-sm" aria-label="Discount" />
              </div>
            </Field>
            <div className="flex justify-between gap-4 border-t border-line pt-2 text-base font-medium">
              <dt>Total</dt>
              <dd className="tabular-nums">{formatMoney(total)}</dd>
            </div>
          </dl>
          <SubmitButton className="mt-5 w-full" disabled={payload.length === 0} pendingLabel="Creating order…">
            Create order
          </SubmitButton>
          {payload.length === 0 && <p className="mt-2 text-center text-xs text-muted">Add at least one item.</p>}
        </Section>
      </div>

      <ProductPickerModal open={pickerOpen} onClose={() => setPickerOpen(false)} onPick={addVariant} />
      <CustomerPickerModal open={customerOpen} onClose={() => setCustomerOpen(false)} onPick={applyCustomer} />
    </form>
  );
}

/* ───────────────────────────── success panel ───────────────────────────── */

function Created({ data }: { data: Record<string, string> }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="mx-auto max-w-lg">
      <div className="card p-6 text-center">
        <span className="mx-auto flex h-10 w-10 items-center justify-center border border-success bg-success/10 text-success">
          <Check className="h-5 w-5" />
        </span>
        <h2 className="display mt-4 text-2xl">Order {data.number} created</h2>
        <p className="mt-2 text-sm text-muted">Share this tracking code with the customer so they can follow the order themselves.</p>
        <div className="mt-5 flex items-center justify-center gap-2">
          <span className="border border-line bg-bone px-4 py-2.5 font-mono text-lg tracking-[0.2em]">{data.trackingCode}</span>
          <button
            type="button"
            onClick={() => {
              void navigator.clipboard?.writeText(data.trackingCode ?? "");
              setCopied(true);
              setTimeout(() => setCopied(false), 1600);
            }}
            className="btn-outline px-3 py-2.5 text-[0.62rem]"
          >
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Link href={`/admin/orders/${data.orderId}`} className="btn px-4 py-2.5 text-[0.65rem]">
            Open the order
          </Link>
          <Link href={`/admin/orders/${data.orderId}/invoice`} target="_blank" className="btn-outline px-4 py-2.5 text-[0.65rem]">
            Print invoice
          </Link>
          <Link href="/admin/orders/new" className="btn-ghost text-[0.65rem] text-muted">
            Create another
          </Link>
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────────── pickers ───────────────────────────── */

function ProductPickerModal({ open, onClose, onPick }: { open: boolean; onClose: () => void; onPick: (p: ProductPick, variantId: string) => void }) {
  const [q, setQ] = useState("");
  const [items, setItems] = useState<ProductPick[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    const t = setTimeout(() => {
      apiFetch<{ items: ProductPick[] }>(`/api/admin/products/search?q=${encodeURIComponent(q)}`)
        .then((r) => !cancelled && setItems(r.items))
        .catch(() => !cancelled && setItems([]))
        .finally(() => !cancelled && setLoading(false));
    }, q ? 280 : 0);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [q, open]);

  return (
    <Modal open={open} onClose={onClose} title="Add a product" description="Pick a variant to add it as a line item." className="max-w-2xl">
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search products by name, slug or SKU…" className="field-box mb-4" autoFocus />
      {loading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-5 w-5 animate-spin text-muted" />
        </div>
      ) : items.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted">No products found.</p>
      ) : (
        <ul className="divide-y divide-line">
          {items.map((p) => (
            <li key={p.id} className="py-3">
              <div className="flex items-start gap-3">
                {p.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.image} alt="" className="h-14 w-11 shrink-0 border border-line object-cover" />
                ) : (
                  <span className="h-14 w-11 shrink-0 border border-line bg-bone" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{p.name}</p>
                  <p className="text-xs text-muted">
                    {p.slug} · {formatMoney(p.price)}
                  </p>
                  {p.variants.length === 0 ? (
                    <p className="mt-1.5 text-xs text-warning">No variants yet — add one in the product editor.</p>
                  ) : (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {p.variants.map((v) => (
                        <button
                          key={v.id}
                          type="button"
                          onClick={() => onPick(p, v.id)}
                          className={cn(
                            "border px-2 py-1 text-xs transition",
                            v.stock <= 0 ? "border-danger/40 text-danger hover:bg-danger hover:text-paper" : "border-line hover:border-ink hover:bg-bone",
                            !v.isActive && "opacity-50",
                          )}
                          title={v.isActive ? `${v.stock} in stock` : "Inactive variant"}
                        >
                          {v.title} · {formatMoney(v.price)} · {v.stock}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}

function CustomerPickerModal({ open, onClose, onPick }: { open: boolean; onClose: () => void; onPick: (c: CustomerPick) => void }) {
  const [q, setQ] = useState("");
  const [items, setItems] = useState<CustomerPick[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || q.trim().length < 2) {
      setItems([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const t = setTimeout(() => {
      apiFetch<{ items: CustomerPick[] }>(`/api/admin/customers/search?q=${encodeURIComponent(q)}`)
        .then((r) => !cancelled && setItems(r.items))
        .catch(() => !cancelled && setItems([]))
        .finally(() => !cancelled && setLoading(false));
    }, 280);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [q, open]);

  return (
    <Modal open={open} onClose={onClose} title="Find a customer" description="Search by phone, name or email.">
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="01712…" className="field-box mb-4" autoFocus />
      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted" />
        </div>
      ) : items.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted">{q.length < 2 ? "Type at least two characters." : "No match — the order will create a new customer."}</p>
      ) : (
        <ul className="divide-y divide-line">
          {items.map((c) => (
            <li key={c.id}>
              <button type="button" onClick={() => onPick(c)} className="flex w-full items-center justify-between gap-3 py-3 text-left hover:bg-bone">
                <span className="min-w-0">
                  <span className="block truncate text-sm">{c.name}</span>
                  <span className="block truncate text-xs text-muted">
                    {c.phone ?? c.email ?? "—"} · {c.orders} order{c.orders === 1 ? "" : "s"}
                    {c.address ? ` · ${c.address.district}` : ""}
                  </span>
                </span>
                <span className="shrink-0 text-[0.62rem] uppercase tracking-[0.14em] text-oxide">Use</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}

export default ManualOrderForm;
