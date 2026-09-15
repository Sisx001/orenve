"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { MessageCircle, RotateCcw, Send, X, ExternalLink } from "lucide-react";
import { useT, useLocale } from "@/lib/i18n/client";
import { useConfig } from "@/components/providers/ConfigProvider";
import { apiFetch } from "@/lib/store/api";
import { i18nText } from "@/lib/json";
import { DUR, EASE } from "@/lib/store/motion";
import { cn } from "@/lib/utils";

type Msg = { id: string; role: "user" | "assistant"; text: string; handoffUrl?: string | null; error?: boolean };

const OPEN_KEY = "orynve.concierge.open";
const MSG_KEY = "orynve.concierge.messages";
export const CONCIERGE_EVENT = "orynve:concierge";

/** Renders assistant text: line breaks preserved, same-origin paths linkified. */
function AssistantText({ text }: { text: string }) {
  const nodes: ReactNode[] = [];
  text.split("\n").forEach((line, li) => {
    if (li > 0) nodes.push(<br key={`br-${li}`} />);
    const parts = line.split(/(\/(?:en|bn)\/[A-Za-z0-9\-_/]+)/g);
    parts.forEach((part, pi) => {
      if (!part) return;
      if (/^\/(en|bn)\/[A-Za-z0-9\-_/]+$/.test(part)) {
        nodes.push(
          <Link key={`l-${li}-${pi}`} href={part} className="underline decoration-oxide underline-offset-4 hover:text-oxide">
            {part}
          </Link>,
        );
      } else {
        nodes.push(<span key={`t-${li}-${pi}`}>{part}</span>);
      }
    });
  });
  return <>{nodes}</>;
}

export function ConciergeWidget() {
  const t = useT();
  const locale = useLocale();
  const { config } = useConfig();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const resetNext = useRef(false);

  const enabled = config.features.aiConcierge && config.ai.enabled;
  const assistantName = i18nText(config.ai.assistantName, locale) || t("ai.title");
  const greeting = i18nText(config.ai.greeting, locale);

  // hydrate from sessionStorage
  useEffect(() => {
    try {
      setOpen(sessionStorage.getItem(OPEN_KEY) === "1");
      const saved = JSON.parse(sessionStorage.getItem(MSG_KEY) ?? "[]");
      if (Array.isArray(saved)) setMessages(saved as Msg[]);
    } catch {
      /* session storage unavailable */
    }
  }, []);

  useEffect(() => {
    try {
      sessionStorage.setItem(OPEN_KEY, open ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, [open]);

  useEffect(() => {
    try {
      sessionStorage.setItem(MSG_KEY, JSON.stringify(messages.slice(-40)));
    } catch {
      /* ignore */
    }
  }, [messages]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy, open]);

  const send = useCallback(
    async (text: string) => {
      const body = text.trim();
      if (!body || busy) return;
      const reset = resetNext.current;
      resetNext.current = false;
      const userMsg: Msg = { id: `u${Date.now()}`, role: "user", text: body };
      setMessages((m) => [...m, userMsg]);
      setDraft("");
      setBusy(true);
      try {
        const r = await apiFetch<{ reply: string; handoffUrl: string | null; orderNumber: string | null }>("/api/ai/chat", {
          method: "POST",
          json: { message: body, locale, reset },
        });
        setMessages((m) => [...m, { id: `a${Date.now()}`, role: "assistant", text: r.reply, handoffUrl: r.handoffUrl }]);
      } catch (e) {
        const err = e as Error & { vars?: Record<string, string | number>; status?: number };
        const key = err.message === "ai.offline" || err.message === "ai.rateLimited" ? err.message : "ai.error";
        setMessages((m) => [...m, { id: `e${Date.now()}`, role: "assistant", text: t(key, err.vars), error: true }]);
      } finally {
        setBusy(false);
      }
    },
    [busy, locale, t],
  );

  // global opener: window.dispatchEvent(new CustomEvent("orynve:concierge", { detail: { message } }))
  useEffect(() => {
    const handler = (e: Event) => {
      setOpen(true);
      const detail = (e as CustomEvent<{ message?: string } | undefined>).detail;
      if (detail?.message) {
        setDraft(detail.message);
        setTimeout(() => void send(detail.message ?? ""), 120);
      } else {
        setTimeout(() => inputRef.current?.focus(), 200);
      }
    };
    window.addEventListener(CONCIERGE_EVENT, handler);
    return () => window.removeEventListener(CONCIERGE_EVENT, handler);
  }, [send]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  /** Clears the transcript locally; the next message starts a fresh server session. */
  function newConversation() {
    setMessages([]);
    setDraft("");
    resetNext.current = true;
    inputRef.current?.focus();
  }

  if (!enabled) return null;

  const suggestions = [t("ai.suggestTrack"), t("ai.suggestSize"), t("ai.suggestDelivery"), t("ai.suggestReturns")];

  return (
    <>
      {/* launcher */}
      <div className="safe-bottom fixed bottom-4 right-4 z-[80] transition-[bottom] duration-300 [body:has([data-sticky-bar])_&]:bottom-[5.5rem] md:bottom-6 md:right-6 md:[body:has([data-sticky-bar])_&]:bottom-6">
        <AnimatePresence>
          {!open && (
            <motion.button
              type="button"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 12 }}
              transition={{ duration: DUR.fast, ease: EASE }}
              onClick={() => setOpen(true)}
              className="flex items-center gap-2.5 border border-coal bg-coal px-5 py-3.5 text-[0.66rem] font-semibold uppercase tracking-[0.16em] text-snow shadow-xl transition hover:border-oxide hover:bg-oxide"
            >
              <MessageCircle className="h-4 w-4" aria-hidden />
              {t("ai.open")}
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      {/* panel — bottom sheet on mobile, anchored card on desktop */}
      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
              className="fixed inset-0 z-[85] bg-coal/50 backdrop-blur-[2px] md:hidden"
            />
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label={assistantName}
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 30 }}
              transition={{ duration: 0.45, ease: EASE }}
              className="safe-bottom fixed inset-x-0 bottom-0 z-[86] flex max-h-[86dvh] flex-col border-t border-line bg-paper shadow-2xl md:inset-x-auto md:bottom-6 md:right-6 md:max-h-[min(34rem,80dvh)] md:w-[24rem] md:border lg:w-[26rem]"
            >
              {/* header */}
              <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
                <div>
                  <p className="display text-lg leading-tight">{assistantName}</p>
                  <p className="eyebrow mt-1">{t("ai.subtitle")}</p>
                </div>
                <div className="flex items-center gap-1">
                  <button type="button" onClick={newConversation} aria-label={t("ai.newChat")} title={t("ai.newChat")} className="p-2 text-muted hover:text-ink">
                    <RotateCcw className="h-4 w-4" aria-hidden />
                  </button>
                  <button type="button" onClick={() => setOpen(false)} aria-label={t("common.close")} className="p-2 text-muted hover:text-ink">
                    <X className="h-4 w-4" aria-hidden />
                  </button>
                </div>
              </div>

              {/* messages */}
              <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto px-5 py-4" aria-live="polite">
                <Bubble role="assistant">{greeting || t("ai.title")}</Bubble>
                {messages.map((m) => (
                  <Bubble key={m.id} role={m.role} error={m.error}>
                    {m.role === "assistant" ? <AssistantText text={m.text} /> : m.text}
                    {m.handoffUrl && (
                      <a
                        href={m.handoffUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-3 inline-flex items-center gap-2 border border-ink px-3 py-2 text-[0.62rem] font-semibold uppercase tracking-[0.14em] transition hover:bg-ink hover:text-paper"
                      >
                        <ExternalLink className="h-3 w-3" aria-hidden />
                        {t("ai.handoff")}
                      </a>
                    )}
                  </Bubble>
                ))}
                {busy && (
                  <div className="mb-4 flex items-center gap-1.5 text-muted" aria-label={t("ai.thinking")}>
                    {[0, 1, 2].map((i) => (
                      <span key={i} className="h-1.5 w-1.5 animate-pulseDot rounded-full bg-muted" style={{ animationDelay: `${i * 0.18}s` }} />
                    ))}
                  </div>
                )}
              </div>

              {/* suggestions */}
              {messages.length === 0 && (
                <div className="flex flex-wrap gap-1.5 px-5 pb-3">
                  {suggestions.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => void send(s)}
                      className="border border-line px-2.5 py-1.5 text-[0.66rem] text-muted transition hover:border-ink hover:text-ink"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}

              {/* composer */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void send(draft);
                }}
                className="border-t border-line px-5 py-3"
              >
                <div className="flex items-end gap-2">
                  <label className="min-w-0 flex-1">
                    <span className="sr-only">{t("ai.placeholder")}</span>
                    <textarea
                      ref={inputRef}
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          void send(draft);
                        }
                      }}
                      rows={1}
                      maxLength={1500}
                      placeholder={t("ai.placeholder")}
                      className="max-h-24 w-full resize-none border-0 bg-transparent py-2 text-sm outline-none placeholder:text-muted/70"
                    />
                  </label>
                  <button type="submit" disabled={busy || !draft.trim()} aria-label={t("ai.send")} className="mb-1 p-2 text-ink transition hover:text-oxide">
                    <Send className="h-4 w-4" aria-hidden />
                  </button>
                </div>
                <p className="mt-1 text-[0.6rem] leading-snug text-muted">{t("ai.disclaimer")}</p>
              </form>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

function Bubble({ role, error, children }: { role: "user" | "assistant"; error?: boolean; children: ReactNode }) {
  return (
    <div className={cn("mb-4 flex", role === "user" ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[85%] px-3.5 py-2.5 text-sm leading-relaxed",
          role === "user" ? "bg-ink text-paper" : error ? "border border-danger/40 bg-danger/5 text-danger" : "border border-line bg-bone/50 text-ink",
        )}
      >
        {children}
      </div>
    </div>
  );
}

/** Opens the concierge from anywhere on the page (optionally pre-sending a message). */
export function openConcierge(message?: string) {
  window.dispatchEvent(new CustomEvent(CONCIERGE_EVENT, { detail: message ? { message } : undefined }));
}
