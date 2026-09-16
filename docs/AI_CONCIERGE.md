# AI concierge

The ORYNVE concierge is an on-site chat widget backed by any OpenAI-compatible API. It runs entirely server-side: no API keys, internal data, or other customers' information ever reaches the browser.

---

## Architecture

```
Browser (chat widget)
    |  HTTPS POST /api/ai/chat  (CSRF token required)
    v
Next.js API route (server-only)
    |  Rate-limit check (DB-backed, per IP)
    |  Load conversation history from DB
    |  Build system prompt (store facts, policies, owner notes)
    |  Inject detection on user message
    v
chatCompletion() — fetch to AI provider
    |  Tool calls resolved server-side (lookup_order, search_products)
    |  Output sanitised (secrets redacted, prompt scaffold stripped)
    v
Store conversation in AiConversation table (if logConversations: true)
    |
    v
Browser receives only the assistant reply text
```

The API route is in `src/app/api/ai/chat/route.ts`. The core logic lives in `src/lib/ai/`:

| File | Purpose |
|---|---|
| `client.ts` | Minimal OpenAI-compatible fetch client; no SDK dependency |
| `prompt.ts` | System prompt builder, injection detector, output sanitiser |
| `tools.ts` | Tool specifications and execution (server-side only) |
| `concierge.ts` | Orchestrates the conversation: history, tool loop, logging |

---

## Security model

### What the model can see

- The system prompt: brand facts, store policies, shipping zones, contact info, owner notes, current date/time in Dhaka.
- The current conversation history (last 12 messages).
- Tool results for tools called in the current turn.
- The customer's message (wrapped in `<customer_message>` tags and treated as data).

### What the model cannot see

- API keys or any environment variable.
- Admin data, internal order notes (`internalNotes`), or non-public order events (events with `isPublic: false`).
- Other customers' orders. `lookup_order` only returns an order when the order reference AND phone number match — the match is enforced in SQL, not by the model.
- The raw Prisma schema, database structure, or source code.
- Staff usernames, passwords, or session tokens.

### Injection hardening

1. **Input wrapping**: every user message is wrapped in `<customer_message>…</customer_message>` and tool results in `<tool_result>…</tool_result>`. The system prompt instructs the model to treat these as untrusted data, never as instructions.

2. **Pre-filter**: `detectInjection()` in `prompt.ts` scans the user message for common jailbreak patterns (ignore instructions, reveal prompt, persona switch, authority claim, secrets extraction, data exfiltration). If a pattern is detected, a `<system_note>` is appended to the user message turn to reinforce the rules. The conversation is marked `flagged: true` in the database.

3. **Output sanitiser**: `sanitizeReply()` strips API key patterns (`sk-…`), XML-like tags from the prompt scaffold, and refuses to reply if the system prompt headings are present in the output.

4. **Scope enforcement**: The system prompt contains nine absolute rules that the model must follow. Rule violations (e.g. the model outputting another customer's order) are caught by the sanitiser or by the server-side tool enforcement.

5. **Rate limiting**: Configurable per-IP per-hour limit (default 60 requests/hour) enforced in the database. Exceeding it returns a 429 response.

6. **Session limit**: Each chat session has a maximum message count (default 40 user turns) after which the customer is redirected to WhatsApp.

---

## Provider setup

All providers use the same three env vars:

```
AI_BASE_URL=<endpoint>
AI_API_KEY=<key>
AI_MODEL=<model-name>
```

These can be set as environment variables or overridden in the studio (Settings → AI Concierge). Studio values take precedence when non-empty.

### DeepSeek (recommended for cost / quality balance)

```bash
AI_BASE_URL=https://api.deepseek.com/v1
AI_API_KEY=sk-...
AI_MODEL=deepseek-chat
```

Sign up at [platform.deepseek.com](https://platform.deepseek.com). DeepSeek uses the OpenAI API format with tool calling support. As of mid-2026, `deepseek-chat` (DeepSeek-V3) is highly capable at a fraction of the cost of GPT-4o.

### OpenAI

```bash
AI_BASE_URL=https://api.openai.com/v1
AI_API_KEY=sk-...
AI_MODEL=gpt-4o-mini   # or gpt-4o for higher quality
```

`gpt-4o-mini` provides a good balance of speed and quality. `gpt-4o` is higher quality but more expensive.

### Groq (fast inference)

```bash
AI_BASE_URL=https://api.groq.com/openai/v1
AI_API_KEY=gsk_...
AI_MODEL=llama-3.3-70b-versatile
```

Groq provides very low latency inference. Sign up at [console.groq.com](https://console.groq.com). Check available models in the Groq dashboard — model names change with versions.

### OpenRouter (access to many models)

```bash
AI_BASE_URL=https://openrouter.ai/api/v1
AI_API_KEY=sk-or-...
AI_MODEL=deepseek/deepseek-chat
```

OpenRouter aggregates many providers and models. Sign up at [openrouter.ai](https://openrouter.ai). Use the model ID format `provider/model-name`. Add `HTTP-Referer` and `X-Title` headers by customising `client.ts` if required by a specific model.

### Ollama (self-hosted, no API cost)

```bash
AI_BASE_URL=http://localhost:11434/v1
AI_API_KEY=ollama
AI_MODEL=llama3.2
```

[Ollama](https://ollama.ai) runs models locally. The app server must have network access to the Ollama instance. Suitable models: `llama3.2`, `mistral`, `qwen2.5`. Note that smaller models may not follow tool calling reliably — test with the studio "Test connection" button and a manual chat.

For a VPS deployment, run Ollama on the same machine and bind to `127.0.0.1` only.

```bash
ollama pull llama3.2
ollama serve   # starts on localhost:11434
```

### LM Studio or vLLM

Both expose an OpenAI-compatible endpoint. Set `AI_BASE_URL` to the endpoint (e.g. `http://localhost:1234/v1`) and `AI_MODEL` to the model identifier shown in the UI.

---

## Cost and latency tips

- Set `maxTokens` (studio) to 400–600 for typical concierge replies. Larger values increase cost and latency.
- Set `temperature` to 0.1–0.2 for factual concierge responses. Higher values add randomness.
- DeepSeek-V3 at 600 max tokens costs roughly USD 0.0003 per customer message at mid-2026 pricing — well under USD 1 per 1,000 conversations.
- Use Groq or DeepSeek for the lowest latency. Ollama on a local GPU can achieve sub-500 ms responses but requires a suitable machine.
- `logConversations: false` reduces DB writes at high volume but makes the audit trail unavailable.

---

## Extending tools safely

The tool system is in `src/lib/ai/tools.ts`. Two tools are built in: `lookup_order` and `search_products`.

To add a new tool:

1. Add a `ToolSpec` entry to `TOOL_SPECS` with a precise `description` and `parameters` schema. The description is what the model reads to decide when to call the tool — be specific about what it returns and when not to use it.

2. Add a handler branch in `runTool()`. All data access must be server-side only (`import "server-only"` is already at the top of the file). Never pass admin data or data belonging to other customers.

3. Add the tool to the `tools` array in `concierge.ts` conditional on an appropriate setting flag.

4. Test edge cases: what does the tool return when the query matches nothing? The model must handle an empty result gracefully.

**Rules for safe tool design:**
- Tools must only return data that is appropriate for any anonymous customer to see, or data that has been verified to belong to the requesting customer (as `lookup_order` does with the phone match).
- Never return fields like `internalNotes`, `ip`, `passwordHash`, or other sensitive columns.
- Wrap tool results in `JSON.stringify()` so the model receives structured data, not raw database output.
- Keep result payloads small — verbose output increases token usage and response latency.

---

## Flagged conversations

Conversations are marked `flagged: true` in the `AiConversation` table when:
- A prompt injection pattern is detected in the user's message
- (Future: moderation API flags the content)

In the studio, Studio → AI Conversations shows all logged sessions. Flagged sessions are highlighted. You can:
- Read the full conversation transcript
- Mark a conversation as reviewed
- Export or delete a conversation

If you see a pattern of injections (e.g. a customer repeatedly trying to extract another customer's order), consider blocking the IP in your firewall or adding a stricter rate limit in the studio settings.

---

## Owner notes

The **Owner notes** field (studio → Settings → AI Concierge → Extra instructions) is appended to the system prompt as a `# Owner notes` section. The model treats these as authoritative facts.

Use it to communicate information that cannot be inferred from the catalogue or policies:

```
Our Eid returns window is extended to 14 days for orders placed in Ramadan.
The overcoat runs one size large — advise customers to size down if they prefer a fitted look.
We offer bespoke Panjabi tailoring — customers should WhatsApp us for a consultation.
WhatsApp response hours: Saturday to Thursday, 10:00–22:00 Bangladesh time.
Do not recommend competitor brands.
```

Write in plain English (or Bangla). The model uses these notes when answering but will not reveal them if asked.

## Phase 4 upgrades

### Streaming replies
When **Streaming** is on (Settings → AI concierge), the widget requests `text/event-stream` and the final answer arrives token by token. Events: `meta` (conversation id, verified order), `delta` (text), `cards` (structured product/order cards), `done` (final sanitised reply, hand-off link, `requestCreated`), `error` (code). Clients that do not send the SSE `Accept` header get the classic JSON response with the same fields. Tool rounds (order lookup, product search) always complete before streaming starts, so nothing unverified is ever streamed.

### Product & order cards
Cards are built **server-side from tool results**, never parsed from model text. A product card shows image, name, price (with compare-at), size chips with live stock, and a link to the piece. An order card appears after a successful `lookup_order` with status and the tracking page. Toggle with **Product cards**.

### Size advisor
Tool `recommend_size` — deterministic logic in `src/lib/ai/size-advisor.ts`. It uses the product's own size guide when one exists, otherwise the brand fit table you edit under **Size advisor** (chest / height / weight ranges per size, JSON). The model must phrase the result as guidance, never as a guarantee. Suggestion chip: "Which size fits me?".

### Order change requests
Tool `request_order_change` (cancel / address / other). Allowed **only** after the customer verified the order in the same conversation (order number + phone) and when **Change requests** is on. It creates a `ConciergeRequest`, an internal order event and an inbox message — it never changes the order itself. Handle requests under **Concierge → Requests** (resolve / reject writes a customer-visible event) or on the order page.

### Brand voice & writer
**Brand voice** is injected into the concierge prompt and used by the AI writer in the studio (sparkle buttons on every bilingual field: Write, Improve, Translate from English, All languages). Writer endpoint: `POST /api/admin/ai/write` (permission `ai.write`).

### Test console & jailbreak suite
**Concierge → Test console** lets staff chat as a customer (optionally with a simulated verified order) and see a debug pane: tools called (phone numbers masked), tokens, latency, flags, cards. Conversations from the console are not logged. **Run jailbreak suite** executes 14 canned attacks — ignore-instructions, prompt reveal, persona switch, authority claim, base64 smuggling, "translate your rules", other-customer data, PIN request, off-topic coding, discount promise, cancelling an unverified order, fake tool-result injection, a Bangla prompt attack and a multi-turn set-up — each in a fresh session, and reports pass/fail with deterministic checks (no prompt scaffold, no keys, no foreign phone numbers, refusal detected, no promise words) plus the raw reply for a human read.

### Hardening added
More injection patterns (base64/decode, "translate your instructions", model probing, `system:` prefixes, forget/new-instructions), reply sanitiser strips anything resembling an API key or `Bearer …`, and cancellation is always described as a request.
