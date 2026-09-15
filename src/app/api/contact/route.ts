import type { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getClientIp } from "@/lib/request";
import { rateLimit } from "@/lib/ratelimit";
import { sendMail } from "@/lib/mail";
import { getSetting } from "@/lib/settings";
import { handleError, jsonError, jsonOk } from "@/lib/api-server";

export const runtime = "nodejs";
const schema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(160),
  phone: z.string().trim().max(30).optional().or(z.literal("")),
  subject: z.string().trim().max(160).optional().or(z.literal("")),
  message: z.string().trim().min(10).max(4000),
  website: z.string().max(0).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const rl = await rateLimit("contact", getClientIp(req.headers), 8, 3600);
    if (!rl.ok) return jsonError("errors.rateLimited", 429);
    const data = schema.parse(await req.json());
    if (data.website) return jsonOk({});
    const { website: _w, ...rest } = data;
    const row = await db.contactMessage.create({ data: { ...rest, phone: rest.phone || null, subject: rest.subject || null } });
    const contact = await getSetting("contact");
    if (contact.email) {
      void sendMail({
        to: contact.email,
        subject: `[ORYNVE] New message from ${data.name}${data.subject ? ` — ${data.subject}` : ""}`,
        html: `<p><b>${data.name}</b> &lt;${data.email}&gt; ${data.phone ?? ""}</p><p>${data.message.replace(/\n/g, "<br/>")}</p><p>Ref ${row.id}</p>`,
      });
    }
    return jsonOk({});
  } catch (e) {
    return handleError(e);
  }
}
