import type { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { jsonError, jsonOk } from "@/lib/api-server";
import type { TokenMap, TokenKey } from "@/lib/theme/types";
import { TOKEN_KEYS } from "@/lib/theme/types";

export const runtime = "nodejs";

/** Parse "r g b" triplet into [0-255] numbers. */
function parseTriplet(t: string): [number, number, number] {
  const parts = t.trim().split(/\s+/).map(Number);
  if (parts.length < 3 || parts.some(isNaN)) return [0, 0, 0];
  return [
    Math.max(0, Math.min(255, parts[0])),
    Math.max(0, Math.min(255, parts[1])),
    Math.max(0, Math.min(255, parts[2])),
  ];
}

/** WCAG 2.1 relative luminance. */
function luminance(r: number, g: number, b: number): number {
  const sRGB = [r, g, b].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * sRGB[0] + 0.7152 * sRGB[1] + 0.0722 * sRGB[2];
}

/** WCAG contrast ratio (always ≥ 1). */
function contrastRatio(l1: number, l2: number): number {
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

type ContrastResult = {
  ratio: number;
  aa: boolean;
  aaa: boolean;
  aaLarge: boolean;
};

function check(fg: string, bg: string): ContrastResult {
  const [fr, fg2, fb] = parseTriplet(fg);
  const [br, bg2, bb] = parseTriplet(bg);
  const ratio = contrastRatio(luminance(fr, fg2, fb), luminance(br, bg2, bb));
  return {
    ratio: Math.round(ratio * 100) / 100,
    aa: ratio >= 4.5,
    aaa: ratio >= 7,
    aaLarge: ratio >= 3,
  };
}

type ContrastReport = Partial<Record<string, ContrastResult>>;

function buildReport(tokens: Partial<TokenMap>): ContrastReport {
  const t = tokens as Record<string, string>;
  const safe = (k: string) => t[k] ?? "0 0 0";

  const pairs: [string, string, string][] = [
    ["ink_on_paper", "ink", "paper"],
    ["ink_on_bone", "ink", "bone"],
    ["muted_on_paper", "muted", "paper"],
    ["muted_on_bone", "muted", "bone"],
    ["oxide_on_paper", "oxide", "paper"],
    ["oxide_on_bone", "oxide", "bone"],
    ["white_on_oxide", "255 255 255", "oxide"],
    ["black_on_oxide", "0 0 0", "oxide"],
    ["white_on_ink", "255 255 255", "ink"],
    ["paper_on_ink", "paper", "ink"],
  ];

  const report: ContrastReport = {};
  for (const [label, fg, bg] of pairs) {
    report[label] = check(safe(fg), safe(bg));
  }
  return report;
}

export async function POST(req: NextRequest) {
  try {
    await requireUser("themes.write");
  } catch {
    return jsonError("Unauthorised.", 401);
  }

  let body: { tokens?: Partial<TokenMap>; mode?: string } = {};
  try {
    body = await req.json();
  } catch {
    return jsonError("Invalid JSON.", 400);
  }

  const tokens = body.tokens ?? {};
  // Validate keys
  const validKeys = new Set<string>(TOKEN_KEYS);
  const filtered: Partial<TokenMap> = {};
  for (const [k, v] of Object.entries(tokens)) {
    if (validKeys.has(k) && typeof v === "string") {
      filtered[k as TokenKey] = v;
    }
  }

  const report = buildReport(filtered);
  return jsonOk({ report });
}
