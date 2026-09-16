import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/session";
import { verifyCsrf } from "@/lib/auth/csrf";
import { handleError, jsonError, jsonOk } from "@/lib/api-server";
import { rateLimit } from "@/lib/ratelimit";
import { getAiConnection } from "@/lib/ai/concierge";
import { getSetting } from "@/lib/settings";
import { writeCopy, resolveLocaleName } from "@/lib/ai/writer";

export const runtime = "nodejs";
export const maxDuration = 60;

const TASKS = [
  "product_description",
  "size_notes",
  "seo_title",
  "seo_description",
  "banner",
  "announcement",
  "email",
  "page",
  "tagline",
  "generic",
] as const;

const bodySchema = z.object({
  task: z.enum(TASKS),
  locale: z.string().min(2).max(10),
  context: z.record(z.union([z.string(), z.number()])).optional(),
  mode: z.enum(["write", "improve", "translate"]),
  text: z.string().max(10_000).optional(),
  sourceText: z.string().max(10_000).optional(),
  maxWords: z.number().int().positive().max(2000).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser("ai.write");
    if (!(await verifyCsrf())) {
      return jsonError("Invalid or missing CSRF token.", 403);
    }

    const rl = await rateLimit("ai.write", user.id, 200, 3600);
    if (!rl.ok) {
      return jsonError("Rate limit exceeded. Try again later.", 429, {
        retryAfterSec: rl.retryAfterSec,
      });
    }

    const raw = await req.json().catch(() => ({}));
    const body = bodySchema.parse(raw);

    const [ai, i18n, brand] = await Promise.all([
      getSetting("ai"),
      getSetting("i18n"),
      getSetting("brand"),
    ]);

    if (!ai.writerEnabled) {
      return jsonError("ai.offline", 503);
    }

    const conn = await getAiConnection();
    if (!conn) {
      return jsonError("ai.offline", 503);
    }

    const localeName = resolveLocaleName(body.locale);

    const text = await writeCopy({
      task: body.task,
      mode: body.mode,
      locale: body.locale,
      localeName,
      text: body.text,
      sourceText: body.sourceText,
      context: body.context,
      glossary: i18n.glossary,
      brandVoice: ai.brandVoice,
      brandName: brand.name,
      temperature: ai.writerTemperature,
      maxWords: body.maxWords,
      conn,
    });

    return jsonOk({ text });
  } catch (e) {
    return handleError(e);
  }
}
