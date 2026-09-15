"use client";

import { CsrfInput } from "@/components/admin/Csrf";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Pencil, Plus, Trash2 } from "lucide-react";
import { Badge, Modal } from "@/components/ui";
import { I18nInput, SelectField, SubmitButton, TextField, ToggleRow } from "@/components/admin/Fields";
import { MediaField } from "@/components/admin/MediaPicker";
import {
  deleteCategoryAction,
  deleteCollectionAction,
  reorderCatalogAction,
  saveCategoryAction,
  saveCollectionAction,
} from "@/lib/admin/actions/commerce";
import { idleState } from "@/lib/admin/action-state";
import { slugify } from "@/lib/utils";
import { cn } from "@/lib/utils";

export type CatalogRow = {
  id: string;
  slug: string;
  nameEn: string;
  nameBn: string;
  descriptionEn: string;
  descriptionBn: string;
  image: string | null;
  parentId?: string | null;
  isActive?: boolean;
  isPublished?: boolean;
  sortOrder: number;
  products: number;
};

type Kind = "collections" | "categories";

export function CatalogManager({
  categories,
  collections,
  csrf,
  initialTab,
}: {
  categories: CatalogRow[];
  collections: CatalogRow[];
  csrf: string;
  initialTab: Kind;
}) {
  const [tab, setTab] = useState<Kind>(initialTab);
  const [catState, catAction] = useActionState(saveCategoryAction, idleState);
  const [colState, colAction] = useActionState(saveCollectionAction, idleState);
  const [delCatState, delCatAction] = useActionState(deleteCategoryAction, idleState);
  const [delColState, delColAction] = useActionState(deleteCollectionAction, idleState);
  const [, reorderAction] = useActionState(reorderCatalogAction, idleState);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<CatalogRow | null>(null);
  const [slug, setSlug] = useState("");
  const [nameEn, setNameEn] = useState("");
  const [slugLocked, setSlugLocked] = useState(false);

  const state = tab === "categories" ? catState : colState;

  useEffect(() => {
    for (const s of [catState, colState]) {
      if (s.error) toast.error(s.error);
      else if (s.ok && s.message) {
        toast.success(s.message);
        setOpen(false);
      }
    }
  }, [catState, colState]);
  useEffect(() => {
    for (const s of [delCatState, delColState]) {
      if (s.error) toast.error(s.error);
      else if (s.ok && s.message) toast.success(s.message);
    }
  }, [delCatState, delColState]);

  useEffect(() => {
    if (!slugLocked) setSlug(slugify(nameEn));
  }, [nameEn, slugLocked]);

  const openNew = () => {
    setEditing(null);
    setNameEn("");
    setSlug("");
    setSlugLocked(false);
    setOpen(true);
  };
  const openEdit = (row: CatalogRow) => {
    setEditing(row);
    setNameEn(row.nameEn);
    setSlug(row.slug);
    setSlugLocked(true);
    setOpen(true);
  };

  const rows = tab === "categories" ? categories : collections;
  const delAction = tab === "categories" ? delCatAction : delColAction;
  const idField = tab === "categories" ? "categoryId" : "collectionId";

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-line">
        <div className="flex gap-1">
          {(["collections", "categories"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={cn(
                "-mb-px flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-[0.68rem] font-semibold uppercase tracking-[0.14em] transition",
                tab === t ? "border-oxide text-ink" : "border-transparent text-muted hover:text-ink",
              )}
            >
              {t}
              <span className={cn("tabular-nums", tab === t ? "text-oxide" : "text-muted/70")}>{t === "categories" ? categories.length : collections.length}</span>
            </button>
          ))}
        </div>
        <button type="button" onClick={openNew} className="btn mb-2 px-4 py-2.5 text-[0.65rem]">
          <Plus className="h-3.5 w-3.5" />
          New {tab === "categories" ? "category" : "collection"}
        </button>
      </div>

      <p className="mb-4 text-sm text-muted">
        {tab === "categories"
          ? "Categories are the shop's navigation spine — a product belongs to one. They can nest one level."
          : "Collections are editorial groupings — a product can sit in several, and each gets its own storefront page."}
      </p>

      {rows.length === 0 ? (
        <div className="card px-6 py-20 text-center text-sm text-muted">Nothing here yet.</div>
      ) : (
        <ul className="space-y-2">
          {rows.map((row, idx) => (
            <li key={row.id} className="card flex items-center gap-3 p-3">
              <span className="h-14 w-14 shrink-0 overflow-hidden border border-line bg-bone">
                {row.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={row.image} alt="" className="h-full w-full object-cover" />
                ) : null}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium">{row.nameEn}</p>
                  {tab === "collections" ? (
                    <Badge tone={row.isPublished ? "success" : "neutral"}>{row.isPublished ? "Published" : "Draft"}</Badge>
                  ) : (
                    <Badge tone={row.isActive ? "success" : "neutral"}>{row.isActive ? "Active" : "Hidden"}</Badge>
                  )}
                </div>
                <p className="truncate font-mono text-[0.68rem] text-muted">
                  {row.slug} · {row.products} product{row.products === 1 ? "" : "s"}
                  {row.parentId ? " · nested" : ""}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-0.5">
                {(["up", "down"] as const).map((dir) => (
                  <form key={dir} action={reorderAction}>
                    <CsrfInput value={csrf} />
                    <input type="hidden" name="kind" value={tab === "categories" ? "category" : "collection"} />
                    <input type="hidden" name="id" value={row.id} />
                    <input type="hidden" name="direction" value={dir} />
                    <button
                      type="submit"
                      disabled={dir === "up" ? idx === 0 : idx === rows.length - 1}
                      aria-label={`Move ${dir}`}
                      className="p-1 text-muted disabled:opacity-30 hover:text-ink"
                    >
                      {dir === "up" ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />}
                    </button>
                  </form>
                ))}
                <button type="button" onClick={() => openEdit(row)} aria-label="Edit" className="p-1 text-muted hover:text-ink">
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <form action={delAction}>
                  <CsrfInput value={csrf} />
                  <input type="hidden" name={idField} value={row.id} />
                  <button
                    type="submit"
                    aria-label="Delete"
                    onClick={(e) => {
                      if (!window.confirm(`Delete “${row.nameEn}”?${row.products > 0 ? ` ${row.products} product(s) reference it.` : ""}`)) e.preventDefault();
                    }}
                    className="p-1 text-muted hover:text-danger"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? `Edit “${editing.nameEn}”` : `New ${tab === "categories" ? "category" : "collection"}`}
      >
        <form action={tab === "categories" ? catAction : colAction} className="space-y-4" key={`${tab}-${editing?.id ?? "new"}`}>
          <CsrfInput value={csrf} />
          {editing && <input type="hidden" name="id" value={editing.id} />}

          <div>
            <span className="mb-1.5 block text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-muted">
              Name <span className="text-oxide">*</span>
            </span>
            <div className="grid gap-2 sm:grid-cols-2">
              <div>
                <span className="mb-1 block text-[0.56rem] uppercase tracking-[0.14em] text-muted">English</span>
                <input name="name_en" value={nameEn} onChange={(e) => setNameEn(e.target.value)} required className="field-box" placeholder="Outerwear" />
              </div>
              <div>
                <span className="mb-1 block text-[0.56rem] uppercase tracking-[0.14em] text-muted">বাংলা</span>
                <input name="name_bn" defaultValue={editing?.nameBn ?? ""} className="field-box font-bangla" />
              </div>
            </div>
            {state.fieldErrors?.name_en && <p className="mt-1 text-xs text-danger">{state.fieldErrors.name_en}</p>}
          </div>

          <TextField
            name="slug"
            label="Slug"
            value={slug}
            onChange={(e) => {
              setSlugLocked(true);
              setSlug(e.target.value);
            }}
            required
            error={state.fieldErrors?.slug}
            inputClassName="font-mono text-xs"
          />

          <I18nInput name="description" label="Description" en={editing?.descriptionEn} bn={editing?.descriptionBn} multiline rows={3} />

          <MediaField name="image" label="Image" defaultValue={editing?.image ?? null} folder="catalog" hint="Used on the collection card and page header." />

          {tab === "categories" ? (
            <>
              <SelectField
                name="parentId"
                label="Parent category"
                defaultValue={editing?.parentId ?? ""}
                options={[
                  { value: "", label: "Top level" },
                  ...categories.filter((c) => c.id !== editing?.id).map((c) => ({ value: c.id, label: c.nameEn })),
                ]}
              />
              <ToggleRow name="isActive" label="Active" hint="Hidden categories stay out of the shop navigation." defaultChecked={editing ? Boolean(editing.isActive) : true} />
            </>
          ) : (
            <ToggleRow name="isPublished" label="Published" hint="Only published collections get a storefront page." defaultChecked={editing ? Boolean(editing.isPublished) : false} />
          )}

          <TextField name="sortOrder" label="Sort order" type="number" min={0} defaultValue={String(editing?.sortOrder ?? rows.length)} />

          <div className="flex justify-end gap-2 border-t border-line pt-4">
            <button type="button" onClick={() => setOpen(false)} className="btn-outline px-4 py-2.5 text-[0.65rem]">
              Cancel
            </button>
            <SubmitButton size="sm" pendingLabel="Saving…">
              Save
            </SubmitButton>
          </div>
        </form>
      </Modal>
    </>
  );
}

export default CatalogManager;
