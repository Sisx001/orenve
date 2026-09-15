"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Eye, EyeOff, GripVertical, Pencil, Plus, Trash2 } from "lucide-react";
import { Badge, Modal } from "@/components/ui";
import { CsrfInput } from "@/components/admin/Csrf";
import { SubmitButton } from "@/components/admin/Fields";
import { BlockDataForm, asPair, asString, asStringArray, type BlockData } from "./BlockFields";
import { addBlockAction, deleteBlockAction, moveBlockAction, saveBlockAction, toggleBlockAction } from "@/lib/admin/actions/content";
import { idleState } from "@/lib/admin/action-state";
import { BLOCK_SCHEMA } from "@/lib/admin/constants";
import { BLOCK_TYPES } from "@/lib/constants";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";

export type BlockRow = { id: string; type: string; isEnabled: boolean; position: number; data: BlockData };

/** One-line preview so the owner can tell blocks apart at a glance. */
function summarise(row: BlockRow): string {
  const d = row.data;
  const title = asPair(d.title).en || asPair(d.eyebrow).en;
  switch (row.type) {
    case "hero": {
      const imgs = asStringArray(d.images).length;
      return [title, asString(d.video) ? "video background" : imgs ? `${imgs} image${imgs === 1 ? "" : "s"}` : "no imagery"].filter(Boolean).join(" · ");
    }
    case "marquee":
      return asPair(d.text).en || "No text yet";
    case "featured":
    case "arrivals":
      return [title, d.limit ? `${asString(d.limit)} products` : ""].filter(Boolean).join(" · ");
    case "lookbook":
      return [title, `${(Array.isArray(d.frames) ? d.frames.length : 0)} frames`].filter(Boolean).join(" · ");
    case "testimonials":
      return `${Array.isArray(d.items) ? d.items.length : 0} quotes`;
    case "video":
      return asString(d.url) || "No video URL";
    case "newsletter":
      return "Email capture band";
    default:
      return title || BLOCK_SCHEMA[row.type]?.description || "";
  }
}

export function HomepageBuilder({ rows, csrf, page }: { rows: BlockRow[]; csrf: string; page: string }) {
  const [saveState, saveAction] = useActionState(saveBlockAction, idleState);
  const [addState, addAction] = useActionState(addBlockAction, idleState);
  const [toggleState, toggleAction] = useActionState(toggleBlockAction, idleState);
  const [delState, delAction] = useActionState(deleteBlockAction, idleState);
  const [, moveAction] = useActionState(moveBlockAction, idleState);

  const [editing, setEditing] = useState<BlockRow | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [order, setOrder] = useState(rows.map((r) => r.id));
  const [dragId, setDragId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => setOrder(rows.map((r) => r.id)), [rows]);

  useEffect(() => {
    for (const s of [saveState, addState, toggleState, delState]) {
      if (s.error) toast.error(s.error);
      else if (s.ok && s.message) toast.success(s.message);
    }
    if (saveState.ok) setEditing(null);
    if (addState.ok) setAddOpen(false);
  }, [saveState, addState, toggleState, delState]);

  const ordered = order.map((id) => rows.find((r) => r.id === id)).filter((r): r is BlockRow => Boolean(r));

  const persistOrder = async (ids: string[]) => {
    setSaving(true);
    try {
      await apiFetch("/api/admin/blocks/reorder", { method: "POST", json: { page, ids } });
      toast.success("Order saved.");
    } catch (e) {
      setOrder(rows.map((r) => r.id));
      toast.error(e instanceof Error ? e.message : "Could not save the order.");
    } finally {
      setSaving(false);
    }
  };

  const onDrop = (targetId: string) => {
    if (!dragId || dragId === targetId) return;
    const next = [...order];
    const from = next.indexOf(dragId);
    const to = next.indexOf(targetId);
    next.splice(from, 1);
    next.splice(to, 0, dragId);
    setOrder(next);
    setDragId(null);
    void persistOrder(next);
  };

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">
          Blocks render top to bottom. Drag a row, or use the arrows. {saving && <span className="text-oxide">Saving order…</span>}
        </p>
        <button type="button" onClick={() => setAddOpen(true)} className="btn px-4 py-2.5 text-[0.65rem]">
          <Plus className="h-3.5 w-3.5" />
          Add block
        </button>
      </div>

      {ordered.length === 0 ? (
        <div className="card px-6 py-20 text-center">
          <p className="text-sm text-muted">The homepage has no blocks. Add a hero to begin.</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {ordered.map((row, idx) => {
            const schema = BLOCK_SCHEMA[row.type];
            return (
              <li
                key={row.id}
                draggable
                onDragStart={() => setDragId(row.id)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => onDrop(row.id)}
                onDragEnd={() => setDragId(null)}
                className={cn("card flex items-center gap-3 p-3.5", dragId === row.id && "opacity-50", !row.isEnabled && "bg-bone/40")}
              >
                <span className="cursor-grab text-muted" aria-hidden>
                  <GripVertical className="h-4 w-4" />
                </span>
                <span className="w-6 shrink-0 text-center font-mono text-xs text-muted">{idx + 1}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium">{schema?.label ?? row.type}</p>
                    {!row.isEnabled && <Badge tone="neutral">Hidden</Badge>}
                  </div>
                  <p className="mt-0.5 truncate text-xs text-muted">{summarise(row)}</p>
                </div>
                <div className="flex shrink-0 items-center gap-0.5">
                  {(["up", "down"] as const).map((dir) => (
                    <form key={dir} action={moveAction}>
                      <CsrfInput value={csrf} />
                      <input type="hidden" name="blockId" value={row.id} />
                      <input type="hidden" name="page" value={page} />
                      <input type="hidden" name="direction" value={dir} />
                      <button
                        type="submit"
                        disabled={dir === "up" ? idx === 0 : idx === ordered.length - 1}
                        aria-label={`Move ${dir}`}
                        className="p-1 text-muted disabled:opacity-30 hover:text-ink"
                      >
                        {dir === "up" ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />}
                      </button>
                    </form>
                  ))}
                  <form action={toggleAction}>
                    <CsrfInput value={csrf} />
                    <input type="hidden" name="blockId" value={row.id} />
                    <button type="submit" aria-label={row.isEnabled ? "Hide block" : "Show block"} className="p-1 text-muted hover:text-ink">
                      {row.isEnabled ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                    </button>
                  </form>
                  <button type="button" onClick={() => setEditing(row)} aria-label="Edit block" className="p-1 text-muted hover:text-ink">
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <form action={delAction}>
                    <CsrfInput value={csrf} />
                    <input type="hidden" name="blockId" value={row.id} />
                    <button
                      type="submit"
                      aria-label="Delete block"
                      onClick={(e) => {
                        if (!window.confirm(`Remove the ${schema?.label ?? row.type} block?`)) e.preventDefault();
                      }}
                      className="p-1 text-muted hover:text-danger"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </form>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* add block */}
      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Add a block">
        <form action={addAction} className="space-y-3">
          <CsrfInput value={csrf} />
          <input type="hidden" name="page" value={page} />
          <ul className="space-y-1.5">
            {BLOCK_TYPES.map((t) => {
              const schema = BLOCK_SCHEMA[t];
              return (
                <li key={t}>
                  <button type="submit" name="type" value={t} className="flex w-full items-start gap-3 border border-line p-2.5 text-left transition hover:border-ink hover:bg-bone">
                    <span className="min-w-0">
                      <span className="block text-sm font-medium">{schema?.label ?? t}</span>
                      <span className="block text-xs text-muted">{schema?.description ?? ""}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </form>
      </Modal>

      {/* edit block */}
      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing ? `Edit ${BLOCK_SCHEMA[editing.type]?.label ?? editing.type}` : ""}
        description={editing ? BLOCK_SCHEMA[editing.type]?.description : undefined}
        className="max-w-2xl"
      >
        {editing && (
          <form action={saveAction} className="space-y-4" key={editing.id}>
            <CsrfInput value={csrf} />
            <input type="hidden" name="id" value={editing.id} />
            <input type="hidden" name="page" value={page} />
            <input type="hidden" name="type" value={editing.type} />
            <input type="hidden" name="isEnabled" value={editing.isEnabled ? "on" : ""} />
            <BlockDataForm fields={BLOCK_SCHEMA[editing.type]?.fields ?? []} initial={editing.data} />
            <div className="flex justify-end gap-2 border-t border-line pt-4">
              <button type="button" onClick={() => setEditing(null)} className="btn-outline px-4 py-2.5 text-[0.65rem]">
                Cancel
              </button>
              <SubmitButton size="sm" pendingLabel="Saving…">
                Save block
              </SubmitButton>
            </div>
          </form>
        )}
      </Modal>
    </>
  );
}

export default HomepageBuilder;
