/**
 * WCAG contrast utilities shared by the preset checker and the studio editor.
 * Colours are the same `"r g b"` triplets the token maps use.
 */
import { TOKEN_KEYS, type TokenMap } from "./types";

export type Rgb = [number, number, number];

/** `"14 15 12"` or `"#0e0f0c"` → `[14, 15, 12]`. Returns null for anything unparseable. */
export function parseColor(value: string): Rgb | null {
  const v = value.trim();
  const hexMatch = /^#?([a-f\d]{3}|[a-f\d]{6})$/i.exec(v);
  if (hexMatch) {
    const h = hexMatch[1].length === 3 ? hexMatch[1].replace(/./g, (c) => c + c) : hexMatch[1];
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }
  const parts = v.split(/[\s,]+/).map(Number);
  if (parts.length === 3 && parts.every((n) => Number.isFinite(n) && n >= 0 && n <= 255)) return [parts[0], parts[1], parts[2]] as Rgb;
  return null;
}

export function toTriplet(value: string): string {
  const rgb = parseColor(value);
  return rgb ? rgb.join(" ") : value;
}

export function toHex(value: string): string {
  const rgb = parseColor(value);
  if (!rgb) return "#000000";
  return `#${rgb.map((c) => Math.max(0, Math.min(255, Math.round(c))).toString(16).padStart(2, "0")).join("")}`;
}

const channel = (c: number) => {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
};

/** Relative luminance per WCAG 2.1. */
export function luminance(color: string): number {
  const rgb = parseColor(color) ?? [0, 0, 0];
  return 0.2126 * channel(rgb[0]) + 0.7152 * channel(rgb[1]) + 0.0722 * channel(rgb[2]);
}

/** WCAG contrast ratio between two colours (1–21). Order does not matter. */
export function contrast(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** Mix an `"r g b"` triple toward a target colour. Used to lift accents on dark canvases. */
export function mix(color: string, target: string, amount: number): string {
  const a = parseColor(color) ?? [0, 0, 0];
  const b = parseColor(target) ?? [255, 255, 255];
  return a.map((c, i) => Math.round(c + (b[i] - c) * amount)).join(" ");
}

/** Mix toward white. */
export const lift = (color: string, amount: number) => mix(color, "255 255 255", amount);
/** Mix toward black. */
export const shade = (color: string, amount: number) => mix(color, "0 0 0", amount);

/** Theme-invariant text colours (see `--c-snow` / `--c-coal` in globals.css). */
export const SNOW = "243 239 230";
export const COAL = "14 15 12";

/** Whichever of snow/coal is legible on a background — what `.on-accent` resolves to. */
export function bestTextOn(background: string): "snow" | "coal" {
  return contrast(SNOW, background) >= contrast(COAL, background) ? "snow" : "coal";
}

export type ContrastIssue = { pair: string; ratio: number; required: number };

/**
 * The AA rules every shipped preset satisfies, in every mode. Run by the studio
 * editor to warn owners about their own palettes and by the preset unit checks:
 *
 *   ink   on paper ≥ 7.0   (body text, AAA-ish for small type)
 *   muted on paper ≥ 4.5   (secondary text)
 *   muted on bone  ≥ 4.5   (secondary text on cards)
 *   oxide on paper ≥ 4.5   (links, badges)
 *   oxide on bone  ≥ 4.5
 *   snow OR coal on oxide ≥ 4.5 (solid accent buttons — `.on-accent` picks the winner)
 */
export function auditTokens(tokens: Partial<TokenMap>): ContrastIssue[] {
  const t = tokens as TokenMap;
  for (const key of TOKEN_KEYS) if (!t[key]) return [];
  const issues: ContrastIssue[] = [];
  const check = (pair: string, ratio: number, required: number) => {
    if (ratio < required) issues.push({ pair, ratio: Math.round(ratio * 100) / 100, required });
  };
  check("ink on paper", contrast(t.ink, t.paper), 7);
  check("muted on paper", contrast(t.muted, t.paper), 4.5);
  check("muted on bone", contrast(t.muted, t.bone), 4.5);
  check("accent on paper", contrast(t.oxide, t.paper), 4.5);
  check("accent on bone", contrast(t.oxide, t.bone), 4.5);
  check("text on accent", Math.max(contrast(SNOW, t.oxide), contrast(COAL, t.oxide)), 4.5);
  return issues;
}
