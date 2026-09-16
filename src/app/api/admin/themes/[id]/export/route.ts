import type { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { exportTheme } from "@/lib/admin/actions/themes";
import { jsonError } from "@/lib/api-server";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireUser("themes.write");
  } catch {
    return jsonError("Unauthorised.", 401);
  }

  const { id } = await params;
  const definition = await exportTheme(id);
  if (!definition) return jsonError("Theme not found.", 404);

  const filename = `theme-${definition.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.json`;
  return new Response(JSON.stringify(definition, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
