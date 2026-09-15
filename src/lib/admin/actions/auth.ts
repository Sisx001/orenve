"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { createHash } from "node:crypto";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { getClientIp } from "@/lib/request";
import { hashPassword, passwordStrength, verifyPassword } from "@/lib/auth/password";
import { createSession, destroyAllSessions, destroySession, getCurrentUser, requireUser } from "@/lib/auth/session";
import { verifyCsrf } from "@/lib/auth/csrf";
import { rateLimit } from "@/lib/ratelimit";
import {
  COOKIE_TOTP_PENDING,
  PENDING_TTL_SEC,
  generateTotpSecret,
  readPendingToken,
  signPendingToken,
  verifyTotp,
} from "@/lib/auth/totp";
import { changePasswordSchema, loginSchema, totpStepSchema } from "@/lib/admin/schemas";
import { fail, runAction, succeed, type ActionState } from "@/lib/admin/guard";
import { revalidatePath } from "next/cache";

const MAX_ATTEMPTS = 5;
const LOCK_MINUTES = 15;

function attemptKey(ip: string, email: string) {
  return createHash("sha256").update(`${ip}:${email}`).digest("hex");
}

function safeNext(next: string | undefined | null): string {
  if (!next || !next.startsWith("/admin") || next.startsWith("//")) return "/admin";
  return next;
}

async function secureCookie() {
  return (process.env.APP_URL ?? "").startsWith("https://");
}

/* ───────────────────────────── login ───────────────────────────── */

export async function loginAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    if (!(await verifyCsrf(fd.get("_csrf") as string | null))) return fail("Your session expired — reload the page and try again.");

    const parsed = loginSchema.safeParse({
      email: fd.get("email"),
      password: fd.get("password"),
      next: fd.get("next") ?? undefined,
    });
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      return fail(first?.message ?? "Check your details.");
    }
    const { email, password } = parsed.data;
    const next = safeNext(parsed.data.next);

    const h = await headers();
    const ip = getClientIp(h);

    // Coarse per-IP limiter on top of the per-identity lockout.
    const rl = await rateLimit("admin-login", ip, 30, 15 * 60);
    if (!rl.ok) return fail("Too many attempts from this network. Try again shortly.");

    const key = attemptKey(ip, email);
    const attempt = await db.loginAttempt.findUnique({ where: { key } });
    if (attempt?.lockedUntil && attempt.lockedUntil > new Date()) {
      const mins = Math.max(1, Math.ceil((attempt.lockedUntil.getTime() - Date.now()) / 60_000));
      return fail(`Too many failed attempts. Try again in ${mins} minute${mins === 1 ? "" : "s"}.`);
    }

    const user = await db.user.findUnique({ where: { email } });
    const ok = user && user.isActive ? await verifyPassword(password, user.passwordHash) : false;

    if (!ok) {
      const count = (attempt?.count ?? 0) + 1;
      const lockedUntil = count >= MAX_ATTEMPTS ? new Date(Date.now() + LOCK_MINUTES * 60_000) : null;
      await db.loginAttempt.upsert({
        where: { key },
        update: { count: lockedUntil ? 0 : count, lockedUntil },
        create: { key, count, lockedUntil },
      });
      await audit(user?.id ?? null, "login.failed", "user", user?.id ?? null, { email, reason: user ? (user.isActive ? "bad_password" : "inactive") : "unknown_email" });
      if (lockedUntil) return fail(`Too many failed attempts. Try again in ${LOCK_MINUTES} minutes.`);
      return fail("Those details do not match an active account.");
    }

    await db.loginAttempt.deleteMany({ where: { key } });

    if (user!.totpEnabled && user!.totpSecret) {
      const jar = await cookies();
      jar.set(COOKIE_TOTP_PENDING, signPendingToken(user!.id), {
        httpOnly: true,
        sameSite: "lax",
        secure: await secureCookie(),
        path: "/",
        maxAge: PENDING_TTL_SEC,
      });
      return { ok: true, message: null, data: { step: "totp", next } };
    }

    await createSession(user!.id);
    await audit(user!.id, "login.success", "user", user!.id, { email });
    redirect(next);
  });
}

export async function loginTotpAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    if (!(await verifyCsrf(fd.get("_csrf") as string | null))) return fail("Your session expired — reload the page and try again.");
    const parsed = totpStepSchema.safeParse({ code: fd.get("code"), next: fd.get("next") ?? undefined });
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Enter the 6-digit code.", data: { step: "totp" } };

    const jar = await cookies();
    const userId = readPendingToken(jar.get(COOKIE_TOTP_PENDING)?.value);
    if (!userId) return fail("That verification step expired. Sign in again.");

    const h = await headers();
    const ip = getClientIp(h);
    const rl = await rateLimit("admin-totp", `${ip}:${userId}`, 10, 15 * 60);
    if (!rl.ok) return fail("Too many code attempts. Try again shortly.");

    const user = await db.user.findUnique({ where: { id: userId } });
    if (!user || !user.isActive || !user.totpSecret) return fail("That account can no longer sign in.");

    if (!verifyTotp(parsed.data.code, user.totpSecret)) {
      await audit(user.id, "login.failed", "user", user.id, { reason: "bad_totp" });
      return { ok: false, error: "That code is not valid. Check your authenticator app.", data: { step: "totp" } };
    }

    jar.delete(COOKIE_TOTP_PENDING);
    await createSession(user.id);
    await audit(user.id, "login.success", "user", user.id, { email: user.email, totp: "true" });
    redirect(safeNext(parsed.data.next));
  });
}

export async function signOutAction() {
  const user = await getCurrentUser();
  await destroySession();
  if (user) await audit(user.id, "logout", "user", user.id);
  redirect("/admin/login");
}

/* ───────────────────────────── profile ───────────────────────────── */

export async function changePasswordAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await requireUser();
    if (!(await verifyCsrf(fd.get("_csrf") as string | null))) return fail("Your session expired — reload the page and try again.");

    const parsed = changePasswordSchema.safeParse({
      current: fd.get("current"),
      next: fd.get("next"),
      confirm: fd.get("confirm"),
    });
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      return fail(issue?.message ?? "Check the fields.", { [String(issue?.path[0] ?? "_form")]: issue?.message ?? "" });
    }

    const row = await db.user.findUniqueOrThrow({ where: { id: user.id } });
    if (!(await verifyPassword(parsed.data.current, row.passwordHash))) {
      return fail("Your current password is not correct.", { current: "Incorrect password." });
    }
    const strength = passwordStrength(parsed.data.next);
    if (strength.score < 3) {
      return fail("Choose a stronger password: 12+ characters with upper and lower case, a number and a symbol.", { next: "Too weak." });
    }

    await db.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(parsed.data.next) } });
    await audit(user.id, "password.change", "user", user.id);
    revalidatePath("/admin/profile");
    return succeed("Password changed. Other sessions stay signed in — revoke them below if you want.");
  });
}

/** Step 1 of enrolment: mint a secret and stash it (unverified) on the user. */
export async function beginTotpAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await requireUser();
    if (!(await verifyCsrf(fd.get("_csrf") as string | null))) return fail("Your session expired — reload the page and try again.");
    if (user.totpEnabled) return fail("Two-factor authentication is already on.");
    const secret = generateTotpSecret();
    await db.user.update({ where: { id: user.id }, data: { totpSecret: secret, totpEnabled: false } });
    revalidatePath("/admin/profile");
    return succeed("Scan the QR code, then confirm with a code.");
  });
}

export async function confirmTotpAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await requireUser();
    if (!(await verifyCsrf(fd.get("_csrf") as string | null))) return fail("Your session expired — reload the page and try again.");
    const code = String(fd.get("code") ?? "");
    const row = await db.user.findUniqueOrThrow({ where: { id: user.id } });
    if (!row.totpSecret) return fail("Start the setup again — no pending secret was found.");
    if (!verifyTotp(code, row.totpSecret)) return fail("That code is not valid. Try the next one your app shows.");
    await db.user.update({ where: { id: user.id }, data: { totpEnabled: true } });
    await audit(user.id, "totp.enable", "user", user.id);
    revalidatePath("/admin/profile");
    return succeed("Two-factor authentication is on.");
  });
}

export async function disableTotpAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await requireUser();
    if (!(await verifyCsrf(fd.get("_csrf") as string | null))) return fail("Your session expired — reload the page and try again.");
    const row = await db.user.findUniqueOrThrow({ where: { id: user.id } });
    if (!row.totpEnabled || !row.totpSecret) return fail("Two-factor authentication is not on.");
    if (!verifyTotp(String(fd.get("code") ?? ""), row.totpSecret)) return fail("Enter a valid code to turn 2FA off.");
    await db.user.update({ where: { id: user.id }, data: { totpEnabled: false, totpSecret: null } });
    await audit(user.id, "totp.disable", "user", user.id);
    revalidatePath("/admin/profile");
    return succeed("Two-factor authentication is off.");
  });
}

export async function cancelTotpSetupAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await requireUser();
    if (!(await verifyCsrf(fd.get("_csrf") as string | null))) return fail("Your session expired.");
    await db.user.update({ where: { id: user.id }, data: { totpSecret: null, totpEnabled: false } });
    revalidatePath("/admin/profile");
    return succeed("Setup cancelled.");
  });
}

export async function revokeSessionAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await requireUser();
    if (!(await verifyCsrf(fd.get("_csrf") as string | null))) return fail("Your session expired — reload the page and try again.");
    const id = String(fd.get("sessionId") ?? "");
    if (id === "all") {
      await destroyAllSessions(user.id);
      await audit(user.id, "sessions.revoke_all", "user", user.id);
      redirect("/admin/login");
    }
    await db.session.deleteMany({ where: { id, userId: user.id } });
    await audit(user.id, "session.revoke", "user", user.id, { sessionId: id });
    revalidatePath("/admin/profile");
    return succeed("Session revoked.");
  });
}

export async function updateProfileAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await requireUser();
    if (!(await verifyCsrf(fd.get("_csrf") as string | null))) return fail("Your session expired — reload the page and try again.");
    const name = String(fd.get("name") ?? "").trim();
    const locale = String(fd.get("locale") ?? "en").slice(0, 5);
    if (name.length < 2) return fail("Enter your name.", { name: "Too short." });
    await db.user.update({ where: { id: user.id }, data: { name, locale } });
    await audit(user.id, "profile.update", "user", user.id);
    revalidatePath("/admin", "layout");
    return succeed("Profile updated.");
  });
}
