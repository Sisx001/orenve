"use client";

import { CsrfInput } from "@/components/admin/Csrf";
import { useActionState, useEffect, type ReactNode } from "react";
import { toast } from "sonner";
import { AlertTriangle, Check, KeyRound, Save } from "lucide-react";
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
  bkash_checkout: boolean;
  nagad_checkout: boolean;
  sslcommerz: boolean;
  aamarpay: boolean;
  shurjopay: boolean;
  stripe: boolean;
  codFee: number;
  codMaxOrder: number;
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
type GatewayKey = "bkash" | "nagad" | "aamarpay" | "shurjopay" | "sslcommerz";
export type EnvStatus = Record<GatewayKey | "stripe" | "whatsapp" | "messenger", boolean>;

function Pill({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 border px-1.5 py-0.5 text-[0.55rem] font-semibold uppercase tracking-[0.12em]", ok ? "border-success/40 bg-success/10 text-success" : "border-warning/40 bg-warning/10 text-warning")}>
      {ok ? <Check className="h-2.5 w-2.5" /> : <AlertTriangle className="h-2.5 w-2.5" />}
      {label}
    </span>
  );
}

/** Credential input: blank keeps the saved value; typing __clear__ removes it. */
function Secret({ name, label, stored, hint, multiline }: { name: string; label: string; stored: boolean; hint?: string; multiline?: boolean }) {
  const common = { name, id: name, placeholder: stored ? "•••••••• saved — leave blank to keep" : "", autoComplete: "off" as const, className: "field-box font-mono text-xs" };
  return (
    <label className="block">
      <span className="mb-1 flex items-center gap-2 text-[0.6rem] font-semibold uppercase tracking-[0.14em] text-muted">
        <KeyRound className="h-3 w-3" /> {label}
        {stored && <span className="text-success">set</span>}
      </span>
      {multiline ? <textarea rows={3} {...common} /> : <input type="text" {...common} />}
      {hint && <span className="mt-1 block text-[0.68rem] text-muted">{hint}</span>}
    </label>
  );
}

function Gateway({ title, name, env, stored, sandbox, hint, children, enabled }: { title: ReactNode; name: GatewayKey; env: boolean; stored: boolean; sandbox: boolean; hint: string; children: ReactNode; enabled: boolean }) {
  return (
    <details className="group border border-line" open={enabled}>
      <summary className="flex cursor-pointer flex-wrap items-center gap-2 px-4 py-3 text-sm font-medium">
        {title}
        <Pill ok={stored || env} label={stored ? "studio keys" : env ? "env keys" : "no keys"} />
        <span className="ml-auto text-[0.6rem] uppercase tracking-[0.14em] text-muted group-open:hidden">configure</span>
      </summary>
      <div className="space-y-3 border-t border-line px-4 py-4">
        <p className="text-xs text-muted">{hint}</p>
        <ToggleRow name={`gw_${name}_sandbox`} label="Sandbox / test mode" hint="Turn off only when you have live credentials." defaultChecked={sandbox} />
        <div className="grid gap-3 sm:grid-cols-2">{children}</div>
      </div>
    </details>
  );
}

export function CheckoutForm({ values, env, stored, sandbox, prefixes, csrf }: { values: CheckoutValues; env: EnvStatus; stored: Record<GatewayKey, boolean>; sandbox: Record<GatewayKey, boolean>; prefixes: { shurjopay: string }; csrf: string }) {
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
            <ToggleRow name="whatsapp" label="WhatsApp ordering" hint={env.whatsapp ? "Opens WhatsApp with the cart pre-filled." : "Add a WhatsApp number under Contact channels first."} defaultChecked={values.whatsapp} />
            <ToggleRow name="messenger" label="Messenger ordering" hint={env.messenger ? "Opens m.me with a reference code." : "Add a Messenger page under Contact channels first."} defaultChecked={values.messenger} />
          </div>
        </Section>

        <Section title="Payment methods" description="Each method shows on the checkout only when it is on AND its keys are present.">
          <div className="divide-y divide-line/70">
            <ToggleRow name="cod" label="Cash on delivery" hint="Collected by the courier. Marked paid when the order is delivered." defaultChecked={values.cod} />
            <ToggleRow name="bkash" label="bKash — Send Money (manual)" hint="Customer sends money and submits the TrxID; you verify it in Orders." defaultChecked={values.bkash} />
            <ToggleRow name="nagad" label="Nagad — Send Money (manual)" hint="Same manual flow as bKash." defaultChecked={values.nagad} />
            <ToggleRow name="bkash_checkout" label={<span className="flex items-center gap-2">bKash Checkout API <Pill ok={stored.bkash || env.bkash} label={stored.bkash || env.bkash ? "keys ok" : "keys missing"} /></span>} hint="Tokenized Checkout — customer pays with PIN + OTP, verified automatically." defaultChecked={values.bkash_checkout} />
            <ToggleRow name="nagad_checkout" label={<span className="flex items-center gap-2">Nagad Payment API <Pill ok={stored.nagad || env.nagad} label={stored.nagad || env.nagad ? "keys ok" : "keys missing"} /></span>} hint="Nagad merchant gateway with RSA-signed requests." defaultChecked={values.nagad_checkout} />
            <ToggleRow name="sslcommerz" label={<span className="flex items-center gap-2">SSLCommerz <Pill ok={stored.sslcommerz || env.sslcommerz} label={stored.sslcommerz || env.sslcommerz ? "keys ok" : "keys missing"} /></span>} hint="Cards, bKash, Nagad, Rocket, net banking in one page." defaultChecked={values.sslcommerz} />
            <ToggleRow name="aamarpay" label={<span className="flex items-center gap-2">aamarPay <Pill ok={stored.aamarpay || env.aamarpay} label={stored.aamarpay || env.aamarpay ? "keys ok" : "keys missing"} /></span>} hint="Aggregator: cards + mobile wallets." defaultChecked={values.aamarpay} />
            <ToggleRow name="shurjopay" label={<span className="flex items-center gap-2">shurjoPay <Pill ok={stored.shurjopay || env.shurjopay} label={stored.shurjopay || env.shurjopay ? "keys ok" : "keys missing"} /></span>} hint="Aggregator: cards + mobile wallets." defaultChecked={values.shurjopay} />
            <ToggleRow name="stripe" label={<span className="flex items-center gap-2">Stripe <Pill ok={env.stripe} label={env.stripe ? "env configured" : "env missing"} /></span>} hint="International cards. Needs STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET in the environment." defaultChecked={values.stripe} />
          </div>
          <div className="mt-4 grid gap-4 border-t border-line pt-4 sm:grid-cols-2">
            <MoneyInput name="codFee" label="COD handling fee" defaultMinor={values.codFee} hint="Added to cash-on-delivery orders. 0 = none." />
            <MoneyInput name="codMaxOrder" label="COD maximum order value" defaultMinor={values.codMaxOrder} hint="Hide COD above this total. 0 = no cap." />
          </div>
        </Section>

        <Section title="Mobile money numbers" description="Shown to the customer when they choose manual bKash or Nagad.">
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField name="bkashNumber" label="bKash number" defaultValue={values.bkashNumber} placeholder="01XXXXXXXXX" />
            <TextField name="nagadNumber" label="Nagad number" defaultValue={values.nagadNumber} placeholder="01XXXXXXXXX" />
          </div>
          <I18nInput name="mfsInstructions" label="Payment instructions" en={values.mfsInstructionsEn} bn={values.mfsInstructionsBn} multiline rows={3} layout="stack" className="mt-4" hint="Tell the customer exactly what to do and how long verification takes." />
        </Section>
      </div>

      <div className="space-y-5">
        <Section title="Gateway credentials" description="Stored server-side only. Blank fields keep the saved value; type __clear__ to remove one.">
          <div className="space-y-3">
            <Gateway title="bKash Checkout" name="bkash" env={env.bkash} stored={stored.bkash} sandbox={sandbox.bkash} enabled={values.bkash_checkout} hint="From merchant.bka.sh → API credentials (app key, app secret, username, password).">
              <Secret name="gw_bkash_appKey" label="App key" stored={stored.bkash} />
              <Secret name="gw_bkash_appSecret" label="App secret" stored={stored.bkash} />
              <Secret name="gw_bkash_username" label="Username" stored={stored.bkash} />
              <Secret name="gw_bkash_password" label="Password" stored={stored.bkash} />
            </Gateway>
            <Gateway title="Nagad" name="nagad" env={env.nagad} stored={stored.nagad} sandbox={sandbox.nagad} enabled={values.nagad_checkout} hint="From the Nagad merchant portal. Paste keys as PEM or single-line base64.">
              <Secret name="gw_nagad_merchantId" label="Merchant ID" stored={stored.nagad} />
              <Secret name="gw_nagad_merchantNumber" label="Merchant number" stored={stored.nagad} />
              <Secret name="gw_nagad_merchantPrivateKey" label="Merchant private key" stored={stored.nagad} multiline />
              <Secret name="gw_nagad_pgPublicKey" label="Nagad public key" stored={stored.nagad} multiline />
            </Gateway>
            <Gateway title="SSLCommerz" name="sslcommerz" env={env.sslcommerz} stored={stored.sslcommerz} sandbox={sandbox.sslcommerz} enabled={values.sslcommerz} hint="Store ID and store password from the SSLCommerz merchant panel.">
              <Secret name="gw_sslcommerz_storeId" label="Store ID" stored={stored.sslcommerz} />
              <Secret name="gw_sslcommerz_storePassword" label="Store password" stored={stored.sslcommerz} />
            </Gateway>
            <Gateway title="aamarPay" name="aamarpay" env={env.aamarpay} stored={stored.aamarpay} sandbox={sandbox.aamarpay} enabled={values.aamarpay} hint="Sandbox store aamarpaytest works for testing.">
              <Secret name="gw_aamarpay_storeId" label="Store ID" stored={stored.aamarpay} />
              <Secret name="gw_aamarpay_signatureKey" label="Signature key" stored={stored.aamarpay} />
            </Gateway>
            <Gateway title="shurjoPay" name="shurjopay" env={env.shurjopay} stored={stored.shurjopay} sandbox={sandbox.shurjopay} enabled={values.shurjopay} hint="Store username/password and the merchant prefix shared by shurjoPay.">
              <Secret name="gw_shurjopay_username" label="Username" stored={stored.shurjopay} />
              <Secret name="gw_shurjopay_password" label="Password" stored={stored.shurjopay} />
              <TextField name="gw_shurjopay_prefix" label="Order prefix" defaultValue={prefixes.shurjopay} />
            </Gateway>
          </div>
        </Section>

        <Section title="Checkout behaviour">
          <div className="divide-y divide-line/70">
            <ToggleRow name="guestCheckout" label="Guest checkout" hint="No account needed — recommended." defaultChecked={values.guestCheckout} />
            <ToggleRow name="requireEmail" label="Require an email address" hint="Off means phone only, which suits Bangladesh." defaultChecked={values.requireEmail} />
            <ToggleRow name="notesEnabled" label="Order notes field" hint="Let customers add delivery instructions." defaultChecked={values.notesEnabled} />
            <ToggleRow name="autoConfirmCod" label="Auto-confirm cash-on-delivery orders" hint="Skips the pending step. Leave off if you call to confirm." defaultChecked={values.autoConfirmCod} />
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
              <li><code className="font-mono text-ink">{"{items}"}</code> — each line as “2 × The Oxide Overshirt (M / Onyx) — ৳8,900”</li>
              <li><code className="font-mono text-ink">{"{subtotal}"}</code> — cart subtotal in the customer&apos;s currency</li>
              <li><code className="font-mono text-ink">{"{reference}"}</code> — short code so you can match the chat to the cart</li>
              <li><code className="font-mono text-ink">{"{notes}"}</code> — anything the customer typed</li>
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
