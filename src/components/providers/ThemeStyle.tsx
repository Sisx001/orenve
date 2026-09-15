/**
 * Injects owner-configured brand tokens (accent colour, radius, fonts) as CSS
 * variables so the studio can retheme the storefront without a rebuild.
 */
function hexToRgb(hex: string): string | null {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex.trim());
  return m ? `${parseInt(m[1], 16)} ${parseInt(m[2], 16)} ${parseInt(m[3], 16)}` : null;
}

export function ThemeStyle({ accent, brass, radius, fontDisplay, fontSans, fontBangla }: { accent: string; brass: string; radius: number; fontDisplay: string; fontSans: string; fontBangla: string }) {
  const vars: string[] = [];
  const a = hexToRgb(accent);
  const b = hexToRgb(brass);
  if (a) vars.push(`--c-oxide:${a}`);
  if (b) vars.push(`--c-brass:${b}`);
  vars.push(`--radius:${radius}px`);
  const esc = (s: string) => s.replace(/[^a-zA-Z0-9 ,'-]/g, "");
  if (fontDisplay) vars.push(`--font-display:'${esc(fontDisplay)}'`);
  if (fontSans) vars.push(`--font-sans:'${esc(fontSans)}'`);
  if (fontBangla) vars.push(`--font-bangla:'${esc(fontBangla)}'`);
  const extraFonts = [fontDisplay, fontSans, fontBangla].filter((f) => f && !["Fraunces", "Space Grotesk", "Hind Siliguri"].includes(f));
  return (
    <>
      {extraFonts.length > 0 && (
        <link rel="stylesheet" href={`https://fonts.googleapis.com/css2?${extraFonts.map((f) => `family=${encodeURIComponent(f).replace(/%20/g, "+")}:wght@300..700`).join("&")}&display=swap`} />
      )}
      <style>{`:root{${vars.join(";")}}`}</style>
    </>
  );
}
