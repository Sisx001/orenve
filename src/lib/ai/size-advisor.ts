/**
 * Pure deterministic size recommendation logic.
 * No DB calls; called from tools.ts which handles data fetching.
 * Tests: npx tsx src/lib/ai/size-advisor.test.ts
 */

export type ChartRow = {
  size: string;
  chest: [number, number]; // body measurement range in cm
  height: [number, number]; // height range in cm
  weight: [number, number]; // weight range in kg
};

export type SizeGuide = {
  unit: string;
  labels: string[];
  rows: (string | number)[][];
  notes?: string;
};

function scoreRow(
  row: ChartRow,
  opts: { chest_cm?: number; height_cm?: number; weight_kg?: number },
): number {
  let score = 0;
  let checks = 0;

  if (opts.chest_cm != null) {
    checks++;
    const { chest } = row;
    if (opts.chest_cm >= chest[0] && opts.chest_cm <= chest[1]) score += 3;
    else score -= Math.abs(opts.chest_cm - (opts.chest_cm < chest[0] ? chest[0] : chest[1])) * 0.3;
  }
  if (opts.height_cm != null) {
    checks++;
    const { height } = row;
    if (opts.height_cm >= height[0] && opts.height_cm <= height[1]) score += 1;
    else score -= Math.abs(opts.height_cm - (opts.height_cm < height[0] ? height[0] : height[1])) * 0.05;
  }
  if (opts.weight_kg != null) {
    checks++;
    const { weight } = row;
    if (opts.weight_kg >= weight[0] && opts.weight_kg <= weight[1]) score += 1;
    else score -= Math.abs(opts.weight_kg - (opts.weight_kg < weight[0] ? weight[0] : weight[1])) * 0.1;
  }

  return checks === 0 ? 0 : score;
}

/** Recommend size from a brand-level chart (body measurements). */
export function recommendFromChart(
  chart: ChartRow[],
  opts: {
    chest_cm?: number;
    height_cm?: number;
    weight_kg?: number;
    fit?: "regular" | "relaxed" | "slim";
  },
): { best: string; alt: string | null } {
  if (!chart.length) return { best: "M", alt: null };

  const scored = chart
    .map((row) => ({ size: row.size, score: scoreRow(row, opts) }))
    .sort((a, b) => b.score - a.score);

  const best = scored[0]!.size;
  const bestIdx = chart.findIndex((r) => r.size === best);

  let altSize: string | null = null;
  if (opts.fit === "relaxed" && bestIdx < chart.length - 1) {
    altSize = chart[bestIdx + 1]!.size;
  } else if (opts.fit === "slim" && bestIdx > 0) {
    altSize = chart[bestIdx - 1]!.size;
  } else if (scored.length > 1) {
    altSize = scored[1]!.size;
  }

  return { best, alt: altSize };
}

/**
 * Try to use a product sizeGuide (garment measurements) to recommend a size.
 * Applies an 8 cm ease offset to convert garment chest → approximate body chest.
 */
export function recommendFromSizeGuide(
  sizeGuide: SizeGuide,
  opts: {
    chest_cm?: number;
    height_cm?: number;
    weight_kg?: number;
    fit?: "regular" | "relaxed" | "slim";
  },
): { best: string; alt: string | null } | null {
  if (!opts.chest_cm) return null;

  const labels = sizeGuide.labels.map((l) => l.toLowerCase());
  const chestIdx = labels.findIndex((l) => l.includes("chest"));
  if (chestIdx < 0) return null;

  const isInch = /inch|"\s*$|\bin\b/i.test(sizeGuide.unit ?? "cm");
  const toCm = (v: string | number): number | null => {
    const n = Number(v);
    if (isNaN(n) || n <= 0) return null;
    return isInch ? n * 2.54 : n;
  };

  // Garment measurements → body measurements via standard ease subtraction
  const EASE_CM = 8;
  const chart: ChartRow[] = [];

  for (const row of sizeGuide.rows) {
    if (!row.length) continue;
    const size = String(row[0]);
    const rawChest = row[chestIdx];
    if (rawChest == null) continue;

    let chestMid: number | null = null;
    if (typeof rawChest === "string" && rawChest.includes("-")) {
      const parts = rawChest
        .split("-")
        .map((s) => toCm(s.trim()))
        .filter((x): x is number => x != null);
      if (parts.length >= 2) chestMid = (parts[0]! + parts[1]!) / 2;
    } else {
      chestMid = toCm(rawChest);
    }

    if (chestMid == null) continue;
    const bodyMid = chestMid - EASE_CM;
    chart.push({ size, chest: [bodyMid - 4, bodyMid + 4], height: [0, 300], weight: [0, 300] });
  }

  if (!chart.length) return null;
  return recommendFromChart(chart, opts);
}
