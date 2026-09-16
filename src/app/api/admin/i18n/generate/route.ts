import { z } from "zod";
import { requireUser } from "@/lib/auth/session";
import { verifyCsrf } from "@/lib/auth/csrf";
import { audit } from "@/lib/audit";
import { rateLimit } from "@/lib/ratelimit";
import { handleError, jsonError, jsonOk } from "@/lib/api-server";
import { getAiConnection } from "@/lib/ai/concierge";
import { getLocaleInfo } from "@/lib/i18n/registry";
import { translateDictionaryChunk, TranslationError } from "@/lib/i18n/translate";

export const runtime = "nodejs";
export const maxDuration = 60;

const schema = z.object({ locale: z.string().trim().min(2).max(8), cursor: z.string().max(200).nullable().optional() });

/**
 * POST /api/admin/i18n/generate — translate ONE chunk of the interface
 * dictionary. The studio loops until `done` so no single request runs long.
 */
export async function POST(req: Request) {
  try {
    const user = await requireUser("i18n.write");
    if (!(await verifyCsrf())) return jsonError("errors.csrf", 403);

    const rl = await rateLimit("i18n-ai", user.id, 120, 3600);
    if (!rl.ok) return jsonError("i18n.rateLimited", 429, { retryAfterSec: rl.retryAfterSec });

    const conn = await getAiConnection();
    if (!conn) return jsonError("ai.offline", 503, { code: "ai.offline" });

    const { locale, cursor } = schema.parse(await req.json());
    const target = await getLocaleInfo(locale);
    if (!target) return jsonError("That language is not registered.", 404);
    if (target.builtIn) return jsonError("Built-in languages ship with a hand-written dictionary — edit it under Translations instead.", 400);

    const step = await translateDictionaryChunk({ locale, cursor: cursor ?? null, conn, targetLocale: target });
    if (step.done) await audit(user.id, "i18n.dictionary_generate", "language", locale, { total: step.total });

    return jsonOk({ step });
  } catch (e) {
    if (e instanceof TranslationError) return jsonError(e.message, 502, { code: e.code });
    if (e instanceof Error && e.message.startsWith("AI provider error")) return jsonError(e.message, 502, { code: "ai.error" });
    return handleError(e);
  }
}
