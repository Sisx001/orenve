"use client";

import { CsrfInput } from "@/components/admin/Csrf";
import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, Globe, Hammer, Rocket, Save } from "lucide-react";
import { I18nInput, SubmitButton, TextAreaField, TextField } from "@/components/admin/Fields";
import { MediaField } from "@/components/admin/MediaPicker";
import { Section } from "@/components/admin/PageHeader";
import { saveSiteAction } from "@/lib/admin/actions/settings";
import { idleState } from "@/lib/admin/action-state";
import { cn } from "@/lib/utils";

export type SiteValues = {
  mode: string;
  maintenanceTitleEn: string;
  maintenanceTitleBn: string;
  maintenanceMessageEn: string;
  maintenanceMessageBn: string;
  launchDate: string;
  maintenanceImage: string;
  allowlistIps: string[];
};

const MODES = [
  { value: "live", label: "Live", icon: Globe, hint: "The shop is open. Orders can be placed." },
  { value: "maintenance", label: "Maintenance", icon: Hammer, hint: "A holding page. Checkout is refused." },
  { value: "coming_soon", label: "Coming soon", icon: Rocket, hint: "A countdown page with email capture." },
] as const;

export function SiteForm({ values, csrf, yourIp }: { values: SiteValues; csrf: string; yourIp: string }) {
  const [state, action] = useActionState(saveSiteAction, idleState);
  const [mode, setMode] = useState(values.mode);

  useEffect(() => {
    if (state.error) toast.error(state.error);
    else if (state.ok && state.message) toast.success(state.message);
  }, [state]);

  return (
    <form action={action} className="space-y-5">
      <CsrfInput value={csrf} />
      <input type="hidden" name="mode" value={mode} />

      <Section title="Site mode">
        <ul className="grid gap-3 sm:grid-cols-3">
          {MODES.map((m) => {
            const Icon = m.icon;
            const active = mode === m.value;
            return (
              <li key={m.value}>
                <button
                  type="button"
                  onClick={() => setMode(m.value)}
                  aria-pressed={active}
                  className={cn("w-full border p-4 text-left transition", active ? "border-oxide bg-oxide/5" : "border-line hover:border-ink")}
                >
                  <Icon className={cn("h-4 w-4", active ? "text-oxide" : "text-muted")} />
                  <p className="mt-2.5 text-sm font-medium">{m.label}</p>
                  <p className="mt-0.5 text-xs text-muted">{m.hint}</p>
                </button>
              </li>
            );
          })}
        </ul>
        {mode !== "live" && (
          <p className="mt-4 flex items-start gap-2 border border-warning/40 bg-warning/10 px-3 py-2.5 text-xs text-warning">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            While the site is not live, visitors see the holding page and checkout refuses new orders. The studio stays reachable.
          </p>
        )}
      </Section>

      <div className="grid gap-5 lg:grid-cols-2">
        <Section title="Holding page" description="Shown for maintenance and coming-soon modes.">
          <I18nInput name="maintenanceTitle" label="Headline" en={values.maintenanceTitleEn} bn={values.maintenanceTitleBn} layout="stack" />
          <I18nInput
            name="maintenanceMessage"
            label="Message"
            en={values.maintenanceMessageEn}
            bn={values.maintenanceMessageBn}
            multiline
            rows={3}
            layout="stack"
            className="mt-4"
          />
          <TextField
            name="launchDate"
            type="datetime-local"
            label="Launch date & time"
            defaultValue={values.launchDate ? values.launchDate.slice(0, 16) : ""}
            className="mt-4"
            hint="Drives the countdown on the coming-soon page. Leave empty to hide it."
          />
          <div className="mt-4">
            <MediaField name="maintenanceImage" label="Background image" defaultValue={values.maintenanceImage} folder="brand" />
          </div>
        </Section>

        <Section title="Preview access" description="IP addresses that see the real storefront even while it is closed.">
          <TextAreaField
            name="allowlistIps"
            label="Allowed IP addresses"
            defaultValue={values.allowlistIps.join("\n")}
            inputClassName="min-h-[120px] font-mono text-xs"
            hint="One per line, or comma separated."
          />
          <div className="mt-3 border border-line bg-bone/60 px-3 py-2.5">
            <p className="text-[0.6rem] uppercase tracking-[0.14em] text-muted">Your current IP</p>
            <p className="mt-0.5 font-mono text-sm">{yourIp}</p>
          </div>
        </Section>
      </div>

      <div className="flex justify-end">
        <SubmitButton pendingLabel="Saving…">
          <Save className="h-3.5 w-3.5" />
          Save site mode
        </SubmitButton>
      </div>
    </form>
  );
}

export default SiteForm;
