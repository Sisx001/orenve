"use client";

import { CsrfInput } from "@/components/admin/Csrf";
import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { Save } from "lucide-react";
import { Field, FormBanner, I18nInput, SelectField, SubmitButton, TextField, ToggleRow } from "@/components/admin/Fields";
import { MediaField } from "@/components/admin/MediaPicker";
import { Section } from "@/components/admin/PageHeader";
import { Monogram, Wordmark } from "@/components/brand/Logo";
import { saveBrandAction } from "@/lib/admin/actions/settings";
import { idleState } from "@/lib/admin/action-state";
import { FONT_BANGLA, FONT_DISPLAY, FONT_SANS } from "@/lib/admin/constants";

export type BrandValues = {
  name: string;
  taglineEn: string;
  taglineBn: string;
  logoUrl: string | null;
  accent: string;
  brass: string;
  theme: string;
  radius: number;
  fontDisplay: string;
  fontSans: string;
  fontBangla: string;
  announcementEn: string;
  announcementBn: string;
  announcementLink: string;
  showAnnouncement: boolean;
};

export function BrandForm({ values, csrf }: { values: BrandValues; csrf: string }) {
  const [state, action] = useActionState(saveBrandAction, idleState);
  const [accent, setAccent] = useState(values.accent);
  const [brass, setBrass] = useState(values.brass);
  const [radius, setRadius] = useState(values.radius);
  const [name, setName] = useState(values.name);
  const [useBuiltIn, setUseBuiltIn] = useState(!values.logoUrl);

  useEffect(() => {
    if (state.error) toast.error(state.error);
    else if (state.ok && state.message) toast.success(state.message);
  }, [state]);

  return (
    <form action={action} className="grid gap-5 xl:grid-cols-3">
      <CsrfInput value={csrf} />
      {useBuiltIn && <input type="hidden" name="logoUrl" value="" />}

      <div className="space-y-5 xl:col-span-2">
        <Section title="Identity">
          <FormBanner state={state} />
          <TextField name="name" label="Brand name" value={name} onChange={(e) => setName(e.target.value)} required hint="Used in the wordmark, invoices and page titles." />
          <I18nInput name="tagline" label="Tagline" en={values.taglineEn} bn={values.taglineBn} layout="stack" className="mt-4" />

          <div className="mt-5 border-t border-line pt-4">
            <p className="mb-2 text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-muted">Logo</p>
            <label className="mb-3 flex items-start gap-2">
              <input type="checkbox" checked={useBuiltIn} onChange={(e) => setUseBuiltIn(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[rgb(var(--c-oxide))]" />
              <span>
                <span className="block text-sm">Use the built-in ORYNVE mark</span>
                <span className="block text-xs text-muted">The drawn monogram and wordmark — it inherits your accent colour and scales perfectly.</span>
              </span>
            </label>
            {!useBuiltIn && <MediaField name="logoUrl" label="Custom logo" defaultValue={values.logoUrl} folder="brand" hint="SVG or a transparent PNG at least 400px wide." />}
          </div>
        </Section>

        <Section title="Colour & shape">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Accent (oxide)" hint="Buttons, links, active states.">
              <div className="flex items-center gap-2">
                <input type="color" name="accent" value={accent} onChange={(e) => setAccent(e.target.value)} className="h-10 w-14 cursor-pointer border border-line bg-paper p-1" />
                <input value={accent} onChange={(e) => setAccent(e.target.value)} className="field-box font-mono text-xs" aria-label="Accent hex" />
              </div>
            </Field>
            <Field label="Brass" hint="Badges, rating stars, quiet highlights.">
              <div className="flex items-center gap-2">
                <input type="color" name="brass" value={brass} onChange={(e) => setBrass(e.target.value)} className="h-10 w-14 cursor-pointer border border-line bg-paper p-1" />
                <input value={brass} onChange={(e) => setBrass(e.target.value)} className="field-box font-mono text-xs" aria-label="Brass hex" />
              </div>
            </Field>
          </div>

          <Field label={`Corner radius — ${radius}px`} hint="0 is a hard editorial edge; 8+ feels softer and more commercial." className="mt-4">
            <input type="range" name="radius" min={0} max={24} step={1} value={radius} onChange={(e) => setRadius(Number(e.target.value))} className="w-full accent-[rgb(var(--c-oxide))]" />
          </Field>

          <SelectField
            name="theme"
            label="Default theme"
            defaultValue={values.theme}
            options={[
              { value: "light", label: "Light" },
              { value: "dark", label: "Dark" },
              { value: "system", label: "Follow the visitor's device" },
            ]}
            className="mt-4"
          />
        </Section>

        <Section title="Typography">
          <div className="grid gap-4 sm:grid-cols-3">
            <SelectField name="fontDisplay" label="Display serif" defaultValue={values.fontDisplay} options={FONT_DISPLAY.map((f) => ({ value: f, label: f }))} />
            <SelectField name="fontSans" label="Sans" defaultValue={values.fontSans} options={FONT_SANS.map((f) => ({ value: f, label: f }))} />
            <SelectField name="fontBangla" label="Bangla" defaultValue={values.fontBangla} options={FONT_BANGLA.map((f) => ({ value: f, label: f }))} />
          </div>
          <p className="mt-3 text-xs text-muted">Fonts load from Google Fonts at runtime, so a change goes live without a rebuild.</p>
        </Section>

        <Section title="Announcement bar">
          <I18nInput name="announcement" label="Message" en={values.announcementEn} bn={values.announcementBn} layout="stack" />
          <TextField name="announcementLink" label="Link" defaultValue={values.announcementLink} className="mt-4" placeholder="/shop" />
          <div className="mt-2">
            <ToggleRow name="showAnnouncement" label="Show the announcement bar" defaultChecked={values.showAnnouncement} />
          </div>
        </Section>
      </div>

      <div className="space-y-5">
        <Section title="Live preview">
          <div className="border border-line p-5" style={{ ["--c-oxide" as string]: hexToRgb(accent), ["--c-brass" as string]: hexToRgb(brass), ["--radius" as string]: `${radius}px` }}>
            <div className="flex items-center gap-2.5">
              <Monogram size={26} />
              <Wordmark name={name || "ORYNVE"} height={18} />
            </div>
            <p className="mt-4 text-xs text-muted">{values.taglineEn || "Not for everyone. For you."}</p>
            <div className="mt-5 flex flex-wrap gap-2">
              <span className="btn px-4 py-2.5 text-[0.65rem]" style={{ borderRadius: `${radius}px` }}>
                Add to bag
              </span>
              <span className="btn-accent px-4 py-2.5 text-[0.65rem]" style={{ borderRadius: `${radius}px` }}>
                Checkout
              </span>
            </div>
            <div className="mt-4 flex gap-2">
              <span className="flex-1 border border-line px-2 py-1.5 text-center text-[0.6rem] uppercase tracking-[0.14em]" style={{ background: accent, color: "#fff", borderRadius: `${radius}px` }}>
                Accent
              </span>
              <span className="flex-1 border border-line px-2 py-1.5 text-center text-[0.6rem] uppercase tracking-[0.14em]" style={{ background: brass, borderRadius: `${radius}px` }}>
                Brass
              </span>
            </div>
          </div>
          <p className="mt-3 text-xs text-muted">The storefront applies these tokens at runtime — no rebuild needed.</p>
        </Section>

        <Section title="">
          <SubmitButton className="w-full" pendingLabel="Saving…">
            <Save className="h-3.5 w-3.5" />
            Save brand & theme
          </SubmitButton>
        </Section>
      </div>
    </form>
  );
}

/** "#c2542b" → "194 84 43" for the CSS custom properties. */
function hexToRgb(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return "194 84 43";
  const n = parseInt(m[1], 16);
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;
}

export default BrandForm;
