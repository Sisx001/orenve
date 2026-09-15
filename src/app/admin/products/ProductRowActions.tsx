"use client";

import { CsrfInput } from "@/components/admin/Csrf";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { Copy, MoreHorizontal, Star, Trash2, Archive, Loader2 } from "lucide-react";
import { deleteProductAction, duplicateProductAction, setProductStatusAction } from "@/lib/admin/actions/products";
import { idleState } from "@/lib/admin/action-state";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";

/** Inline featured toggle — optimistic, persisted through the JSON route. */
export function FeaturedToggle({ id, featured }: { id: string; featured: boolean }) {
  const [on, setOn] = useState(featured);
  const [busy, setBusy] = useState(false);

  return (
    <button
      type="button"
      disabled={busy}
      aria-pressed={on}
      aria-label={on ? "Remove from featured" : "Mark as featured"}
      onClick={async () => {
        const next = !on;
        setOn(next);
        setBusy(true);
        try {
          await apiFetch(`/api/admin/products/${id}`, { method: "PATCH", json: { featured: next } });
        } catch (e) {
          setOn(!next);
          toast.error(e instanceof Error ? e.message : "Could not save.");
        } finally {
          setBusy(false);
        }
      }}
      className="p-1 transition"
      title={on ? "Featured on the homepage" : "Not featured"}
    >
      {busy ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin text-muted" />
      ) : (
        <Star className={cn("h-3.5 w-3.5", on ? "fill-brass text-brass" : "text-line hover:text-muted")} />
      )}
    </button>
  );
}

export function ProductRowActions({ id, csrf, status }: { id: string; csrf: string; status: string }) {
  const [dupState, dupAction] = useActionState(duplicateProductAction, idleState);
  const [statusState, statusAction] = useActionState(setProductStatusAction, idleState);
  const [delState, delAction] = useActionState(deleteProductAction, idleState);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    for (const s of [dupState, statusState, delState]) {
      if (s.error) toast.error(s.error);
      else if (s.ok && s.message) toast.success(s.message);
    }
  }, [dupState, statusState, delState]);

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [open]);

  return (
    <div className="relative inline-flex">
      <button
        type="button"
        aria-label="Product actions"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className="p-1 text-muted hover:text-ink"
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>
      {open && (
        <div className="absolute right-0 top-full z-30 mt-1 w-48 border border-line bg-paper shadow-lg" onClick={(e) => e.stopPropagation()}>
          <form action={dupAction}>
            <CsrfInput value={csrf} />
            <input type="hidden" name="productId" value={id} />
            <button type="submit" className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs hover:bg-bone">
              <Copy className="h-3.5 w-3.5 text-muted" />
              Duplicate
            </button>
          </form>
          <form action={statusAction}>
            <CsrfInput value={csrf} />
            <input type="hidden" name="productId" value={id} />
            <input type="hidden" name="status" value={status === "archived" ? "draft" : "archived"} />
            <button type="submit" className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs hover:bg-bone">
              <Archive className="h-3.5 w-3.5 text-muted" />
              {status === "archived" ? "Restore to draft" : "Archive"}
            </button>
          </form>
          <form action={delAction} className="border-t border-line">
            <CsrfInput value={csrf} />
            <input type="hidden" name="productId" value={id} />
            <button
              type="submit"
              onClick={(e) => {
                if (!window.confirm("Delete this product? Products used in past orders are archived instead.")) e.preventDefault();
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-danger hover:bg-danger/5"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
