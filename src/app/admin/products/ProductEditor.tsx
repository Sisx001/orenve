"use client";

import { CsrfInput } from "@/components/admin/Csrf";

import { useActionState, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  ArrowDown,
  ArrowUp,
  GripVertical,
  Image as ImageIcon,
  Plus,
  RefreshCw,
  Save,
  Trash2,
  X,
} from "lucide-react";
import { Field, I18nInput, MoneyInput, SelectField, SubmitButton, TextAreaField, TextField, CheckboxField, FormBanner } from "@/components/admin/Fields";
import type { AiWriteConfig } from "@/components/admin/AiWrite";
import { MediaPicker } from "@/components/admin/MediaPicker";
import { saveProductAction } from "@/lib/admin/actions/products";
import { idleState } from "@/lib/admin/action-state";
import { MARKDOWN_HELP } from "@/lib/admin/constants";
import { PRODUCT_STATUSES } from "@/lib/constants";
import { majorToMinor } from "@/lib/money";
import { slugify } from "@/lib/utils";
import { cn } from "@/lib/utils";

/* ───────────────────────────── types ───────────────────────────── */

export type Pair = { en: string; bn: string };
export type EditorImage = { id?: string; url: string; alt: Pair; colorName: string | null };
export type EditorOption = { name: string; values: { value: string; hex?: string }[] };
export type EditorVariant = {
  id?: string;
  sku: string;
  title: string;
  options: Record<string, string>;
  priceMajor: string;
  stock: number;
  lowStockAt: number;
  isActive: boolean;
  imageUrl: string | null;
};
export type EditorSizeGuide = { unit: "cm" | "in"; labels: string[]; rows: string[][]; notes: string };

export type ProductEditorData = {
  id: string | null;
  name: Pair;
  slug: string;
  sku: string;
  status: string;
  categoryId: string;
  collectionIds: string[];
  featured: boolean;
  badge: Pair;
  tags: string;
  price: number | null;
  compareAtPrice: number | null;
  costPrice: number | null;
  description: Pair;
  details: { material: Pair; fit: Pair; care: Pair; shipping: Pair; returns: Pair };
  video: string;
  sizeGuide: EditorSizeGuide | null;
  seoTitle: Pair;
  seoDescription: Pair;
  images: EditorImage[];
  options: EditorOption[];
  variants: EditorVariant[];
};

const TABS = [
  { key: "essentials", label: "Essentials" },
  { key: "description", label: "Description" },
  { key: "media", label: "Media" },
  { key: "variants", label: "Variants" },
  { key: "sizeguide", label: "Size guide" },
  { key: "seo", label: "SEO" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

const optionsKey = (o: Record<string, string>) =>
  Object.keys(o)
    .sort()
    .map((k) => `${k}=${o[k]}`)
    .join("|");

/* ───────────────────────────── component ───────────────────────────── */

export function ProductEditor({
  data,
  csrf,
  categories,
  collections,
}: {
  data: ProductEditorData;
  csrf: string;
  categories: { id: string; name: string }[];
  collections: { id: string; name: string }[];
}) {
  const [state, action] = useActionState(saveProductAction, idleState);
  const [tab, setTab] = useState<TabKey>("essentials");

  const [nameEn, setNameEn] = useState(data.name.en);
  const [slug, setSlug] = useState(data.slug);
  const [slugLocked, setSlugLocked] = useState(Boolean(data.slug));

  const [images, setImages] = useState<EditorImage[]>(data.images);
  const [options, setOptions] = useState<EditorOption[]>(data.options);
  const [variants, setVariants] = useState<EditorVariant[]>(data.variants);
  const [guide, setGuide] = useState<EditorSizeGuide | null>(data.sizeGuide);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [bulkStock, setBulkStock] = useState("");

  useEffect(() => {
    if (state.error) toast.error(state.error);
    else if (state.ok && state.message) toast.success(state.message);
  }, [state]);

  useEffect(() => {
    if (!slugLocked) setSlug(slugify(nameEn));
  }, [nameEn, slugLocked]);

  const colorValues = useMemo(() => {
    const color = options.find((o) => o.name.trim().toLowerCase() === "color");
    return color ? color.values.map((v) => v.value).filter(Boolean) : [];
  }, [options]);

  /* ── payloads ── */
  const imagesPayload = images.map((i) => ({ id: i.id, url: i.url, alt: i.alt, colorName: i.colorName }));
  const optionsPayload = options
    .filter((o) => o.name.trim())
    .map((o) => ({ name: o.name.trim(), values: o.values.filter((v) => v.value.trim()) }));
  const variantsPayload = variants
    .filter((v) => v.title.trim())
    .map((v) => ({
      id: v.id,
      sku: v.sku || undefined,
      title: v.title,
      options: v.options,
      price: v.priceMajor.trim() === "" ? null : majorToMinor(v.priceMajor),
      stock: v.stock,
      lowStockAt: v.lowStockAt,
      isActive: v.isActive,
      imageUrl: v.imageUrl,
    }));

  /* ── image helpers ── */
  const moveImage = (from: number, to: number) => {
    if (to < 0 || to >= images.length) return;
    setImages((s) => {
      const next = [...s];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });
  };

  /* ── variant generation ── */
  const generateVariants = () => {
    const active = optionsPayload.filter((o) => o.values.length > 0);
    if (active.length === 0) {
      // a single default variant
      setVariants((prev) => {
        if (prev.length > 0 && Object.keys(prev[0].options).length === 0) return prev;
        return [
          {
            sku: "",
            title: "Default",
            options: {},
            priceMajor: "",
            stock: prev[0]?.stock ?? 0,
            lowStockAt: prev[0]?.lowStockAt ?? 3,
            isActive: true,
            imageUrl: null,
          },
        ];
      });
      toast.success("Created a single default variant.");
      return;
    }

    let combos: Record<string, string>[] = [{}];
    for (const opt of active) {
      const next: Record<string, string>[] = [];
      for (const c of combos) for (const v of opt.values) next.push({ ...c, [opt.name]: v.value });
      combos = next;
    }
    if (combos.length > 300) {
      toast.error("That would create more than 300 variants — reduce the option values.");
      return;
    }

    const byKey = new Map(variants.map((v) => [optionsKey(v.options), v]));
    const built: EditorVariant[] = combos.map((c) => {
      const existing = byKey.get(optionsKey(c));
      const title = active.map((o) => c[o.name]).join(" / ");
      return (
        existing ? { ...existing, title, options: c } : { sku: "", title, options: c, priceMajor: "", stock: 0, lowStockAt: 3, isActive: true, imageUrl: null }
      ) as EditorVariant;
    });
    setVariants(built);
    toast.success(`${built.length} variant${built.length === 1 ? "" : "s"} ready.`);
  };

  /* ── size guide helpers ── */
  const ensureGuide = (): EditorSizeGuide =>
    guide ?? { unit: "cm", labels: ["Size", "Chest", "Length", "Shoulder"], rows: [["S", "", "", ""]], notes: "" };

  return (
    <form action={action} className="pb-24">
      <CsrfInput value={csrf} />
      {data.id && <input type="hidden" name="id" value={data.id} />}
      <input type="hidden" name="images" value={JSON.stringify(imagesPayload)} />
      <input type="hidden" name="options" value={JSON.stringify(optionsPayload)} />
      <input type="hidden" name="variants" value={JSON.stringify(variantsPayload)} />
      <input type="hidden" name="sizeGuide" value={guide ? JSON.stringify(guide) : ""} />

      <FormBanner state={state} />

      {/* tabs */}
      <div className="no-scrollbar mb-5 flex gap-1 overflow-x-auto border-b border-line">
        {TABS.map((t) => {
          const count =
            t.key === "media" ? images.length : t.key === "variants" ? variants.length : undefined;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={cn(
                "-mb-px flex shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2.5 text-[0.68rem] font-semibold uppercase tracking-[0.14em] transition",
                tab === t.key ? "border-oxide text-ink" : "border-transparent text-muted hover:text-ink",
              )}
            >
              {t.label}
              {count != null && <span className={cn("tabular-nums", tab === t.key ? "text-oxide" : "text-muted/70")}>{count}</span>}
            </button>
          );
        })}
      </div>

      {/* ── Essentials ── */}
      <section className={cn("grid gap-5 xl:grid-cols-3", tab !== "essentials" && "hidden")}>
        <div className="space-y-4 xl:col-span-2">
          <div className="card p-4 sm:p-5">
            <div className="space-y-4">
              <Field label="Product name (English)" required error={state.fieldErrors?.name_en}>
                <input name="name_en" value={nameEn} onChange={(e) => setNameEn(e.target.value)} required className="field-box" placeholder="The Oxide Overshirt" />
              </Field>
              <Field label="Product name (বাংলা)">
                <input name="name_bn" defaultValue={data.name.bn} className="field-box font-bangla" placeholder="অক্সাইড ওভারশার্ট" />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="URL slug" required hint={`/en/product/${slug || "…"}`} error={state.fieldErrors?.slug}>
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
                <TextField name="sku" label="SKU" defaultValue={data.sku} placeholder="ORY-OS-001" hint="Optional. Must be unique." />
              </div>
            </div>
          </div>

          <div className="card p-4 sm:p-5">
            <h3 className="mb-4 text-[0.68rem] font-semibold uppercase tracking-[0.16em]">Pricing</h3>
            <div className="grid gap-4 sm:grid-cols-3">
              <MoneyInput name="price" label="Price" defaultMinor={data.price} required hint="Shown on the storefront." />
              <MoneyInput name="compareAtPrice" label="Compare at" defaultMinor={data.compareAtPrice} hint="Struck through when higher." />
              <MoneyInput name="costPrice" label="Cost" defaultMinor={data.costPrice} hint="Private — margin only." />
            </div>
          </div>

          <div className="card p-4 sm:p-5">
            <h3 className="mb-4 text-[0.68rem] font-semibold uppercase tracking-[0.16em]">Merchandising</h3>
            <I18nInput
              name="badge"
              label="Badge"
              values={{ en: data.badge.en, bn: data.badge.bn }}
              layout="stack"
              placeholder="Last few"
              ai={{ task: "generic", context: { name: data.name.en } } satisfies AiWriteConfig}
            />
            <TextField name="tags" label="Tags" defaultValue={data.tags} className="mt-4" placeholder="overshirt, heavyweight, collection-001" hint="Comma separated. Used by search and the AI concierge." />
          </div>
        </div>

        <div className="space-y-4">
          <div className="card p-4 sm:p-5">
            <SelectField name="status" label="Status" defaultValue={data.status} options={PRODUCT_STATUSES.map((s) => ({ value: s, label: s }))} hint="Only published products appear on the storefront." />
            <div className="mt-4 border-t border-line pt-4">
              <CheckboxField name="featured" label="Featured" hint="Eligible for the homepage featured band." defaultChecked={data.featured} />
            </div>
          </div>

          <div className="card p-4 sm:p-5">
            <SelectField
              name="categoryId"
              label="Category"
              defaultValue={data.categoryId}
              options={[{ value: "", label: "No category" }, ...categories.map((c) => ({ value: c.id, label: c.name }))]}
            />
            <div className="mt-4 border-t border-line pt-4">
              <p className="mb-2 text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-muted">Collections</p>
              {collections.length === 0 ? (
                <p className="text-xs text-muted">
                  No collections yet —{" "}
                  <Link href="/admin/catalog" className="text-oxide hover:underline">
                    create one
                  </Link>
                  .
                </p>
              ) : (
                <div className="space-y-1.5">
                  {collections.map((c) => (
                    <CheckboxField key={c.id} name="collectionIds" value={c.id} label={c.name} defaultChecked={data.collectionIds.includes(c.id)} />
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="card p-4 sm:p-5">
            <TextField name="video" label="Product video URL" defaultValue={data.video} placeholder="/uploads/… or https://…" hint="mp4 or webm. Shown in the gallery." />
          </div>
        </div>
      </section>

      {/* ── Description ── */}
      <section className={cn("grid gap-5 xl:grid-cols-2", tab !== "description" && "hidden")}>
        <div className="card p-4 sm:p-5">
          <h3 className="mb-1 text-[0.68rem] font-semibold uppercase tracking-[0.16em]">Description</h3>
          <p className="mb-4 text-xs text-muted">{MARKDOWN_HELP}</p>
          <I18nInput
            name="description"
            values={{ en: data.description.en, bn: data.description.bn }}
            multiline
            rows={9}
            ai={
              {
                task: "product_description",
                context: {
                  name: data.name.en,
                  category: data.categoryId,
                  price: data.price != null ? data.price : undefined,
                  material: data.details.material.en,
                  fit: data.details.fit.en,
                  care: data.details.care.en,
                },
              } satisfies AiWriteConfig
            }
          />
        </div>
        <div className="card p-4 sm:p-5">
          <h3 className="mb-4 text-[0.68rem] font-semibold uppercase tracking-[0.16em]">Details accordion</h3>
          <div className="space-y-4">
            <I18nInput
              name="details_material"
              label="Material"
              values={{ en: data.details.material.en, bn: data.details.material.bn }}
              multiline
              rows={3}
            />
            <I18nInput
              name="details_fit"
              label="Fit"
              values={{ en: data.details.fit.en, bn: data.details.fit.bn }}
              multiline
              rows={3}
              ai={
                {
                  task: "size_notes",
                  context: {
                    name: data.name.en,
                    material: data.details.material.en,
                  },
                } satisfies AiWriteConfig
              }
            />
            <I18nInput
              name="details_care"
              label="Care"
              values={{ en: data.details.care.en, bn: data.details.care.bn }}
              multiline
              rows={3}
            />
            <I18nInput
              name="details_shipping"
              label="Shipping"
              values={{ en: data.details.shipping.en, bn: data.details.shipping.bn }}
              multiline
              rows={3}
            />
            <I18nInput
              name="details_returns"
              label="Returns"
              values={{ en: data.details.returns.en, bn: data.details.returns.bn }}
              multiline
              rows={3}
            />
          </div>
        </div>
      </section>

      {/* ── Media ── */}
      <section className={cn(tab !== "media" && "hidden")}>
        <div className="card p-4 sm:p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-[0.68rem] font-semibold uppercase tracking-[0.16em]">Gallery</h3>
              <p className="mt-1 text-xs text-muted">The first image is the card thumbnail. Drag a row or use the arrows to reorder.</p>
            </div>
            <MediaPicker
              folder="products"
              multiple
              title="Add product images"
              onSelect={(url) =>
                setImages((s) => (s.some((i) => i.url === url) ? s : [...s, { url, alt: { en: "", bn: "" }, colorName: null }]))
              }
            />
          </div>

          {images.length === 0 ? (
            <div className="border border-dashed border-line py-14 text-center">
              <ImageIcon className="mx-auto mb-2 h-5 w-5 text-muted" />
              <p className="text-sm text-muted">No images yet. A published product should have at least two.</p>
            </div>
          ) : (
            <ul className="space-y-2">
              {images.map((img, idx) => (
                <li
                  key={`${img.url}-${idx}`}
                  draggable
                  onDragStart={() => setDragIndex(idx)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => {
                    if (dragIndex !== null && dragIndex !== idx) moveImage(dragIndex, idx);
                    setDragIndex(null);
                  }}
                  onDragEnd={() => setDragIndex(null)}
                  className={cn("flex gap-3 border border-line bg-bone/30 p-2.5", dragIndex === idx && "opacity-50")}
                >
                  <span className="mt-1 cursor-grab text-muted" aria-hidden>
                    <GripVertical className="h-4 w-4" />
                  </span>
                  <div className="h-20 w-16 shrink-0 overflow-hidden border border-line bg-bone">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={img.url} alt="" className="h-full w-full object-cover" />
                  </div>
                  <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-2">
                    <label className="block">
                      <span className="mb-1 block text-[0.56rem] uppercase tracking-[0.14em] text-muted">Alt (English)</span>
                      <input
                        value={img.alt.en}
                        onChange={(e) => setImages((s) => s.map((x, i) => (i === idx ? { ...x, alt: { ...x.alt, en: e.target.value } } : x)))}
                        className="field-box py-1.5 text-xs"
                        placeholder="Model wearing the overshirt, front"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-[0.56rem] uppercase tracking-[0.14em] text-muted">Alt (বাংলা)</span>
                      <input
                        value={img.alt.bn}
                        onChange={(e) => setImages((s) => s.map((x, i) => (i === idx ? { ...x, alt: { ...x.alt, bn: e.target.value } } : x)))}
                        className="field-box py-1.5 text-xs font-bangla"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-[0.56rem] uppercase tracking-[0.14em] text-muted">Colour</span>
                      <select
                        value={img.colorName ?? ""}
                        onChange={(e) => setImages((s) => s.map((x, i) => (i === idx ? { ...x, colorName: e.target.value || null } : x)))}
                        className="field-box py-1.5 text-xs"
                      >
                        <option value="">Any colour</option>
                        {colorValues.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </label>
                    <p className="self-end truncate text-[0.6rem] text-muted">{img.url}</p>
                  </div>
                  <div className="flex shrink-0 flex-col items-center gap-0.5">
                    <button type="button" onClick={() => moveImage(idx, idx - 1)} disabled={idx === 0} aria-label="Move up" className="p-1 text-muted disabled:opacity-30 hover:text-ink">
                      <ArrowUp className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => moveImage(idx, idx + 1)}
                      disabled={idx === images.length - 1}
                      aria-label="Move down"
                      className="p-1 text-muted disabled:opacity-30 hover:text-ink"
                    >
                      <ArrowDown className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setImages((s) => s.filter((_, i) => i !== idx));
                        setVariants((s) => s.map((v) => (v.imageUrl === img.url ? { ...v, imageUrl: null } : v)));
                      }}
                      aria-label="Remove image"
                      className="p-1 text-muted hover:text-danger"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* ── Variants ── */}
      <section className={cn("space-y-5", tab !== "variants" && "hidden")}>
        <div className="card p-4 sm:p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-[0.68rem] font-semibold uppercase tracking-[0.16em]">Options</h3>
              <p className="mt-1 text-xs text-muted">Usually Size and Colour. Colour values can carry a swatch hex.</p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setOptions((s) => [...s, { name: s.some((o) => o.name === "Size") ? "Colour" : "Size", values: [{ value: "" }] }])}
                className="btn-outline px-3 py-2 text-[0.62rem]"
              >
                <Plus className="h-3 w-3" />
                Add option
              </button>
              <button type="button" onClick={generateVariants} className="btn px-3 py-2 text-[0.62rem]">
                <RefreshCw className="h-3 w-3" />
                Generate variants
              </button>
            </div>
          </div>

          {options.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted">No options — the product will have a single default variant.</p>
          ) : (
            <ul className="space-y-4">
              {options.map((opt, oi) => {
                const isColor = opt.name.trim().toLowerCase().startsWith("colo");
                return (
                  <li key={oi} className="border border-line p-3">
                    <div className="mb-2.5 flex items-center gap-2">
                      <input
                        value={opt.name}
                        onChange={(e) => setOptions((s) => s.map((x, i) => (i === oi ? { ...x, name: e.target.value } : x)))}
                        className="field-box max-w-[12rem] py-1.5 text-xs"
                        placeholder="Size"
                        aria-label="Option name"
                      />
                      <button type="button" onClick={() => setOptions((s) => s.filter((_, i) => i !== oi))} className="ml-auto p-1 text-muted hover:text-danger" aria-label="Remove option">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <ul className="space-y-1.5">
                      {opt.values.map((val, vi) => (
                        <li key={vi} className="flex items-center gap-2">
                          <input
                            value={val.value}
                            onChange={(e) =>
                              setOptions((s) => s.map((x, i) => (i === oi ? { ...x, values: x.values.map((v, j) => (j === vi ? { ...v, value: e.target.value } : v)) } : x)))
                            }
                            className="field-box max-w-[14rem] py-1.5 text-xs"
                            placeholder={isColor ? "Onyx" : "M"}
                            aria-label="Option value"
                          />
                          {isColor && (
                            <input
                              type="color"
                              value={val.hex ?? "#262521"}
                              onChange={(e) =>
                                setOptions((s) => s.map((x, i) => (i === oi ? { ...x, values: x.values.map((v, j) => (j === vi ? { ...v, hex: e.target.value } : v)) } : x)))
                              }
                              className="h-8 w-10 shrink-0 cursor-pointer border border-line bg-paper p-0.5"
                              aria-label="Swatch colour"
                            />
                          )}
                          <button
                            type="button"
                            onClick={() => setOptions((s) => s.map((x, i) => (i === oi ? { ...x, values: x.values.filter((_, j) => j !== vi) } : x)))}
                            className="p-1 text-muted hover:text-danger"
                            aria-label="Remove value"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </li>
                      ))}
                    </ul>
                    <button
                      type="button"
                      onClick={() => setOptions((s) => s.map((x, i) => (i === oi ? { ...x, values: [...x.values, { value: "" }] } : x)))}
                      className="btn-ghost mt-2 text-[0.62rem]"
                    >
                      <Plus className="h-3 w-3" />
                      Add value
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="card p-4 sm:p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-[0.68rem] font-semibold uppercase tracking-[0.16em]">Variants</h3>
              <p className="mt-1 text-xs text-muted">Leave a price override empty to use the product price. Existing variants keep their id, so order history stays intact.</p>
            </div>
            <div className="flex items-end gap-2">
              <label className="block">
                <span className="mb-1 block text-[0.56rem] uppercase tracking-[0.14em] text-muted">Set all stock</span>
                <input value={bulkStock} onChange={(e) => setBulkStock(e.target.value)} inputMode="numeric" className="field-box w-20 py-1.5 text-xs" placeholder="0" />
              </label>
              <button
                type="button"
                onClick={() => {
                  const n = Math.max(0, Number(bulkStock) || 0);
                  setVariants((s) => s.map((v) => ({ ...v, stock: n })));
                  toast.success(`Stock set to ${n} on every variant (save to apply).`);
                }}
                className="btn-outline px-3 py-2 text-[0.62rem]"
              >
                Apply
              </button>
            </div>
          </div>

          {variants.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted">No variants yet — add options and press “Generate variants”.</p>
          ) : (
            <div className="-mx-4 overflow-x-auto sm:-mx-5">
              <table className="w-full min-w-[52rem] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-line text-[0.58rem] uppercase tracking-[0.14em] text-muted">
                    <th className="px-4 py-2 text-left font-semibold sm:px-5">Variant</th>
                    <th className="px-2 py-2 text-left font-semibold">SKU</th>
                    <th className="px-2 py-2 text-right font-semibold">Price override</th>
                    <th className="px-2 py-2 text-right font-semibold">Stock</th>
                    <th className="px-2 py-2 text-right font-semibold">Low at</th>
                    <th className="px-2 py-2 text-left font-semibold">Image</th>
                    <th className="px-2 py-2 text-center font-semibold">Active</th>
                    <th className="w-10 px-2 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {variants.map((v, idx) => (
                    <tr key={v.id ?? `${optionsKey(v.options)}-${idx}`} className="border-b border-line/60 last:border-0">
                      <td className="px-4 py-2 sm:px-5">
                        <input
                          value={v.title}
                          onChange={(e) => setVariants((s) => s.map((x, i) => (i === idx ? { ...x, title: e.target.value } : x)))}
                          className="field-box py-1.5 text-xs"
                          aria-label="Variant title"
                        />
                      </td>
                      <td className="px-2 py-2">
                        <input
                          value={v.sku}
                          onChange={(e) => setVariants((s) => s.map((x, i) => (i === idx ? { ...x, sku: e.target.value } : x)))}
                          className="field-box w-28 py-1.5 font-mono text-xs"
                          aria-label="Variant SKU"
                        />
                      </td>
                      <td className="px-2 py-2 text-right">
                        <input
                          value={v.priceMajor}
                          onChange={(e) => setVariants((s) => s.map((x, i) => (i === idx ? { ...x, priceMajor: e.target.value } : x)))}
                          inputMode="decimal"
                          placeholder="—"
                          className="field-box w-24 py-1.5 text-right font-mono text-xs"
                          aria-label="Price override"
                        />
                      </td>
                      <td className="px-2 py-2 text-right">
                        <input
                          type="number"
                          min={0}
                          value={v.stock}
                          onChange={(e) => setVariants((s) => s.map((x, i) => (i === idx ? { ...x, stock: Math.max(0, Number(e.target.value) || 0) } : x)))}
                          className={cn("field-box w-16 py-1.5 text-right font-mono text-xs", v.stock === 0 && "border-danger/50")}
                          aria-label="Stock"
                        />
                      </td>
                      <td className="px-2 py-2 text-right">
                        <input
                          type="number"
                          min={0}
                          value={v.lowStockAt}
                          onChange={(e) => setVariants((s) => s.map((x, i) => (i === idx ? { ...x, lowStockAt: Math.max(0, Number(e.target.value) || 0) } : x)))}
                          className="field-box w-14 py-1.5 text-right font-mono text-xs"
                          aria-label="Low stock threshold"
                        />
                      </td>
                      <td className="px-2 py-2">
                        <select
                          value={v.imageUrl ?? ""}
                          onChange={(e) => setVariants((s) => s.map((x, i) => (i === idx ? { ...x, imageUrl: e.target.value || null } : x)))}
                          className="field-box w-28 py-1.5 text-xs"
                          aria-label="Variant image"
                        >
                          <option value="">Auto</option>
                          {images.map((img, i) => (
                            <option key={img.url} value={img.url}>
                              Image {i + 1}
                              {img.colorName ? ` · ${img.colorName}` : ""}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-2 py-2 text-center">
                        <input
                          type="checkbox"
                          checked={v.isActive}
                          onChange={(e) => setVariants((s) => s.map((x, i) => (i === idx ? { ...x, isActive: e.target.checked } : x)))}
                          className="h-3.5 w-3.5 accent-[rgb(var(--c-oxide))]"
                          aria-label="Variant active"
                        />
                      </td>
                      <td className="px-2 py-2 text-right">
                        <button type="button" onClick={() => setVariants((s) => s.filter((_, i) => i !== idx))} className="p-1 text-muted hover:text-danger" aria-label="Remove variant">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {/* ── Size guide ── */}
      <section className={cn(tab !== "sizeguide" && "hidden")}>
        <div className="card p-4 sm:p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-[0.68rem] font-semibold uppercase tracking-[0.16em]">Size guide</h3>
              <p className="mt-1 text-xs text-muted">Shown in a drawer on the product page and used by the concierge when a customer asks about fit.</p>
            </div>
            {guide ? (
              <button type="button" onClick={() => setGuide(null)} className="btn-ghost text-[0.62rem] text-danger">
                <Trash2 className="h-3 w-3" />
                Remove guide
              </button>
            ) : (
              <button type="button" onClick={() => setGuide(ensureGuide())} className="btn-outline px-3 py-2 text-[0.62rem]">
                <Plus className="h-3 w-3" />
                Add a size guide
              </button>
            )}
          </div>

          {!guide ? (
            <p className="py-10 text-center text-sm text-muted">No size guide for this product.</p>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap items-end gap-3">
                <label className="block">
                  <span className="mb-1 block text-[0.58rem] uppercase tracking-[0.14em] text-muted">Unit</span>
                  <select value={guide.unit} onChange={(e) => setGuide({ ...guide, unit: e.target.value as "cm" | "in" })} className="field-box w-24 py-1.5 text-xs">
                    <option value="cm">cm</option>
                    <option value="in">in</option>
                  </select>
                </label>
                <button
                  type="button"
                  onClick={() => setGuide({ ...guide, labels: [...guide.labels, `Column ${guide.labels.length + 1}`], rows: guide.rows.map((r) => [...r, ""]) })}
                  className="btn-outline px-3 py-2 text-[0.62rem]"
                >
                  <Plus className="h-3 w-3" />
                  Add column
                </button>
                <button
                  type="button"
                  onClick={() => setGuide({ ...guide, rows: [...guide.rows, guide.labels.map(() => "")] })}
                  className="btn-outline px-3 py-2 text-[0.62rem]"
                >
                  <Plus className="h-3 w-3" />
                  Add row
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="border-collapse">
                  <thead>
                    <tr>
                      {guide.labels.map((label, ci) => (
                        <th key={ci} className="border border-line p-1">
                          <div className="flex items-center gap-1">
                            <input
                              value={label}
                              onChange={(e) => setGuide({ ...guide, labels: guide.labels.map((l, i) => (i === ci ? e.target.value : l)) })}
                              className="field-box w-28 py-1 text-xs font-semibold"
                              aria-label={`Column ${ci + 1} label`}
                            />
                            <button
                              type="button"
                              onClick={() =>
                                setGuide({
                                  ...guide,
                                  labels: guide.labels.filter((_, i) => i !== ci),
                                  rows: guide.rows.map((r) => r.filter((_, i) => i !== ci)),
                                })
                              }
                              className="p-0.5 text-muted hover:text-danger"
                              aria-label="Remove column"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        </th>
                      ))}
                      <th className="border border-line p-1" />
                    </tr>
                  </thead>
                  <tbody>
                    {guide.rows.map((row, ri) => (
                      <tr key={ri}>
                        {guide.labels.map((_, ci) => (
                          <td key={ci} className="border border-line p-1">
                            <input
                              value={row[ci] ?? ""}
                              onChange={(e) =>
                                setGuide({
                                  ...guide,
                                  rows: guide.rows.map((r, i) => (i === ri ? r.map((c, j) => (j === ci ? e.target.value : c)) : r)),
                                })
                              }
                              className="field-box w-28 py-1 text-xs"
                              aria-label={`Row ${ri + 1} column ${ci + 1}`}
                            />
                          </td>
                        ))}
                        <td className="border border-line p-1 text-center">
                          <button type="button" onClick={() => setGuide({ ...guide, rows: guide.rows.filter((_, i) => i !== ri) })} className="p-1 text-muted hover:text-danger" aria-label="Remove row">
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <label className="block">
                <span className="mb-1.5 block text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-muted">Notes</span>
                <textarea
                  value={guide.notes}
                  onChange={(e) => setGuide({ ...guide, notes: e.target.value })}
                  className="field-box min-h-[80px]"
                  placeholder="Measurements are taken flat. If you are between sizes, take the larger."
                />
              </label>
            </div>
          )}
        </div>
      </section>

      {/* ── SEO ── */}
      <section className={cn("grid gap-5 xl:grid-cols-2", tab !== "seo" && "hidden")}>
        <div className="card p-4 sm:p-5">
          <h3 className="mb-4 text-[0.68rem] font-semibold uppercase tracking-[0.16em]">Search appearance</h3>
          <I18nInput
            name="seoTitle"
            label="SEO title"
            values={{ en: data.seoTitle.en, bn: data.seoTitle.bn }}
            layout="stack"
            placeholder="The Oxide Overshirt — ORYNVE"
            ai={
              {
                task: "seo_title",
                context: { name: data.name.en, description: data.description.en },
              } satisfies AiWriteConfig
            }
          />
          <I18nInput
            name="seoDescription"
            label="Meta description"
            values={{ en: data.seoDescription.en, bn: data.seoDescription.bn }}
            multiline
            rows={3}
            layout="stack"
            className="mt-4"
            ai={
              {
                task: "seo_description",
                context: { name: data.name.en, description: data.description.en },
              } satisfies AiWriteConfig
            }
          />
        </div>
        <div className="card p-4 sm:p-5">
          <h3 className="mb-4 text-[0.68rem] font-semibold uppercase tracking-[0.16em]">Preview</h3>
          <div className="border border-line bg-bone/40 p-4">
            <p className="truncate text-xs text-muted">orynve.com › product › {slug || "…"}</p>
            <p className="mt-1 line-clamp-1 text-base text-[#1a0dab]">{data.seoTitle.en || nameEn || "Product name"}</p>
            <p className="mt-1 line-clamp-2 text-xs text-muted">
              {data.seoDescription.en || "Add a meta description so search results read well. Around 150 characters is ideal."}
            </p>
          </div>
          <p className="mt-3 text-xs text-muted">Leave these blank to fall back to the product name and description.</p>
        </div>
      </section>

      {/* sticky save bar */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-paper/95 px-3 py-3 backdrop-blur sm:px-5 lg:pl-[16rem]">
        <div className="mx-auto flex max-w-[1500px] flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-muted">
            {data.id ? "Editing" : "New product"} · {images.length} image{images.length === 1 ? "" : "s"} · {variants.length} variant
            {variants.length === 1 ? "" : "s"}
          </p>
          <div className="flex items-center gap-2">
            <Link href="/admin/products" className="btn-ghost text-[0.65rem] text-muted">
              Cancel
            </Link>
            <SubmitButton pendingLabel="Saving…">
              <Save className="h-3.5 w-3.5" />
              {data.id ? "Save product" : "Create product"}
            </SubmitButton>
          </div>
        </div>
      </div>
    </form>
  );
}

export default ProductEditor;
