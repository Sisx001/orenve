"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { ImageIcon, Upload, X, Check, Loader2 } from "lucide-react";
import { Modal } from "@/components/ui";
import { apiFetch, ensureCsrf } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { MediaListResponse, MediaRow } from "@/lib/admin/types";

/* ───────────────────────────── upload with progress ───────────────────────────── */

export type UploadTask = { id: string; name: string; progress: number; error?: string; done?: boolean };

export async function uploadMedia(
  file: File,
  folder: string,
  onProgress: (pct: number) => void,
): Promise<MediaRow> {
  const token = await ensureCsrf();
  return new Promise((resolve, reject) => {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("folder", folder);
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/admin/media/upload");
    xhr.setRequestHeader("x-csrf-token", token);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      let data: { ok?: boolean; media?: MediaRow; error?: string } = {};
      try {
        data = JSON.parse(xhr.responseText);
      } catch {
        /* non-JSON response */
      }
      if (xhr.status >= 200 && xhr.status < 300 && data.ok && data.media) resolve(data.media);
      else reject(new Error(data.error ?? `Upload failed (${xhr.status})`));
    };
    xhr.onerror = () => reject(new Error("Network error during upload."));
    xhr.send(fd);
  });
}

/* ───────────────────────────── library browser ───────────────────────────── */

function Library({
  folder,
  onPick,
  selected,
  multiple,
}: {
  folder: string;
  onPick: (m: MediaRow) => void;
  selected: string[];
  multiple?: boolean;
}) {
  const [items, setItems] = useState<MediaRow[]>([]);
  const [folders, setFolders] = useState<string[]>([]);
  const [activeFolder, setActiveFolder] = useState(folder);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch<MediaListResponse>(
        `/api/admin/media?folder=${encodeURIComponent(activeFolder)}&q=${encodeURIComponent(q)}&take=60`,
      );
      setItems(res.items);
      setFolders(res.folders);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [activeFolder, q]);

  useEffect(() => {
    const t = setTimeout(load, q ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, q]);

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search media…" className="field-box flex-1 min-w-[10rem] py-2 text-xs" />
        <select value={activeFolder} onChange={(e) => setActiveFolder(e.target.value)} className="field-box w-auto py-2 text-xs">
          <option value="">All folders</option>
          {folders.map((f) => (
            <option key={f} value={f}>
              {f}
            </option>
          ))}
        </select>
      </div>
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-muted" />
        </div>
      ) : items.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted">No media yet — upload something.</p>
      ) : (
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {items.map((m) => {
            const isSel = selected.includes(m.url);
            return (
              <li key={m.id}>
                <button
                  type="button"
                  onClick={() => onPick(m)}
                  className={cn(
                    "group relative block aspect-square w-full overflow-hidden border transition",
                    isSel ? "border-oxide ring-1 ring-oxide" : "border-line hover:border-ink",
                  )}
                  title={m.name}
                >
                  {m.mime.startsWith("video/") ? (
                    <video src={m.url} className="h-full w-full object-cover" muted />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={m.url} alt={m.alt ?? m.name} className="h-full w-full object-cover" loading="lazy" />
                  )}
                  {isSel && (
                    <span className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center bg-oxide text-paper">
                      <Check className="h-3 w-3" />
                    </span>
                  )}
                  {multiple && !isSel && <span className="absolute inset-0 bg-ink/0 transition group-hover:bg-ink/10" />}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/* ───────────────────────────── uploader ───────────────────────────── */

export function MediaUploader({
  folder = "library",
  onUploaded,
  className,
  compact,
}: {
  folder?: string;
  onUploaded: (m: MediaRow) => void;
  className?: string;
  compact?: boolean;
}) {
  const [tasks, setTasks] = useState<UploadTask[]>([]);
  const [drag, setDrag] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(
    async (files: FileList | File[]) => {
      const list = Array.from(files);
      for (const file of list) {
        const id = `${file.name}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        setTasks((t) => [...t, { id, name: file.name, progress: 0 }]);
        try {
          const media = await uploadMedia(file, folder, (pct) => setTasks((t) => t.map((x) => (x.id === id ? { ...x, progress: pct } : x))));
          setTasks((t) => t.map((x) => (x.id === id ? { ...x, progress: 100, done: true } : x)));
          onUploaded(media);
          setTimeout(() => setTasks((t) => t.filter((x) => x.id !== id)), 1200);
        } catch (e) {
          const msg = e instanceof Error ? e.message : "Upload failed";
          setTasks((t) => t.map((x) => (x.id === id ? { ...x, error: msg } : x)));
        }
      }
    },
    [folder, onUploaded],
  );

  return (
    <div className={className}>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          if (e.dataTransfer.files.length) void handleFiles(e.dataTransfer.files);
        }}
        className={cn(
          "flex flex-col items-center justify-center border border-dashed px-4 text-center transition",
          compact ? "py-5" : "py-10",
          drag ? "border-oxide bg-oxide/5" : "border-line",
        )}
      >
        <Upload className="mb-2 h-5 w-5 text-muted" />
        <p className="text-sm">
          Drop files here or{" "}
          <button type="button" className="underline decoration-oxide underline-offset-4" onClick={() => inputRef.current?.click()}>
            browse
          </button>
        </p>
        <p className="mt-1 text-xs text-muted">JPEG, PNG, WebP, AVIF, GIF, SVG, MP4, WebM · up to 30 MB each</p>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="image/*,video/mp4,video/webm"
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) void handleFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>
      {tasks.length > 0 && (
        <ul className="mt-3 space-y-2">
          {tasks.map((t) => (
            <li key={t.id} className="text-xs">
              <div className="mb-1 flex items-center justify-between gap-2">
                <span className="truncate">{t.name}</span>
                <span className={cn("shrink-0 tabular-nums", t.error && "text-danger")}>{t.error ? "Failed" : `${t.progress}%`}</span>
              </div>
              <div className="h-1 w-full bg-line">
                <div className={cn("h-1 transition-all", t.error ? "bg-danger" : "bg-oxide")} style={{ width: `${t.error ? 100 : t.progress}%` }} />
              </div>
              {t.error && <p className="mt-1 text-danger">{t.error}</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ───────────────────────────── picker modal ───────────────────────────── */

export function MediaPicker({
  onSelect,
  folder = "library",
  multiple,
  trigger,
  title = "Media library",
  selected = [],
}: {
  onSelect: (url: string, media?: MediaRow) => void;
  folder?: string;
  multiple?: boolean;
  trigger?: ReactNode;
  title?: string;
  selected?: string[];
}) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"library" | "upload">("library");
  const [nonce, setNonce] = useState(0);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={trigger ? "inline-flex" : "btn-outline px-4 py-2.5 text-[0.65rem]"}>
        {trigger ?? (
          <>
            <ImageIcon className="h-3.5 w-3.5" />
            Choose media
          </>
        )}
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title={title} className="max-w-3xl">
        <div className="mb-4 flex gap-1 border-b border-line">
          {(["library", "upload"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={cn(
                "-mb-px border-b-2 px-3 py-2 text-[0.65rem] font-semibold uppercase tracking-[0.14em] transition",
                tab === t ? "border-oxide text-ink" : "border-transparent text-muted hover:text-ink",
              )}
            >
              {t === "library" ? "Library" : "Upload"}
            </button>
          ))}
        </div>
        {tab === "library" ? (
          <Library
            key={nonce}
            folder={folder}
            selected={selected}
            multiple={multiple}
            onPick={(m) => {
              onSelect(m.url, m);
              if (!multiple) setOpen(false);
            }}
          />
        ) : (
          <MediaUploader
            folder={folder}
            onUploaded={(m) => {
              onSelect(m.url, m);
              setNonce((n) => n + 1);
              if (!multiple) setOpen(false);
            }}
          />
        )}
      </Modal>
    </>
  );
}

/* ───────────────────────────── form field ───────────────────────────── */

/** Single-image form field: hidden input + preview + picker. */
export function MediaField({
  name,
  label,
  hint,
  defaultValue,
  folder = "library",
  aspect = "aspect-[4/3]",
}: {
  name: string;
  label?: ReactNode;
  hint?: ReactNode;
  defaultValue?: string | null;
  folder?: string;
  aspect?: string;
}) {
  const [url, setUrl] = useState(defaultValue ?? "");
  return (
    <div>
      {label && <span className="mb-1.5 block text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-muted">{label}</span>}
      <input type="hidden" name={name} value={url} />
      <div className="flex items-start gap-3">
        <div className={cn("w-28 shrink-0 overflow-hidden border border-line bg-bone", aspect)}>
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
          <div className="flex flex-wrap gap-2">
            <MediaPicker folder={folder} onSelect={(u) => setUrl(u)} />
            {url && (
              <button type="button" onClick={() => setUrl("")} className="btn-ghost text-[0.65rem] text-danger">
                <X className="h-3.5 w-3.5" />
                Remove
              </button>
            )}
          </div>
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="…or paste a URL"
            className="field-box mt-2 py-2 text-xs"
          />
          {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
        </div>
      </div>
    </div>
  );
}

export default MediaPicker;
