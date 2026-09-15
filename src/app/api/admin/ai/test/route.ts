import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/session";
import { verifyCsrf } from "@/lib/auth/csrf";
import { audit } from "@/lib/audit";
import { handleError, jsonError, jsonOk } from "@/lib/api-server";
import { testConnection } from "@/lib/ai/client";
import { getAiConnection } from "@/lib/ai/concierge";

export const runtime = "nodejs";
export const maxDuration = 60;

const bodySchema = z
  .object({
    baseUrl: z.string().trim().max(400).optional(),
    model: z.string().trim().max(120).optional(),
    apiKey: z.string().max(400).optional(),
  })
  .optional();

/**
 * "Test connection" from Settings → AI concierge.
 * Unsaved form values may be passed in; anything missing falls back to the
 * stored setting, then to the environment. The key is never echoed back.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await requireUser("ai.configure");
    if (!(await verifyCsrf())) return jsonError("Invalid or missing CSRF token.", 403);

    const raw = await req.json().catch(() => ({}));
    const override = bodySchema.parse(raw) ?? {};
    const stored = await getAiConnection();

    const baseUrl = (override.baseUrl || stored?.baseUrl || process.env.AI_BASE_URL || "").trim();
    const model = (override.model || stored?.model || process.env.AI_MODEL || "").trim();
    const apiKey = (override.apiKey || stored?.apiKey || process.env.AI_API_KEY || "").trim();

    if (!baseUrl) return jsonError("Add a base URL first (for example https://api.deepseek.com/v1).", 400);
    if (!model) return jsonError("Add a model name first (for example deepseek-chat).", 400);

    const result = await testConnection({ baseUrl, apiKey, model });
    await audit(user.id, "ai.test", "setting", "ai", { ok: result.ok, latencyMs: result.latencyMs, model });

    return jsonOk({
      result: {
        ok: result.ok,
        message: result.message,
        latencyMs: result.latencyMs,
        model,
        baseUrl,
        usingEnvKey: !override.apiKey && !stored?.apiKey && Boolean(process.env.AI_API_KEY),
      },
    });
  } catch (e) {
    return handleError(e);
  }
}
