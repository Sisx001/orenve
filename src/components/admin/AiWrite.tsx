"use client";

import { useState } from "react";
import { Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";

/* ───────────────────────── types ───────────────────────── */

export type AiWriteConfig = {
  task:
    | "product_description"
    | "size_notes"
    | "seo_title"
    | "seo_description"
    | "banner"
    | "announcement"
    | "email"
    | "page"
    | "tagline"
    | "generic";
  context?: Record<string, string | number | undefined>;
  maxWords?: number;
};

type WriteOptions = {
  task: AiWriteConfig["task"];
  locale: string;
  context?: Record<string, string | number | undefined>;
  mode: "write" | "improve" | "translate";
  text?: string;
  sourceText?: string;
  maxWords?: number;
};

/* ───────────────────────── hook ───────────────────────── */

/** Low-level hook used by I18nInput and standalone AiWriteButton. */
export function useAiWrite() {
  const [busy, setBusy] = useState(false);

  async function write(opts: WriteOptions): Promise<string> {
    setBusy(true);
    try {
      const res = await apiFetch<{ text: string }>("/api/admin/ai/write", {
        method: "POST",
        json: opts,
      });
      return res.text;
    } finally {
      setBusy(false);
    }
  }

  return { write, busy };
}

/* ───────────────────────── standalone button ───────────────────────── */

/**
 * Standalone AI write button for plain (non-I18nInput) fields.
 * Calls `onResult` with the generated text so the parent can update its state.
 */
export function AiWriteButton({
  task,
  locale,
  context,
  mode,
  currentText,
  sourceText,
  maxWords,
  onResult,
  label,
  className,
}: {
  task: AiWriteConfig["task"];
  locale: string;
  context?: AiWriteConfig["context"];
  mode: "write" | "improve" | "translate";
  currentText?: string;
  sourceText?: string;
  maxWords?: number;
  onResult: (text: string) => void;
  label?: string;
  className?: string;
}) {
  const { write, busy } = useAiWrite();

  async function handleClick() {
    try {
      const text = await write({
        task,
        locale,
        context,
        mode,
        text: currentText,
        sourceText,
        maxWords,
      });
      onResult(text);
      toast.success("AI copy ready");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "AI write failed";
      if (msg === "ai.offline" || msg.includes("ai.offline")) {
        toast.info("AI not configured");
      } else {
        toast.error(msg);
      }
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={busy}
      className={cn(
        "inline-flex items-center gap-1 border border-line px-2 py-0.5 text-[0.58rem] font-semibold uppercase tracking-[0.14em] text-muted transition hover:border-oxide hover:text-oxide disabled:opacity-50",
        className,
      )}
    >
      {busy ? (
        <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
      ) : (
        <Sparkles className="h-3 w-3" aria-hidden />
      )}
      {label ?? "Write"}
    </button>
  );
}
