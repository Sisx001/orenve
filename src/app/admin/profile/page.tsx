import { createHash } from "node:crypto";
import { cookies } from "next/headers";
import { PageHeader, Section } from "@/components/admin/PageHeader";
import { ChangePassword, ProfileDetails, SessionList, TwoFactor, type SessionRow } from "./ProfileForms";
import { requireStudio } from "@/lib/admin/session";
import { csrfToken } from "@/lib/admin/csrf";
import { db } from "@/lib/db";
import { COOKIE_SESSION } from "@/lib/constants";
import { formatSecret, totpKeyUri, totpQrDataUrl } from "@/lib/auth/totp";

export const dynamic = "force-dynamic";

const dt = (d: Date) => d.toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

export default async function ProfilePage() {
  const user = await requireStudio(undefined, "/admin/profile");
  const [csrf, jar, row, sessions] = await Promise.all([
    csrfToken(),
    cookies(),
    db.user.findUniqueOrThrow({ where: { id: user.id }, select: { totpEnabled: true, totpSecret: true, email: true, locale: true } }),
    db.session.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" } }),
  ]);

  const token = jar.get(COOKIE_SESSION)?.value;
  const currentHash = token ? createHash("sha256").update(token).digest("hex") : "";

  const pending = !row.totpEnabled && Boolean(row.totpSecret);
  const qr = pending && row.totpSecret ? await totpQrDataUrl(totpKeyUri(row.email, row.totpSecret)) : null;

  const sessionRows: SessionRow[] = sessions.map((s) => ({
    id: s.id,
    ip: s.ip ?? "unknown",
    userAgent: s.userAgent ?? "",
    createdAt: dt(s.createdAt),
    expiresAt: dt(s.expiresAt),
    current: s.tokenHash === currentHash,
  }));

  return (
    <div className="mx-auto max-w-[1100px]">
      <PageHeader title="Your profile" description="Your details, password, two-factor authentication and active sessions." />

      <div className="grid gap-5 lg:grid-cols-2">
        <Section title="Details">
          <ProfileDetails csrf={csrf} name={user.name} email={row.email} role={user.role} locale={row.locale} />
        </Section>

        <Section title="Password" className="scroll-mt-24" >
          <div id="password" />
          <ChangePassword csrf={csrf} />
        </Section>

        <Section title="Two-factor authentication" className="lg:col-span-2">
          <div id="twofa" className="scroll-mt-24" />
          <TwoFactor csrf={csrf} enabled={row.totpEnabled} pending={pending} qr={qr} secret={row.totpSecret ? formatSecret(row.totpSecret) : null} />
        </Section>

        <Section title={`Active sessions (${sessionRows.length})`} className="lg:col-span-2">
          <SessionList csrf={csrf} sessions={sessionRows} />
        </Section>
      </div>
    </div>
  );
}
