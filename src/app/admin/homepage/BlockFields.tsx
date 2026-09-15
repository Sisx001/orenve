"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, Image as ImageIcon, Plus, Trash2, X } from "lucide-react";
import { MediaPicker } from "@/components/admin/MediaPicker";
import { Field } from "@/components/admin/Fields";
import type { BlockField } from "@/lib/admin/constants";
import { cn } from "@/lib/utils";

/** Block `data` is an untyped JSON bag; these helpers read it defensively. */
export type BlockData = Record<string, unknown>;

export const asString = (v: unknown, fallback = ""): string => (typeof v === "string" ? v : typeof v === "number" ? String(v) : fallback);
export const asPair = (v: unknown): { en: string; bn: string } => {
  if (v && typeof v === "object" && !Array.isArray(v)) {
    const o = v as Record<string, unknown>;
    return { en: asString(o.en), bn: asString(o.bn) };
  }
  return { en: asString(v), bn: "" };
};
export const asStringArray = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);
export const asObjectArray = (v: unknown): Record<string, unknown>[] =>
  Array.isArray(v) ? v.filter((x): x is Record<string, unknown> => Boolean(x) && typeof x === "object" && !Array.isArray(x)) : [];

/* ───────────────────────────── one field ───────────────────────────── */

export function BlockFieldInput({
  field,
  value,
  onChange,
}: {
  field: BlockField;
  value: unknown;
  onChange: (next: unknown) => void;
}) {
  switch (field.type) {
    case "i18n":
    case "i18n-long": {
      const pair = asPair(value);
      const long = field.type === "i18n-long";
      return (
        <Field label={field.label} hint={field.hint}>
          <div className="grid gap-2 sm:grid-cols-2">
            <div>
              <span className="mb-1 block text-[0.56rem] uppercase tracking-[0.14em] text-muted">English</span>
              {long ? (
                <textarea value={pair.en} onChange={(e) => onChange({ ...pair, en: e.target.value })} className="field-box min-h-[80px]" />
              ) : (
                <input value={pair.en} onChange={(e) => onChange({ ...pair, en: e.target.value })} className="field-box" />
              )}
            </div>
            <div>
              <span className="mb-1 block text-[0.56rem] uppercase tracking-[0.14em] text-muted">বাংলা</span>
              {long ? (
                <textarea value={pair.bn} onChange={(e) => onChange({ ...pair, bn: e.target.value })} className="field-box min-h-[80px] font-bangla" />
              ) : (
                <input value={pair.bn} onChange={(e) => onChange({ ...pair, bn: e.target.value })} className="field-box font-bangla" />
              )}
            </div>
          </div>
        </Field>
      );
    }

    case "text":
    case "url":
    case "focal":
      return (
        <Field label={field.label} hint={field.hint}>
          <input
            value={asString(value)}
            onChange={(e) => onChange(e.target.value)}
            className="field-box text-sm"
            placeholder={field.type === "focal" ? "50% 50%" : field.type === "url" ? "/shop" : ""}
          />
        </Field>
      );

    case "number":
      return (
        <Field label={field.label} hint={field.hint}>
          <input
            type="number"
            value={asString(value)}
            onChange={(e) => onChange(e.target.value === "" ? "" : Number(e.target.value))}
            className="field-box w-32 text-sm"
          />
        </Field>
      );

    case "boolean":
      return (
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={Boolean(value)} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4 accent-[rgb(var(--c-oxide))]" />
          <span className="text-sm">{field.label}</span>
        </label>
      );

    case "image": {
      const url = asString(value);
      return (
        <Field label={field.label} hint={field.hint}>
          <div className="flex items-start gap-3">
            <div className="h-20 w-28 shrink-0 overflow-hidden border border-line bg-bone">
              {url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={url} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="flex h-full w-full items-center justify-center text-muted">
                  <ImageIcon className="h-4 w-4" />
                </span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex gap-2">
                <MediaPicker folder="homepage" onSelect={(u) => onChange(u)} />
                {url && (
                  <button type="button" onClick={() => onChange("")} className="btn-ghost text-[0.62rem] text-danger">
                    Remove
                  </button>
                )}
              </div>
              <input value={url} onChange={(e) => onChange(e.target.value)} placeholder="…or paste a URL" className="field-box mt-2 py-1.5 text-xs" />
            </div>
          </div>
        </Field>
      );
    }

    case "images": {
      const urls = asStringArray(value);
      const move = (from: number, to: number) => {
        if (to < 0 || to >= urls.length) return;
        const next = [...urls];
        const [item] = next.splice(from, 1);
        next.splice(to, 0, item);
        onChange(next);
      };
      return (
        <Field label={field.label} hint={field.hint}>
          <div className="space-y-2">
            {urls.map((u, i) => (
              <div key={`${u}-${i}`} className="flex items-center gap-2 border border-line bg-bone/30 p-2">
                <span className="h-14 w-11 shrink-0 overflow-hidden border border-line bg-bone">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={u} alt="" className="h-full w-full object-cover" />
                </span>
                <span className="min-w-0 flex-1 truncate text-xs text-muted">{u}</span>
                <button type="button" onClick={() => move(i, i - 1)} disabled={i === 0} aria-label="Move up" className="p-1 text-muted disabled:opacity-30">
                  <ArrowUp className="h-3.5 w-3.5" />
                </button>
                <button type="button" onClick={() => move(i, i + 1)} disabled={i === urls.length - 1} aria-label="Move down" className="p-1 text-muted disabled:opacity-30">
                  <ArrowDown className="h-3.5 w-3.5" />
                </button>
                <button type="button" onClick={() => onChange(urls.filter((_, j) => j !== i))} aria-label="Remove" className="p-1 text-muted hover:text-danger">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
            <MediaPicker folder="homepage" multiple title="Add images" onSelect={(u) => onChange([...urls, u])} />
          </div>
        </Field>
      );
    }

    case "frames": {
      const frames = asObjectArray(value);
      return (
        <Field label={field.label} hint={field.hint}>
          <div className="space-y-2">
            {frames.map((f, i) => (
              <div key={i} className="flex items-start gap-2 border border-line bg-bone/30 p-2">
                <span className="h-16 w-12 shrink-0 overflow-hidden border border-line bg-bone">
                  {asString(f.image) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={asString(f.image)} alt="" className="h-full w-full object-cover" />
                  ) : null}
                </span>
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="flex gap-2">
                    <MediaPicker
                      folder="homepage"
                      onSelect={(u) => onChange(frames.map((x, j) => (j === i ? { ...x, image: u } : x)))}
                      trigger={<span className="btn-outline px-2.5 py-1.5 text-[0.6rem]">Pick image</span>}
                    />
                  </div>
                  <input
                    value={asString(f.productSlug)}
                    onChange={(e) => onChange(frames.map((x, j) => (j === i ? { ...x, productSlug: e.target.value } : x)))}
                    placeholder="product-slug (optional)"
                    className="field-box py-1.5 font-mono text-xs"
                  />
                </div>
                <button type="button" onClick={() => onChange(frames.filter((_, j) => j !== i))} aria-label="Remove frame" className="p-1 text-muted hover:text-danger">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
            <button type="button" onClick={() => onChange([...frames, { image: "", productSlug: "" }])} className="btn-outline px-3 py-2 text-[0.62rem]">
              <Plus className="h-3 w-3" />
              Add frame
            </button>
          </div>
        </Field>
      );
    }

    case "testimonials": {
      const items = asObjectArray(value);
      return (
        <Field label={field.label} hint={field.hint}>
          <div className="space-y-2">
            {items.map((it, i) => {
              const text = asPair(it.text);
              return (
                <div key={i} className="space-y-1.5 border border-line bg-bone/30 p-2.5">
                  <div className="flex gap-2">
                    <input
                      value={asString(it.name)}
                      onChange={(e) => onChange(items.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))}
                      placeholder="Name"
                      className="field-box py-1.5 text-xs"
                    />
                    <input
                      value={asString(it.city)}
                      onChange={(e) => onChange(items.map((x, j) => (j === i ? { ...x, city: e.target.value } : x)))}
                      placeholder="City"
                      className="field-box py-1.5 text-xs"
                    />
                    <button type="button" onClick={() => onChange(items.filter((_, j) => j !== i))} aria-label="Remove quote" className="p-1 text-muted hover:text-danger">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <textarea
                    value={text.en}
                    onChange={(e) => onChange(items.map((x, j) => (j === i ? { ...x, text: { ...text, en: e.target.value } } : x)))}
                    placeholder="Quote (English)"
                    className="field-box min-h-[56px] py-1.5 text-xs"
                  />
                  <textarea
                    value={text.bn}
                    onChange={(e) => onChange(items.map((x, j) => (j === i ? { ...x, text: { ...text, bn: e.target.value } } : x)))}
                    placeholder="উদ্ধৃতি (বাংলা)"
                    className="field-box min-h-[56px] py-1.5 font-bangla text-xs"
                  />
                </div>
              );
            })}
            <button type="button" onClick={() => onChange([...items, { name: "", city: "", text: { en: "", bn: "" } }])} className="btn-outline px-3 py-2 text-[0.62rem]">
              <Plus className="h-3 w-3" />
              Add quote
            </button>
          </div>
        </Field>
      );
    }

    default:
      return null;
  }
}

/** Editable form for one block, driven by BLOCK_SCHEMA. */
export function BlockDataForm({ fields, initial }: { fields: BlockField[]; initial: BlockData }) {
  const [data, setData] = useState<BlockData>(initial);
  if (fields.length === 0) {
    return (
      <>
        <input type="hidden" name="data" value={JSON.stringify({})} />
        <p className="border border-line bg-bone/60 px-3 py-2.5 text-xs text-muted">This block has no settings — enable it and it renders with the brand defaults.</p>
      </>
    );
  }
  return (
    <div className={cn("space-y-4")}>
      <input type="hidden" name="data" value={JSON.stringify(data)} />
      {fields.map((f) => (
        <BlockFieldInput key={f.key} field={f} value={data[f.key]} onChange={(next) => setData((s) => ({ ...s, [f.key]: next }))} />
      ))}
    </div>
  );
}
