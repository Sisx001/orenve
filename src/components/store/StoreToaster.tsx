"use client";

import { Toaster } from "sonner";

/** Sonner toaster, styled to the ORYNVE palette. */
export function StoreToaster() {
  return (
    <Toaster
      position="bottom-center"
      gap={10}
      toastOptions={{
        unstyled: false,
        classNames: {
          toast: "!rounded-none !border !border-line !bg-paper !text-ink !font-sans !text-[0.8rem] !shadow-xl",
          description: "!text-muted",
          actionButton: "!bg-ink !text-paper !rounded-none",
          cancelButton: "!bg-bone !text-ink !rounded-none",
        },
      }}
    />
  );
}
