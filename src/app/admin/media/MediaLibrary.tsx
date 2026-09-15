"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Check, Copy, Loader2, Trash2 } from "lucide-react";
import { Modal } from "@/components/ui";
import { MediaUploader } from "@/components/admin/MediaPicker";
import { TextField } from "@/components/admin/Fields";
import { apiFetch } from "@/lib/api";
import type { MediaListResponse, MediaRow } from "@/lib/admin/types";
import { cn } from "@/lib/utils";

const kb = (n: number) => (n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

export function MediaLibrary({ initialFolders }: { initialFolders: string[] }) {
  const [items, setItems] = useState<MediaRow[]>([]);
  const [folders, setFolders] = useState<string[]>(initialFolders);
  const [folder, setFolder] = useState("");
  const [uploadFolder, setUploadFolder] = useState("library");
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<MediaRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch<MediaListResponse>(`/api/admin/media?folder=${encodeURIComponent(folder)}&q=${encodeURIComponent(q)}&take=120`);
      setItems(res.items);
      setFolders(res.folders);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not load the library.");
    } finally {
      setLoading(false);
    }
  }, [folder, q]);

  useEffect(() => {
    const t = setTimeout(load, q ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, q]);

  const save = async () => {
    if (!editing) return;
    setBusy(true);
    try {
      await apiFetch(`/api/admin/media/${editing.id}`, {
        method: "PATCH",
        json: { name: editing.name, alt: editing.alt ?? "", folder: editing.folder },
      });
      toast.success("Saved.");
      setEditing(null);
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (m: MediaRow) => {
    if (!window.confirm(`Delete “${m.name}”? Anything using this file will show a broken image.`)) return;
    setBusy(true);
    try {
      const res = await apiFetch<{ inUse: number }>(`/api/admin/media/${m.id}`, { method: "DELETE" });
      toast.success(res.inUse > 0 ? `Deleted — it was still used by ${res.inUse} product image(s).` : "Deleted.");
      setEditing(null);
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete.");
    } finally {
      setBusy(false);
    }
  };

  const copy = (url: string) => {
    void navigator.clipboard?.writeText(url);
    setCopied(url);
    setTimeout(() => setCopied(null), 1400);
  };

  return (
    <div className="space-y-5">
      <div className="card p-4 sm:p-5">
        <div className="mb-3 flex flex-wrap items-end gap-3">
          <label className="block">
            <span className="mb-1 block text-[0.58rem] uppercase tracking-[0.14em] text-muted">Upload into folder</span>
            <input value={uploadFolder} onChange={(e) => setUploadFolder(e.target.value)} className="field-box py-2 text-xs" placeholder="library" />
          </label>
          <p className="text-xs text-muted">Folders are plain labels — use them to group product shots, editorial and brand assets.</p>
        </div>
        <MediaUploader
          folder={uploadFolder || "library"}
          compact
          onUploaded={(m) => {
            setItems((s) => [m, ...s]);
            if (!folders.includes(m.folder)) setFolders((f) => [...f, m.folder]);
          }}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2.5">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name or alt text…" className="field-box min-w-[14rem] flex-1 py-2 text-sm" />
        <select value={folder} onChange={(e) => setFolder(e.target.value)} className="field-box w-auto py-2 text-xs">
          <option value="">All folders</option>
          {folders.map((f) => (
            <option key={f} value={f}>
              {f}
            </option>
          ))}
        </select>
        <span className="text-xs text-muted">{items.length} file{items.length === 1 ? "" : "s"}</span>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-5 w-5 animate-spin text-muted" />
        </div>
      ) : items.length === 0 ? (
        <div className="card px-6 py-16 text-center text-sm text-muted">Nothing in this folder yet.</div>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6">
          {items.map((m) => (
            <li key={m.id} className="group card overflow-hidden">
              <button type="button" onClick={() => setEditing(m)} className="block aspect-square w-full overflow-hidden bg-bone">
                {m.mime.startsWith("video/") ? (
                  <video src={m.url} muted className="h-full w-full object-cover" />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={m.url} alt={m.alt ?? m.name} className="h-full w-full object-cover transition group-hover:scale-[1.02]" loading="lazy" />
                )}
              </button>
              <div className="flex items-start justify-between gap-1.5 border-t border-line px-2 py-1.5">
                <div className="min-w-0">
                  <p className="truncate text-xs">{m.name}</p>
                  <p className="truncate text-[0.6rem] text-muted">
                    {m.width && m.height ? `${m.width}×${m.height} · ` : ""}
                    {kb(m.size)}
                  </p>
                </div>
                <button type="button" onClick={() => copy(m.url)} aria-label="Copy URL" className="shrink-0 p-0.5 text-muted hover:text-ink">
                  {copied === m.url ? <Check className="h-3 w-3 text-success" /> : <Copy className="h-3 w-3" />}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Modal open={!!editing} onClose={() => setEditing(null)} title="Edit file">
        {editing && (
          <div className="space-y-4">
            <div className="overflow-hidden border border-line bg-bone">
              {editing.mime.startsWith("video/") ? (
                <video src={editing.url} controls className="max-h-64 w-full object-contain" />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={editing.url} alt={editing.alt ?? editing.name} className="max-h-64 w-full object-contain" />
              )}
            </div>
            <TextField label="Name" value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
            <TextField
              label="Alt text"
              value={editing.alt ?? ""}
              onChange={(e) => setEditing({ ...editing, alt: e.target.value })}
              hint="Describe the image for screen readers and search engines."
            />
            <TextField label="Folder" value={editing.folder} onChange={(e) => setEditing({ ...editing, folder: e.target.value })} />
            <div className="border border-line bg-bone/60 p-2.5">
              <p className="mb-1 text-[0.58rem] uppercase tracking-[0.14em] text-muted">URL</p>
              <p className="break-all font-mono text-xs">{editing.url}</p>
              <button type="button" onClick={() => copy(editing.url)} className="btn-ghost mt-1.5 text-[0.62rem]">
                {copied === editing.url ? "Copied" : "Copy URL"}
              </button>
            </div>
            <div className="flex items-center justify-between gap-2 border-t border-line pt-4">
              <button type="button" onClick={() => remove(editing)} disabled={busy} className={cn("btn-ghost text-[0.65rem] text-danger")}>
                <Trash2 className="h-3.5 w-3.5" />
                Delete
              </button>
              <div className="flex gap-2">
                <button type="button" onClick={() => setEditing(null)} className="btn-outline px-4 py-2.5 text-[0.65rem]">
                  Close
                </button>
                <button type="button" onClick={save} disabled={busy} className="btn px-4 py-2.5 text-[0.65rem]">
                  {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Save
                </button>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

export default MediaLibrary;
