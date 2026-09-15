"use client";

import { MessageCircle } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { useConfig } from "@/components/providers/ConfigProvider";

/** Fallback float shown when the AI concierge is switched off. */
export function WhatsappFloat() {
  const t = useT();
  const { config } = useConfig();
  const number = config.contact.whatsapp.replace(/\D/g, "");
  if (!number) return null;
  return (
    <a
      href={`https://wa.me/${number}`}
      target="_blank"
      rel="noopener noreferrer"
      className="safe-bottom fixed bottom-4 right-4 z-[80] [body:has([data-sticky-bar])_&]:bottom-[5.5rem] md:[body:has([data-sticky-bar])_&]:bottom-6 flex items-center gap-2.5 border border-ink bg-ink px-5 py-3.5 text-[0.66rem] font-semibold uppercase tracking-[0.16em] text-paper shadow-xl transition hover:border-oxide hover:bg-oxide md:bottom-6 md:right-6"
    >
      <MessageCircle className="h-4 w-4" aria-hidden />
      {t("contact.whatsapp")}
    </a>
  );
}
