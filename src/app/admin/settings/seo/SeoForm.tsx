"use client";

import { CsrfInput } from "@/components/admin/Csrf";
import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { Save } from "lucide-react";
import { SubmitButton, TextField, ToggleRow } from "@/components/admin/Fields";
import { MediaField } from "@/components/admin/MediaPicker";
import { Section } from "@/components/admin/PageHeader";
import { saveSeoAction } from "@/lib/admin/actions/settings";
import { idleState } from "@/lib/admin/action-state";

export type SeoValues = {
  titleEn: string;
  titleBn: string;
  descriptionEn: string;
  descriptionBn: string;
  ogImage: string;
  twitter: string;
  gaId: string;
  metaPixelId: string;
  robotsIndex: boolean;
};

export function SeoForm({ values, csrf, appUrl }: { values: SeoValues; csrf: string; appUrl: string }) {
  const [state, action] = useActionState(saveSeoAction, idleState);
  const [title, setTitle] = useState(values.titleEn);
  const [description, setDescription] = useState(values.descriptionEn);

  useEffect(() => {
    if (state.error) toast.error(state.error);
    else if (state.ok && state.message) toast.success(state.message);
  }, [state]);

  return (
    <form action={action} className="grid gap-5 xl:grid-cols-2">
      <CsrfInput value={csrf} />

      <div className="space-y-5">
        <Section title="Search & social">
          <div>
            <span className="mb-1.5 block text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-muted">Site title</span>
            <div className="grid gap-2 sm:grid-cols-2">
              <div>
                <span className="mb-1 block text-[0.56rem] uppercase tracking-[0.14em] text-muted">English</span>
                <input name="title_en" value={title} onChange={(e) => setTitle(e.target.value)} className="field-box" />
              </div>
              <div>
                <span className="mb-1 block text-[0.56rem] uppercase tracking-[0.14em] text-muted">বাংলা</span>
                <input name="title_bn" defaultValue={values.titleBn} className="field-box font-bangla" />
              </div>
            </div>
            <p className="mt-1 text-xs text-muted">{title.length} characters — around 60 reads best in Google.</p>
          </div>

          <div className="mt-4">
            <span className="mb-1.5 block text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-muted">Meta description</span>
            <div className="grid gap-2 sm:grid-cols-2">
              <div>
                <span className="mb-1 block text-[0.56rem] uppercase tracking-[0.14em] text-muted">English</span>
                <textarea name="description_en" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className="field-box min-h-[80px]" />
              </div>
              <div>
                <span className="mb-1 block text-[0.56rem] uppercase tracking-[0.14em] text-muted">বাংলা</span>
                <textarea name="description_bn" defaultValue={values.descriptionBn} rows={3} className="field-box min-h-[80px] font-bangla" />
              </div>
            </div>
            <p className="mt-1 text-xs text-muted">{description.length} characters — aim for 150–160.</p>
          </div>

          <div className="mt-5 border-t border-line pt-4">
            <MediaField name="ogImage" label="Share image" defaultValue={values.ogImage} folder="brand" hint="1200×630 works everywhere. Shown when the site is shared on Facebook, WhatsApp or X." />
          </div>
          <TextField name="twitter" label="X / Twitter handle" defaultValue={values.twitter} placeholder="@orynve" className="mt-4" />
        </Section>

        <Section title="Analytics">
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField name="gaId" label="Google Analytics 4" defaultValue={values.gaId} placeholder="G-XXXXXXXXXX" hint="Leave empty to load no analytics at all." />
            <TextField name="metaPixelId" label="Meta Pixel" defaultValue={values.metaPixelId} placeholder="1234567890" hint="For Facebook and Instagram ad tracking." />
          </div>
          <div className="mt-4 border-t border-line pt-3">
            <ToggleRow
              name="robotsIndex"
              label="Allow search engines to index the site"
              hint="Turn off while you are still setting up. Remember to turn it back on before launch."
              defaultChecked={values.robotsIndex}
            />
          </div>
        </Section>
      </div>

      <div className="space-y-5">
        <Section title="Search preview">
          <div className="border border-line bg-bone/40 p-4">
            <p className="truncate text-xs text-muted">{appUrl.replace(/^https?:\/\//, "")}</p>
            <p className="mt-1 line-clamp-1 text-base text-[#1a0dab]">{title || "ORYNVE"}</p>
            <p className="mt-1 line-clamp-2 text-xs text-muted">{description || "Add a description so search results read well."}</p>
          </div>

          <p className="mb-2 mt-5 text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-muted">Share card</p>
          <div className="overflow-hidden border border-line">
            <div className="aspect-[1200/630] bg-bone">
              {values.ogImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={values.ogImage} alt="" className="h-full w-full object-cover" />
              ) : null}
            </div>
            <div className="border-t border-line bg-bone/40 p-3">
              <p className="text-[0.6rem] uppercase tracking-[0.14em] text-muted">{appUrl.replace(/^https?:\/\//, "")}</p>
              <p className="mt-0.5 line-clamp-1 text-sm font-medium">{title || "ORYNVE"}</p>
              <p className="line-clamp-2 text-xs text-muted">{description}</p>
            </div>
          </div>
        </Section>

        <Section title="">
          <SubmitButton className="w-full" pendingLabel="Saving…">
            <Save className="h-3.5 w-3.5" />
            Save SEO
          </SubmitButton>
        </Section>
      </div>
    </form>
  );
}

export default SeoForm;
