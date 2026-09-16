import "server-only";
import { getEnabledLocales } from "./registry";
import { getAiConnection } from "@/lib/ai/concierge";
import { createHash } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { parseJson, toJson } from "@/lib/json";
import { getSetting, saveSetting, type SettingKey } from "@/lib/settings";
import { chatCompletion, type AiConnection } from "@/lib/ai/client";
import type { LocaleInfo } from "./registry";
import en from "../../../messages/en.json";
import bn from "../../../messages/bn.json";

/**
 * The AI translation engine.
 *
 * English is always the source of truth. Everything produced here is written
 * with `machine: true, approved: false` so the studio review queue can promote
 * it, and an approved human translation is never overwritten by a machine one.
 *
 * Every entry point does **one bounded step** (a dictionary chunk, a single
 * content record) so the studio can loop with a progress bar and each HTTP
 * request stays short enough for serverless hosts.
 */

/* ───────────────────────────── dictionary flattening ───────────────────────────── */

function flatten(obj: unknown, prefix = "", out: Record<string, string> = {}): Record<string, string> {
  if (!obj || typeof obj !== "object") return out;
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v)) flatten(v, key, out);
    else if (typeof v === "string") out[key] = v;
  }
  return out;
}

const FLAT_EN = flatten(en);
const FLAT_BN = flatten(bn);
/** Stable order so a cursor means the same thing across requests. */
const UI_KEYS = Object.keys(FLAT_EN)
  .filter((k) => FLAT_EN[k].trim() !== "")
  .sort();

/** The interface dictionary as dotted keys → English source text. */
export function uiSourceStrings(): Record<string, string> {
  return { ...FLAT_EN };
}

/* ───────────────────────────── the model call ───────────────────────────── */

export type TranslateItem = { id: string; text: string };

export class TranslationError extends Error {
  code: string;
  constructor(message: string, code = "i18n.translateFailed") {
    super(message);
    this.name = "TranslationError";
    this.code = code;
  }
}

const KIND_NOTE: Record<"ui" | "content", string> = {
  ui: "These are user-interface strings for an e-commerce storefront: buttons, labels, headings, validation messages. Keep them as short as the English, and use the wording a native speaker would expect in a shop interface.",
  content:
    "These are brand and catalogue texts: product names and descriptions, editorial copy, policy pages. Translate for meaning and rhythm, not word for word. Product names that read as proper nouns stay in English.",
};

function buildSystemPrompt(target: LocaleInfo, glossary: string[], kind: "ui" | "content", brandVoice: string): string {
  return [
    `You are a professional localisation specialist translating from English into ${target.name} (${target.nativeName}, code "${target.code}", script direction ${target.dir}) for ORYNVE, an independent premium menswear label.`,
    KIND_NOTE[kind],
    brandVoice ? `Brand voice to match: ${brandVoice}` : "",
    "Hard rules:",
    `• Keep every placeholder token exactly as written, including the braces: {amount}, {name}, {items}, {count}, {year}, {brand}. Never translate, reorder the characters inside, or drop them.`,
    glossary.length ? `• Leave these terms untranslated, spelled exactly as given: ${glossary.join(", ")}.` : "",
    "• Preserve markdown (**bold**, links), HTML tags, line breaks (\\n) and leading/trailing spaces.",
    "• Do not add explanations, quotes, notes or transliterations. Do not translate URLs, file paths, email addresses or currency codes.",
    "• If a string is a brand name or already correct in the target language, return it unchanged.",
    `• Write natural, modern ${target.name} — never a word-for-word transliteration of English.`,
    "",
    'Output format: a STRICT JSON array and nothing else — [{"id":"<the id you were given>","text":"<translation>"}]. One object per input item, same ids, same order. No code fences, no prose.',
  ]
    .filter(Boolean)
    .join("\n");
}

function stripFences(raw: string): string {
  let s = raw.trim();
  if (s.startsWith("```")) s = s.replace(/^```[a-zA-Z]*\s*/, "").replace(/```\s*$/, "");
  const first = s.indexOf("[");
  const last = s.lastIndexOf("]");
  if (first >= 0 && last > first) s = s.slice(first, last + 1);
  return s.trim();
}

function parseItems(raw: string): TranslateItem[] | null {
  const parsed = parseJson<unknown>(stripFences(raw), null);
  if (!Array.isArray(parsed)) return null;
  const out: TranslateItem[] = [];
  for (const row of parsed) {
    if (!row || typeof row !== "object") continue;
    const r = row as { id?: unknown; text?: unknown };
    if (typeof r.id !== "string" || typeof r.text !== "string") continue;
    out.push({ id: r.id, text: r.text });
  }
  return out.length ? out : null;
}

async function translateChunk(
  chunk: TranslateItem[],
  system: string,
  conn: AiConnection,
): Promise<TranslateItem[]> {
  const payload = JSON.stringify(chunk.map((i) => ({ id: i.id, text: i.text })));
  const budget = Math.min(4096, Math.max(400, Math.round(payload.length / 2) + 300));

  const first = await chatCompletion(
    conn,
    [
      { role: "system", content: system },
      { role: "user", content: payload },
    ],
    { temperature: 0.2, maxTokens: budget },
  );
  const firstRaw = first.message.content ?? "";
  const ok = parseItems(firstRaw);
  if (ok) return ok;

  // One repair attempt: hand the model its own output back and ask for clean JSON.
  const repair = await chatCompletion(
    conn,
    [
      { role: "system", content: system },
      { role: "user", content: payload },
      { role: "assistant", content: firstRaw.slice(0, 4000) },
      {
        role: "user",
        content:
          'That was not valid JSON. Reply again with ONLY a JSON array of objects shaped {"id":"…","text":"…"} — one per input item, same ids. No code fences, no commentary.',
      },
    ],
    { temperature: 0, maxTokens: budget },
  );
  const repaired = parseItems(repair.message.content ?? "");
  if (repaired) return repaired;

  throw new TranslationError(
    `The AI model did not return usable JSON for ${chunk.length} string(s). Check the model and try a smaller batch size.`,
    "i18n.badResponse",
  );
}

/**
 * Translate a list of `{id, text}` pairs. Chunked by `i18n.batchSize` (or the
 * explicit `batchSize`) so a long list becomes several short model calls.
 */
export async function translateStrings(opts: {
  items: TranslateItem[];
  targetLocale: LocaleInfo;
  sourceLocale?: "en";
  glossary?: string[];
  kind: "ui" | "content";
  conn: AiConnection;
  batchSize?: number;
  brandVoice?: string;
}): Promise<TranslateItem[]> {
  const items = opts.items.filter((i) => i.text.trim() !== "");
  if (!items.length) return [];

  const settings = await getSetting("i18n");
  const ai = await getSetting("ai");
  const glossary = (opts.glossary ?? settings.glossary).filter(Boolean);
  const size = Math.max(1, opts.batchSize ?? settings.batchSize);
  const system = buildSystemPrompt(opts.targetLocale, glossary, opts.kind, opts.brandVoice ?? ai.brandVoice);

  const out = new Map<string, string>();
  for (let i = 0; i < items.length; i += size) {
    const chunk = items.slice(i, i + size);
    const translated = await translateChunk(chunk, system, opts.conn);
    const byId = new Map(translated.map((t) => [t.id, t.text]));
    for (const item of chunk) {
      const text = byId.get(item.id);
      if (typeof text === "string" && text.trim() !== "") out.set(item.id, text);
    }
  }
  return [...out.entries()].map(([id, text]) => ({ id, text }));
}

/** Single-string helper for other studio UIs (product editor, page editor…). */
export async function translateOne(opts: {
  text: string;
  targetLocale: LocaleInfo;
  kind: "ui" | "content";
  conn: AiConnection;
}): Promise<string> {
  const [result] = await translateStrings({
    items: [{ id: "1", text: opts.text }],
    targetLocale: opts.targetLocale,
    kind: opts.kind,
    conn: opts.conn,
    batchSize: 1,
  });
  if (!result) throw new TranslationError("The AI model returned nothing to translate.", "i18n.badResponse");
  return result.text;
}

/* ───────────────────────────── dictionary step ───────────────────────────── */

export type DictionaryStep = {
  done: boolean;
  nextCursor: string | null;
  translated: number;
  total: number;
  /** keys examined so far, for the progress bar */
  processed: number;
};

/**
 * Translate the next `batchSize` interface keys for a language. Keys that
 * already carry a human-approved row are skipped; machine rows are refreshed.
 */
export async function translateDictionaryChunk(opts: {
  locale: string;
  cursor?: string | null;
  conn: AiConnection;
  targetLocale: LocaleInfo;
}): Promise<DictionaryStep> {
  const { locale, targetLocale, conn } = opts;
  const settings = await getSetting("i18n");
  const batchSize = Math.max(1, settings.batchSize);

  const rows = await db.translation.findMany({ where: { locale, namespace: "common" } });
  const existing = new Map(rows.map((r) => [r.key, r]));

  const total = UI_KEYS.length;
  const start = opts.cursor ? Math.max(0, UI_KEYS.indexOf(opts.cursor) + 1) : 0;

  const slice: string[] = [];
  let i = start;
  for (; i < total && slice.length < batchSize; i++) {
    const key = UI_KEYS[i];
    const row = existing.get(key);
    if (row && row.approved && !row.machine) continue; // human work is never touched
    slice.push(key);
  }
  const processed = i;
  const nextCursor = i < total ? UI_KEYS[i - 1] : null;

  if (!slice.length) return { done: i >= total, nextCursor, translated: 0, total, processed };

  const translated = await translateStrings({
    items: slice.map((key) => ({ id: key, text: FLAT_EN[key] })),
    targetLocale,
    kind: "ui",
    conn,
    batchSize,
  });

  let saved = 0;
  for (const item of translated) {
    if (!FLAT_EN[item.id]) continue;
    const row = existing.get(item.id);
    if (row && row.approved && !row.machine) continue;
    await db.translation.upsert({
      where: { locale_namespace_key: { locale, namespace: "common", key: item.id } },
      update: { value: item.text, machine: true, approved: false },
      create: { locale, namespace: "common", key: item.id, value: item.text, machine: true, approved: false },
    });
    saved++;
  }

  return { done: i >= total, nextCursor, translated: saved, total, processed };
}

/* ───────────────────────────── content models ───────────────────────────── */

export const CONTENT_MODELS = ["product", "category", "collection", "page", "block", "setting"] as const;
export type ContentModel = (typeof CONTENT_MODELS)[number];

export function isContentModel(v: string): v is ContentModel {
  return (CONTENT_MODELS as readonly string[]).includes(v);
}

export const CONTENT_MODEL_LABELS: Record<ContentModel, string> = {
  product: "Products",
  category: "Categories",
  collection: "Collections",
  page: "Pages",
  block: "Homepage blocks",
  setting: "Brand & SEO settings",
};

/** Columns holding i18n JSON, per model. */
const MODEL_COLUMNS: Record<Exclude<ContentModel, "setting">, string[]> = {
  product: ["name", "description", "details", "badge", "seoTitle", "seoDescription"],
  category: ["name", "description"],
  collection: ["name", "description"],
  page: ["title", "body", "seoTitle", "seoDescription"],
  block: ["data"],
};

/** Setting groups with locale→string records inside their JSON value. */
const SETTING_FIELDS: Record<string, string[]> = {
  brand: ["tagline", "announcement"],
  contact: ["address", "hours"],
  checkout: ["mfsInstructions", "whatsappTemplate"],
  seo: ["title", "description"],
  site: ["maintenanceTitle", "maintenanceMessage"],
  ai: ["assistantName", "greeting"],
};
const SETTING_KEYS = Object.keys(SETTING_FIELDS);

/** `{"en":"…","bn":"…"}` — all values strings, locale-shaped keys, English present. */
function isI18nRecord(v: unknown): v is Record<string, string> {
  if (!v || typeof v !== "object" || Array.isArray(v)) return false;
  const entries = Object.entries(v as Record<string, unknown>);
  if (!entries.length) return false;
  if (!entries.every(([k, val]) => typeof val === "string" && /^[a-z]{2,3}$/.test(k))) return false;
  return typeof (v as Record<string, unknown>).en === "string";
}

type I18nNode = { path: string; obj: Record<string, string> };

/** Walk a parsed JSON tree and collect every i18n record, keyed by its path. */
function collectNodes(node: unknown, path: string, out: I18nNode[] = []): I18nNode[] {
  if (isI18nRecord(node)) {
    out.push({ path, obj: node });
    return out;
  }
  if (Array.isArray(node)) {
    node.forEach((v, i) => collectNodes(v, `${path}[${i}]`, out));
    return out;
  }
  if (node && typeof node === "object") {
    for (const [k, v] of Object.entries(node as Record<string, unknown>)) collectNodes(v, path ? `${path}.${k}` : k, out);
  }
  return out;
}

/** Parse a JSON-in-String column into a mutable tree (legacy plain strings become {en}). */
function parseColumn(raw: string | null | undefined): unknown {
  if (raw === null || raw === undefined || raw.trim() === "") return null;
  const t = raw.trim();
  if (t.startsWith("{") || t.startsWith("[")) return parseJson<unknown>(raw, null);
  return { en: raw };
}

const hashOf = (s: string) => createHash("sha256").update(s).digest("hex").slice(0, 32);

type LoadedRecord = { id: string; label: string; columns: Record<string, string | null> };

async function fetchNextRecord(model: Exclude<ContentModel, "setting">, cursor?: string | null): Promise<LoadedRecord | null> {
  const where = cursor ? { id: { gt: cursor } } : {};
  const orderBy = { id: "asc" } as const;
  switch (model) {
    case "product": {
      const r = await db.product.findFirst({ where, orderBy });
      return r
        ? {
            id: r.id,
            label: r.slug,
            columns: { name: r.name, description: r.description, details: r.details, badge: r.badge, seoTitle: r.seoTitle, seoDescription: r.seoDescription },
          }
        : null;
    }
    case "category": {
      const r = await db.category.findFirst({ where, orderBy });
      return r ? { id: r.id, label: r.slug, columns: { name: r.name, description: r.description } } : null;
    }
    case "collection": {
      const r = await db.collection.findFirst({ where, orderBy });
      return r ? { id: r.id, label: r.slug, columns: { name: r.name, description: r.description } } : null;
    }
    case "page": {
      const r = await db.page.findFirst({ where, orderBy });
      return r ? { id: r.id, label: r.slug, columns: { title: r.title, body: r.body, seoTitle: r.seoTitle, seoDescription: r.seoDescription } } : null;
    }
    case "block": {
      const r = await db.block.findFirst({ where, orderBy });
      return r ? { id: r.id, label: `${r.page} / ${r.type}`, columns: { data: r.data } } : null;
    }
  }
}

async function saveColumns(model: Exclude<ContentModel, "setting">, id: string, data: Record<string, string>): Promise<void> {
  switch (model) {
    case "product":
      await db.product.update({ where: { id }, data: data as Prisma.ProductUpdateInput });
      return;
    case "category":
      await db.category.update({ where: { id }, data: data as Prisma.CategoryUpdateInput });
      return;
    case "collection":
      await db.collection.update({ where: { id }, data: data as Prisma.CollectionUpdateInput });
      return;
    case "page":
      await db.page.update({ where: { id }, data: data as Prisma.PageUpdateInput });
      return;
    case "block":
      await db.block.update({ where: { id }, data: data as Prisma.BlockUpdateInput });
      return;
  }
}

async function countRecords(model: Exclude<ContentModel, "setting">): Promise<number> {
  switch (model) {
    case "product":
      return db.product.count();
    case "category":
      return db.category.count();
    case "collection":
      return db.collection.count();
    case "page":
      return db.page.count();
    case "block":
      return db.block.count();
  }
}

async function listRecords(model: Exclude<ContentModel, "setting">): Promise<LoadedRecord[]> {
  const out: LoadedRecord[] = [];
  let cursor: string | null = null;
  // Small catalogues; read straight through so coverage stays a single pass.
  for (;;) {
    const rec: LoadedRecord | null = await fetchNextRecord(model, cursor);
    if (!rec) break;
    out.push(rec);
    cursor = rec.id;
    if (out.length > 2000) break;
  }
  return out;
}

/* ───────────────────────────── content step ───────────────────────────── */

export type ContentStep = {
  done: boolean;
  nextCursor: string | null;
  recordLabel: string | null;
  fieldsTranslated: number;
  total: number;
  processed: number;
};

type Pending = { field: string; source: string; obj: Record<string, string> };

/** Which nodes of a record still need this locale (missing, or the English source moved on). */
function pendingNodes(nodes: I18nNode[], locale: string, rows: Map<string, { sourceHash: string | null; approved: boolean }>): Pending[] {
  const out: Pending[] = [];
  for (const node of nodes) {
    const source = node.obj.en ?? "";
    if (source.trim() === "") continue;
    const current = node.obj[locale];
    const row = rows.get(node.path);
    const stale = row?.sourceHash ? row.sourceHash !== hashOf(source) : false;
    if (current && current.trim() !== "" && !stale) continue;
    // A human-approved translation whose English source is unchanged is never redone.
    if (current && row?.approved && !stale) continue;
    out.push({ field: node.path, source, obj: node.obj });
  }
  return out;
}

async function translationRowsFor(model: ContentModel, recordId: string, locale: string) {
  const rows = await db.contentTranslation.findMany({ where: { model, recordId, locale } });
  return new Map(rows.map((r) => [r.field, { sourceHash: r.sourceHash, approved: r.approved }]));
}

async function markTranslated(model: ContentModel, recordId: string, field: string, locale: string, source: string) {
  const sourceHash = hashOf(source);
  await db.contentTranslation.upsert({
    where: { model_recordId_field_locale: { model, recordId, field, locale } },
    update: { machine: true, approved: false, sourceHash },
    create: { model, recordId, field, locale, machine: true, approved: false, sourceHash },
  });
}

/** Translate one content record (or one settings group) into `locale`. */
export async function translateContentStep(opts: {
  locale: string;
  model: ContentModel;
  cursor?: string | null;
  conn: AiConnection;
  targetLocale: LocaleInfo;
}): Promise<ContentStep> {
  const { locale, model, targetLocale, conn } = opts;
  if (model === "setting") return translateSettingStep({ locale, cursor: opts.cursor, conn, targetLocale });

  const total = await countRecords(model);
  const rec = await fetchNextRecord(model, opts.cursor);
  if (!rec) return { done: true, nextCursor: null, recordLabel: null, fieldsTranslated: 0, total, processed: total };

  const trees = new Map<string, unknown>();
  const nodes: I18nNode[] = [];
  for (const column of MODEL_COLUMNS[model]) {
    const tree = parseColumn(rec.columns[column]);
    if (tree === null) continue;
    trees.set(column, tree);
    collectNodes(tree, column, nodes);
  }

  const rows = await translationRowsFor(model, rec.id, locale);
  const pending = pendingNodes(nodes, locale, rows);

  let fieldsTranslated = 0;
  if (pending.length) {
    const translated = await translateStrings({
      items: pending.map((p, i) => ({ id: String(i), text: p.source })),
      targetLocale,
      kind: "content",
      conn,
    });
    const byId = new Map(translated.map((t) => [t.id, t.text]));
    const touched = new Set<string>();
    for (const [i, p] of pending.entries()) {
      const text = byId.get(String(i));
      if (!text) continue;
      p.obj[locale] = text; // only this locale's key is written; en/bn are untouched
      touched.add(p.field.split(/[.[]/)[0]);
      await markTranslated(model, rec.id, p.field, locale, p.source);
      fieldsTranslated++;
    }
    if (fieldsTranslated) {
      const data: Record<string, string> = {};
      for (const column of touched) {
        const tree = trees.get(column);
        if (tree !== undefined) data[column] = toJson(tree);
      }
      if (Object.keys(data).length) await saveColumns(model, rec.id, data);
    }
  }

  const after = await countAfter(model, rec.id);
  return {
    done: after === 0,
    nextCursor: after > 0 ? rec.id : null,
    recordLabel: rec.label,
    fieldsTranslated,
    total,
    processed: Math.max(0, total - after),
  };
}

async function fetchRecordById(model: Exclude<ContentModel, "setting">, id: string): Promise<LoadedRecord | null> {
  switch (model) {
    case "product": {
      const r = await db.product.findUnique({ where: { id } });
      return r ? { id: r.id, label: r.slug, columns: { name: r.name, description: r.description, details: r.details, badge: r.badge, seoTitle: r.seoTitle, seoDescription: r.seoDescription } } : null;
    }
    case "category": {
      const r = await db.category.findUnique({ where: { id } });
      return r ? { id: r.id, label: r.slug, columns: { name: r.name, description: r.description } } : null;
    }
    case "collection": {
      const r = await db.collection.findUnique({ where: { id } });
      return r ? { id: r.id, label: r.slug, columns: { name: r.name, description: r.description } } : null;
    }
    case "page": {
      const r = await db.page.findUnique({ where: { id } });
      return r ? { id: r.id, label: r.slug, columns: { title: r.title, body: r.body, seoTitle: r.seoTitle, seoDescription: r.seoDescription } } : null;
    }
    case "block": {
      const r = await db.block.findUnique({ where: { id } });
      return r ? { id: r.id, label: `${r.page} / ${r.type}`, columns: { data: r.data } } : null;
    }
  }
}

/** Translate ONE record into ONE locale (used by the auto-translate-on-save hook). Returns fields written. */
export async function translateRecord(opts: { model: Exclude<ContentModel, "setting">; recordId: string; locale: string; conn: AiConnection; targetLocale: LocaleInfo }): Promise<number> {
  const { model, recordId, locale, conn, targetLocale } = opts;
  const rec = await fetchRecordById(model, recordId);
  if (!rec) return 0;
  const trees = new Map<string, unknown>();
  const nodes: I18nNode[] = [];
  for (const column of MODEL_COLUMNS[model]) {
    const tree = parseColumn(rec.columns[column]);
    if (tree === null) continue;
    trees.set(column, tree);
    collectNodes(tree, column, nodes);
  }
  const pending = pendingNodes(nodes, locale, await translationRowsFor(model, rec.id, locale));
  if (!pending.length) return 0;
  const translated = await translateStrings({ items: pending.map((p, i) => ({ id: String(i), text: p.source })), targetLocale, kind: "content", conn });
  const byId = new Map(translated.map((t) => [t.id, t.text]));
  const touched = new Set<string>();
  let n = 0;
  for (const [i, p] of pending.entries()) {
    const text = byId.get(String(i));
    if (!text) continue;
    p.obj[locale] = text;
    touched.add(p.field.split(/[.[]/)[0]);
    await markTranslated(model, rec.id, p.field, locale, p.source);
    n++;
  }
  if (n) {
    const data: Record<string, string> = {};
    for (const column of touched) {
      const tree = trees.get(column);
      if (tree !== undefined) data[column] = toJson(tree);
    }
    if (Object.keys(data).length) await saveColumns(model, rec.id, data);
  }
  return n;
}

/**
 * Auto-translate a just-saved record into every enabled machine language when
 * `i18n.autoTranslateNewContent` is on. Never throws — a failed translation must
 * not break a save. Intended to run via `after()` so the response isn't delayed.
 */
export async function autoTranslateRecord(model: Exclude<ContentModel, "setting">, recordId: string): Promise<void> {
  try {
    const i18n = await getSetting("i18n");
    if (!i18n.autoTranslateNewContent) return;
    const conn = await getAiConnection();
    if (!conn) return;
    const targets = (await getEnabledLocales()).filter((l) => !l.builtIn && l.isMachine);
    for (const target of targets) {
      await translateRecord({ model, recordId, locale: target.code, conn, targetLocale: target });
    }
  } catch (e) {
    console.warn("[i18n] auto-translate skipped:", (e as Error).message);
  }
}

async function countAfter(model: Exclude<ContentModel, "setting">, id: string): Promise<number> {
  const where = { id: { gt: id } };
  switch (model) {
    case "product":
      return db.product.count({ where });
    case "category":
      return db.category.count({ where });
    case "collection":
      return db.collection.count({ where });
    case "page":
      return db.page.count({ where });
    case "block":
      return db.block.count({ where });
  }
}

async function translateSettingStep(opts: { locale: string; cursor?: string | null; conn: AiConnection; targetLocale: LocaleInfo }): Promise<ContentStep> {
  const { locale, targetLocale, conn } = opts;
  const total = SETTING_KEYS.length;
  const start = opts.cursor ? Math.max(0, SETTING_KEYS.indexOf(opts.cursor) + 1) : 0;
  if (start >= total) return { done: true, nextCursor: null, recordLabel: null, fieldsTranslated: 0, total, processed: total };

  const key = SETTING_KEYS[start];
  const value = (await getSetting(key as SettingKey)) as unknown as Record<string, unknown>;
  const nodes: I18nNode[] = [];
  for (const field of SETTING_FIELDS[key]) collectNodes(value[field], field, nodes);

  const rows = await translationRowsFor("setting", key, locale);
  const pending = pendingNodes(nodes, locale, rows);

  let fieldsTranslated = 0;
  if (pending.length) {
    const translated = await translateStrings({
      items: pending.map((p, i) => ({ id: String(i), text: p.source })),
      targetLocale,
      kind: "content",
      conn,
    });
    const byId = new Map(translated.map((t) => [t.id, t.text]));
    for (const [i, p] of pending.entries()) {
      const text = byId.get(String(i));
      if (!text) continue;
      p.obj[locale] = text;
      await markTranslated("setting", key, p.field, locale, p.source);
      fieldsTranslated++;
    }
    if (fieldsTranslated) await saveSetting(key as SettingKey, value);
  }

  const processed = start + 1;
  return {
    done: processed >= total,
    nextCursor: processed < total ? key : null,
    recordLabel: key,
    fieldsTranslated,
    total,
    processed,
  };
}

/* ───────────────────────────── coverage ───────────────────────────── */

export type Coverage = {
  uiTotal: number;
  uiTranslated: number;
  uiApproved: number;
  contentTotal: number;
  contentTranslated: number;
  contentApproved: number;
};

type ScannedField = { model: ContentModel; recordId: string; field: string; obj: Record<string, string> };

/** One pass over every translatable content field, reused for all locales. */
async function scanContent(models: readonly ContentModel[]): Promise<ScannedField[]> {
  const out: ScannedField[] = [];
  for (const model of models) {
    if (model === "setting") {
      for (const key of SETTING_KEYS) {
        const value = (await getSetting(key as SettingKey)) as unknown as Record<string, unknown>;
        for (const field of SETTING_FIELDS[key]) {
          for (const node of collectNodes(value[field], field)) {
            if ((node.obj.en ?? "").trim() !== "") out.push({ model, recordId: key, field: node.path, obj: node.obj });
          }
        }
      }
      continue;
    }
    for (const rec of await listRecords(model)) {
      for (const column of MODEL_COLUMNS[model]) {
        const tree = parseColumn(rec.columns[column]);
        if (tree === null) continue;
        for (const node of collectNodes(tree, column)) {
          if ((node.obj.en ?? "").trim() !== "") out.push({ model, recordId: rec.id, field: node.path, obj: node.obj });
        }
      }
    }
  }
  return out;
}

/** Coverage for several locales in one content scan. */
export async function coverageMany(locales: string[]): Promise<Record<string, Coverage>> {
  const settings = await getSetting("i18n");
  const models = settings.contentModels.filter(isContentModel);
  const fields = await scanContent(models.length ? models : CONTENT_MODELS);

  const [uiRows, contentRows] = await Promise.all([
    db.translation.findMany({ where: { locale: { in: locales } } }).catch(() => []),
    db.contentTranslation.findMany({ where: { locale: { in: locales } } }).catch(() => []),
  ]);

  const out: Record<string, Coverage> = {};
  for (const locale of locales) {
    const uiByKey = new Map(
      uiRows
        .filter((r) => r.locale === locale)
        .map((r) => [r.namespace === "common" ? r.key : `${r.namespace}.${r.key}`, r]),
    );
    const builtIn = locale === "bn" ? FLAT_BN : locale === "en" ? FLAT_EN : {};

    let uiTranslated = 0;
    let uiApproved = 0;
    for (const key of UI_KEYS) {
      const row = uiByKey.get(key);
      const shipped = (builtIn as Record<string, string>)[key];
      const has = Boolean((row && row.value.trim() !== "") || (shipped && shipped.trim() !== ""));
      if (!has) continue;
      uiTranslated++;
      if (!row || row.approved) uiApproved++;
    }

    const ctByKey = new Map(contentRows.filter((r) => r.locale === locale).map((r) => [`${r.model}|${r.recordId}|${r.field}`, r]));
    let contentTranslated = 0;
    let contentApproved = 0;
    for (const f of fields) {
      const value = f.obj[locale];
      if (!value || value.trim() === "") continue;
      contentTranslated++;
      const row = ctByKey.get(`${f.model}|${f.recordId}|${f.field}`);
      if (!row || row.approved) contentApproved++;
    }

    out[locale] = {
      uiTotal: UI_KEYS.length,
      uiTranslated,
      uiApproved,
      contentTotal: fields.length,
      contentTranslated,
      contentApproved,
    };
  }
  return out;
}

export async function coverage(locale: string): Promise<Coverage> {
  return (await coverageMany([locale]))[locale];
}

/* ───────────────────────────── review queue data ───────────────────────────── */

export type UiReviewRow = { id: string; key: string; source: string; value: string; machine: boolean; approved: boolean };
export type ContentReviewRow = {
  id: string;
  model: ContentModel;
  recordId: string;
  recordLabel: string;
  field: string;
  source: string;
  value: string;
  machine: boolean;
  approved: boolean;
  stale: boolean;
};

/** Interface strings awaiting review for a locale. */
export async function uiReviewRows(locale: string): Promise<UiReviewRow[]> {
  const rows = await db.translation.findMany({ where: { locale }, orderBy: { key: "asc" } });
  return rows.map((r) => {
    const key = r.namespace === "common" ? r.key : `${r.namespace}.${r.key}`;
    return { id: r.id, key, source: FLAT_EN[key] ?? "", value: r.value, machine: r.machine, approved: r.approved };
  });
}

/** Machine-translated content fields awaiting review for a locale. */
export async function contentReviewRows(locale: string): Promise<ContentReviewRow[]> {
  const rows = await db.contentTranslation.findMany({ where: { locale }, orderBy: [{ model: "asc" }, { recordId: "asc" }, { field: "asc" }] });
  if (!rows.length) return [];

  const settings = await getSetting("i18n");
  const models = settings.contentModels.filter(isContentModel);
  const fields = await scanContent(models.length ? models : CONTENT_MODELS);
  const byKey = new Map(fields.map((f) => [`${f.model}|${f.recordId}|${f.field}`, f]));

  const labels = new Map<string, string>();
  for (const model of new Set(rows.map((r) => r.model))) {
    if (!isContentModel(model) || model === "setting") continue;
    for (const rec of await listRecords(model)) labels.set(`${model}|${rec.id}`, rec.label);
  }

  const out: ContentReviewRow[] = [];
  for (const r of rows) {
    if (!isContentModel(r.model)) continue;
    const field = byKey.get(`${r.model}|${r.recordId}|${r.field}`);
    const source = field?.obj.en ?? "";
    out.push({
      id: r.id,
      model: r.model,
      recordId: r.recordId,
      recordLabel: labels.get(`${r.model}|${r.recordId}`) ?? r.recordId,
      field: r.field,
      source,
      value: field?.obj[locale] ?? "",
      machine: r.machine,
      approved: r.approved,
      stale: Boolean(source && r.sourceHash && r.sourceHash !== hashOf(source)),
    });
  }
  return out;
}

/** Save an edited content translation straight into the record's i18n JSON. */
export async function saveContentTranslation(id: string, value: string): Promise<boolean> {
  const row = await db.contentTranslation.findUnique({ where: { id } });
  if (!row || !isContentModel(row.model)) return false;

  if (row.model === "setting") {
    if (!SETTING_FIELDS[row.recordId]) return false;
    const setting = (await getSetting(row.recordId as SettingKey)) as unknown as Record<string, unknown>;
    const nodes: I18nNode[] = [];
    for (const field of SETTING_FIELDS[row.recordId]) collectNodes(setting[field], field, nodes);
    const node = nodes.find((n) => n.path === row.field);
    if (!node) return false;
    node.obj[row.locale] = value;
    await saveSetting(row.recordId as SettingKey, setting);
    return true;
  }

  const model = row.model;
  const rec = await fetchOneRecord(model, row.recordId);
  if (!rec) return false;
  const column = row.field.split(/[.[]/)[0];
  if (!MODEL_COLUMNS[model].includes(column)) return false;
  const tree = parseColumn(rec.columns[column]);
  if (tree === null) return false;
  const node = collectNodes(tree, column).find((n) => n.path === row.field);
  if (!node) return false;
  node.obj[row.locale] = value;
  await saveColumns(model, rec.id, { [column]: toJson(tree) });
  return true;
}

async function fetchOneRecord(model: Exclude<ContentModel, "setting">, id: string): Promise<LoadedRecord | null> {
  switch (model) {
    case "product": {
      const r = await db.product.findUnique({ where: { id } });
      return r
        ? {
            id: r.id,
            label: r.slug,
            columns: { name: r.name, description: r.description, details: r.details, badge: r.badge, seoTitle: r.seoTitle, seoDescription: r.seoDescription },
          }
        : null;
    }
    case "category": {
      const r = await db.category.findUnique({ where: { id } });
      return r ? { id: r.id, label: r.slug, columns: { name: r.name, description: r.description } } : null;
    }
    case "collection": {
      const r = await db.collection.findUnique({ where: { id } });
      return r ? { id: r.id, label: r.slug, columns: { name: r.name, description: r.description } } : null;
    }
    case "page": {
      const r = await db.page.findUnique({ where: { id } });
      return r ? { id: r.id, label: r.slug, columns: { title: r.title, body: r.body, seoTitle: r.seoTitle, seoDescription: r.seoDescription } } : null;
    }
    case "block": {
      const r = await db.block.findUnique({ where: { id } });
      return r ? { id: r.id, label: `${r.page} / ${r.type}`, columns: { data: r.data } } : null;
    }
  }
}

/* ───────────────────────────── removing a language ───────────────────────────── */

/**
 * Strip a locale's key from every content i18n JSON field. Used when a language
 * is deleted so no orphan translations linger in the catalogue.
 */
export async function stripLocaleFromContent(locale: string): Promise<number> {
  if (locale === "en") return 0; // English is the source of truth
  let removed = 0;

  for (const model of ["product", "category", "collection", "page", "block"] as const) {
    for (const rec of await listRecords(model)) {
      const data: Record<string, string> = {};
      for (const column of MODEL_COLUMNS[model]) {
        const tree = parseColumn(rec.columns[column]);
        if (tree === null) continue;
        let touched = false;
        for (const node of collectNodes(tree, column)) {
          if (locale in node.obj) {
            delete node.obj[locale];
            touched = true;
            removed++;
          }
        }
        if (touched) data[column] = toJson(tree);
      }
      if (Object.keys(data).length) await saveColumns(model, rec.id, data);
    }
  }

  for (const key of SETTING_KEYS) {
    const value = (await getSetting(key as SettingKey)) as unknown as Record<string, unknown>;
    let touched = false;
    for (const field of SETTING_FIELDS[key]) {
      for (const node of collectNodes(value[field], field)) {
        if (locale in node.obj) {
          delete node.obj[locale];
          touched = true;
          removed++;
        }
      }
    }
    if (touched) await saveSetting(key as SettingKey, value);
  }

  return removed;
}
