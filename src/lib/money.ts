/**
 * Money helpers. Amounts are stored as integer minor units of BDT (paisa).
 * Display currencies are indicative conversions maintained by the owner.
 */
export type DisplayCurrency = { code: string; symbol: string; rate: number; decimals: number; enabled?: boolean };

const BN_DIGITS = ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"];

export function toBanglaDigits(input: string | number): string {
  return String(input).replace(/\d/g, (d) => BN_DIGITS[Number(d)]);
}

export function minorToMajor(minor: number): number {
  return minor / 100;
}
export function majorToMinor(major: number | string): number {
  const n = typeof major === "string" ? Number(major.replace(/[^\d.-]/g, "")) : major;
  return Math.round((Number.isFinite(n) ? n : 0) * 100);
}

/** Group digits Indian-style (12,34,567) for BDT/INR, western elsewhere. */
function group(numStr: string, indian: boolean) {
  if (!indian) return numStr.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const last3 = numStr.slice(-3);
  const rest = numStr.slice(0, -3);
  return (rest ? rest.replace(/\B(?=(\d{2})+(?!\d))/g, ",") + "," : "") + last3;
}

export function formatMoney(
  minorBdt: number,
  currency: DisplayCurrency = { code: "BDT", symbol: "৳", rate: 1, decimals: 0 },
  locale = "en",
): string {
  const value = minorToMajor(minorBdt) * currency.rate;
  const fixed = value.toFixed(currency.decimals);
  const [int, dec] = fixed.split(".");
  const grouped = group(int, currency.code === "BDT" || currency.code === "INR");
  let out = `${currency.symbol}${grouped}${dec ? `.${dec}` : ""}`;
  if (locale === "bn") out = toBanglaDigits(out);
  return out;
}

export function convert(minorBdt: number, currency: DisplayCurrency) {
  return Math.round(minorToMajor(minorBdt) * currency.rate * 100) / 100;
}

export function percentOff(price: number, compareAt?: number | null) {
  if (!compareAt || compareAt <= price) return 0;
  return Math.round(((compareAt - price) / compareAt) * 100);
}
