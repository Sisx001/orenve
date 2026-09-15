"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";

/** Copies text to the clipboard with a short confirmation state. */
export function CopyButton({ value, className, label }: { value: string; className?: string; label?: string }) {
  const t = useT();
  const [done, setDone] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      return;
    }
    setDone(true);
    setTimeout(() => setDone(false), 1800);
  }

  return (
    <button type="button" onClick={copy} className={cn("btn-ghost text-muted hover:text-ink", className)} aria-label={label ?? t("common.copy")}>
      {done ? <Check className="h-3.5 w-3.5 text-success" aria-hidden /> : <Copy className="h-3.5 w-3.5" aria-hidden />}
      <span>{done ? t("common.copied") : (label ?? t("common.copy"))}</span>
    </button>
  );
}
