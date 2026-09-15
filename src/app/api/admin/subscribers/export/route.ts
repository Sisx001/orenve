import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { audit } from "@/lib/audit";
import { handleError } from "@/lib/api-server";

const esc = (v: unknown) => {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** Newsletter list as CSV, ready for a mail provider import. */
export async function GET() {
  try {
    const user = await requireUser("customers.read");
    const rows = await db.subscriber.findMany({ orderBy: { createdAt: "desc" } });
    await audit(user.id, "subscribers.export", "subscriber", null, { rows: rows.length });

    const lines = ["email,locale,confirmed,source,subscribed_at"];
    for (const s of rows) {
      lines.push([s.email, s.locale, s.isConfirmed ? "yes" : "no", s.source ?? "", s.createdAt.toISOString()].map(esc).join(","));
    }

    const stamp = new Date().toISOString().slice(0, 10);
    return new Response(`${lines.join("\n")}\n`, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="orynve-subscribers-${stamp}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    return handleError(e);
  }
}
