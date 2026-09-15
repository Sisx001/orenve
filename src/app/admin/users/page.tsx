import { PageHeader } from "@/components/admin/PageHeader";
import { requireStudio } from "@/lib/admin/session";
import { csrfToken } from "@/lib/admin/csrf";
import { db } from "@/lib/db";
import { UsersManager, type UserRow } from "./UsersManager";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const me = await requireStudio("users.manage", "/admin/users");
  const [users, csrf] = await Promise.all([
    db.user.findMany({
      orderBy: [{ role: "asc" }, { createdAt: "asc" }],
      include: { _count: { select: { sessions: true } } },
    }),
    csrfToken(),
  ]);

  const rows: UserRow[] = users.map((u) => ({
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
    isActive: u.isActive,
    totpEnabled: u.totpEnabled,
    lastLoginAt: u.lastLoginAt ? u.lastLoginAt.toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : null,
    sessions: u._count.sessions,
    isSelf: u.id === me.id,
  }));

  return (
    <div className="mx-auto max-w-[1000px]">
      <PageHeader title="Users" description="Who can sign in to the studio, and what they can touch. Every sign-in and change is recorded in the audit log." />
      <UsersManager rows={rows} csrf={csrf} />
    </div>
  );
}
