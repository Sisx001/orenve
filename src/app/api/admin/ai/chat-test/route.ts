import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/session";
import { verifyCsrf } from "@/lib/auth/csrf";
import { handleError, jsonError, jsonOk } from "@/lib/api-server";
import { converse } from "@/lib/ai/concierge";

export const runtime = "nodejs";
export const maxDuration = 60;

const bodySchema = z.object({
  message: z.string().trim().min(1).max(1500),
  locale: z.string().default("en"),
  sessionKey: z.string().min(1).max(100),
  simulatedOrder: z.string().max(40).optional(),
});

/**
 * POST /api/admin/ai/chat-test
 * Studio-only test endpoint for the concierge — returns debug info (tool trace, tokens, cards).
 * Does NOT log to AiConversation and does NOT count toward rate limits.
 */
export async function POST(req: NextRequest) {
  try {
    await requireUser("ai.configure");
    if (!(await verifyCsrf())) return jsonError("Invalid or missing CSRF token.", 403);

    const body = bodySchema.parse(await req.json());

    const result = await converse({
      sessionKey: body.sessionKey,
      locale: body.locale,
      userMessage: body.message,
      debug: true,
      log: false,
    });

    return jsonOk({
      reply: result.reply,
      flagged: result.flagged,
      cards: result.cards,
      toolTrace: result.toolTrace ?? [],
      requestCreated: result.requestCreated,
      usage: undefined as undefined,
    });
  } catch (e: any) {
    if (e?.message === "ai_disabled") return jsonError("AI concierge is disabled or not configured.", 503);
    if (String(e?.message ?? "").startsWith("AI provider error")) {
      console.error("[chat-test]", e);
      return jsonError("AI provider error — check settings.", 502);
    }
    return handleError(e);
  }
}
