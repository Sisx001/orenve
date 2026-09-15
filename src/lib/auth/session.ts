import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cookies, headers } from "next/headers";
import { cache } from "react";
import { db } from "@/lib/db";
import { COOKIE_SESSION, SESSION_TTL_DAYS, PERMISSIONS, type Role } from "@/lib/constants";
import { getClientIp } from "@/lib/request";

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: Role;
  locale: string;
  totpEnabled: boolean;
  avatarUrl: string | null;
};

const hashToken = (t: string) => createHash("sha256").update(t).digest("hex");

function cookieOptions(expires: Date) {
  const secure = (process.env.APP_URL ?? "").startsWith("https://");
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure,
    path: "/",
    expires,
  };
}

export async function createSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 86400_000);
  const h = await headers();
  await db.session.create({
    data: {
      userId,
      tokenHash: hashToken(token),
      expiresAt,
      ip: getClientIp(h),
      userAgent: h.get("user-agent")?.slice(0, 300) ?? null,
    },
  });
  const jar = await cookies();
  jar.set(COOKIE_SESSION, token, cookieOptions(expiresAt));
  await db.user.update({ where: { id: userId }, data: { lastLoginAt: new Date() } });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(COOKIE_SESSION)?.value;
  if (token) await db.session.deleteMany({ where: { tokenHash: hashToken(token) } });
  jar.delete(COOKIE_SESSION);
}

export async function destroyAllSessions(userId: string) {
  await db.session.deleteMany({ where: { userId } });
}

/** Cached per request. Returns null when not signed in. */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const jar = await cookies();
  const token = jar.get(COOKIE_SESSION)?.value;
  if (!token) return null;
  const session = await db.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: true },
  });
  if (!session || session.expiresAt < new Date() || !session.user.isActive) return null;

  // Sliding expiry: extend when less than half the TTL remains.
  if (session.expiresAt.getTime() - Date.now() < (SESSION_TTL_DAYS * 86400_000) / 2) {
    const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 86400_000);
    await db.session.update({ where: { id: session.id }, data: { expiresAt } }).catch(() => {});
  }
  const u = session.user;
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role as Role,
    locale: u.locale,
    totpEnabled: u.totpEnabled,
    avatarUrl: u.avatarUrl,
  };
});

export function can(user: SessionUser | null, permission: keyof typeof PERMISSIONS | string): boolean {
  if (!user) return false;
  if (user.role === "owner") return true;
  const allowed = PERMISSIONS[permission];
  return allowed ? allowed.includes(user.role) : false;
}

export class AuthError extends Error {
  status: number;
  constructor(message = "Unauthorized", status = 401) {
    super(message);
    this.status = status;
  }
}

export async function requireUser(permission?: string): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) throw new AuthError("Please sign in.", 401);
  if (permission && !can(user, permission)) throw new AuthError("You do not have permission for this action.", 403);
  return user;
}

export async function cleanupExpiredSessions() {
  await db.session.deleteMany({ where: { expiresAt: { lt: new Date() } } });
}
