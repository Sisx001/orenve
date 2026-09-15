"use server";

import { randomBytes } from "node:crypto";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { hashPassword, passwordStrength } from "@/lib/auth/password";
import { destroyAllSessions } from "@/lib/auth/session";
import { authorize, fail, revalidateStudio, runAction, succeed, type ActionState } from "@/lib/admin/guard";
import { readBool, userCreateSchema, userUpdateSchema } from "@/lib/admin/schemas";

/** Readable temporary password: three chunks + digits + a symbol. */
function tempPassword() {
  const b = randomBytes(12).toString("base64url").replace(/[-_]/g, "");
  return `Ory-${b.slice(0, 5)}-${b.slice(5, 10)}-${randomBytes(2).readUInt16BE(0) % 9000 + 1000}!`;
}

async function ownerCount() {
  return db.user.count({ where: { role: "owner", isActive: true } });
}

export async function createUserAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const actor = await authorize("users.manage", fd);
    const supplied = String(fd.get("password") ?? "").trim();
    const password = supplied || tempPassword();

    const input = userCreateSchema.parse({
      email: fd.get("email"),
      name: fd.get("name"),
      role: String(fd.get("role") ?? "editor"),
      password,
    });
    if (supplied && passwordStrength(supplied).score < 3) {
      return fail("That password is too weak — 12+ characters with mixed case, a number and a symbol.", { password: "Too weak." });
    }

    const exists = await db.user.findUnique({ where: { email: input.email }, select: { id: true } });
    if (exists) return fail("A user with that email already exists.", { email: "Already in use." });

    const created = await db.user.create({
      data: { email: input.email, name: input.name, role: input.role, passwordHash: await hashPassword(password) },
    });
    await audit(actor.id, "user.create", "user", created.id, { email: created.email, role: created.role });
    revalidateStudio("/admin/users");
    return succeed(`${created.name} can now sign in.`, { password, email: created.email });
  });
}

export async function updateUserAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const actor = await authorize("users.manage", fd);
    const input = userUpdateSchema.parse({
      id: fd.get("id"),
      name: fd.get("name"),
      role: String(fd.get("role") ?? "editor"),
      isActive: readBool(fd, "isActive"),
    });

    const target = await db.user.findUnique({ where: { id: input.id } });
    if (!target) return fail("That user no longer exists.");

    const losingOwner = target.role === "owner" && (input.role !== "owner" || !input.isActive);
    if (losingOwner && (await ownerCount()) <= 1) {
      return fail("This is the only active owner — promote another owner first.");
    }
    if (target.id === actor.id && !input.isActive) return fail("You cannot deactivate your own account.");

    await db.user.update({ where: { id: input.id }, data: { name: input.name, role: input.role, isActive: input.isActive } });
    if (!input.isActive) await destroyAllSessions(input.id);

    await audit(actor.id, "user.update", "user", input.id, { role: input.role, isActive: input.isActive });
    revalidateStudio("/admin/users");
    return succeed("User updated.");
  });
}

export async function resetUserPasswordAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const actor = await authorize("users.manage", fd);
    const id = String(fd.get("userId") ?? "");
    const target = await db.user.findUnique({ where: { id }, select: { email: true, name: true } });
    if (!target) return fail("That user no longer exists.");

    const password = tempPassword();
    await db.user.update({ where: { id }, data: { passwordHash: await hashPassword(password), totpEnabled: false, totpSecret: null } });
    await destroyAllSessions(id);
    await audit(actor.id, "user.reset_password", "user", id, { email: target.email });
    revalidateStudio("/admin/users");
    return succeed(`Temporary password for ${target.name}. Share it once, then ask them to change it.`, { password, email: target.email });
  });
}

export async function revokeUserSessionsAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const actor = await authorize("users.manage", fd);
    const id = String(fd.get("userId") ?? "");
    await destroyAllSessions(id);
    await audit(actor.id, "user.revoke_sessions", "user", id);
    revalidateStudio("/admin/users");
    return succeed("All of that user's sessions were signed out.");
  });
}

export async function deleteUserAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const actor = await authorize("users.manage", fd);
    const id = String(fd.get("userId") ?? "");
    if (id === actor.id) return fail("You cannot delete your own account.");
    const target = await db.user.findUnique({ where: { id }, select: { email: true, role: true } });
    if (!target) return fail("That user no longer exists.");
    if (target.role === "owner" && (await ownerCount()) <= 1) return fail("This is the only owner — promote another owner first.");
    await db.user.delete({ where: { id } });
    await audit(actor.id, "user.delete", "user", id, { email: target.email });
    revalidateStudio("/admin/users");
    return succeed("User deleted.");
  });
}
