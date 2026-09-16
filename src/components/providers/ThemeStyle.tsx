/**
 * Emits everything the resolved theme needs into `<head>`:
 *   • preconnects + one Google Fonts stylesheet for every non-built-in family
 *   • the theme's `<style>` block (tokens for all three modes, radius, fonts,
 *     `@font-face` rules for custom uploads, sanitised custom CSS)
 *   • per-language font rules for studio-added languages, scoped to `[lang="xx"]`
 *
 * Token/CSS generation lives in `@/lib/theme/css` so the studio preview can
 * reuse it; this component is only the plumbing.
 */
import type { ResolvedTheme } from "@/lib/theme/types";
import { buildThemeCss, googleFontsHref, themeFontFamilies } from "@/lib/theme/css";

export { googleFontsHref };

const esc = (s: string) => s.replace(/[^a-zA-Z0-9 ,'_-]/g, "").slice(0, 60);

/** en/bn already have typography rules in globals.css — never re-declare them. */
const SCOPED_SKIP = new Set(["en", "bn"]);

export type ThemeStyleProps = {
  theme: ResolvedTheme;
  /**
   * Extra storefront languages. Each one with a font gets that family loaded
   * and scoped to `[lang="xx"]`, so a studio-added language can carry its own
   * script font without a rebuild.
   */
  languages?: { code: string; font: string | null; dir: string }[];
};

export function ThemeStyle({ theme, languages }: ThemeStyleProps) {
  const scoped = (languages ?? []).filter((l): l is { code: string; font: string; dir: string } => !!l.font && /^[a-z]{2,3}$/.test(l.code) && !SCOPED_SKIP.has(l.code));

  const langCss = scoped
    .map((l) => {
      const family = esc(l.font);
      return `[lang="${l.code}"]{--font-sans:'${family}',sans-serif;--font-display:'${family}',serif}`;
    })
    .join("");

  const href = googleFontsHref([...themeFontFamilies(theme), ...scoped.map((l) => l.font)]);
  const css = `${buildThemeCss(theme)}${langCss ? `\n${langCss}` : ""}`;

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
