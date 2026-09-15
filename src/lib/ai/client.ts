import "server-only";

/**
 * Minimal OpenAI-compatible chat completions client (no SDK dependency).
 * Works with DeepSeek, OpenAI, Groq, Together, OpenRouter, Mistral, Ollama,
 * LM Studio, vLLM and any custom endpoint that speaks the same protocol.
 */
export type ChatMessage =
  | { role: "system" | "user" | "assistant"; content: string; tool_calls?: ToolCall[] }
  | { role: "tool"; content: string; tool_call_id: string };

export type ToolCall = { id: string; type: "function"; function: { name: string; arguments: string } };

export type ToolSpec = {
  type: "function";
  function: { name: string; description: string; parameters: Record<string, unknown> };
};

export type ChatResult = {
  message: { role: "assistant"; content: string | null; tool_calls?: ToolCall[] };
  usage?: { prompt_tokens?: number; completion_tokens?: number };
  finish_reason?: string;
};

export type AiConnection = { baseUrl: string; apiKey: string; model: string };

export async function chatCompletion(
  conn: AiConnection,
  messages: ChatMessage[],
  opts: { tools?: ToolSpec[]; temperature?: number; maxTokens?: number; signal?: AbortSignal } = {},
): Promise<ChatResult> {
  const url = `${conn.baseUrl.replace(/\/$/, "")}/chat/completions`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(conn.apiKey ? { Authorization: `Bearer ${conn.apiKey}` } : {}) },
    body: JSON.stringify({
      model: conn.model,
      messages,
      temperature: opts.temperature ?? 0.2,
      max_tokens: opts.maxTokens ?? 600,
      ...(opts.tools?.length ? { tools: opts.tools, tool_choice: "auto" } : {}),
    }),
    signal: opts.signal ?? AbortSignal.timeout(45_000),
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`AI provider error ${res.status}: ${text.slice(0, 300)}`);
  }
  const data = (await res.json()) as any;
  const choice = data.choices?.[0];
  if (!choice) throw new Error("AI provider returned no choices");
  return { message: choice.message, usage: data.usage, finish_reason: choice.finish_reason };
}

/** Lightweight connectivity test used by the studio "Test connection" button. */
export async function testConnection(conn: AiConnection): Promise<{ ok: boolean; message: string; latencyMs: number }> {
  const t0 = Date.now();
  try {
    const r = await chatCompletion(conn, [{ role: "user", content: "Reply with the single word OK." }], { maxTokens: 5, temperature: 0 });
    return { ok: true, message: (r.message.content ?? "").trim().slice(0, 40) || "OK", latencyMs: Date.now() - t0 };
  } catch (e: any) {
    return { ok: false, message: e?.message ?? "Failed", latencyMs: Date.now() - t0 };
  }
}
