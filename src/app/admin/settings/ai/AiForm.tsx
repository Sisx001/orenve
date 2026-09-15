"use client";

import { CsrfInput } from "@/components/admin/Csrf";
import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Check, Loader2, Save, X, Zap } from "lucide-react";
import { Field, FormBanner, I18nInput, SelectField, SubmitButton, TextAreaField, TextField, ToggleRow } from "@/components/admin/Fields";
import { Section } from "@/components/admin/PageHeader";
import { clearAiKeyAction, saveAiAction } from "@/lib/admin/actions/settings";
import { idleState } from "@/lib/admin/action-state";
import { AI_PRESETS } from "@/lib/admin/constants";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";

export type AiValues = {
  enabled: boolean;
  baseUrl: string;
  model: string;
  hasKey: boolean;
  envKey: boolean;
  temperature: number;
  maxTokens: number;
  assistantNameEn: string;
  assistantNameBn: string;
  greetingEn: string;
  greetingBn: string;
  extraInstructions: string;
  allowProductSearch: boolean;
  allowOrderLookup: boolean;
  requirePhoneForOrder: boolean;
  maxMessagesPerSession: number;
  rateLimitPerHour: number;
  logConversations: boolean;
  handoffWhatsapp: boolean;
};

type TestResult = { ok: boolean; message: string; latencyMs: number; model: string; usingEnvKey: boolean };

const GUIDANCE = `Write what only you know. The concierge already has your products, stock, prices, delivery zones, order statuses and published policy pages.

Good things to add:
• Fit advice — "our overshirts run one size large; if between sizes take the smaller"
• Fabric detail your description skips — "the 340gsm twill softens after three washes"
• Exchange practicalities — "exchanges within 7 days in Dhaka, courier collects"
• House rules — "we never ask for a full advance on cash-on-delivery"
• Tone — "warm but brief; never use exclamation marks"

Avoid: prices, stock numbers or delivery rates (it reads those live), and anything you would not want repeated to a stranger.`;

export function AiForm({ values, csrf }: { values: AiValues; csrf: string }) {
  const [state, action] = useActionState(saveAiAction, idleState);
  const [clearState, clearAction] = useActionState(clearAiKeyAction, idleState);
  const [baseUrl, setBaseUrl] = useState(values.baseUrl);
  const [model, setModel] = useState(values.model);
  const [apiKey, setApiKey] = useState("");
  const [preset, setPreset] = useState("custom");
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<TestResult | null>(null);

  useEffect(() => {
    if (state.error) toast.error(state.error);
    else if (state.ok && state.message) toast.success(state.message);
  }, [state]);
  useEffect(() => {
    if (clearState.error) toast.error(clearState.error);
    else if (clearState.ok && clearState.message) toast.success(clearState.message);
  }, [clearState]);

  // Match the saved connection back to a preset so the dropdown reflects reality.
  useEffect(() => {
    const found = AI_PRESETS.find((p) => p.baseUrl && p.baseUrl === values.baseUrl);
    if (found) setPreset(found.value);
  }, [values.baseUrl]);

  const applyPreset = (value: string) => {
    setPreset(value);
    const p = AI_PRESETS.find((x) => x.value === value);
    if (!p || p.value === "custom") return;
    setBaseUrl(p.baseUrl);
    setModel(p.model);
  };

  const runTest = async () => {
    setTesting(true);
    setResult(null);
    try {
      const res = await apiFetch<{ result: TestResult }>("/api/admin/ai/test", {
        method: "POST",
        json: { baseUrl, model, apiKey: apiKey || undefined },
      });
      setResult(res.result);
      if (res.result.ok) toast.success(`Connected in ${res.result.latencyMs} ms.`);
      else toast.error("The provider rejected the request.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not reach the provider.");
    } finally {
      setTesting(false);
    }
  };

  return (
    <form action={action} className="grid gap-5 xl:grid-cols-3">
      <CsrfInput value={csrf} />

      <div className="space-y-5 xl:col-span-2">
        <Section title="Connection" description="Any OpenAI-compatible chat completions endpoint.">
          <FormBanner state={state} />
          <div className="divide-y divide-line/70">
            <ToggleRow name="enabled" label="Concierge enabled" hint="Also needs the AI concierge feature switched on under Features." defaultChecked={values.enabled} />
          </div>

          <SelectField
            label="Provider preset"
            value={preset}
            onChange={(e) => applyPreset(e.target.value)}
            options={AI_PRESETS.map((p) => ({ value: p.value, label: p.label }))}
            className="mt-4"
            hint="Picking a preset fills the base URL and a sensible model. You can edit both."
          />

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <TextField name="baseUrl" label="Base URL" value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="https://api.deepseek.com/v1" inputClassName="font-mono text-xs" />
            <TextField name="model" label="Model" value={model} onChange={(e) => setModel(e.target.value)} placeholder="deepseek-chat" inputClassName="font-mono text-xs" />
          </div>

          <Field
            label="API key"
            hint={
              values.hasKey
                ? "A key is stored. Leave this empty to keep it, or paste a new one to replace it."
                : values.envKey
                  ? "No key stored here — AI_API_KEY from the environment will be used."
                  : "Paste the provider key. It is stored server-side and never sent to the browser."
            }
            className="mt-4"
          >
            <div className="flex flex-wrap items-center gap-2">
              <input
                name="apiKey"
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                autoComplete="off"
                placeholder={values.hasKey ? "••••••••••  configured" : values.envKey ? "using AI_API_KEY from env" : "sk-…"}
                className="field-box flex-1 font-mono text-xs"
              />
              {values.hasKey && (
                <span className="inline-flex items-center gap-1 border border-success/40 bg-success/10 px-2 py-1 text-[0.58rem] font-semibold uppercase tracking-[0.12em] text-success">
                  <Check className="h-2.5 w-2.5" />
                  Configured
                </span>
              )}
            </div>
          </Field>

          <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-line pt-4">
            <button type="button" onClick={runTest} disabled={testing} className="btn-outline px-4 py-2.5 text-[0.65rem]">
              {testing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
              Test connection
            </button>
            {result && (
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 border px-2.5 py-1.5 text-xs",
                  result.ok ? "border-success/40 bg-success/10 text-success" : "border-danger/40 bg-danger/10 text-danger",
                )}
              >
                {result.ok ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                {result.ok ? `${result.model} replied “${result.message}” in ${result.latencyMs} ms` : result.message}
              </span>
            )}
            {values.hasKey && (
              <button
                type="submit"
                formAction={clearAction}
                onClick={(e) => {
                  if (!window.confirm("Remove the stored API key?")) e.preventDefault();
                }}
                className="btn-ghost text-[0.62rem] text-danger"
              >
                Remove stored key
              </button>
            )}
          </div>
          {result && !result.ok && (
            <p className="mt-2 text-xs text-muted">
              Common causes: wrong base URL (it must end in <span className="font-mono">/v1</span>), a model name the provider does not offer, or an expired key.
            </p>
          )}
        </Section>

        <Section title="Voice">
          <I18nInput name="assistantName" label="Assistant name" en={values.assistantNameEn} bn={values.assistantNameBn} layout="stack" />
          <I18nInput name="greeting" label="Opening greeting" en={values.greetingEn} bn={values.greetingBn} multiline rows={3} layout="stack" className="mt-4" />
        </Section>

        <Section title="Owner notes" description="Extra knowledge and tone, injected into every conversation.">
          <TextAreaField
            name="extraInstructions"
            defaultValue={values.extraInstructions}
            inputClassName="min-h-[200px] text-sm leading-relaxed"
            placeholder="Our overshirts run one size large — if a customer is between sizes, suggest the smaller."
          />
          <details className="mt-3 border border-line bg-bone/50 p-3">
            <summary className="cursor-pointer text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-muted">What should go here?</summary>
            <p className="mt-2.5 whitespace-pre-line text-xs leading-relaxed text-muted">{GUIDANCE}</p>
          </details>
        </Section>
      </div>

      <div className="space-y-5">
        <Section title="Capabilities">
          <div className="divide-y divide-line/70">
            <ToggleRow name="allowProductSearch" label="Product search" hint="Let it look up products, sizes, colours and stock." defaultChecked={values.allowProductSearch} />
            <ToggleRow name="allowOrderLookup" label="Order lookup" hint="Let it read order status and the public timeline." defaultChecked={values.allowOrderLookup} />
            <ToggleRow
              name="requirePhoneForOrder"
              label="Require phone to reveal an order"
              hint="Strongly recommended — order number alone is not proof of identity."
              defaultChecked={values.requirePhoneForOrder}
            />
            <ToggleRow name="handoffWhatsapp" label="Offer WhatsApp hand-off" hint="Shows a “talk to a human” link when it cannot help." defaultChecked={values.handoffWhatsapp} />
            <ToggleRow name="logConversations" label="Log conversations" hint="Needed for the Concierge review screen." defaultChecked={values.logConversations} />
          </div>
        </Section>

        <Section title="Limits">
          <div className="space-y-4">
            <TextField
              name="temperature"
              label="Temperature"
              type="number"
              min={0}
              max={1}
              step={0.1}
              defaultValue={String(values.temperature)}
              hint="0 is precise and repetitive; 0.2–0.4 suits support."
            />
            <TextField name="maxTokens" label="Max reply length" type="number" min={64} max={4096} defaultValue={String(values.maxTokens)} hint="Tokens. 600 is about 3 short paragraphs." />
            <TextField name="maxMessagesPerSession" label="Messages per conversation" type="number" min={1} defaultValue={String(values.maxMessagesPerSession)} />
            <TextField name="rateLimitPerHour" label="Messages per visitor per hour" type="number" min={1} defaultValue={String(values.rateLimitPerHour)} hint="Protects your provider bill." />
          </div>
        </Section>

        <Section title="">
          <SubmitButton className="w-full" pendingLabel="Saving…">
            <Save className="h-3.5 w-3.5" />
            Save concierge settings
          </SubmitButton>
          <Link href="/admin/concierge" className="btn-ghost mt-3 w-full justify-center text-[0.65rem] text-muted">
            Review conversations
          </Link>
        </Section>
      </div>
    </form>
  );
}

export default AiForm;
