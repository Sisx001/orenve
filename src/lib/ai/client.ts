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

/**
 * Streaming variant — calls onDelta for each text token, returns full content + optional usage.
 * Handles partial SSE lines across chunks, [DONE] sentinel, and reasoning_content (ignored).
 */
export async function chatCompletionStream(
  conn: AiConnection,
  messages: ChatMessage[],
  opts: { tools?: ToolSpec[]; temperature?: number; maxTokens?: number; signal?: AbortSignal },
  onDelta: (text: string) => void,
): Promise<{ content: string; usage?: { prompt_tokens?: number; completion_tokens?: number } }> {
  const url = `${conn.baseUrl.replace(/\/$/, "")}/chat/completions`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(conn.apiKey ? { Authorization: `Bearer ${conn.apiKey}` } : {}) },
    body: JSON.stringify({
      model: conn.model,
      messages,
      temperature: opts.temperature ?? 0.2,
      max_tokens: opts.maxTokens ?? 600,
      stream: true,
      stream_options: { include_usage: true },
      ...(opts.tools?.length ? { tools: opts.tools, tool_choice: "auto" } : {}),
    }),
    signal: opts.signal ?? AbortSignal.timeout(55_000),
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`AI provider error ${res.status}: ${text.slice(0, 300)}`);
  }

  let content = "";
  let usage: { prompt_tokens?: number; completion_tokens?: number } | undefined;
  let partial = "";

  const reader = res.body?.getReader();
  if (!reader) throw new Error("No response body for streaming");

  const decoder = new TextDecoder();

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      partial += decoder.decode(value, { stream: true });

      // Process all complete lines
      const lines = partial.split("\n");
      partial = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;
        const dataStr = trimmed.slice(5).trim();
        if (dataStr === "[DONE]") continue;

        let chunk: any;
        try { chunk = JSON.parse(dataStr); } catch { continue; }

        // Some providers include usage at the end
        if (chunk.usage) usage = chunk.usage;

        const delta = chunk.choices?.[0]?.delta;
        if (!delta) continue;

        // Ignore reasoning_content (DeepSeek R1, etc.)
        const text = typeof delta.content === "string" ? delta.content : "";
        if (text) {
          content += text;
          onDelta(text);
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  return { content, usage };
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
