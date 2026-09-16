"use server";

import { z } from "zod";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { getSetting, saveSetting } from "@/lib/settings";
import { toJson, parseJson } from "@/lib/json";
import { authorize, fail, revalidateStudio, runAction, succeed, type ActionState } from "@/lib/admin/guard";
import { readBool, readInt } from "@/lib/admin/schemas";
import {
  TOKEN_KEYS,
  HEADER_STYLES,
  MENU_STYLES,
  FOOTER_STYLES,
  CONTAINERS,
  CARD_STYLES,
  BUTTON_STYLES,
  MOTION_LEVELS,
  DENSITIES,
  DEFAULT_LAYOUT,
  DEFAULT_TYPOGRAPHY,
  BASE_LIGHT,
  BASE_DARK,
  BASE_BLACK,
  type TokenMap,
  type ThemeDefinition,
  type ThemeLayout,
  type ThemeTypography,
} from "@/lib/theme/types";
// Written by Prism — these will exist after integration:
import type { ThemeDefinition as _TD } from "@/lib/theme/types";

/* ─── Zod schemas ──────────────────────────────────────────────────── */

const tokenMapSchema = z.record(z.string()).transform((m) => {
  const out: Partial<TokenMap> = {};
  for (const k of TOKEN_KEYS) {
    out[k] = typeof m[k] === "string" ? m[k] : "0 0 0";
  }
  return out as TokenMap;
});

const customFontSchema = z.object({
  family: z.string().max(120),
  url: z.string().max(600),
  weight: z.string().max(20).optional(),
  style: z.enum(["normal", "italic"]).optional(),
});

const typographySchema = z.object({
  display: z.string().max(120).default(DEFAULT_TYPOGRAPHY.display),
  sans: z.string().max(120).default(DEFAULT_TYPOGRAPHY.sans),
  bangla: z.string().max(120).default(DEFAULT_TYPOGRAPHY.bangla),
  scale: z.number().min(0.7).max(1.5).default(1),
  customFonts: z.array(customFontSchema).max(20).default([]),
});

const layoutSchema = z.object({
  header: z.enum(HEADER_STYLES).default(DEFAULT_LAYOUT.header),
  menu: z.enum(MENU_STYLES).default(DEFAULT_LAYOUT.menu),
  footer: z.enum(FOOTER_STYLES).default(DEFAULT_LAYOUT.footer),
  container: z.enum(CONTAINERS).default(DEFAULT_LAYOUT.container),
  productGrid: z.union([z.literal(2), z.literal(3), z.literal(4)]).default(DEFAULT_LAYOUT.productGrid),
  cardStyle: z.enum(CARD_STYLES).default(DEFAULT_LAYOUT.cardStyle),
  buttonStyle: z.enum(BUTTON_STYLES).default(DEFAULT_LAYOUT.buttonStyle),
  radius: z.number().min(0).max(24).default(DEFAULT_LAYOUT.radius),
  motion: z.enum(MOTION_LEVELS).default(DEFAULT_LAYOUT.motion),
  density: z.enum(DENSITIES).default(DEFAULT_LAYOUT.density),
  grain: z.boolean().default(DEFAULT_LAYOUT.grain),
  uppercaseEyebrows: z.boolean().default(DEFAULT_LAYOUT.uppercaseEyebrows),
});

const definitionSchema = z.object({
  name: z.string().trim().min(1, "A theme name is required.").max(120),
  description: z.string().max(500).default(""),
  light: tokenMapSchema.default(BASE_LIGHT as unknown as Record<string, string>),
  dark: tokenMapSchema.default(BASE_DARK as unknown as Record<string, string>),
  black: tokenMapSchema.default(BASE_BLACK as unknown as Record<string, string>),
  typography: typographySchema.default({}),
  layout: layoutSchema.default({}),
  customCss: z.string().max(20000).default(""),
});

/* ─── Helpers ──────────────────────────────────────────────────────── */

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80) || "theme";
}

async function uniqueSlug(base: string, excludeId?: string): Promise<string> {
  let slug = base;
  let n = 1;
  while (true) {
    const existing = await db.theme.findUnique({ where: { slug } });
    if (!existing || existing.id === excludeId) return slug;
    slug = `${base}-${++n}`;
  }
}

/** Read a full ThemeDefinition from a DB row (mirrors resolve.ts contract). */
function rowToDefinition(row: {
  id: string;
  name: string;
  description: string | null;
  presetKey: string | null;
  light: string;
  dark: string;
  black: string;
  typography: string;
  layout: string;
  customCss: string | null;
}): ThemeDefinition {
  return {
    key: row.id,
    name: row.name,
    description: row.description ?? "",
    light: parseJson<TokenMap>(row.light, BASE_LIGHT),
    dark: parseJson<TokenMap>(row.dark, BASE_DARK),
    black: parseJson<TokenMap>(row.black, BASE_BLACK),
    typography: parseJson<ThemeTypography>(row.typography, DEFAULT_TYPOGRAPHY),
    layout: parseJson<ThemeLayout>(row.layout, DEFAULT_LAYOUT),
    customCss: row.customCss ?? "",
  };
}

/* ─── exportTheme helper (called by the export route) ─────────────── */

export async function exportTheme(id: string): Promise<ThemeDefinition | null> {
  const row = await db.theme.findUnique({ where: { id } });
  if (!row) return null;
  return rowToDefinition(row);
}

/* ─── createThemeFromPresetAction ──────────────────────────────────── */

export async function createThemeFromPresetAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await authorize("themes.write", fd);
    const presetKey = String(fd.get("presetKey") ?? "").slice(0, 80);
    if (!presetKey) return fail("No preset key provided.");
    const customName = String(fd.get("name") ?? "").trim().slice(0, 120);

    // Lazy import — Prism writes this module; it will exist after integration.
    let preset: ThemeDefinition | undefined;
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const m = require("@/lib/theme/presets") as {
        getPreset: (k: string) => ThemeDefinition | undefined;
      };
      preset = m.getPreset(presetKey);
    } catch {
      return fail("Theme presets module is not yet available. Please integrate Prism's output first.");
    }
    if (!preset) return fail(`Preset "${presetKey}" not found.`);

    const name = customName || `${preset.name} (copy)`;
    const slug = await uniqueSlug(slugify(name));

    const theme = await db.theme.create({
      data: {
        slug,
        name,
        description: preset.description,
        presetKey,
        light: toJson(preset.light),
        dark: toJson(preset.dark),
        black: toJson(preset.black),
        typography: toJson(preset.typography),
        layout: toJson(preset.layout),
        customCss: preset.customCss ?? "",
      },
    });

    await audit(user.id, "theme.create_from_preset", "theme", theme.id, { presetKey, name });
    revalidateStudio("/admin/settings/themes");
    return succeed(`"${name}" created — open the editor to customise it.`, { id: theme.id });
  });
}

/* ─── saveThemeAction ──────────────────────────────────────────────── */

export async function saveThemeAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await authorize("themes.write", fd);
    const id = String(fd.get("id") ?? "").trim();
    const rawDef = String(fd.get("definition") ?? "");

    let parsed: ReturnType<typeof definitionSchema.parse>;
    try {
      parsed = definitionSchema.parse(JSON.parse(rawDef));
    } catch {
      return fail("Invalid theme definition payload.");
    }

    const slug = await uniqueSlug(slugify(parsed.name), id || undefined);
    const data = {
      slug,
      name: parsed.name,
      description: parsed.description,
      light: toJson(parsed.light),
      dark: toJson(parsed.dark),
      black: toJson(parsed.black),
      typography: toJson(parsed.typography),
      layout: toJson(parsed.layout),
      customCss: parsed.customCss || null,
    };

    let theme;
    if (id) {
      const existing = await db.theme.findUnique({ where: { id } });
      if (!existing) return fail("That theme no longer exists.");
      theme = await db.theme.update({ where: { id }, data: { ...data, updatedAt: new Date() } });
      await audit(user.id, "theme.save", "theme", theme.id, { name: theme.name });
    } else {
      theme = await db.theme.create({ data });
      await audit(user.id, "theme.create", "theme", theme.id, { name: theme.name });
    }

    revalidateStudio("/admin/settings/themes", `/admin/settings/themes/${theme.id}`);
    return succeed("Theme saved.", { id: theme.id });
  });
}

/* ─── deleteThemeAction ────────────────────────────────────────────── */

export async function deleteThemeAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await authorize("themes.write", fd);
    const id = String(fd.get("id") ?? "").trim();
    if (!id) return fail("No theme ID provided.");

    const theme = await db.theme.findUnique({ where: { id } });
    if (!theme) return fail("That theme no longer exists.");

    // Refuse when this theme is the active one.
    const setting = await getSetting("theme");
    if (setting.activeThemeId === id) {
      return fail("Cannot delete the active theme. Apply a different theme first.");
    }

    await db.theme.delete({ where: { id } });
    await audit(user.id, "theme.delete", "theme", id, { name: theme.name });
    revalidateStudio("/admin/settings/themes");
    return succeed(`"${theme.name}" deleted.`);
  });
}

/* ─── applyThemeAction ─────────────────────────────────────────────── */

export async function applyThemeAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await authorize("themes.write", fd);
    // id can be a db id, "preset:<key>", or "" (reset to built-in)
    const rawId = String(fd.get("id") ?? "").trim();
    const activeThemeId = rawId || null;

    const current = await getSetting("theme");
    await saveSetting("theme", { ...current, activeThemeId });

    let label = "Built-in ORYNVE theme";
    if (activeThemeId) {
      if (activeThemeId.startsWith("preset:")) {
        label = `preset ${activeThemeId.slice(7)}`;
      } else {
        const theme = await db.theme.findUnique({ where: { id: activeThemeId } }).catch(() => null);
        label = theme?.name ?? activeThemeId;
      }
    }

    await audit(user.id, "theme.apply", "setting", "theme", { activeThemeId, label });
    revalidateStudio("/admin/settings/themes");
    return succeed(`"${label}" is now the active theme.`);
  });
}

/* ─── saveThemeModesAction ─────────────────────────────────────────── */

export async function saveThemeModesAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await authorize("themes.write", fd);
    const current = await getSetting("theme");
    const rawDefault = String(fd.get("defaultMode") ?? "light");
    const defaultMode = (["light", "dark", "black", "system"].includes(rawDefault) ? rawDefault : "light") as
      | "light"
      | "dark"
      | "black"
      | "system";

    const modes = {
      light: readBool(fd, "light"),
      dark: readBool(fd, "dark"),
      black: readBool(fd, "black"),
    };
    // At least one mode must be enabled.
    if (!modes.light && !modes.dark && !modes.black) {
      return fail("At least one colour mode must be enabled.");
    }

    const next = await saveSetting("theme", {
      ...current,
      modes,
      defaultMode,
      allowVisitorToggle: readBool(fd, "allowVisitorToggle"),
    });

    await audit(user.id, "theme.modes", "setting", "theme", { modes: next.modes, defaultMode: next.defaultMode });
    revalidateStudio("/admin/settings/themes");
    return succeed("Visitor colour modes saved.");
  });
}

/* ─── saveAssignmentAction ─────────────────────────────────────────── */

export async function saveAssignmentAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await authorize("themes.write", fd);
    const assignmentId = String(fd.get("assignmentId") ?? "").trim();
    const themeId = String(fd.get("themeId") ?? "").trim();
    if (!themeId) return fail("A theme is required.");

    const theme = await db.theme.findUnique({ where: { id: themeId } });
    if (!theme) return fail("That theme no longer exists.");

    const pathPattern = String(fd.get("pathPattern") ?? "*").trim() || "*";
    const locale = String(fd.get("locale") ?? "").trim() || null;
    const priority = readInt(fd, "priority", 0);

    const startsAtRaw = String(fd.get("startsAt") ?? "").trim();
    const endsAtRaw = String(fd.get("endsAt") ?? "").trim();
    const startsAt = startsAtRaw ? new Date(startsAtRaw) : null;
    const endsAt = endsAtRaw ? new Date(endsAtRaw) : null;

    if (startsAt && isNaN(startsAt.getTime())) return fail("Invalid start date.", { startsAt: "Enter a valid date and time." });
    if (endsAt && isNaN(endsAt.getTime())) return fail("Invalid end date.", { endsAt: "Enter a valid date and time." });
    if (startsAt && endsAt && endsAt <= startsAt) return fail("End date must be after start date.", { endsAt: "Must be after the start date." });

    const data = { themeId, pathPattern, locale, priority, startsAt, endsAt, isEnabled: readBool(fd, "isEnabled") };

    let assignment;
    if (assignmentId) {
      assignment = await db.themeAssignment.update({ where: { id: assignmentId }, data });
      await audit(user.id, "theme.assignment_update", "themeAssignment", assignmentId, { themeId, pathPattern });
    } else {
      assignment = await db.themeAssignment.create({ data });
      await audit(user.id, "theme.assignment_create", "themeAssignment", assignment.id, { themeId, pathPattern });
    }

    revalidateStudio("/admin/settings/themes");
    return succeed("Assignment saved.", { id: assignment.id });
  });
}

/* ─── deleteAssignmentAction ───────────────────────────────────────── */

export async function deleteAssignmentAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await authorize("themes.write", fd);
    const id = String(fd.get("id") ?? "").trim();
    if (!id) return fail("No assignment ID provided.");

    await db.themeAssignment.delete({ where: { id } });
    await audit(user.id, "theme.assignment_delete", "themeAssignment", id);
    revalidateStudio("/admin/settings/themes");
    return succeed("Assignment removed.");
  });
}

/* ─── toggleAssignmentAction ───────────────────────────────────────── */

export async function toggleAssignmentAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await authorize("themes.write", fd);
    const id = String(fd.get("id") ?? "").trim();
    const isEnabled = readBool(fd, "isEnabled");

    const assignment = await db.themeAssignment.findUnique({ where: { id } });
    if (!assignment) return fail("That assignment no longer exists.");

    await db.themeAssignment.update({ where: { id }, data: { isEnabled } });
    await audit(user.id, "theme.assignment_toggle", "themeAssignment", id, { isEnabled });
    revalidateStudio("/admin/settings/themes");
    return succeed(isEnabled ? "Assignment enabled." : "Assignment disabled.");
  });
}

/* ─── importThemeAction ────────────────────────────────────────────── */

export async function importThemeAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await authorize("themes.write", fd);
    const file = fd.get("file");
    if (!(file instanceof File)) return fail("Upload a JSON file.");
    if (file.size > 200_000) return fail("File too large. Theme JSON must be under 200 KB.");

    const text = await file.text();
    let raw: unknown;
    try {
      raw = JSON.parse(text);
    } catch {
      return fail("Could not parse the file as JSON.");
    }

    let parsed: ReturnType<typeof definitionSchema.parse>;
    try {
      parsed = definitionSchema.parse(raw);
    } catch {
      return fail("The JSON does not match the expected theme structure.");
    }

    const slug = await uniqueSlug(slugify(parsed.name));
    const theme = await db.theme.create({
      data: {
        slug,
        name: parsed.name,
        description: parsed.description,
        light: toJson(parsed.light),
        dark: toJson(parsed.dark),
        black: toJson(parsed.black),
        typography: toJson(parsed.typography),
        layout: toJson(parsed.layout),
        customCss: parsed.customCss || null,
      },
    });

    await audit(user.id, "theme.import", "theme", theme.id, { name: theme.name });
    revalidateStudio("/admin/settings/themes");
    return succeed(`"${theme.name}" imported.`, { id: theme.id });
  });
}
