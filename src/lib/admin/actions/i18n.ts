"use server";

import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { getSetting, saveSetting } from "@/lib/settings";
import { LOCALE_SEGMENT_RE, SUPPORTED_LOCALES, DEFAULT_LOCALE } from "@/lib/constants";
import { authorize, fail, revalidateStudio, runAction, succeed, type ActionState } from "@/lib/admin/guard";
import { readBool, readInt } from "@/lib/admin/schemas";
import { stripLocaleFromContent } from "@/lib/i18n/translate";

const str = (fd: FormData, name: string, max = 200) => String(fd.get(name) ?? "").trim().slice(0, max);
const isBuiltIn = (code: string) => (SUPPORTED_LOCALES as readonly string[]).includes(code);

/* ───────────────────────────── add a language ───────────────────────────── */

export async function addLanguageAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await authorize("i18n.write", fd);

    const code = str(fd, "code", 8).toLowerCase();
    if (!LOCALE_SEGMENT_RE.test(code)) {
      return fail("Use a 2–3 letter language code, for example hi, ar or fil.", { code: "Invalid code." });
    }
    if (isBuiltIn(code)) {
      return fail(`${code === "en" ? "English" : "Bangla"} is built in — enable it in the list instead of adding it.`, { code: "Already built in." });
    }
    const exists = await db.language.findUnique({ where: { code } });
    if (exists) return fail(`${exists.name} (${code}) is already in the list.`, { code: "Already added." });

    const name = str(fd, "name", 80) || code.toUpperCase();
    const language = await db.language.create({
      data: {
        code,
        name,
        nativeName: str(fd, "nativeName", 80) || name,
        dir: str(fd, "dir", 3) === "rtl" ? "rtl" : "ltr",
        font: str(fd, "font", 80) || null,
        flag: str(fd, "flag", 8) || null,
        enabled: readBool(fd, "enabled"),
        isMachine: true,
        sortOrder: readInt(fd, "sortOrder", 0),
      },
    });

    await audit(user.id, "i18n.language_add", "language", code, { name: language.name, dir: language.dir, enabled: language.enabled });
    revalidateStudio("/admin/settings/languages");
    return succeed(`${language.name} added. Generate the dictionary with AI, then review it before switching the language on.`, { code });
  });
}

/* ───────────────────────────── update a language ───────────────────────────── */

export async function updateLanguageAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await authorize("i18n.write", fd);
    const code = str(fd, "code", 8).toLowerCase();

    // Built-in languages live in the locale setting, not the Language table.
    if (isBuiltIn(code)) return toggleBuiltIn(user.id, code, readBool(fd, "enabled"));

    const current = await db.language.findUnique({ where: { code } });
    if (!current) return fail("That language is no longer in the list.");

    // Only the fields the form actually rendered are touched, so the quick
    // enable/disable switch cannot silently reset the font or direction.
    const name = str(fd, "name", 80) || current.name;
    const updated = await db.language.update({
      where: { code },
      data: {
        name,
        nativeName: str(fd, "nativeName", 80) || (fd.has("name") ? name : current.nativeName),
        dir: fd.has("dir") ? (str(fd, "dir", 3) === "rtl" ? "rtl" : "ltr") : current.dir,
        font: fd.has("font") ? str(fd, "font", 80) || null : current.font,
        flag: fd.has("flag") ? str(fd, "flag", 8) || null : current.flag,
        enabled: readBool(fd, "enabled"),
        isMachine: fd.has("isMachine") ? readBool(fd, "isMachine") : current.isMachine,
        sortOrder: fd.has("sortOrder") ? readInt(fd, "sortOrder", current.sortOrder) : current.sortOrder,
      },
    });

    await audit(user.id, "i18n.language_update", "language", code, { enabled: updated.enabled, dir: updated.dir, font: updated.font });
    revalidateStudio("/admin/settings/languages", `/admin/settings/languages/${code}`);
    return succeed(`${updated.name} saved.`);
  });
}

/* ───────────────────────────── enable / disable a built-in ───────────────────────────── */

async function toggleBuiltIn(userId: string, code: string, enabled: boolean): Promise<ActionState> {
  if (code === DEFAULT_LOCALE) return fail("English is the source language and is always on.");
  const locale = await getSetting("locale");
  const set = new Set(locale.enabled.filter((l) => l !== code));
  set.add(DEFAULT_LOCALE);
  if (enabled) set.add(code);
  const next = [...set];
  await saveSetting("locale", {
    ...locale,
    enabled: next,
    default: next.includes(locale.default) ? locale.default : DEFAULT_LOCALE,
  });
  await audit(userId, "i18n.builtin_toggle", "setting", "locale", { code, enabled });
  revalidateStudio("/admin/settings/languages", "/admin/settings/currency");
  return succeed(enabled ? `${code.toUpperCase()} is live on the storefront.` : `${code.toUpperCase()} is hidden from the storefront.`);
}

export async function toggleBuiltInLocaleAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await authorize("i18n.write", fd);
    const code = str(fd, "code", 8).toLowerCase();
    if (!isBuiltIn(code)) return fail("That is not a built-in language.");
    return toggleBuiltIn(user.id, code, readBool(fd, "enabled"));
  });
}

/* ───────────────────────────── delete a language ───────────────────────────── */

export async function deleteLanguageAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await authorize("i18n.write", fd);
    const code = str(fd, "code", 8).toLowerCase();
    if (isBuiltIn(code)) return fail("Built-in languages cannot be deleted — switch them off instead.");

    const language = await db.language.findUnique({ where: { code } });
    if (!language) return fail("That language is no longer in the list.");

    const [ui, content] = await Promise.all([
      db.translation.deleteMany({ where: { locale: code } }),
      db.contentTranslation.deleteMany({ where: { locale: code } }),
    ]);
    const stripped = await stripLocaleFromContent(code);
    await db.language.delete({ where: { code } });

    await audit(user.id, "i18n.language_delete", "language", code, { ui: ui.count, content: content.count, stripped });
    revalidateStudio("/admin/settings/languages", "/admin/settings/translations");
    return succeed(`${language.name} removed — ${ui.count} interface strings and ${stripped} content translations deleted.`);
  });
}

/* ───────────────────────────── engine settings ───────────────────────────── */

export async function saveI18nSettingsAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await authorize("i18n.write", fd);
    const current = await getSetting("i18n");

    const glossary = String(fd.get("glossary") ?? "")
      .split(/[\n,]/)
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 120);

    const value = await saveSetting("i18n", {
      ...current,
      glossary,
      autoTranslateNewContent: readBool(fd, "autoTranslateNewContent"),
      showMachineBadge: readBool(fd, "showMachineBadge"),
      batchSize: Math.min(80, Math.max(5, readInt(fd, "batchSize", current.batchSize))),
    });

    await audit(user.id, "settings.i18n", "setting", "i18n", { glossary: value.glossary.length, batchSize: value.batchSize });
    revalidateStudio("/admin/settings/languages");
    return succeed("Translation engine settings saved.");
  });
}
