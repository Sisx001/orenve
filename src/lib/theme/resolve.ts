import "server-only";
import { cache } from "react";
import { z } from "zod";
import { db } from "@/lib/db";
import { parseJson, toJson } from "@/lib/json";
import { getSetting } from "@/lib/settings";
import { isGlobalPattern, normalisePath, pathMatches } from "./match";
import { PRESETS, getPreset, withBaseTokens } from "./presets";
import { lift, toTriplet } from "./contrast";
import { buildModeTokensCss } from "./css";
import {
  BUTTON_STYLES,
  CARD_STYLES,
  CONTAINERS,
  DEFAULT_LAYOUT,
  DEFAULT_TYPOGRAPHY,
  DENSITIES,
  FOOTER_STYLES,
  HEADER_STYLES,
  MENU_STYLES,
  MOTION_LEVELS,
  type ResolvedTheme,
  type ThemeDefinition,
  type ThemeLayout,
  type ThemeMode,
  type ThemeTypography,
  type TokenMap,
} from "./types";

/* ══════════════════════════ Validation ══════════════════════════
   Every JSON-in-string column is parsed through a tolerant schema: unknown
   fields are dropped, missing fields fall back to the defaults in types.ts, and
   a malformed row degrades to the house preset instead of throwing. */

const TRIPLET_RE = /^\d{1,3} \d{1,3} \d{1,3}$/;
const isTriplet = (v: string) => TRIPLET_RE.test(v);

/** Accepts `"r g b"` or `"#rrggbb"` and always stores the triplet form. */
const tripletSchema = z
  .string()
  .transform(toTriplet)
  .refine(isTriplet, 'expected an "r g b" triplet or a #rrggbb hex')
  .optional();

/** Every colour token is optional — callers merge the result over `BASE_*`. */
export const tokenMapSchema = z.object({
  ink: tripletSchema,
  paper: tripletSchema,
  bone: tripletSchema,
  line: tripletSchema,
  muted: tripletSchema,
  oxide: tripletSchema,
  brass: tripletSchema,
  olive: tripletSchema,
  success: tripletSchema,
  danger: tripletSchema,
  warning: tripletSchema,
  elev: tripletSchema,
});

export const typographySchema = z.object({
  display: z.string().min(1).max(60).default(DEFAULT_TYPOGRAPHY.display),
  sans: z.string().min(1).max(60).default(DEFAULT_TYPOGRAPHY.sans),
  bangla: z.string().min(1).max(60).default(DEFAULT_TYPOGRAPHY.bangla),
  scale: z.coerce.number().min(0.6).max(1.6).default(1),
  customFonts: z
    .array(
      z.object({
        family: z.string().min(1).max(60),
        url: z.string().min(1).max(500),
        weight: z.string().max(12).optional(),
        style: z.enum(["normal", "italic"]).optional(),
      }),
    )
    .max(12)
    .default([]),
});

export const layoutSchema = z.object({
  header: z.enum(HEADER_STYLES).default(DEFAULT_LAYOUT.header),
  menu: z.enum(MENU_STYLES).default(DEFAULT_LAYOUT.menu),
  footer: z.enum(FOOTER_STYLES).default(DEFAULT_LAYOUT.footer),
  container: z.enum(CONTAINERS).default(DEFAULT_LAYOUT.container),
  productGrid: z.union([z.literal(2), z.literal(3), z.literal(4)]).default(DEFAULT_LAYOUT.productGrid),
  cardStyle: z.enum(CARD_STYLES).default(DEFAULT_LAYOUT.cardStyle),
  buttonStyle: z.enum(BUTTON_STYLES).default(DEFAULT_LAYOUT.buttonStyle),
  radius: z.coerce.number().min(0).max(24).default(DEFAULT_LAYOUT.radius),
  motion: z.enum(MOTION_LEVELS).default(DEFAULT_LAYOUT.motion),
  density: z.enum(DENSITIES).default(DEFAULT_LAYOUT.density),
  grain: z.coerce.boolean().default(DEFAULT_LAYOUT.grain),
  uppercaseEyebrows: z.coerce.boolean().default(DEFAULT_LAYOUT.uppercaseEyebrows),
});

/** Shape of the `Theme` row we read — declared locally so the studio can pass plain objects. */
export type ThemeRowLike = {
  id: string;
  slug?: string | null;
  name: string;
  description?: string | null;
  presetKey?: string | null;
  light: string;
  dark: string;
  black: string;
  typography: string;
  layout: string;
  customCss?: string | null;
};

/** Parse a `Theme` row (JSON-in-string columns) into a complete definition. */
export function themeRowToDefinition(row: ThemeRowLike): ThemeDefinition {
  const preset = getPreset(row.presetKey);
  const tokens = (raw: string, fallback: TokenMap): TokenMap => {
    const parsed = tokenMapSchema.safeParse(parseJson(raw, {}));
    if (!parsed.success) return fallback;
    const defined = Object.fromEntries(Object.entries(parsed.data).filter(([, v]) => typeof v === "string"));
    return { ...fallback, ...defined } as TokenMap;
  };
  const typography = typographySchema.safeParse(parseJson(row.typography, {}));
  const layout = layoutSchema.safeParse(parseJson(row.layout, {}));
  return {
    key: row.id,
    name: row.name,
    description: row.description ?? "",
    light: tokens(row.light, preset.light),
    dark: tokens(row.dark, preset.dark),
    black: tokens(row.black, preset.black),
    typography: typography.success ? (typography.data as ThemeTypography) : preset.typography,
    layout: layout.success ? (layout.data as ThemeLayout) : preset.layout,
    customCss: row.customCss ?? "",
  };
}

/** Inverse of `themeRowToDefinition` — the columns a studio save should write. */
export function definitionToRow(def: ThemeDefinition): {
  name: string;
  description: string | null;
  presetKey: string | null;
  light: string;
  dark: string;
  black: string;
  typography: string;
  layout: string;
  customCss: string | null;
} {
  const clean = (raw: Partial<TokenMap> | undefined) => {
    const parsed = tokenMapSchema.safeParse(raw ?? {});
    return parsed.success ? (Object.fromEntries(Object.entries(parsed.data).filter(([, v]) => typeof v === "string")) as Partial<TokenMap>) : {};
  };
  const light = clean(def.light);
  const dark = clean(def.dark);
  const black = clean(def.black);
  return {
    name: def.name,
    description: def.description || null,
    presetKey: def.key && PRESETS[def.key] ? def.key : null,
    light: toJson(withBaseTokens("light", light)),
    dark: toJson(withBaseTokens("dark", dark)),
    black: toJson(withBaseTokens("black", black)),
    typography: toJson(typographySchema.parse(def.typography ?? {})),
    layout: toJson(layoutSchema.parse(def.layout ?? {})),
    customCss: def.customCss || null,
  };
}

/* ══════════════════════════ Brand overlay ══════════════════════════ */

/**
 * Fold the legacy brand settings (accent, brass, radius, fonts) into a
 * definition. The dark/black accents are lifted toward white by the same
 * amounts the previous `ThemeStyle` used (0.22 / 0.12), so a store that only
 * ever touched the brand form keeps pixel-identical colours.
 */
function applyBrand(base: ThemeDefinition, brand: { accent: string; brass: string; radius: number; fontDisplay: string; fontSans: string; fontBangla: string }): ThemeDefinition {
  const accent = toTriplet(brand.accent);
  const brass = toTriplet(brand.brass);
  const hasAccent = /^\d{1,3} \d{1,3} \d{1,3}$/.test(accent);
  const hasBrass = /^\d{1,3} \d{1,3} \d{1,3}$/.test(brass);
  const overlay = (tokens: TokenMap, dark: boolean): TokenMap => ({
    ...tokens,
    ...(hasAccent ? { oxide: dark ? lift(accent, 0.22) : accent } : {}),
    ...(hasBrass ? { brass: dark ? lift(brass, 0.12) : brass } : {}),
  });
  return {
    ...base,
    light: overlay(base.light, false),
    dark: overlay(base.dark, true),
    black: overlay(base.black, true),
    typography: {
      ...base.typography,
      display: brand.fontDisplay || base.typography.display,
      sans: brand.fontSans || base.typography.sans,
      bangla: brand.fontBangla || base.typography.bangla,
    },
    layout: { ...base.layout, radius: Number.isFinite(brand.radius) ? brand.radius : base.layout.radius },
  };
}

/* ══════════════════════════ Assignments ══════════════════════════ */

/** Pattern matching lives in ./match so the client switcher uses the same code. */
export { isGlobalPattern, normalisePath, pathMatches };

type AssignmentRow = {
  id: string;
  themeId: string;
  pathPattern: string;
  locale: string | null;
  startsAt: Date | null;
  endsAt: Date | null;
  priority: number;
  isEnabled: boolean;
};

const inWindow = (a: Pick<AssignmentRow, "startsAt" | "endsAt">, now: Date) => (!a.startsAt || a.startsAt <= now) && (!a.endsAt || a.endsAt >= now);

/** Enabled assignments, highest priority first. Cached per request. */
const listAssignments = cache(async (): Promise<AssignmentRow[]> => {
  const rows = await db.themeAssignment.findMany({ where: { isEnabled: true }, orderBy: [{ priority: "desc" }, { createdAt: "asc" }], take: 200 }).catch(() => []);
  return rows as AssignmentRow[];
});

const loadThemeDefinition = cache(async (themeId: string): Promise<ThemeDefinition | null> => {
  const row = await db.theme.findUnique({ where: { id: themeId } }).catch(() => null);
  return row ? themeRowToDefinition(row as ThemeRowLike) : null;
});

/** Resolve an `activeThemeId`-style reference: a `Theme.id`, a slug, or `preset:<key>`. */
async function loadReference(ref: string | null | undefined): Promise<ThemeDefinition | null> {
  if (!ref) return null;
  if (ref.startsWith("preset:")) {
    const key = ref.slice(7);
    return PRESETS[key] ? PRESETS[key] : null;
  }
  const byId = await loadThemeDefinition(ref);
  if (byId) return byId;
  const row = await db.theme.findUnique({ where: { slug: ref } }).catch(() => null);
  return row ? themeRowToDefinition(row as ThemeRowLike) : null;
}

/* ══════════════════════════ Resolver ══════════════════════════ */

function mergeDefinition(base: ThemeDefinition, over: ThemeDefinition): ThemeDefinition {
  return {
    key: over.key,
    name: over.name,
    description: over.description,
    light: { ...base.light, ...over.light },
    dark: { ...base.dark, ...over.dark },
    black: { ...base.black, ...over.black },
    typography: { ...base.typography, ...over.typography },
    layout: { ...base.layout, ...over.layout },
    customCss: [base.customCss, over.customCss].filter(Boolean).join("\n"),
  };
}

export type ResolveThemeArgs = {
  /** Full request path; the locale prefix is stripped before matching. */
  pathname: string;
  locale: string;
  now?: Date;
  /** `Theme.id`, slug or `preset:<key>` from `?theme_preview=` — ignored unless `allowPreview`. */
  previewId?: string | null;
  /** Caller vouches that the visitor is a signed-in studio user. */
  allowPreview?: boolean;
};

/**
 * Merge order (later wins):
 *   1. `PRESETS.orynve`
 *   2. brand settings (accent / brass / radius / fonts)
 *   3. `theme.activeThemeId` (a Theme row, a slug, or `preset:<key>`)
 *   4. the highest-priority enabled assignment matching path + locale + schedule
 *   5. `previewId`, when the caller allows preview
 * Tokens are merged over `BASE_*`, so a half-filled map can never break the CSS.
 */
export const resolveTheme = cache(async function resolveTheme({ pathname, locale, now, previewId, allowPreview }: ResolveThemeArgs): Promise<ResolvedTheme> {
  const at = now ?? new Date();
  const [settings, brand] = await Promise.all([getSetting("theme"), getSetting("brand")]);

  let definition = applyBrand(PRESETS.orynve, brand);
  let source: ResolvedTheme["source"] = "preset";

  const active = await loadReference(settings.activeThemeId);
  if (active) {
    definition = mergeDefinition(definition, active);
    source = settings.activeThemeId?.startsWith("preset:") ? "preset" : "custom";
  }

  const assignments = await listAssignments();
  const match = assignments.find((a) => (a.locale === null || a.locale === locale) && inWindow(a, at) && pathMatches(a.pathPattern, pathname));
  if (match) {
    const assigned = await loadThemeDefinition(match.themeId);
    if (assigned) {
      definition = mergeDefinition(definition, assigned);
      source = "assignment";
    }
  }

  if (allowPreview && previewId) {
    const preview = await loadReference(previewId);
    if (preview) {
      definition = mergeDefinition(definition, preview);
      source = "preview";
    }
  }

  return {
    ...definition,
    light: withBaseTokens("light", definition.light),
    dark: withBaseTokens("dark", definition.dark),
    black: withBaseTokens("black", definition.black),
    modes: { light: settings.modes.light, dark: settings.modes.dark, black: settings.modes.black },
    defaultMode: settings.defaultMode,
    allowVisitorToggle: settings.allowVisitorToggle,
    source,
  };
});

/* ══════════════════════════ Per-page overrides ══════════════════════════
   Next gives a server layout no way to read the current pathname, and the
   middleware is out of bounds, so page-scoped assignments cannot be resolved
   during the layout render. Instead the layout resolves *all* candidate
   assignments once (they are few and cached) and hands them to the client
   `PageThemeSwitch`, which re-applies the right one on every route change. The
   globally-scoped theme is still fully server-rendered, so the first paint is
   never wrong for the common case. */

export type PageThemeOverride = {
  id: string;
  pattern: string;
  locale: string | null;
  priority: number;
  /** Ready-to-inject CSS for the three modes, scoped to `#ory-page-theme`'s selectors. */
  css: string;
  /** `layoutDataAttributes()`-ready values for `<html>`. */
  layout: ThemeLayout;
  tokens: Record<ThemeMode, TokenMap>;
};

/**
 * Assignments that could apply to *some* page of this locale in this time
 * window, capped at 10 (highest priority first). Patterns that match every path
 * are excluded — the layout already resolved those server-side.
 */
export const getPageThemeOverrides = cache(async function getPageThemeOverrides({ locale, now }: { locale: string; now?: Date }): Promise<PageThemeOverride[]> {
  const at = now ?? new Date();
  const assignments = await listAssignments();
  const candidates = assignments.filter((a) => (a.locale === null || a.locale === locale) && inWindow(a, at) && !isGlobalPattern(a.pathPattern)).slice(0, 10);
  if (!candidates.length) return [];

  const [brand, settings] = await Promise.all([getSetting("brand"), getSetting("theme")]);
  const branded = applyBrand(PRESETS.orynve, brand);
  const active = await loadReference(settings.activeThemeId);
  const base = active ? mergeDefinition(branded, active) : branded;

  const out: PageThemeOverride[] = [];
  for (const a of candidates) {
    const def = await loadThemeDefinition(a.themeId);
    if (!def) continue;
    const merged = mergeDefinition(base, def);
    const tokens = {
      light: withBaseTokens("light", merged.light),
      dark: withBaseTokens("dark", merged.dark),
      black: withBaseTokens("black", merged.black),
    };
    out.push({
      id: a.id,
      pattern: a.pathPattern,
      locale: a.locale,
      priority: a.priority,
      css: [
        buildModeTokensCss("html:root", tokens.light),
        buildModeTokensCss('html[data-theme="dark"]', tokens.dark),
        buildModeTokensCss('html[data-theme="black"]', tokens.black),
      ].join("\n"),
      layout: merged.layout,
      tokens,
    });
  }
  return out;
});
