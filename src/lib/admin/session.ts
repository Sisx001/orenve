import "server-only";
import { redirect } from "next/navigation";
import { can, getCurrentUser, type SessionUser } from "@/lib/auth/session";

/**
 * Page-level guard for studio routes.
 *  • no session      → /admin/login?next=…
 *  • missing right   → /admin?denied=<permission>
 */
export async function requireStudio(permission?: string, nextPath?: string): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) {
    const next = nextPath ? `?next=${encodeURIComponent(nextPath)}` : "";
    redirect(`/admin/login${next}`);
  }
  if (permission && !can(user, permission)) redirect(`/admin?denied=${encodeURIComponent(permission)}`);
  return user;
}
