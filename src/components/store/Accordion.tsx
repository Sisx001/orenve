"use client";

import { useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Plus } from "lucide-react";
import { EASE } from "@/lib/store/motion";
import { cn } from "@/lib/utils";

export type AccordionItem = { id: string; title: string; content: ReactNode };

/** Hairline accordion used for product details and FAQ-style copy. */
export function Accordion({ items, defaultOpen, className }: { items: AccordionItem[]; defaultOpen?: string; className?: string }) {
  const [open, setOpen] = useState<string | null>(defaultOpen ?? null);
  if (items.length === 0) return null;
  return (
    <div className={cn("border-t border-line", className)}>
      {items.map((item) => {
        const isOpen = open === item.id;
        return (
          <div key={item.id} className="border-b border-line">
            <h3>
              <button
                type="button"
                onClick={() => setOpen(isOpen ? null : item.id)}
                aria-expanded={isOpen}
                aria-controls={`acc-${item.id}`}
                className="flex w-full items-center justify-between gap-4 py-4 text-left text-[0.7rem] font-semibold uppercase tracking-[0.16em] transition hover:text-oxide"
              >
                <span>{item.title}</span>
                <Plus className={cn("h-4 w-4 shrink-0 text-muted transition-transform duration-500 ease-editorial", isOpen && "rotate-45 text-oxide")} aria-hidden />
              </button>
            </h3>
            <AnimatePresence initial={false}>
              {isOpen && (
                <motion.div
                  id={`acc-${item.id}`}
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.45, ease: EASE }}
                  className="overflow-hidden"
                >
                  <div className="pb-5 text-sm leading-relaxed text-muted">{item.content}</div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}
