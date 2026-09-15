/**
 * Injects owner-configured brand tokens (accent colour, radius, fonts) as CSS
 * variables so the studio can retheme the storefront without a rebuild, and
 * loads any Google Font the owner picked (static weights — works for both
 * variable and static families).
 */
function hexToRgb(hex: string): string | null {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex.trim());
  return m ? `${parseInt(m[1], 16)} ${parseInt(m[2], 16)} ${parseInt(m[3], 16)}` : null;
}

/** Mix an "r g b" triple toward white so accents stay legible on the dark canvas. */
function lift(rgb: string, amount: number): string {
  return rgb
    .split(" ")
    .map((c) => Math.round(Number(c) + (255 - Number(c)) * amount))
    .join(" ");
}

const BUILT_IN = new Set(["Fraunces", "Space Grotesk", "Hind Siliguri"]);
const SYSTEM = new Set(["system-ui", "serif", "sans-serif", "Georgia", "Arial", "Helvetica", "Times New Roman"]);

export type ThemeStyleProps = {
  accent: string;
  brass: string;
  radius: number;
  fontDisplay: string;
  fontSans: string;
  fontBangla: string;
  /** optional per-token overrides from the theme editor: { "--c-ink": "14 15 12", ... } */
  tokens?: Record<string, string>;
  darkTokens?: Record<string, string>;
  customCss?: string;
};

export function googleFontsHref(families: string[]): string | null {
  const list = [...new Set(families.filter((f) => f && !BUILT_IN.has(f) && !SYSTEM.has(f)))];
  if (!list.length) return null;
  const q = list.map((f) => `family=${encodeURIComponent(f).replace(/%20/g, "+")}:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400`).join("&");
  return `https://fonts.googleapis.com/css2?${q}&display=swap`;
}

const esc = (s: string) => s.replace(/[^a-zA-Z0-9 ,'-]/g, "");
const safeVar = (k: string) => /^--[a-z0-9-]+$/i.test(k);
const safeVal = (v: string) => /^[\w\s.#%(),'"-]+$/.test(v);

export function ThemeStyle({ accent, brass, radius, fontDisplay, fontSans, fontBangla, tokens, darkTokens, customCss }: ThemeStyleProps) {
  const vars: string[] = [];
  const a = hexToRgb(accent);
  const b = hexToRgb(brass);
  if (a) vars.push(`--c-oxide:${a}`);
  if (b) vars.push(`--c-brass:${b}`);
  vars.push(`--radius:${radius}px`);
  if (fontDisplay) vars.push(`--font-display:'${esc(fontDisplay)}'`);
  if (fontSans) vars.push(`--font-sans:'${esc(fontSans)}'`);
  if (fontBangla) vars.push(`--font-bangla:'${esc(fontBangla)}'`);
  for (const [k, v] of Object.entries(tokens ?? {})) if (safeVar(k) && safeVal(v)) vars.push(`${k}:${v}`);
  // Dark canvas: unless the theme editor overrides them, lift the accents so the
  // same brand hue clears WCAG AA on near-black. (Emitted unconditionally so the
  // studio :root block above can never shadow the dark remap in globals.css.)
  const dark: Record<string, string> = {};
  if (a) dark["--c-oxide"] = lift(a, 0.22);
  if (b) dark["--c-brass"] = lift(b, 0.12);
  for (const [k, v] of Object.entries(darkTokens ?? {})) if (safeVar(k) && safeVal(v)) dark[k] = v;
  const darkVars = Object.entries(dark).map(([k, v]) => `${k}:${v}`);

  const href = googleFontsHref([fontDisplay, fontSans, fontBangla]);
  const css = `:root{${vars.join(";")}}${darkVars.length ? `[data-theme="dark"]{${darkVars.join(";")}}` : ""}${customCss ? `\n${customCss.replace(/<\/style/gi, "")}` : ""}`;
  return (
    <>
      {href && (
        <>
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
          <link rel="stylesheet" href={href} />
        </>
      )}
      <style>{css}</style>
    </>
  );
}
