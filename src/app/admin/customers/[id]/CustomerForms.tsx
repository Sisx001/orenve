"use client";

import { CsrfInput } from "@/components/admin/Csrf";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Save, Trash2 } from "lucide-react";
import { Modal } from "@/components/ui";
import { CheckboxField, SelectField, SubmitButton, TextAreaField, TextField } from "@/components/admin/Fields";
import { deleteAddressAction, deleteCustomerAction, saveAddressAction, saveCustomerAction } from "@/lib/admin/actions/customers";
import { idleState } from "@/lib/admin/action-state";
import { BD_DISTRICTS } from "@/lib/constants";

export type AddressRow = {
  id: string;
  label: string;
  name: string;
  phone: string;
  line1: string;
  line2: string;
  city: string;
  district: string;
  postalCode: string;
  country: string;
  isDefault: boolean;
};

function useToast(state: { ok?: boolean; error?: string | null; message?: string | null }) {
  useEffect(() => {
    if (state.error) toast.error(state.error);
    else if (state.ok && state.message) toast.success(state.message);
  }, [state]);
}

export function CustomerDetailsForm({
  csrf,
  customer,
}: {
  csrf: string;
  customer: { id: string; name: string; phone: string; email: string; locale: string; notes: string; tags: string };
}) {
  const [state, action] = useActionState(saveCustomerAction, idleState);
  useToast(state);

  return (
    <form action={action} className="space-y-3">
      <CsrfInput value={csrf} />
      <input type="hidden" name="id" value={customer.id} />
      <TextField name="name" label="Name" defaultValue={customer.name} required error={state.fieldErrors?.name} />
      <div className="grid gap-3 sm:grid-cols-2">
        <TextField name="phone" label="Phone" defaultValue={customer.phone} hint="Used to match repeat orders." />
        <TextField name="email" type="email" label="Email" defaultValue={customer.email} />
      </div>
      <SelectField name="locale" label="Preferred language" defaultValue={customer.locale} options={[{ value: "en", label: "English" }, { value: "bn", label: "বাংলা" }]} />
      <TextField name="tags" label="Tags" defaultValue={customer.tags} placeholder="vip, wholesale, repeat" hint="Comma separated." />
      <TextAreaField name="notes" label="Private notes" defaultValue={customer.notes} inputClassName="min-h-[100px]" hint="Only staff see this." />
      <SubmitButton size="sm" pendingLabel="Saving…">
        <Save className="h-3.5 w-3.5" />
        Save customer
      </SubmitButton>
    </form>
  );
}

export function AddressBook({ csrf, customerId, addresses }: { csrf: string; customerId: string; addresses: AddressRow[] }) {
  const [state, action] = useActionState(saveAddressAction, idleState);
  const [delState, delAction] = useActionState(deleteAddressAction, idleState);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<AddressRow | null>(null);
  useToast(state);
  useToast(delState);

  useEffect(() => {
    if (state.ok) setOpen(false);
  }, [state.ok]);

  return (
    <div>
      {addresses.length === 0 ? (
        <p className="py-4 text-sm text-muted">No saved addresses.</p>
      ) : (
        <ul className="divide-y divide-line/70">
          {addresses.map((a) => (
            <li key={a.id} className="flex items-start justify-between gap-3 py-3 first:pt-0">
              <div className="min-w-0">
                <p className="text-sm">
                  {a.label || a.district}
                  {a.isDefault && <span className="ml-2 border border-oxide/40 bg-oxide/10 px-1.5 py-0.5 text-[0.55rem] uppercase tracking-[0.14em] text-oxide">Default</span>}
                </p>
                <p className="mt-0.5 text-xs text-muted">
                  {a.name} · {a.phone}
                </p>
                <p className="text-xs text-muted">{[a.line1, a.line2, a.city, a.district, a.postalCode].filter(Boolean).join(", ")}</p>
              </div>
              <div className="flex shrink-0 gap-1">
                <button
                  type="button"
                  onClick={() => {
                    setEditing(a);
                    setOpen(true);
                  }}
                  className="text-[0.62rem] uppercase tracking-[0.14em] text-oxide hover:underline"
                >
                  Edit
                </button>
                <form action={delAction}>
                  <CsrfInput value={csrf} />
                  <input type="hidden" name="addressId" value={a.id} />
                  <button
                    type="submit"
                    aria-label="Remove address"
                    onClick={(e) => {
                      if (!window.confirm("Remove this address?")) e.preventDefault();
                    }}
                    className="p-1 text-muted hover:text-danger"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}

      <button
        type="button"
        onClick={() => {
          setEditing(null);
          setOpen(true);
        }}
        className="btn-outline mt-4 px-4 py-2.5 text-[0.65rem]"
      >
        <Plus className="h-3.5 w-3.5" />
        Add address
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? "Edit address" : "Add address"}>
        <form action={action} className="space-y-3" key={editing?.id ?? "new"}>
          <CsrfInput value={csrf} />
          <input type="hidden" name="customerId" value={customerId} />
          {editing && <input type="hidden" name="addressId" value={editing.id} />}
          <input type="hidden" name="country" value={editing?.country ?? "BD"} />
          <TextField name="label" label="Label" defaultValue={editing?.label ?? ""} placeholder="Home, office…" />
          <div className="grid gap-3 sm:grid-cols-2">
            <TextField name="name" label="Recipient" defaultValue={editing?.name ?? ""} required />
            <TextField name="phone" label="Phone" defaultValue={editing?.phone ?? ""} required />
          </div>
          <TextField name="line1" label="Address line 1" defaultValue={editing?.line1 ?? ""} required />
          <TextField name="line2" label="Address line 2" defaultValue={editing?.line2 ?? ""} />
          <div className="grid gap-3 sm:grid-cols-3">
            <TextField name="city" label="City / area" defaultValue={editing?.city ?? ""} required />
            <SelectField
              name="district"
              label="District"
              defaultValue={editing?.district ?? ""}
              options={[{ value: "", label: "Select…" }, ...BD_DISTRICTS.map((d) => ({ value: d, label: d }))]}
            />
            <TextField name="postalCode" label="Postal code" defaultValue={editing?.postalCode ?? ""} />
          </div>
          <CheckboxField name="isDefault" label="Make this the default address" defaultChecked={editing?.isDefault ?? addresses.length === 0} />
          <div className="flex justify-end gap-2 border-t border-line pt-4">
            <button type="button" onClick={() => setOpen(false)} className="btn-outline px-4 py-2.5 text-[0.65rem]">
              Cancel
            </button>
            <SubmitButton size="sm" pendingLabel="Saving…">
              Save address
            </SubmitButton>
          </div>
        </form>
      </Modal>
    </div>
  );
}

export function DeleteCustomer({ csrf, customerId, orders }: { csrf: string; customerId: string; orders: number }) {
  const [state, action] = useActionState(deleteCustomerAction, idleState);
  useToast(state);
  return (
    <form action={action}>
      <CsrfInput value={csrf} />
      <input type="hidden" name="customerId" value={customerId} />
      <button
        type="submit"
        disabled={orders > 0}
        onClick={(e) => {
          if (!window.confirm("Delete this customer record?")) e.preventDefault();
        }}
        className="btn-ghost text-[0.65rem] text-danger disabled:opacity-40"
      >
        <Trash2 className="h-3.5 w-3.5" />
        Delete customer
      </button>
      {orders > 0 && <p className="mt-1 text-xs text-muted">Customers with orders cannot be deleted.</p>}
    </form>
  );
}
