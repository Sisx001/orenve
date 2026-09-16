import { z } from "zod";
import { requireUser } from "@/lib/auth/session";
import { verifyCsrf } from "@/lib/auth/csrf";
import { rateLimit } from "@/lib/ratelimit";
import { handleError, jsonError, jsonOk } from "@/lib/api-server";
import { getAiConnection } from "@/lib/ai/concierge";
import { getLocaleInfo } from "@/lib/i18n/registry";
import { translateOne, TranslationError } from "@/lib/i18n/translate";

export const runtime = "nodejs";
export const maxDuration = 60;

const schema = z.object({
  text: z.string().min(1).max(6000),
  targetLocale: z.string().trim().min(2).max(8),
  kind: z.enum(["ui", "content"]).default("content"),
});

/** POST /api/admin/i18n/translate-text — single-string helper for any studio editor. */
export async function POST(req: Request) {
  try {
    const user = await requireUser("i18n.write");
    if (!(await verifyCsrf())) return jsonError("errors.csrf", 403);

    const rl = await rateLimit("i18n-ai", user.id, 120, 3600);
    if (!rl.ok) return jsonError("i18n.rateLimited", 429, { retryAfterSec: rl.retryAfterSec });

    const conn = await getAiConnection();
    if (!conn) return jsonError("ai.offline", 503, { code: "ai.offline" });

    const { text, targetLocale, kind } = schema.parse(await req.json());
    const target = await getLocaleInfo(targetLocale);
    if (!target) return jsonError("That language is not registered.", 404);
    if (target.code === "en") return jsonError("English is the source language.", 400);

    return jsonOk({ text: await translateOne({ text, targetLocale: target, kind, conn }) });
  } catch (e) {
    if (e instanceof TranslationError) return jsonError(e.message, 502, { code: e.code });
    if (e instanceof Error && e.message.startsWith("AI provider error")) return jsonError(e.message, 502, { code: "ai.error" });
    return handleError(e);
  }
}
