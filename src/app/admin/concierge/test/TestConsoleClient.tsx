"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronRight, Loader2, Send, Shield } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";

type ToolTrace = { name: string; args: Record<string, unknown>; ms: number; ok: boolean };

type AiCard = { kind: string; [k: string]: unknown };

type TestMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  cards?: AiCard[];
  toolTrace?: ToolTrace[];
  tokens?: number;
  latencyMs?: number;
  flagged?: boolean;
};

type JailbreakCase = { id: string; name: string; description: string };

type JailbreakResult = {
  id: string;
  name: string;
  pass: boolean;
  reply: string;
  checks: Record<string, boolean>;
};

export function TestConsoleClient() {
  const [messages, setMessages] = useState<TestMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [locale, setLocale] = useState("en");
  const [simulatedOrder, setSimulatedOrder] = useState("");
  const [busy, setBusy] = useState(false);
  const [sessionKey] = useState(() => `test-${Math.random().toString(36).slice(2)}`);
  const listRef = useRef<HTMLDivElement>(null);

  // Jailbreak suite
  const [jailbreakCases, setJailbreakCases] = useState<JailbreakCase[]>([]);
  const [jailbreakResults, setJailbreakResults] = useState<JailbreakResult[]>([]);
  const [jailbreakRunning, setJailbreakRunning] = useState(false);
  const [jailbreakProgress, setJailbreakProgress] = useState(0);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    // Load jailbreak cases
    apiFetch<{ cases: JailbreakCase[] }>("/api/admin/ai/jailbreak", { method: "GET" })
      .then((r) => setJailbreakCases(r.cases))
      .catch(() => {});
  }, []);

  const send = async (text: string) => {
    const body = text.trim();
    if (!body || busy) return;
    setBusy(true);
    setDraft("");
    const userMsg: TestMessage = { id: `u${Date.now()}`, role: "user", text: body };
    setMessages((m) => [...m, userMsg]);
    const t0 = Date.now();
    try {
      const r = await apiFetch<{
        reply: string;
        cards: AiCard[];
        toolTrace: ToolTrace[];
        flagged: boolean;
        usage?: { tokensIn: number; tokensOut: number };
      }>("/api/admin/ai/chat-test", {
        method: "POST",
        json: { message: body, locale, sessionKey, simulatedOrder: simulatedOrder || undefined },
      });
      setMessages((m) => [
        ...m,
        {
          id: `a${Date.now()}`,
          role: "assistant",
          text: r.reply,
          cards: r.cards,
          toolTrace: r.toolTrace,
          flagged: r.flagged,
          latencyMs: Date.now() - t0,
          tokens: (r.usage?.tokensIn ?? 0) + (r.usage?.tokensOut ?? 0),
        },
      ]);
    } catch (e) {
      setMessages((m) => [
        ...m,
        { id: `e${Date.now()}`, role: "assistant", text: `Error: ${e instanceof Error ? e.message : "unknown"}`, flagged: false },
      ]);
    } finally {
      setBusy(false);
    }
  };

  const runJailbreakSuite = async () => {
    if (jailbreakRunning || jailbreakCases.length === 0) return;
    setJailbreakRunning(true);
    setJailbreakResults([]);
    setJailbreakProgress(0);

    for (let i = 0; i < jailbreakCases.length; i++) {
      const c = jailbreakCases[i]!;
      try {
        const r = await apiFetch<{ result: JailbreakResult }>("/api/admin/ai/jailbreak", {
          method: "POST",
          json: { caseId: c.id },
        });
        setJailbreakResults((prev) => [...prev, r.result]);
      } catch (e) {
        setJailbreakResults((prev) => [
          ...prev,
          { id: c.id, name: c.name, pass: false, reply: `Network error: ${e instanceof Error ? e.message : "unknown"}`, checks: {} },
        ]);
      }
      setJailbreakProgress(i + 1);
    }
    setJailbreakRunning(false);
  };

  return (
    <div className="grid gap-5 xl:grid-cols-3">
      {/* Chat panel */}
      <div className="flex flex-col xl:col-span-2">
        <div className="card flex flex-col" style={{ minHeight: "32rem" }}>
          <div className="border-b border-line px-4 py-3">
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-1.5 text-xs">
                <span className="text-muted">Locale</span>
                <select
                  value={locale}
                  onChange={(e) => setLocale(e.target.value)}
                  className="field-box py-1 text-xs"
                >
                  <option value="en">English</option>
                  <option value="bn">বাংলা</option>
                </select>
              </label>
              <label className="flex items-center gap-1.5 text-xs">
                <span className="text-muted">Simulate verified order</span>
                <input
                  type="text"
                  value={simulatedOrder}
                  onChange={(e) => setSimulatedOrder(e.target.value)}
                  placeholder="ORY-2024-000001"
                  className="field-box w-36 py-1 font-mono text-xs"
                />
              </label>
              <button
                type="button"
                onClick={() => setMessages([])}
                className="btn-ghost text-[0.6rem] text-muted"
              >
                Clear
              </button>
            </div>
          </div>

          <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto p-4 space-y-3">
            {messages.length === 0 && (
              <p className="text-center text-sm text-muted">Send a message to test the concierge.</p>
            )}
            {messages.map((m) => (
              <div key={m.id} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
                <div className={cn("max-w-[85%] space-y-1.5")}>
                  <div
                    className={cn(
                      "px-3.5 py-2.5 text-sm leading-relaxed",
                      m.role === "user"
                        ? "bg-ink text-paper"
                        : "border border-line bg-bone/50",
                    )}
                  >
                    <p className="whitespace-pre-line">{m.text}</p>
                    {m.flagged && (
                      <p className="mt-1.5 text-[0.6rem] uppercase tracking-[0.12em] text-warning">
                        Flagged — injection pattern detected
                      </p>
                    )}
                  </div>
                  {m.role === "assistant" && (m.latencyMs || m.tokens || m.toolTrace?.length) ? (
                    <DebugPane trace={m.toolTrace ?? []} tokens={m.tokens ?? 0} latencyMs={m.latencyMs ?? 0} cards={m.cards ?? []} />
                  ) : null}
                </div>
              </div>
            ))}
            {busy && (
              <div className="flex items-center gap-2 text-xs text-muted">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Waiting…
              </div>
            )}
          </div>

          <div className="border-t border-line p-4">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void send(draft);
              }}
              className="flex items-end gap-2"
            >
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void send(draft);
                  }
                }}
                rows={2}
                placeholder="Type a message…"
                className="min-h-0 flex-1 resize-none border border-line bg-paper p-2 text-sm outline-none focus:border-ink"
              />
              <button type="submit" disabled={busy || !draft.trim()} className="btn-outline px-4 py-2.5 text-[0.65rem]">
                {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Jailbreak suite */}
      <div className="space-y-4">
        <div className="card p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-[0.65rem] font-semibold uppercase tracking-[0.14em]">Jailbreak suite</h2>
            <span className="text-xs text-muted">{jailbreakCases.length} cases</span>
          </div>
          <p className="mb-4 text-xs text-muted">
            Runs each attack in a fresh unlogged session and reports pass/fail with deterministic checks.
          </p>
          <button
            type="button"
            onClick={runJailbreakSuite}
            disabled={jailbreakRunning || jailbreakCases.length === 0}
            className="btn-outline w-full px-4 py-2.5 text-[0.65rem]"
          >
            {jailbreakRunning ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Running {jailbreakProgress}/{jailbreakCases.length}…
              </>
            ) : (
              <>
                <Shield className="h-3.5 w-3.5" />
                Run jailbreak suite
              </>
            )}
          </button>

          {jailbreakResults.length > 0 && (
            <div className="mt-4 space-y-2">
              {jailbreakResults.map((r) => (
                <JailbreakRow key={r.id} result={r} />
              ))}
              <p className="pt-2 text-xs text-muted">
                {jailbreakResults.filter((r) => r.pass).length}/{jailbreakResults.length} passed
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function DebugPane({
  trace,
  tokens,
  latencyMs,
  cards,
}: {
  trace: ToolTrace[];
  tokens: number;
  latencyMs: number;
  cards: AiCard[];
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-line/60 bg-bone/30 text-[0.62rem]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-1.5 px-2.5 py-1.5 text-left text-muted hover:text-ink"
      >
        {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        {latencyMs}ms · {tokens} tokens · {trace.length} tool call{trace.length === 1 ? "" : "s"}
        {cards.length > 0 && ` · ${cards.length} card${cards.length === 1 ? "" : "s"}`}
      </button>
      {open && (
        <div className="border-t border-line/60 px-2.5 pb-2.5 pt-2 space-y-2">
          {trace.map((t, i) => (
            <div key={i} className={cn("space-y-0.5", !t.ok && "text-danger")}>
              <p className="font-mono font-semibold">{t.name} ({t.ms}ms) {t.ok ? "✓" : "✗"}</p>
              <pre className="whitespace-pre-wrap text-muted">{JSON.stringify(t.args, null, 2)}</pre>
            </div>
          ))}
          {cards.length > 0 && (
            <div>
              <p className="font-semibold text-muted">Cards</p>
              <pre className="whitespace-pre-wrap text-muted">{JSON.stringify(cards, null, 2)}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function JailbreakRow({ result }: { result: JailbreakResult }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={cn("border", result.pass ? "border-success/30 bg-success/5" : "border-danger/30 bg-danger/5")}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-2.5 py-2 text-left text-[0.62rem]"
      >
        <span className={cn("font-semibold", result.pass ? "text-success" : "text-danger")}>
          {result.pass ? "PASS" : "FAIL"}
        </span>
        <span className="flex-1 font-medium">{result.name}</span>
        {open ? <ChevronDown className="h-3 w-3 text-muted" /> : <ChevronRight className="h-3 w-3 text-muted" />}
      </button>
      {open && (
        <div className="border-t border-line/40 px-2.5 pb-2.5 pt-2 space-y-2 text-[0.6rem]">
          <p className="text-muted whitespace-pre-wrap">{result.reply.slice(0, 400)}</p>
          <div className="space-y-0.5">
            {Object.entries(result.checks).map(([k, v]) => (
              <div key={k} className="flex items-center gap-1.5">
                <span className={v ? "text-success" : "text-danger"}>{v ? "✓" : "✗"}</span>
                <span className="text-muted">{k}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
