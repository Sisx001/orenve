import type { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { handleError, jsonError, jsonOk } from "@/lib/api-server";
import { isKnownLocale } from "@/lib/i18n/registry";
import { coverage } from "@/lib/i18n/translate";

export const runtime = "nodejs";
export const maxDuration = 60;

/** GET /api/admin/i18n/coverage?locale=xx — live progress for the studio meters. */
export async function GET(req: NextRequest) {
  try {
    await requireUser("i18n.write");
    const locale = (req.nextUrl.searchParams.get("locale") ?? "").trim().toLowerCase();
    if (!locale) return jsonError("Pass ?locale=<code>.", 400);
    if (!(await isKnownLocale(locale))) return jsonError("That language is not registered.", 404);
    return jsonOk({ locale, coverage: await coverage(locale) });
  } catch (e) {
    return handleError(e);
  }
}
