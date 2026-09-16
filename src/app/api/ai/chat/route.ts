import { cookies } from "next/headers";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { getClientIp } from "@/lib/request";
import { rateLimit } from "@/lib/ratelimit";
import { getSetting } from "@/lib/settings";
import { converse } from "@/lib/ai/concierge";
import { COOKIE_AI_SESSION } from "@/lib/constants";
import { handleError, jsonError, jsonOk } from "@/lib/api-server";
import { verifyCsrf } from "@/lib/auth/csrf";

export const runtime = "nodejs";
export const maxDuration = 60;

const schema = z.object({ message: z.string().trim().min(1).max(1500), locale: z.string().default("en"), reset: z.boolean().optional() });

function sseEvent(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

/** POST /api/ai/chat — storefront concierge. Session is an httpOnly cookie; nothing about the model or keys reaches the client. */
export async function POST(req: Request) {
  try {
    if (!(await verifyCsrf())) return jsonError("errors.csrf", 403);
    const ai = await getSetting("ai");
    const features = await getSetting("features");
    if (!ai.enabled || !features.aiConcierge) return jsonError("ai.offline", 503);

    const ip = getClientIp(req.headers);
    const rl = await rateLimit("ai", ip, ai.rateLimitPerHour, 3600);
    if (!rl.ok) return jsonError("ai.rateLimited", 429);

    const { message, locale, reset } = schema.parse(await req.json());
    const jar = await cookies();
    let sessionKey = jar.get(COOKIE_AI_SESSION)?.value;
    if (!sessionKey || reset) {
      sessionKey = randomBytes(16).toString("base64url");
      jar.set(COOKIE_AI_SESSION, sessionKey, {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 7,
        secure: (process.env.APP_URL ?? "").startsWith("https://"),
      });
    }

    const wantsStream = ai.streaming && req.headers.get("accept")?.includes("text/event-stream");

    if (wantsStream) {
      // SSE streaming response
      const sessionKeyFinal = sessionKey;
      const stream = new ReadableStream<Uint8Array>({
        async start(controller) {
          const enc = new TextEncoder();
          const emit = (event: string, data: unknown) => {
            try { controller.enqueue(enc.encode(sseEvent(event, data))); } catch {}
          };

          try {
            const result = await converse({
              sessionKey: sessionKeyFinal,
              locale,
              userMessage: message,
              ip,
              stream: (delta) => emit("delta", { text: delta }),
            });

            // Send a meta event first (conversationId, orderNumber)
            // (sent before deltas in a two-pass scenario; here we emit it after
            //  since deltas went out inline — clients should handle out-of-order meta)
            emit("meta", { conversationId: result.conversationId, orderNumber: result.orderNumber });

            if (result.cards.length > 0) {
              emit("cards", result.cards);
            }

            emit("done", {
              reply: result.reply,
              handoffUrl: result.handoffUrl,
              requestCreated: result.requestCreated,
              flagged: result.flagged,
            });
          } catch (e: any) {
            const code =
              e?.message === "ai_disabled"
                ? "ai.offline"
                : String(e?.message ?? "").startsWith("AI provider error")
                  ? "ai.error"
                  : "ai.error";
            emit("error", { code });
          } finally {
            controller.close();
          }
        },
      });

      return new Response(stream, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache, no-transform",
          Connection: "keep-alive",
          "X-Accel-Buffering": "no",
        },
      });
    }

    // Non-streaming JSON response
    const result = await converse({ sessionKey, locale, userMessage: message, ip });
    return jsonOk({
      reply: result.reply,
      handoffUrl: result.handoffUrl,
      orderNumber: result.orderNumber,
      cards: result.cards,
      requestCreated: result.requestCreated,
    });
  } catch (e: any) {
    if (e?.message === "ai_disabled") return jsonError("ai.offline", 503);
    if (String(e?.message ?? "").startsWith("AI provider error")) {
      console.error(e);
      return jsonError("ai.error", 502);
    }
    return handleError(e);
  }
}
