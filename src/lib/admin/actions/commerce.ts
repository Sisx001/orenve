"use server";

import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { toJson } from "@/lib/json";
import { slugify } from "@/lib/utils";
import { BD_DISTRICTS } from "@/lib/constants";
import { authorize, fail, revalidateStudio, runAction, succeed, type ActionState } from "@/lib/admin/guard";
import {
  categorySchema,
  collectionSchema,
  couponSchema,
  readBool,
  readI18n,
  readInt,
  readMoney,
  shippingZoneSchema,
} from "@/lib/admin/schemas";

const i18n = (p: { en: string; bn: string }) => toJson({ en: p.en, bn: p.bn || p.en });
const i18nOrNull = (p: { en: string; bn: string }) => (p.en.trim() || p.bn.trim() ? i18n(p) : null);
const dateOrNull = (v: string) => (v ? new Date(v) : null);

/* ───────────────────────────── coupons ───────────────────────────── */

export async function saveCouponAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await authorize("products.write", fd);
    const type = String(fd.get("type") ?? "percent");
    // Percent coupons store 0–100; fixed coupons store minor units.
    const value = type === "fixed" ? (readMoney(fd, "value") ?? 0) : Math.min(100, Math.max(0, readInt(fd, "value", 0)));

    const input = couponSchema.parse({
      id: String(fd.get("id") ?? "") || undefined,
      code: fd.get("code"),
      type,
      value,
      minSubtotal: readMoney(fd, "minSubtotal") ?? 0,
      maxUses: readInt(fd, "maxUses", 0) || null,
      perCustomer: readInt(fd, "perCustomer", 0) || null,
      startsAt: String(fd.get("startsAt") ?? ""),
      endsAt: String(fd.get("endsAt") ?? ""),
      isActive: readBool(fd, "isActive"),
    });

    const data = {
      code: input.code,
      type: input.type,
      value: input.value,
      minSubtotal: input.minSubtotal,
      maxUses: input.maxUses ?? null,
      perCustomer: input.perCustomer ?? null,
      startsAt: dateOrNull(input.startsAt ?? ""),
      endsAt: dateOrNull(input.endsAt ?? ""),
      isActive: input.isActive,
    };

    const clash = await db.coupon.findUnique({ where: { code: data.code }, select: { id: true } });
    if (clash && clash.id !== input.id) return fail("Another coupon already uses that code.", { code: "Already taken." });

    const row = input.id ? await db.coupon.update({ where: { id: input.id }, data }) : await db.coupon.create({ data });
    await audit(user.id, input.id ? "coupon.update" : "coupon.create", "coupon", row.id, { code: row.code, type: row.type });
    revalidateStudio("/admin/coupons");
    return succeed(`Coupon ${row.code} saved.`);
  });
}

export async function deleteCouponAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await authorize("products.write", fd);
    const id = String(fd.get("couponId") ?? "");
    const row = await db.coupon.findUnique({ where: { id }, select: { code: true } });
    if (!row) return fail("That coupon no longer exists.");
    await db.coupon.delete({ where: { id } });
    await audit(user.id, "coupon.delete", "coupon", id, { code: row.code });
    revalidateStudio("/admin/coupons");
    return succeed("Coupon deleted.");
  });
}

/* ───────────────────────────── shipping zones ───────────────────────────── */

export async function saveShippingZoneAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await authorize("settings.write", fd);
    const picked = fd.getAll("districts").map(String).filter((d) => (BD_DISTRICTS as readonly string[]).includes(d));
    const everywhere = readBool(fd, "everywhereElse");

    const input = shippingZoneSchema.parse({
      id: String(fd.get("id") ?? "") || undefined,
      name: readI18n(fd, "name"),
      districts: picked,
      everywhereElse: everywhere,
      rate: readMoney(fd, "rate") ?? 0,
      freeAbove: readMoney(fd, "freeAbove"),
      etaMinDays: readInt(fd, "etaMinDays", 2),
      etaMaxDays: readInt(fd, "etaMaxDays", 5),
      isActive: readBool(fd, "isActive"),
      sortOrder: readInt(fd, "sortOrder", 0),
    });
    if (!input.name.en.trim()) return fail("An English zone name is required.", { name_en: "Required." });
    if (input.districts.length === 0 && !input.everywhereElse) return fail("Pick at least one district, or switch on “everywhere else”.");
    if (input.etaMaxDays < input.etaMinDays) return fail("The maximum delivery time cannot be shorter than the minimum.");

    const districts = input.everywhereElse ? [...input.districts, "*"] : input.districts;
    const data = {
      name: i18n(input.name),
      districts: toJson(districts),
      rate: input.rate,
      freeAbove: input.freeAbove ?? null,
      etaMinDays: input.etaMinDays,
      etaMaxDays: input.etaMaxDays,
      isActive: input.isActive,
      sortOrder: input.sortOrder,
    };

    const row = input.id ? await db.shippingZone.update({ where: { id: input.id }, data }) : await db.shippingZone.create({ data });
    await audit(user.id, input.id ? "shipping.update" : "shipping.create", "shippingZone", row.id, { districts: districts.length, rate: row.rate });
    revalidateStudio("/admin/shipping");
    return succeed("Zone saved.");
  });
}

export async function deleteShippingZoneAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await authorize("settings.write", fd);
    const id = String(fd.get("zoneId") ?? "");
    if (!(await db.shippingZone.findUnique({ where: { id }, select: { id: true } }))) return fail("That zone no longer exists.");
    await db.shippingZone.delete({ where: { id } });
    await audit(user.id, "shipping.delete", "shippingZone", id);
    revalidateStudio("/admin/shipping");
    return succeed("Zone deleted.");
  });
}

/* ───────────────────────────── categories ───────────────────────────── */

export async function saveCategoryAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await authorize("products.write", fd);
    const name = readI18n(fd, "name");
    const input = categorySchema.parse({
      id: String(fd.get("id") ?? "") || undefined,
      slug: slugify(String(fd.get("slug") ?? "").trim() || name.en),
      name,
      description: readI18n(fd, "description"),
      image: String(fd.get("image") ?? "").trim(),
      parentId: String(fd.get("parentId") ?? "") || undefined,
      sortOrder: readInt(fd, "sortOrder", 0),
      isActive: readBool(fd, "isActive"),
    });
    if (!input.name.en.trim()) return fail("An English name is required.", { name_en: "Required." });
    if (input.parentId === input.id) return fail("A category cannot be its own parent.");

    const clash = await db.category.findUnique({ where: { slug: input.slug }, select: { id: true } });
    if (clash && clash.id !== input.id) return fail("Another category already uses that slug.", { slug: "Already taken." });

    const data = {
      slug: input.slug,
      name: i18n(input.name),
      description: input.description ? i18nOrNull(input.description) : null,
      image: input.image || null,
      parentId: input.parentId,
      sortOrder: input.sortOrder,
      isActive: input.isActive,
    };
    const row = input.id ? await db.category.update({ where: { id: input.id }, data }) : await db.category.create({ data });
    await audit(user.id, input.id ? "category.update" : "category.create", "category", row.id, { slug: row.slug });
    revalidateStudio("/admin/catalog");
    return succeed("Category saved.");
  });
}

export async function deleteCategoryAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await authorize("products.write", fd);
    const id = String(fd.get("categoryId") ?? "");
    const row = await db.category.findUnique({ where: { id }, select: { slug: true, _count: { select: { products: true, children: true } } } });
    if (!row) return fail("That category no longer exists.");
    await db.category.delete({ where: { id } });
    await audit(user.id, "category.delete", "category", id, { slug: row.slug, products: row._count.products });
    revalidateStudio("/admin/catalog", "/admin/products");
    return succeed(
      row._count.products > 0
        ? `Category deleted. ${row._count.products} product${row._count.products === 1 ? "" : "s"} now have no category.`
        : "Category deleted.",
    );
  });
}

/* ───────────────────────────── collections ───────────────────────────── */

export async function saveCollectionAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await authorize("products.write", fd);
    const name = readI18n(fd, "name");
    const input = collectionSchema.parse({
      id: String(fd.get("id") ?? "") || undefined,
      slug: slugify(String(fd.get("slug") ?? "").trim() || name.en),
      name,
      description: readI18n(fd, "description"),
      image: String(fd.get("image") ?? "").trim(),
      isPublished: readBool(fd, "isPublished"),
      sortOrder: readInt(fd, "sortOrder", 0),
    });
    if (!input.name.en.trim()) return fail("An English name is required.", { name_en: "Required." });

    const clash = await db.collection.findUnique({ where: { slug: input.slug }, select: { id: true } });
    if (clash && clash.id !== input.id) return fail("Another collection already uses that slug.", { slug: "Already taken." });

    const data = {
      slug: input.slug,
      name: i18n(input.name),
      description: input.description ? i18nOrNull(input.description) : null,
      image: input.image || null,
      isPublished: input.isPublished,
      sortOrder: input.sortOrder,
    };
    const row = input.id ? await db.collection.update({ where: { id: input.id }, data }) : await db.collection.create({ data });
    await audit(user.id, input.id ? "collection.update" : "collection.create", "collection", row.id, { slug: row.slug });
    revalidateStudio("/admin/catalog");
    return succeed("Collection saved.");
  });
}

export async function deleteCollectionAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await authorize("products.write", fd);
    const id = String(fd.get("collectionId") ?? "");
    const row = await db.collection.findUnique({ where: { id }, select: { slug: true } });
    if (!row) return fail("That collection no longer exists.");
    await db.collection.delete({ where: { id } });
    await audit(user.id, "collection.delete", "collection", id, { slug: row.slug });
    revalidateStudio("/admin/catalog");
    return succeed("Collection deleted.");
  });
}

/** Shared reorder for categories and collections (up/down buttons). */
export async function reorderCatalogAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await authorize("products.write", fd);
    const kind = String(fd.get("kind") ?? "");
    const id = String(fd.get("id") ?? "");
    const direction = String(fd.get("direction") ?? "up") === "down" ? 1 : -1;

    if (kind === "category") {
      const rows = await db.category.findMany({ orderBy: { sortOrder: "asc" }, select: { id: true } });
      const idx = rows.findIndex((r) => r.id === id);
      const swap = idx + direction;
      if (idx < 0 || swap < 0 || swap >= rows.length) return succeed("Already at the end.");
      [rows[idx], rows[swap]] = [rows[swap], rows[idx]];
      for (let i = 0; i < rows.length; i++) await db.category.update({ where: { id: rows[i].id }, data: { sortOrder: i } });
    } else {
      const rows = await db.collection.findMany({ orderBy: { sortOrder: "asc" }, select: { id: true } });
      const idx = rows.findIndex((r) => r.id === id);
      const swap = idx + direction;
      if (idx < 0 || swap < 0 || swap >= rows.length) return succeed("Already at the end.");
      [rows[idx], rows[swap]] = [rows[swap], rows[idx]];
      for (let i = 0; i < rows.length; i++) await db.collection.update({ where: { id: rows[i].id }, data: { sortOrder: i } });
    }

    await audit(user.id, "catalog.reorder", kind, id);
    revalidateStudio("/admin/catalog");
    return succeed("Order updated.");
  });
}
