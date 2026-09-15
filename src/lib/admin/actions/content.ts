"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { toJson } from "@/lib/json";
import { slugify } from "@/lib/utils";
import { BLOCK_TYPES } from "@/lib/constants";
import { authorize, fail, revalidateStudio, runAction, succeed, type ActionState } from "@/lib/admin/guard";
import { blockSchema, pageSchema, readBool, readI18n, readInt, readJson } from "@/lib/admin/schemas";

const i18n = (p: { en: string; bn: string }) => toJson({ en: p.en, bn: p.bn || p.en });
const i18nOrNull = (p: { en: string; bn: string }) => (p.en.trim() || p.bn.trim() ? i18n(p) : null);

/* ───────────────────────────── pages ───────────────────────────── */

export async function savePageAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  let created: string | null = null;
  const result = await runAction(async () => {
    const user = await authorize("content.write", fd);
    const title = readI18n(fd, "title");
    const input = pageSchema.parse({
      id: String(fd.get("id") ?? "") || undefined,
      slug: slugify(String(fd.get("slug") ?? "").trim() || title.en),
      title,
      body: readI18n(fd, "body"),
      template: String(fd.get("template") ?? "editorial"),
      isPublished: readBool(fd, "isPublished"),
      showInFooter: readBool(fd, "showInFooter"),
      seoTitle: readI18n(fd, "seoTitle"),
      seoDescription: readI18n(fd, "seoDescription"),
    });
    if (!input.title.en.trim()) return fail("An English title is required.", { title_en: "Required." });
    if (!input.slug) return fail("A slug is required.", { slug: "Required." });

    const clash = await db.page.findUnique({ where: { slug: input.slug }, select: { id: true } });
    if (clash && clash.id !== input.id) return fail("Another page already uses that slug.", { slug: "Already taken." });

    const data = {
      slug: input.slug,
      title: i18n(input.title),
      body: i18n(input.body),
      template: input.template,
      isPublished: input.isPublished,
      showInFooter: input.showInFooter,
      seoTitle: input.seoTitle ? i18nOrNull(input.seoTitle) : null,
      seoDescription: input.seoDescription ? i18nOrNull(input.seoDescription) : null,
    };

    const row = input.id ? await db.page.update({ where: { id: input.id }, data }) : await db.page.create({ data });
    created = input.id ? null : row.id;
    await audit(user.id, input.id ? "page.update" : "page.create", "page", row.id, { slug: row.slug, published: row.isPublished });
    revalidateStudio("/admin/pages", `/admin/pages/${row.id}`);
    return succeed("Page saved.", { id: row.id });
  });
  if (result.ok && created) redirect(`/admin/pages/${created}`);
  return result;
}

export async function deletePageAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const result = await runAction(async () => {
    const user = await authorize("content.write", fd);
    const id = String(fd.get("pageId") ?? "");
    const row = await db.page.findUnique({ where: { id }, select: { slug: true } });
    if (!row) return fail("That page no longer exists.");
    await db.page.delete({ where: { id } });
    await audit(user.id, "page.delete", "page", id, { slug: row.slug });
    revalidateStudio("/admin/pages");
    return succeed("Page deleted.", { deleted: "1" });
  });
  if (result.ok && result.data?.deleted === "1") redirect("/admin/pages");
  return result;
}

export async function togglePageAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await authorize("content.write", fd);
    const id = String(fd.get("pageId") ?? "");
    const row = await db.page.findUnique({ where: { id }, select: { isPublished: true, slug: true } });
    if (!row) return fail("That page no longer exists.");
    await db.page.update({ where: { id }, data: { isPublished: !row.isPublished } });
    await audit(user.id, "page.toggle", "page", id, { slug: row.slug, published: !row.isPublished });
    revalidateStudio("/admin/pages");
    return succeed(row.isPublished ? "Page unpublished." : "Page published.");
  });
}

/* ───────────────────────────── homepage blocks ───────────────────────────── */

export async function saveBlockAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await authorize("content.write", fd);
    const input = blockSchema.parse({
      id: String(fd.get("id") ?? "") || undefined,
      page: String(fd.get("page") ?? "home"),
      type: String(fd.get("type") ?? "custom"),
      isEnabled: readBool(fd, "isEnabled"),
      position: readInt(fd, "position", 0),
      data: readJson<Record<string, unknown>>(fd, "data", {}),
    });

    if (input.id) {
      await db.block.update({
        where: { id: input.id },
        data: { type: input.type, isEnabled: input.isEnabled, data: toJson(input.data) },
      });
    } else {
      const last = await db.block.findFirst({ where: { page: input.page }, orderBy: { position: "desc" }, select: { position: true } });
      await db.block.create({
        data: {
          page: input.page,
          type: input.type,
          isEnabled: input.isEnabled,
          position: (last?.position ?? -1) + 1,
          data: toJson(input.data),
        },
      });
    }

    await audit(user.id, input.id ? "block.update" : "block.create", "block", input.id ?? null, { type: input.type, page: input.page });
    revalidateStudio("/admin/homepage");
    return succeed("Block saved.");
  });
}

export async function addBlockAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await authorize("content.write", fd);
    const type = String(fd.get("type") ?? "");
    const page = String(fd.get("page") ?? "home");
    if (!(BLOCK_TYPES as readonly string[]).includes(type)) return fail("Pick a block type.");
    const last = await db.block.findFirst({ where: { page }, orderBy: { position: "desc" }, select: { position: true } });
    const row = await db.block.create({
      data: { page, type, isEnabled: true, position: (last?.position ?? -1) + 1, data: toJson({}) },
    });
    await audit(user.id, "block.create", "block", row.id, { type, page });
    revalidateStudio("/admin/homepage");
    return succeed(`${type} block added — open it to fill in the content.`, { id: row.id });
  });
}

export async function toggleBlockAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await authorize("content.write", fd);
    const id = String(fd.get("blockId") ?? "");
    const row = await db.block.findUnique({ where: { id }, select: { isEnabled: true, type: true } });
    if (!row) return fail("That block no longer exists.");
    await db.block.update({ where: { id }, data: { isEnabled: !row.isEnabled } });
    await audit(user.id, "block.toggle", "block", id, { type: row.type, enabled: !row.isEnabled });
    revalidateStudio("/admin/homepage");
    return succeed(row.isEnabled ? "Block hidden." : "Block shown.");
  });
}

export async function deleteBlockAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await authorize("content.write", fd);
    const id = String(fd.get("blockId") ?? "");
    const row = await db.block.findUnique({ where: { id }, select: { type: true, page: true } });
    if (!row) return fail("That block no longer exists.");
    await db.block.delete({ where: { id } });
    await audit(user.id, "block.delete", "block", id, { type: row.type });
    revalidateStudio("/admin/homepage");
    return succeed("Block removed.");
  });
}

export async function moveBlockAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await authorize("content.write", fd);
    const id = String(fd.get("blockId") ?? "");
    const page = String(fd.get("page") ?? "home");
    const direction = String(fd.get("direction") ?? "up") === "down" ? 1 : -1;

    const rows = await db.block.findMany({ where: { page }, orderBy: { position: "asc" }, select: { id: true } });
    const idx = rows.findIndex((r) => r.id === id);
    const swap = idx + direction;
    if (idx < 0 || swap < 0 || swap >= rows.length) return succeed("Already at the end.");
    [rows[idx], rows[swap]] = [rows[swap], rows[idx]];
    for (let i = 0; i < rows.length; i++) await db.block.update({ where: { id: rows[i].id }, data: { position: i } });

    await audit(user.id, "block.reorder", "block", id, { page });
    revalidateStudio("/admin/homepage");
    return succeed("Order updated.");
  });
}

/* ───────────────────────────── reviews ───────────────────────────── */

export async function reviewDecisionAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await authorize("content.write", fd);
    const id = String(fd.get("reviewId") ?? "");
    const decision = String(fd.get("decision") ?? "");
    const row = await db.review.findUnique({ where: { id }, select: { productId: true, customerName: true } });
    if (!row) return fail("That review no longer exists.");

    if (decision === "delete") {
      await db.review.delete({ where: { id } });
      await audit(user.id, "review.delete", "review", id, { productId: row.productId });
      revalidateStudio("/admin/reviews");
      return succeed("Review deleted.");
    }
    const approve = decision === "approve";
    await db.review.update({ where: { id }, data: { isApproved: approve } });
    await audit(user.id, approve ? "review.approve" : "review.unapprove", "review", id, { productId: row.productId });
    revalidateStudio("/admin/reviews");
    return succeed(approve ? "Review approved and live." : "Review hidden.");
  });
}

/* ───────────────────────────── contact messages ───────────────────────────── */

export async function messageStatusAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await authorize("customers.read", fd);
    const id = String(fd.get("messageId") ?? "");
    const status = String(fd.get("status") ?? "");
    if (status === "delete") {
      await db.contactMessage.delete({ where: { id } }).catch(() => {});
      await audit(user.id, "message.delete", "contactMessage", id);
      revalidateStudio("/admin/messages");
      return succeed("Message deleted.");
    }
    if (!["new", "replied", "archived"].includes(status)) return fail("Pick a valid status.");
    await db.contactMessage.update({ where: { id }, data: { status } });
    await audit(user.id, "message.status", "contactMessage", id, { status });
    revalidateStudio("/admin/messages");
    return succeed(`Marked as ${status}.`);
  });
}

export async function deleteSubscriberAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await authorize("customers.read", fd);
    const id = String(fd.get("subscriberId") ?? "");
    const row = await db.subscriber.findUnique({ where: { id }, select: { email: true } });
    if (!row) return fail("That subscriber no longer exists.");
    await db.subscriber.delete({ where: { id } });
    await audit(user.id, "subscriber.delete", "subscriber", id, { email: row.email });
    revalidateStudio("/admin/messages");
    return succeed("Subscriber removed.");
  });
}
