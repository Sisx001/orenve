"use client";

import { useState, type ReactNode } from "react";
import { Modal } from "@/components/ui";
import { cn } from "@/lib/utils";

/**
 * Destructive-action guard. Renders its own trigger button and, on confirm,
 * submits a hidden form (so the work still happens in a server action).
 */
export function ConfirmDialog({
  trigger,
  title,
  body,
  confirmLabel = "Delete",
  cancelLabel = "Cancel",
  onConfirm,
  tone = "danger",
  children,
}: {
  trigger: ReactNode;
  title: string;
  body?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Called after the user confirms. Usually a form action or fetch. */
  onConfirm?: () => void | Promise<void>;
  tone?: "danger" | "neutral";
  /** Extra content shown inside the dialog (e.g. a reason textarea). */
  children?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  return (
    <>
      <span onClick={() => setOpen(true)} className="inline-flex">
        {trigger}
      </span>
      <Modal open={open} onClose={() => !busy && setOpen(false)} title={title}>
        {body && <div className="text-sm text-muted">{body}</div>}
        {children && <div className="mt-4">{children}</div>}
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" className="btn-outline px-4 py-2.5 text-[0.65rem]" onClick={() => setOpen(false)} disabled={busy}>
            {cancelLabel}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await onConfirm?.();
                setOpen(false);
              } finally {
                setBusy(false);
              }
            }}
            className={cn("btn px-4 py-2.5 text-[0.65rem]", tone === "danger" && "border-danger bg-danger hover:border-ink hover:bg-ink")}
          >
            {busy ? "Working…" : confirmLabel}
          </button>
        </div>
      </Modal>
    </>
  );
}

/**
 * Submit button that asks for confirmation before letting the form post.
 * Keeps progressive enhancement (it is a real submit button).
 */
export function ConfirmSubmit({
  children,
  message,
  className,
  name,
  value,
  formAction,
}: {
  children: ReactNode;
  message: string;
  className?: string;
  name?: string;
  value?: string;
  formAction?: (fd: FormData) => void | Promise<void>;
}) {
  return (
    <button
      type="submit"
      name={name}
      value={value}
      formAction={formAction as never}
      onClick={(e) => {
        if (!window.confirm(message)) e.preventDefault();
      }}
      className={cn("btn border-danger bg-danger px-4 py-2.5 text-[0.65rem] hover:border-ink hover:bg-ink", className)}
    >
      {children}
    </button>
  );
}

export default ConfirmDialog;
