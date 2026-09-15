"use client";

import { CsrfInput } from "@/components/admin/Csrf";

import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Save } from "lucide-react";
import { Field, FormBanner, I18nInput, SelectField, SubmitButton, TextAreaField, ToggleRow } from "@/components/admin/Fields";
import { savePageAction } from "@/lib/admin/actions/content";
import { idleState } from "@/lib/admin/action-state";
import { MARKDOWN_HELP } from "@/lib/admin/constants";
import { slugify } from "@/lib/utils";

export type PageData = {
  id: string | null;
  slug: string;
  titleEn: string;
  titleBn: string;
  bodyEn: string;
  bodyBn: string;
  template: string;
  isPublished: boolean;
  showInFooter: boolean;
  seoTitleEn: string;
  seoTitleBn: string;
  seoDescriptionEn: string;
  seoDescriptionBn: string;
};

export function PageEditor({ data, csrf }: { data: PageData; csrf: string }) {
  const [state, action] = useActionState(savePageAction, idleState);
  const [titleEn, setTitleEn] = useState(data.titleEn);
  const [slug, setSlug] = useState(data.slug);
  const [slugLocked, setSlugLocked] = useState(Boolean(data.slug));

  useEffect(() => {
    if (state.error) toast.error(state.error);
    else if (state.ok && state.message) toast.success(state.message);
  }, [state]);

  useEffect(() => {
    if (!slugLocked) setSlug(slugify(titleEn));
  }, [titleEn, slugLocked]);

  return (
    <form action={action} className="grid gap-5 xl:grid-cols-3">
      <CsrfInput value={csrf} />
      {data.id && <input type="hidden" name="id" value={data.id} />}

      <div className="space-y-5 xl:col-span-2">
        <div className="card p-4 sm:p-5">
          <FormBanner state={state} />
          <div className="space-y-4">
            <Field label="Title (English)" required error={state.fieldErrors?.title_en}>
              <input name="title_en" value={titleEn} onChange={(e) => setTitleEn(e.target.value)} required className="field-box" placeholder="Shipping & delivery" />
            </Field>
            <Field label="Title (বাংলা)">
              <input name="title_bn" defaultValue={data.titleBn} className="field-box font-bangla" />
            </Field>
            <Field label="Slug" required hint={`/en/${slug || "…"}`} error={state.fieldErrors?.slug}>
              <input
                name="slug"
                value={slug}
                onChange={(e) => {
                  setSlugLocked(true);
                  setSlug(e.target.value);
                }}
                required
                className="field-box font-mono text-xs"
              />
            </Field>
          </div>
        </div>

        <div className="card p-4 sm:p-5">
          <h3 className="mb-1 text-[0.68rem] font-semibold uppercase tracking-[0.16em]">Body</h3>
          <p className="mb-4 text-xs text-muted">{MARKDOWN_HELP}</p>
          <TextAreaField name="body_en" label="English" defaultValue={data.bodyEn} inputClassName="min-h-[320px] font-mono text-xs leading-relaxed" required />
          <TextAreaField name="body_bn" label="বাংলা" defaultValue={data.bodyBn} className="mt-4" inputClassName="min-h-[320px] font-mono text-xs leading-relaxed font-bangla" />
        </div>

        <div className="card p-4 sm:p-5">
          <h3 className="mb-4 text-[0.68rem] font-semibold uppercase tracking-[0.16em]">SEO</h3>
          <I18nInput name="seoTitle" label="SEO title" en={data.seoTitleEn} bn={data.seoTitleBn} layout="stack" />
          <I18nInput name="seoDescription" label="Meta description" en={data.seoDescriptionEn} bn={data.seoDescriptionBn} multiline rows={3} layout="stack" className="mt-4" />
        </div>
      </div>

      <div className="space-y-5">
        <div className="card p-4 sm:p-5">
          <SelectField
            name="template"
            label="Template"
            defaultValue={data.template}
            options={[
              { value: "editorial", label: "Editorial — wide, generous type" },
              { value: "plain", label: "Plain — simple column" },
              { value: "legal", label: "Legal — dense, numbered" },
            ]}
          />
          <div className="mt-2 divide-y divide-line/70">
            <ToggleRow name="isPublished" label="Published" hint="Drafts are only visible here." defaultChecked={data.isPublished} />
            <ToggleRow name="showInFooter" label="Show in footer" hint="Adds a link in the storefront footer." defaultChecked={data.showInFooter} />
          </div>
        </div>

        <div className="card p-4 sm:p-5">
          <SubmitButton className="w-full" pendingLabel="Saving…">
            <Save className="h-3.5 w-3.5" />
            {data.id ? "Save page" : "Create page"}
          </SubmitButton>
          <Link href="/admin/pages" className="btn-ghost mt-3 w-full justify-center text-[0.65rem] text-muted">
            Cancel
          </Link>
        </div>
      </div>
    </form>
  );
}

export default PageEditor;
