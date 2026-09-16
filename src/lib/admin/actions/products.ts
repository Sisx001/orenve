"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { toJson, parseJson } from "@/lib/json";
import { slugify } from "@/lib/utils";
import { after } from "next/server";
import { autoTranslateRecord } from "@/lib/i18n/translate";
import { authorize, fail, revalidateStudio, runAction, succeed, type ActionState } from "@/lib/admin/guard";
import {
  productSchema,
  readBool,
  readI18n,
  readInt,
  readJson,
  readList,
  readMoney,
  sizeGuideSchema,
  type ProductInput,
} from "@/lib/admin/schemas";

type ImagePayload = { id?: string; url: string; alt?: { en: string; bn: string }; colorName?: string | null };
type OptionPayload = { name: string; values: { value: string; hex?: string }[] };
type VariantPayload = {
  id?: string;
  sku?: string;
  title: string;
  options: Record<string, string>;
  price: number | null;
  stock: number;
  lowStockAt: number;
  isActive: boolean;
  imageUrl?: string | null;
};

/** Stable identity for a variant across saves: its option values. */
function optionsKey(options: Record<string, string>) {
  return Object.keys(options)
    .sort()
    .map((k) => `${k}=${options[k]}`)
    .join("|");
}

function i18nOrNull(pair: { en: string; bn: string }) {
  if (!pair.en.trim() && !pair.bn.trim()) return null;
  return toJson({ en: pair.en, bn: pair.bn || pair.en });
}

export async function saveProductAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  let createdId: string | null = null;

  const result = await runAction(async () => {
    const user = await authorize("products.write", fd);

    const nameI18n = readI18n(fd, "name");
    const slugRaw = String(fd.get("slug") ?? "").trim();
    const slug = slugify(slugRaw || nameI18n.en);

    const rawSizeGuide = readJson<unknown>(fd, "sizeGuide", null);
    const sizeGuideParsed = rawSizeGuide ? sizeGuideSchema.safeParse(rawSizeGuide) : null;

    const input: ProductInput = productSchema.parse({
      id: String(fd.get("id") ?? "") || undefined,
      name: nameI18n,
      slug,
      sku: String(fd.get("sku") ?? "").trim() || undefined,
      status: String(fd.get("status") ?? "draft"),
      categoryId: String(fd.get("categoryId") ?? "") || undefined,
      collectionIds: fd.getAll("collectionIds").map(String).filter(Boolean),
      featured: readBool(fd, "featured"),
      badge: readI18n(fd, "badge"),
      tags: readList(fd, "tags"),
      price: readMoney(fd, "price") ?? 0,
      compareAtPrice: readMoney(fd, "compareAtPrice"),
      costPrice: readMoney(fd, "costPrice"),
      description: readI18n(fd, "description"),
      details: {
        material: readI18n(fd, "details_material"),
        fit: readI18n(fd, "details_fit"),
        care: readI18n(fd, "details_care"),
        shipping: readI18n(fd, "details_shipping"),
        returns: readI18n(fd, "details_returns"),
      },
      video: String(fd.get("video") ?? "").trim() || undefined,
      sizeGuide: sizeGuideParsed?.success ? sizeGuideParsed.data : null,
      seoTitle: readI18n(fd, "seoTitle"),
      seoDescription: readI18n(fd, "seoDescription"),
      images: [],
      options: [],
      variants: [],
    });

    if (!input.name.en.trim()) return fail("An English product name is required.", { name_en: "Required." });
    if (!input.slug) return fail("A URL slug is required.", { slug: "Required." });

    const images = readJson<ImagePayload[]>(fd, "images", []).filter((i) => i.url);
    const options = readJson<OptionPayload[]>(fd, "options", []).filter((o) => o.name.trim());
    const variants = readJson<VariantPayload[]>(fd, "variants", []).filter((v) => v.title.trim());

    // slug uniqueness
    const slugOwner = await db.product.findUnique({ where: { slug: input.slug }, select: { id: true } });
    if (slugOwner && slugOwner.id !== input.id) return fail("Another product already uses that slug.", { slug: "Already taken." });

    const detailsJson =
      input.details &&
      Object.entries(input.details).some(([, v]) => v && (v.en.trim() || v.bn.trim()))
        ? toJson(
            Object.fromEntries(
              Object.entries(input.details)
                .filter(([, v]) => v && (v.en.trim() || v.bn.trim()))
                .map(([k, v]) => [k, { en: v!.en, bn: v!.bn || v!.en }]),
            ),
          )
        : null;

    const base = {
      slug: input.slug,
      sku: input.sku || null,
      name: toJson({ en: input.name.en, bn: input.name.bn || input.name.en }),
      description: input.description ? i18nOrNull(input.description) : null,
      details: detailsJson,
      status: input.status,
      categoryId: input.categoryId,
      price: input.price,
      compareAtPrice: input.compareAtPrice ?? null,
      costPrice: input.costPrice ?? null,
      featured: input.featured,
      badge: input.badge ? i18nOrNull(input.badge) : null,
      tags: input.tags.length ? toJson(input.tags) : null,
      video: input.video || null,
      sizeGuide: input.sizeGuide ? toJson(input.sizeGuide) : null,
      seoTitle: input.seoTitle ? i18nOrNull(input.seoTitle) : null,
      seoDescription: input.seoDescription ? i18nOrNull(input.seoDescription) : null,
    };

    const product = input.id
      ? await db.product.update({
          where: { id: input.id },
          data: {
            ...base,
            publishedAt: input.status === "published" ? undefined : null,
          },
        })
      : await db.product.create({ data: { ...base, publishedAt: input.status === "published" ? new Date() : null } });

    if (input.id && input.status === "published") {
      const existing = await db.product.findUnique({ where: { id: product.id }, select: { publishedAt: true } });
      if (!existing?.publishedAt) await db.product.update({ where: { id: product.id }, data: { publishedAt: new Date() } });
    }
    createdId = product.id;

    /* ── images ── */
    const existingImages = await db.productImage.findMany({ where: { productId: product.id } });
    const keptIds = new Set(images.map((i) => i.id).filter(Boolean) as string[]);
    for (const old of existingImages) {
      if (!keptIds.has(old.id)) await db.productImage.delete({ where: { id: old.id } }).catch(() => {});
    }
    const urlToImageId = new Map<string, string>();
    for (let i = 0; i < images.length; i++) {
      const img = images[i];
      const data = {
        url: img.url,
        alt: img.alt && (img.alt.en || img.alt.bn) ? toJson({ en: img.alt.en, bn: img.alt.bn || img.alt.en }) : null,
        colorName: img.colorName || null,
        position: i,
      };
      if (img.id && existingImages.some((e) => e.id === img.id)) {
        const row = await db.productImage.update({ where: { id: img.id }, data });
        urlToImageId.set(row.url, row.id);
      } else {
        const row = await db.productImage.create({ data: { ...data, productId: product.id } });
        urlToImageId.set(row.url, row.id);
      }
    }

    /* ── options ── */
    await db.productOption.deleteMany({ where: { productId: product.id } });
    for (let i = 0; i < options.length; i++) {
      const o = options[i];
      await db.productOption.create({
        data: {
          productId: product.id,
          name: o.name.trim(),
          values: toJson(o.values.filter((v) => v.value.trim()).map((v) => (v.hex ? { value: v.value.trim(), hex: v.hex } : { value: v.value.trim() }))),
          position: i,
        },
      });
    }

    /* ── variants (keep ids so order history stays linked) ── */
    const existingVariants = await db.productVariant.findMany({ where: { productId: product.id } });
    const byKey = new Map(existingVariants.map((v) => [optionsKey(parseJson<Record<string, string>>(v.options, {})), v]));
    const byId = new Map(existingVariants.map((v) => [v.id, v]));
    const matched = new Set<string>();

    for (let i = 0; i < variants.length; i++) {
      const v = variants[i];
      const existing = (v.id && byId.get(v.id)) || byKey.get(optionsKey(v.options));
      const imageId = v.imageUrl ? (urlToImageId.get(v.imageUrl) ?? null) : null;
      const data = {
        sku: v.sku?.trim() || null,
        title: v.title.trim(),
        options: toJson(v.options),
        price: v.price ?? null,
        stock: Math.max(0, Math.round(v.stock)),
        lowStockAt: Math.max(0, Math.round(v.lowStockAt)),
        imageId,
        isActive: v.isActive,
        position: i,
      };
      if (existing) {
        matched.add(existing.id);
        await db.productVariant.update({ where: { id: existing.id }, data });
      } else {
        const created = await db.productVariant.create({ data: { ...data, productId: product.id } });
        matched.add(created.id);
      }
    }
    for (const old of existingVariants) {
      if (!matched.has(old.id)) await db.productVariant.delete({ where: { id: old.id } }).catch(() => {});
    }

    /* ── collections ── */
    await db.productCollection.deleteMany({ where: { productId: product.id } });
    for (let i = 0; i < input.collectionIds.length; i++) {
      await db.productCollection
        .create({ data: { productId: product.id, collectionId: input.collectionIds[i], position: i } })
        .catch(() => {});
    }

    await audit(user.id, input.id ? "product.update" : "product.create", "product", product.id, {
      slug: product.slug,
      status: product.status,
      variants: variants.length,
    });
    // Optional: translate the saved product into every enabled machine language once the response is sent.
    after(() => autoTranslateRecord("product", product.id));
    revalidateStudio("/admin/products", `/admin/products/${product.id}`, "/admin/inventory");

    if (!input.id) return succeed("Product created.", { id: product.id, created: "1" });
    return succeed("Product saved.", { id: product.id });
  });

  if (result.ok && result.data?.created === "1" && createdId) redirect(`/admin/products/${createdId}?created=1`);
  return result;
}

export async function duplicateProductAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  let newId: string | null = null;
  const result = await runAction(async () => {
    const user = await authorize("products.write", fd);
    const id = String(fd.get("productId") ?? "");
    const source = await db.product.findUnique({
      where: { id },
      include: { images: { orderBy: { position: "asc" } }, options: { orderBy: { position: "asc" } }, variants: { orderBy: { position: "asc" } }, collections: true },
    });
    if (!source) return fail("That product no longer exists.");

    let slug = `${source.slug}-copy`;
    for (let i = 2; await db.product.findUnique({ where: { slug }, select: { id: true } }); i++) slug = `${source.slug}-copy-${i}`;

    const name = parseJson<Record<string, string>>(source.name, {});
    const copy = await db.product.create({
      data: {
        slug,
        sku: null,
        name: toJson({ ...name, en: `${name.en ?? source.slug} (copy)` }),
        description: source.description,
        details: source.details,
        status: "draft",
        categoryId: source.categoryId,
        price: source.price,
        compareAtPrice: source.compareAtPrice,
        costPrice: source.costPrice,
        featured: false,
        badge: source.badge,
        tags: source.tags,
        video: source.video,
        sizeGuide: source.sizeGuide,
        seoTitle: source.seoTitle,
        seoDescription: source.seoDescription,
        publishedAt: null,
      },
    });
    newId = copy.id;

    const imageMap = new Map<string, string>();
    for (const img of source.images) {
      const created = await db.productImage.create({
        data: { productId: copy.id, url: img.url, alt: img.alt, colorName: img.colorName, position: img.position, width: img.width, height: img.height },
      });
      imageMap.set(img.id, created.id);
    }
    for (const o of source.options) {
      await db.productOption.create({ data: { productId: copy.id, name: o.name, values: o.values, position: o.position } });
    }
    for (const v of source.variants) {
      await db.productVariant.create({
        data: {
          productId: copy.id,
          sku: null,
          title: v.title,
          options: v.options,
          price: v.price,
          stock: v.stock,
          lowStockAt: v.lowStockAt,
          weightGrams: v.weightGrams,
          imageId: v.imageId ? (imageMap.get(v.imageId) ?? null) : null,
          isActive: v.isActive,
          position: v.position,
        },
      });
    }
    for (const c of source.collections) {
      await db.productCollection.create({ data: { productId: copy.id, collectionId: c.collectionId, position: c.position } }).catch(() => {});
    }

    await audit(user.id, "product.duplicate", "product", copy.id, { from: source.id, slug: copy.slug });
    revalidateStudio("/admin/products");
    return succeed("Duplicated as a draft.", { id: copy.id });
  });
  if (result.ok && newId) redirect(`/admin/products/${newId}`);
  return result;
}

export async function setProductStatusAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await authorize("products.write", fd);
    const id = String(fd.get("productId") ?? "");
    const status = String(fd.get("status") ?? "");
    if (!["draft", "published", "archived"].includes(status)) return fail("Pick a valid status.");
    await db.product.update({
      where: { id },
      data: { status, publishedAt: status === "published" ? new Date() : undefined },
    });
    await audit(user.id, "product.status", "product", id, { status });
    revalidateStudio("/admin/products", `/admin/products/${id}`);
    return succeed(`Product ${status}.`);
  });
}

export async function deleteProductAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const result = await runAction(async () => {
    const user = await authorize("products.write", fd);
    const id = String(fd.get("productId") ?? "");
    const row = await db.product.findUnique({ where: { id }, select: { slug: true, _count: { select: { orderItems: true } } } });
    if (!row) return fail("That product no longer exists.");
    if (row._count.orderItems > 0) {
      await db.product.update({ where: { id }, data: { status: "archived", featured: false } });
      await audit(user.id, "product.archive", "product", id, { slug: row.slug, reason: "has_orders" });
      revalidateStudio("/admin/products");
      return succeed("This product appears in past orders, so it was archived instead of deleted.");
    }
    await db.product.delete({ where: { id } });
    await audit(user.id, "product.delete", "product", id, { slug: row.slug });
    revalidateStudio("/admin/products", "/admin/inventory");
    return succeed("Product deleted.", { deleted: "1" });
  });
  if (result.ok && result.data?.deleted === "1") redirect("/admin/products");
  return result;
}

/** Bulk-set stock across a product's variants from the editor. */
export async function bulkStockAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await authorize("products.write", fd);
    const id = String(fd.get("productId") ?? "");
    const stock = readInt(fd, "stock", 0);
    if (!id) return fail("Missing product.");
    const res = await db.productVariant.updateMany({ where: { productId: id }, data: { stock: Math.max(0, stock) } });
    await audit(user.id, "product.bulk_stock", "product", id, { stock, variants: res.count });
    revalidateStudio(`/admin/products/${id}`, "/admin/inventory");
    return succeed(`Set stock to ${stock} on ${res.count} variant${res.count === 1 ? "" : "s"}.`);
  });
}
