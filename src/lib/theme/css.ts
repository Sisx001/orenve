/**
 * Turns a `ResolvedTheme` into the single `<style>` block the storefront needs.
 *
 * Specificity note: the light block is emitted as `html:root` (0,1,1) and the
 * mode blocks as `html[data-theme="…"]` (0,1,1) so they always beat the
 * `:root` / `[data-theme="dark"]` declarations in globals.css (0,1,0) no matter
 * where the framework decides to hoist the compiled stylesheet. Within this
 * sheet the dark/black blocks come last, so they win over the light block.
 *
 * globals.css keeps its own token declarations: the studio (which never renders
 * `ThemeStyle`) and any page that loses this inline style still get a complete,
 * legible palette.
 */
import { TOKEN_KEYS, type ResolvedTheme, type ThemeMode, type TokenMap } from "./types";
import { bestTextOn } from "./contrast";

/* ─────────────────────────── Fonts ─────────────────────────── */

/** Families already delivered by the `@import` at the top of globals.css. */
const BUILT_IN = new Set(["Fraunces", "Space Grotesk", "Hind Siliguri"]);
const SYSTEM = new Set(["system-ui", "serif", "sans-serif", "monospace", "ui-monospace", "Georgia", "Arial", "Helvetica", "Times New Roman"]);

/**
 * Google Fonts CSS2 URL for the families that are neither built in nor local.
 * Static weight list, so it works for variable and static families alike.
 */
export function googleFontsHref(families: (string | null | undefined)[]): string | null {
  const list = [...new Set(families.filter((f): f is string => !!f && !BUILT_IN.has(f) && !SYSTEM.has(f)))];
  if (!list.length) return null;
  const q = list.map((f) => `family=${encodeURIComponent(f).replace(/%20/g, "+")}:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400`).join("&");
  return `https://fonts.googleapis.com/css2?${q}&display=swap`;
}

/** Font family names may only contain letters, digits, spaces and a few marks. */
const escFamily = (s: string) => s.replace(/[^a-zA-Z0-9 ,'_-]/g, "").slice(0, 60);

/** Only absolute https URLs and same-origin paths; no quotes, parens or schemes we don't want. */
function safeFontUrl(url: string): string | null {
  const u = url.trim();
  if (!/^(https:\/\/|\/)[\w\-./%~+@:]+$/i.test(u)) return null;
  if (/javascript:|data:text/i.test(u)) return null;
  return u;
}

function fontFormat(url: string): string {
  const ext = url.split("?")[0].split(".").pop()?.toLowerCase();
  if (ext === "woff2") return "woff2";
  if (ext === "woff") return "woff";
  if (ext === "otf") return "opentype";
  if (ext === "ttf") return "truetype";
  return "woff2";
}

/* ─────────────────────────── Tokens ─────────────────────────── */

const safeTriplet = (v: string) => /^\d{1,3} \d{1,3} \d{1,3}$/.test(v.trim());

function tokenVars(tokens: TokenMap): string {
  const out: string[] = [];
  for (const key of TOKEN_KEYS) {
    const value = tokens[key]?.trim();
    if (!value || !safeTriplet(value)) continue;
    out.push(key === "elev" ? `--bg-elev:${value}` : `--c-${key}:${value}`);
  }
  // Keep the aliases globals.css uses for body background/colour in sync.
  if (safeTriplet(tokens.ink ?? "")) out.push(`--fg:${tokens.ink}`);
  if (safeTriplet(tokens.paper ?? "")) out.push(`--bg:${tokens.paper}`);
  return out.join(";");
}

/* ─────────────────────────── Custom CSS ─────────────────────────── */

/**
 * Owner-authored CSS is injected verbatim apart from the escapes that could
 * break out of the style element or pull in remote/executable content.
 */
export function sanitiseCustomCss(css: string): string {
  return css
    .replace(/<\/style/gi, "")
    .replace(/<!--|-->/g, "")
    .replace(/@import[^;]*;?/gi, "")
    .replace(/expression\s*\(/gi, "")
    .replace(/url\(\s*['"]?\s*javascript:/gi, "url(")
    .replace(/url\(\s*['"]?\s*data:text\/html/gi, "url(")
    .replace(/behavior\s*:/gi, "")
    .slice(0, 40_000);
}

/* ─────────────────────────── Display scale ─────────────────────────── */

/** The clamp() expressions from tailwind.config.ts, so `typography.scale` can multiply them. */
const DISPLAY_SIZES: [string, string][] = [
  ["xl", "clamp(3.5rem, 9vw, 11rem)"],
  ["lg", "clamp(2.75rem, 6vw, 7rem)"],
  ["md", "clamp(2rem, 4vw, 4.5rem)"],
  ["sm", "clamp(1.5rem, 2.5vw, 2.75rem)"],
];

function displayScaleCss(scale: number): string {
  if (!(scale > 0) || Math.abs(scale - 1) < 0.001) return "";
  const s = Math.max(0.6, Math.min(1.6, scale)).toFixed(3);
  // `[lang="bn"]` keeps its own hard-coded sizes in globals.css, so exclude it.
  return DISPLAY_SIZES.map(([name, expr]) => `html:not([lang="bn"]) .text-display-${name}{font-size:calc(${expr} * ${s})}`).join("");
}

/* ─────────────────────────── Public API ─────────────────────────── */

const MODE_SELECTOR: Record<Exclude<ThemeMode, "light">, string> = {
  dark: 'html[data-theme="dark"]',
  black: 'html[data-theme="black"]',
};

/**
 * Text colour on solid-accent surfaces, decided per mode from the accent's own
 * luminance instead of the "light → snow, dark → coal" guess in globals.css.
 * Keeps `.btn-accent`, accent badges and `.on-accent` at AA for any palette.
 */
function accentTextCss(theme: ResolvedTheme): string {
  const rules: string[] = [];
  const emit = (prefix: string, accent: string) => {
    const token = bestTextOn(accent) === "snow" ? "--c-snow" : "--c-coal";
    const targets = [".bg-oxide", ".hover\\:bg-oxide:hover", ".btn-accent", ".on-accent"];
    rules.push(`${targets.map((t) => `${prefix}${t}`).join(",")}{color:rgb(var(${token}))}`);
  };
  emit("html:root ", theme.light.oxide);
  emit(`${MODE_SELECTOR.dark} `, theme.dark.oxide);
  emit(`${MODE_SELECTOR.black} `, theme.black.oxide);
  return rules.join("");
}

/** Everything that belongs in the storefront's inline `<style>` element. */
export function buildThemeCss(theme: ResolvedTheme): string {
  const { typography, layout } = theme;
  const base: string[] = [
    tokenVars(theme.light),
    `--radius:${Math.max(0, Math.min(24, Math.round(layout.radius)))}px`,
    `--display-scale:${Math.max(0.6, Math.min(1.6, typography.scale || 1))}`,
  ];
  if (typography.display) base.push(`--font-display:'${escFamily(typography.display)}'`);
  if (typography.sans) base.push(`--font-sans:'${escFamily(typography.sans)}'`);
  if (typography.bangla) base.push(`--font-bangla:'${escFamily(typography.bangla)}'`);

  const faces = (typography.customFonts ?? [])
    .map((f) => {
      const family = escFamily(f.family ?? "");
      const url = safeFontUrl(f.url ?? "");
      if (!family || !url) return "";
      const weight = /^[\w\s]{1,12}$/.test(f.weight ?? "") ? (f.weight as string) : "400";
      const style = f.style === "italic" ? "italic" : "normal";
      return `@font-face{font-family:'${family}';src:url("${url}") format("${fontFormat(url)}");font-weight:${weight};font-style:${style};font-display:swap}`;
    })
    .join("");

  const custom = theme.customCss ? sanitiseCustomCss(theme.customCss) : "";

  return [
    faces,
    `html:root{${base.join(";")}}`,
    `${MODE_SELECTOR.dark}{${tokenVars(theme.dark)}}`,
    `${MODE_SELECTOR.black}{${tokenVars(theme.black)}}`,
    accentTextCss(theme),
    displayScaleCss(typography.scale || 1),
    custom,
  ]
    .filter(Boolean)
    .join("\n");
}

/** Only the tokens for one mode — used by `PageThemeSwitch` for per-page overrides. */
export function buildModeTokensCss(selector: string, tokens: TokenMap): string {
  return `${selector}{${tokenVars(tokens)}}`;
}

/** Every font family a theme needs, ready for `googleFontsHref` (custom faces excluded). */
export function themeFontFamilies(theme: Pick<ResolvedTheme, "typography">): string[] {
  const custom = new Set((theme.typography.customFonts ?? []).map((f) => f.family));
  return [theme.typography.display, theme.typography.sans, theme.typography.bangla].filter((f) => f && !custom.has(f));
}
