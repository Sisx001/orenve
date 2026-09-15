"use client";

import { CsrfInput } from "@/components/admin/Csrf";
import { useActionState, useEffect, type ReactNode } from "react";
import { toast } from "sonner";
import { AlertTriangle, Check, KeyRound, Save } from "lucide-react";
import { FormBanner, SelectField, SubmitButton, TextField, ToggleRow } from "@/components/admin/Fields";
import { Section } from "@/components/admin/PageHeader";
import { saveCourierAction } from "@/lib/admin/actions/settings";
import { idleState } from "@/lib/admin/action-state";
import { cn } from "@/lib/utils";

type Provider = "pathao" | "steadfast" | "redx" | "paperfly";
export type CourierValues = {
  defaultProvider: string;
  autoBookOnConfirm: boolean;
  autoSyncMinutes: number;
  defaultWeightKg: number;
  manualCouriers: string;
  pathao: { enabled: boolean; sandbox: boolean; baseUrl: string; storeId: string };
  steadfast: { enabled: boolean; baseUrl: string };
  redx: { enabled: boolean; sandbox: boolean; baseUrl: string; pickupStoreId: string };
  paperfly: { enabled: boolean; baseUrl: string };
};

function Pill({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 border px-1.5 py-0.5 text-[0.55rem] font-semibold uppercase tracking-[0.12em]", ok ? "border-success/40 bg-success/10 text-success" : "border-warning/40 bg-warning/10 text-warning")}>
      {ok ? <Check className="h-2.5 w-2.5" /> : <AlertTriangle className="h-2.5 w-2.5" />}
      {label}
    </span>
  );
}
function Secret({ name, label, stored }: { name: string; label: string; stored: boolean }) {
  return (
    <label className="block">
      <span className="mb-1 flex items-center gap-2 text-[0.6rem] font-semibold uppercase tracking-[0.14em] text-muted">
        <KeyRound className="h-3 w-3" /> {label} {stored && <span className="text-success">set</span>}
      </span>
      <input type="text" name={name} autoComplete="off" placeholder={stored ? "•••••••• saved — leave blank to keep" : ""} className="field-box font-mono text-xs" />
    </label>
  );
}
function Card({ title, name, enabled, keysOk, hint, children }: { title: string; name: Provider; enabled: boolean; keysOk: boolean; hint: string; children: ReactNode }) {
  return (
    <details className="group border border-line" open={enabled}>
      <summary className="flex cursor-pointer flex-wrap items-center gap-2 px-4 py-3 text-sm font-medium">
        {title} <Pill ok={keysOk} label={keysOk ? "keys ok" : "keys missing"} />
        <span className="ml-auto text-[0.6rem] uppercase tracking-[0.14em] text-muted group-open:hidden">configure</span>
      </summary>
      <div className="space-y-3 border-t border-line px-4 py-4">
        <p className="text-xs text-muted">{hint}</p>
        <ToggleRow name={`${name}_enabled`} label="Enabled" hint="Show this courier when booking from an order." defaultChecked={enabled} />
        <div className="grid gap-3 sm:grid-cols-2">{children}</div>
      </div>
    </details>
  );
}

export function CourierForm({ values, env, stored, csrf, cronConfigured }: { values: CourierValues; env: Record<Provider, boolean>; stored: Record<Provider, boolean>; csrf: string; cronConfigured: boolean }) {
  const [state, action] = useActionState(saveCourierAction, idleState);
  useEffect(() => {
    if (state.error) toast.error(state.error);
    else if (state.ok && state.message) toast.success(state.message);
  }, [state]);

  return (
    <form action={action} className="grid gap-5 xl:grid-cols-2">
      <CsrfInput value={csrf} />
      <div className="space-y-5">
        <Section title="Behaviour">
          <FormBanner state={state} />
          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField name="defaultProvider" label="Default courier" defaultValue={values.defaultProvider} options={[{ value: "manual", label: "Manual entry" }, { value: "pathao", label: "Pathao" }, { value: "steadfast", label: "Steadfast" }, { value: "redx", label: "RedX" }, { value: "paperfly", label: "Paperfly" }]} />
            <TextField name="defaultWeightKg" label="Default parcel weight (kg)" defaultValue={String(values.defaultWeightKg)} inputMode="decimal" />
            <TextField name="autoSyncMinutes" label="Auto-sync status every (minutes)" defaultValue={String(values.autoSyncMinutes)} inputMode="numeric" hint={cronConfigured ? "CRON_SECRET is set — point your scheduler at /api/cron/sync-shipments?key=…" : "Set CRON_SECRET in the environment and schedule GET /api/cron/sync-shipments?key=… (Vercel Cron, cPanel cron, GitHub Actions). 0 = manual sync only."} />
            <TextField name="manualCouriers" label="Manual courier names" defaultValue={values.manualCouriers} hint="Comma separated. Offered when recording a shipment by hand." />
          </div>
          <div className="mt-4 border-t border-line pt-3">
            <ToggleRow name="autoBookOnConfirm" label="Auto-book with the default courier when an order is confirmed" hint="Only for API couriers. You can still review the consignment on the order screen." defaultChecked={values.autoBookOnConfirm} />
          </div>
        </Section>
        <Section title="">
          <SubmitButton className="w-full" pendingLabel="Saving…">
            <Save className="h-3.5 w-3.5" /> Save couriers
          </SubmitButton>
        </Section>
      </div>

      <div className="space-y-3">
        <Card title="Pathao" name="pathao" enabled={values.pathao.enabled} keysOk={stored.pathao || env.pathao} hint="merchant.pathao.com → Developers. Needs client id/secret, your merchant login, and a store id (Pathao::stores).">
          <ToggleRow name="pathao_sandbox" label="Sandbox" hint="courier-api-sandbox.pathao.com" defaultChecked={values.pathao.sandbox} />
          <TextField name="pathao_storeId" label="Store ID" defaultValue={values.pathao.storeId} />
          <Secret name="pathao_clientId" label="Client ID" stored={stored.pathao} />
          <Secret name="pathao_clientSecret" label="Client secret" stored={stored.pathao} />
          <Secret name="pathao_username" label="Merchant username (email)" stored={stored.pathao} />
          <Secret name="pathao_password" label="Merchant password" stored={stored.pathao} />
          <TextField name="pathao_baseUrl" label="Custom base URL (optional)" defaultValue={values.pathao.baseUrl} className="sm:col-span-2" />
        </Card>
        <Card title="Steadfast" name="steadfast" enabled={values.steadfast.enabled} keysOk={stored.steadfast || env.steadfast} hint="steadfast.com.bd → API settings. Api-Key and Secret-Key.">
          <Secret name="steadfast_apiKey" label="API key" stored={stored.steadfast} />
          <Secret name="steadfast_secretKey" label="Secret key" stored={stored.steadfast} />
          <TextField name="steadfast_baseUrl" label="Custom base URL (optional)" defaultValue={values.steadfast.baseUrl} className="sm:col-span-2" />
        </Card>
        <Card title="RedX" name="redx" enabled={values.redx.enabled} keysOk={stored.redx || env.redx} hint="redx.com.bd → Developer API. Access token plus your pickup store id.">
          <ToggleRow name="redx_sandbox" label="Sandbox" hint="sandbox.redx.com.bd" defaultChecked={values.redx.sandbox} />
          <TextField name="redx_pickupStoreId" label="Pickup store ID" defaultValue={values.redx.pickupStoreId} />
          <Secret name="redx_accessToken" label="Access token" stored={stored.redx} />
          <TextField name="redx_baseUrl" label="Custom base URL (optional)" defaultValue={values.redx.baseUrl} />
        </Card>
        <Card title="Paperfly" name="paperfly" enabled={values.paperfly.enabled} keysOk={stored.paperfly || env.paperfly} hint="Merchant API credentials from your Paperfly account manager.">
          <Secret name="paperfly_username" label="Username" stored={stored.paperfly} />
          <Secret name="paperfly_password" label="Password" stored={stored.paperfly} />
          <Secret name="paperfly_merchantKey" label="Merchant key" stored={stored.paperfly} />
          <TextField name="paperfly_baseUrl" label="Custom base URL (optional)" defaultValue={values.paperfly.baseUrl} />
        </Card>
      </div>
    </form>
  );
}
export default CourierForm;
