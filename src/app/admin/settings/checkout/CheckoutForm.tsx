"use client";

import { CsrfInput } from "@/components/admin/Csrf";
import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { AlertTriangle, Check, Save } from "lucide-react";
import { FormBanner, I18nInput, MoneyInput, SubmitButton, TextField, ToggleRow } from "@/components/admin/Fields";
import { Section } from "@/components/admin/PageHeader";
import { saveCheckoutAction } from "@/lib/admin/actions/settings";
import { idleState } from "@/lib/admin/action-state";
import { cn } from "@/lib/utils";

export type CheckoutValues = {
  whatsapp: boolean;
  messenger: boolean;
  website: boolean;
  cod: boolean;
  bkash: boolean;
  nagad: boolean;
  sslcommerz: boolean;
  stripe: boolean;
  bkashNumber: string;
  nagadNumber: string;
  mfsInstructionsEn: string;
  mfsInstructionsBn: string;
  requireEmail: boolean;
  guestCheckout: boolean;
  minOrder: number;
  notesEnabled: boolean;
  whatsappTemplateEn: string;
  whatsappTemplateBn: string;
  autoConfirmCod: boolean;
};

export type EnvStatus = { sslcommerz: boolean; stripe: boolean; whatsapp: boolean; messenger: boolean };

function EnvPill({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 border px-1.5 py-0.5 text-[0.55rem] font-semibold uppercase tracking-[0.12em]",
        ok ? "border-success/40 bg-success/10 text-success" : "border-warning/40 bg-warning/10 text-warning",
      )}
    >
      {ok ? <Check className="h-2.5 w-2.5" /> : <AlertTriangle className="h-2.5 w-2.5" />}
      {label}
    </span>
  );
}

export function CheckoutForm({ values, env, csrf }: { values: CheckoutValues; env: EnvStatus; csrf: string }) {
  const [state, action] = useActionState(saveCheckoutAction, idleState);
  useEffect(() => {
    if (state.error) toast.error(state.error);
    else if (state.ok && state.message) toast.success(state.message);
  }, [state]);

  return (
    <form action={action} className="grid gap-5 xl:grid-cols-2">
      <CsrfInput value={csrf} />

      <div className="space-y-5">
        <Section title="Order channels" description="Where customers can place an order.">
          <FormBanner state={state} />
          <div className="divide-y divide-line/70">
            <ToggleRow name="website" label="On-site checkout" hint="The full checkout form on the website." defaultChecked={values.website} />
            <ToggleRow
              name="whatsapp"
              label="WhatsApp ordering"
              hint={env.whatsapp ? "Opens WhatsApp with the cart pre-filled." : "Add a WhatsApp number under Contact channels first."}
              defaultChecked={values.whatsapp}
            />
            <ToggleRow
              name="messenger"
              label="Messenger ordering"
              hint={env.messenger ? "Opens m.me with a reference code." : "Add a Messenger page under Contact channels first."}
              defaultChecked={values.messenger}
            />
          </div>
        </Section>

        <Section title="Payment methods">
          <div className="divide-y divide-line/70">
            <ToggleRow name="cod" label="Cash on delivery" hint="Collected by the courier. Marked paid when you set the order to delivered." defaultChecked={values.cod} />
            <ToggleRow name="bkash" label="bKash (manual)" hint="Customer sends money and submits the TrxID; you verify it in Orders." defaultChecked={values.bkash} />
            <ToggleRow name="nagad" label="Nagad (manual)" hint="Same manual flow as bKash." defaultChecked={values.nagad} />
            <ToggleRow
              name="sslcommerz"
              label={
                <span className="flex flex-wrap items-center gap-2">
                  SSLCOMMERZ <EnvPill ok={env.sslcommerz} label={env.sslcommerz ? "env configured" : "env missing"} />
                </span>
              }
              hint="Cards, mobile banking and net banking. Needs SSLCOMMERZ_STORE_ID and SSLCOMMERZ_STORE_PASSWORD."
              defaultChecked={values.sslcommerz}
            />
            <ToggleRow
              name="stripe"
              label={
                <span className="flex flex-wrap items-center gap-2">
                  Stripe <EnvPill ok={env.stripe} label={env.stripe ? "env configured" : "env missing"} />
                </span>
              }
              hint="International cards. Needs STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET."
              defaultChecked={values.stripe}
            />
          </div>
        </Section>

        <Section title="Mobile money numbers" description="Shown to the customer when they choose bKash or Nagad.">
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField name="bkashNumber" label="bKash number" defaultValue={values.bkashNumber} placeholder="01XXXXXXXXX" />
            <TextField name="nagadNumber" label="Nagad number" defaultValue={values.nagadNumber} placeholder="01XXXXXXXXX" />
          </div>
          <I18nInput
            name="mfsInstructions"
            label="Payment instructions"
            en={values.mfsInstructionsEn}
            bn={values.mfsInstructionsBn}
            multiline
            rows={3}
            layout="stack"
            className="mt-4"
            hint="Tell the customer exactly what to do and how long verification takes."
          />
        </Section>
      </div>

      <div className="space-y-5">
        <Section title="Checkout behaviour">
          <div className="divide-y divide-line/70">
            <ToggleRow name="guestCheckout" label="Guest checkout" hint="No account needed — recommended." defaultChecked={values.guestCheckout} />
            <ToggleRow name="requireEmail" label="Require an email address" hint="Off means phone only, which suits Bangladesh." defaultChecked={values.requireEmail} />
            <ToggleRow name="notesEnabled" label="Order notes field" hint="Let customers add delivery instructions." defaultChecked={values.notesEnabled} />
            <ToggleRow
              name="autoConfirmCod"
              label="Auto-confirm cash-on-delivery orders"
              hint="Skips the pending step. Leave off if you call to confirm."
              defaultChecked={values.autoConfirmCod}
            />
          </div>
          <div className="mt-4 border-t border-line pt-4">
            <MoneyInput name="minOrder" label="Minimum order value" defaultMinor={values.minOrder} hint="Set 0 for no minimum." />
          </div>
        </Section>

        <Section title="WhatsApp message template" description="Sent as the pre-filled message when a customer orders over WhatsApp.">
          <I18nInput name="whatsappTemplate" label="Template" en={values.whatsappTemplateEn} bn={values.whatsappTemplateBn} multiline rows={8} layout="stack" />
          <div className="mt-3 border border-line bg-bone/60 p-3">
            <p className="mb-1.5 text-[0.6rem] font-semibold uppercase tracking-[0.14em] text-muted">Placeholders</p>
            <ul className="space-y-0.5 text-xs text-muted">
              <li>
                <code className="font-mono text-ink">{"{items}"}</code> — each line as “2 × The Oxide Overshirt (M / Onyx) — ৳8,900”
              </li>
              <li>
                <code className="font-mono text-ink">{"{subtotal}"}</code> — cart subtotal in the customer&apos;s currency
              </li>
              <li>
                <code className="font-mono text-ink">{"{reference}"}</code> — short code so you can match the chat to the cart
              </li>
              <li>
                <code className="font-mono text-ink">{"{notes}"}</code> — anything the customer typed
              </li>
            </ul>
          </div>
        </Section>

        <Section title="">
          <SubmitButton className="w-full" pendingLabel="Saving…">
            <Save className="h-3.5 w-3.5" />
            Save checkout & payments
          </SubmitButton>
        </Section>
      </div>
    </form>
  );
}

export default CheckoutForm;
