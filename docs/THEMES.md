# Themes

ORYNVE's storefront is fully re-themeable at runtime: no rebuild, no redeploy.
A theme decides **colours** (three modes), **typography** (any Google Font or a
custom `@font-face`), **layout** (header/menu/footer variants, container width,
grid, card and button styles, density, motion, grain) and optional **custom
CSS**. Themes can be switched globally, pinned to parts of the storefront, or
scheduled for a campaign window.

The shipped look is the `orynve` preset. A store with no `Theme` rows and
default settings renders exactly as it always has.

---

## Concepts

| Concept | Where it lives | What it does |
| --- | --- | --- |
| **Preset** | `src/lib/theme/presets.ts` (code) | A complete, named `ThemeDefinition`. 14 ship in the box. Referenced as `preset:<key>`. |
| **Theme row** | `Theme` table | An owner-authored theme, usually cloned from a preset. JSON-in-string columns for `light`/`dark`/`black`/`typography`/`layout`. |
| **Mode** | cookie `ory_theme` | `light` \| `dark` \| `black` \| `system`. Each theme carries a full palette for all three. |
| **Token** | CSS variable | 12 semantic colours (`ink`, `paper`, `bone`, `line`, `muted`, `oxide`, `brass`, `olive`, `success`, `danger`, `warning`, `elev`) as `"r g b"` triplets, so Tailwind alpha modifiers keep working. |
| **Assignment** | `ThemeAssignment` table | Applies a theme to a path pattern, a locale and/or a time window, with a priority. |
| **Preview** | cookie `ory_theme_preview` | Lets a signed-in studio user see an unpublished theme. Preview pages are `noindex`. |

### Colour modes

`getSetting("theme")` controls which modes exist:

```jsonc
{
  "activeThemeId": null,          // null → orynve preset + brand settings
  "modes": { "light": true, "dark": true, "black": false },
  "defaultMode": "light",         // light | dark | black | system
  "allowVisitorToggle": true,
  "studioTheme": "light"
}
```

- If the visitor's cookie names a **disabled** mode, the resolver falls back to
  the first enabled mode.
- `defaultMode: "system"` (or a `system` cookie) renders **light** on the server
  and is corrected before first paint by a tiny inline script in
  `src/app/[locale]/layout.tsx`, so there is no white flash on a dark device.
- When `allowVisitorToggle` is `false` (or the `darkModeToggle` feature is off,
  or only one mode is enabled) the header's appearance control is hidden.

---

## How the resolver merges

`resolveTheme()` in `src/lib/theme/resolve.ts` is a React-`cache`d,
`server-only` function. Later steps win:

1. **`PRESETS.orynve`** — the house palette, typography and layout.
2. **Brand settings** — `accent` → `oxide` (light), and `lift(accent, 0.22)` for
   dark/black so the same brand hue clears AA on a near-black canvas; `brass` →
   `brass` (dark lifted by `0.12`); plus `radius` and the three font families.
   These are the same numbers the old `ThemeStyle` used, so a store that only
   ever touched the brand form does not move a pixel.
3. **`theme.activeThemeId`** — a `Theme.id`, a `Theme.slug`, or `preset:<key>`.
4. **The highest-priority enabled `ThemeAssignment`** whose `pathPattern`
   matches the path, whose `locale` is `null` or equal, and whose
   `startsAt`/`endsAt` window contains `now`.
5. **`previewId`** — only when the caller passes `allowPreview: true`.

Token maps are always merged over `BASE_LIGHT` / `BASE_DARK` / `BASE_BLACK`, so
a half-filled or corrupt row can never produce broken CSS.

### Path patterns

Matching (`src/lib/theme/match.ts`) strips the locale prefix and any trailing
slash first, so `/bn/shop/` and `/shop` behave identically.

| Pattern | Matches |
| --- | --- |
| `*` (or empty, or `/*`) | every path — resolved server-side in the layout |
| `/collections/*` | `/collections` and anything below it |
| `/shop` | exactly `/shop` |
| `/product/the-form-overcoat` | that one product |

### Page-scoped assignments and the one caveat

A Next.js App Router **layout cannot read the request pathname**, and the
middleware is off-limits in this codebase. So the layout resolves the *global*
theme (steps 1–3 plus `*` assignments) and hands the remaining non-global
assignments — at most ten, already filtered by locale and schedule, each with
its tokens pre-rendered to CSS — to the client component
`src/components/store/PageThemeSwitch.tsx`. On mount and on every route change
it picks the highest-priority match and writes it into a single
`<style id="ory-page-theme">` element plus the `<html>` data attributes.

Consequences:

- The **first paint of every page is correct** for the common case (no page
  assignments, or a `*` assignment).
- A **page-scoped** assignment lands in the same commit as the route change —
  a one-frame difference on a hard navigation.
- Only **CSS-driven** choices follow a page assignment. The header and footer
  *component* variants come from the globally resolved theme, so a route change
  never remounts the chrome. Put structural changes in the active theme or a `*`
  assignment.

---

## Contrast: every preset passes AA

`src/lib/theme/contrast.ts` exports `contrast(a, b)`, `luminance`, `bestTextOn`
and `auditTokens(tokens)`. `auditTokens` encodes the rules every shipped preset
satisfies **in all three modes**:

| Pair | Minimum |
| --- | --- |
| `ink` on `paper` | 7.0 : 1 |
| `muted` on `paper` | 4.5 : 1 |
| `muted` on `bone` | 4.5 : 1 |
| `oxide` on `paper` | 4.5 : 1 |
| `oxide` on `bone` | 4.5 : 1 |
| `snow` **or** `coal` on `oxide` | 4.5 : 1 |

The preset palettes are the *corrected* output of a one-off generator that
pushed each draft hue toward black (light modes) or white (dark modes) in 3 %
steps until every rule cleared — so edit them with `auditTokens()` in hand.

`ThemeStyle` also re-emits the accent text colour per mode using
`bestTextOn(accent)`, so `.btn-accent`, accent badges and `.on-accent` stay
legible for **owner-authored** palettes too, not just the presets.

---

## Adding a preset in code

1. Open `src/lib/theme/presets.ts`.
2. Add an entry to `PRESETS` with `light`, `dark` and `black` token maps,
   a `typography` object and a `layout` object. The `type()` and `layout()`
   helpers fill in the defaults, so you only list what differs.
3. Check it: `auditTokens(PRESETS.yourKey.light)` (and `.dark`, `.black`) must
   return `[]`.
4. Add the key to the `ORDER` array so it appears in the studio gallery.

```ts
mykey: {
  key: "mykey",
  name: "My Key",
  description: "One sentence the studio shows under the swatches.",
  light: { ink: "…", paper: "…", /* all 12 */ },
  dark:  { /* … */ },
  black: { /* … */ },
  typography: type({ display: "Syne", sans: "Inter", bangla: "Anek Bangla", scale: 1.05 }),
  layout: layout({ header: "split", footer: "columns", cardStyle: "overlay" }),
  customCss: "",
}
```

`PRESET_LIST` derives the studio gallery entries (name, description, four hex
swatches, header/footer/font summary). `getPreset(key)` is a safe lookup that
falls back to `orynve`.

---

## CSS data attributes reference

`layoutDataAttributes()` (in `src/lib/theme/types.ts`) writes these onto
`<html>`; the layout adds `data-eyebrows` alongside them. **Every shipped
default value has no CSS rule at all**, which is how the default store stays
pixel-identical. Rules live at the bottom of `src/app/globals.css`.

| Attribute | Values | Effect |
| --- | --- | --- |
| `data-theme` | `light` `dark` `black` | Selects the token block. |
| `data-header` | `classic` `centered` `split` `transparent` `utility` | Header variant (React). `transparent` also styles `.site-header[data-solid="false"]`. |
| `data-menu` | `mega` `dropdown` `drawer` `inline` | Desktop submenu style. `drawer` shows the hamburger at every breakpoint; `inline` promotes collections into the bar and drops the panel. |
| `data-footer` | `editorial` `columns` `compact` `minimal` | Footer variant (React). |
| `data-container` | `narrow` `regular` `wide` `full` | Sets `--container-max`, used by `.container-page`. `regular` = unset → `--page-max`. |
| `data-grid` | `2` `3` `4` | Sets `--grid-cols`. `2`/`3` pin `.product-grid` columns from `md` up; `4` keeps the responsive 4 → 5 → 6 ladder. |
| `data-cards` | `editorial` `minimal` `bordered` `overlay` | Styles `.product-card` / `.card-media` / `.card-details` / `.card-head`. `overlay` lifts the details onto the image with a scrim and snow text. |
| `data-buttons` | `square` `rounded` `pill` | `rounded` → `border-radius: var(--radius)`, `pill` → `999px`, on `.btn`, `.btn-outline`, `.btn-accent`. |
| `data-density` | `airy` `regular` `compact` | Sets `--space-section`, used by `.section`. |
| `data-motion` | `full` `reduced` `none` | `reduced`: Framer reveals become instant (`MotionConfig reducedMotion="always"`) but CSS hover transitions stay. `none`: freezes animations and transitions too. |
| `data-grain` | `on` `off` | `off` blanks `.grain::after`. |
| `data-eyebrows` | `caps` `sentence` | `sentence` removes the uppercase transform on `.eyebrow`. |

### CSS variables a theme emits

`buildThemeCss()` (`src/lib/theme/css.ts`) writes:

- `html:root { --c-*, --bg-elev, --fg, --bg, --radius, --display-scale, --font-display, --font-sans, --font-bangla }`
- `html[data-theme="dark"] { … }` and `html[data-theme="black"] { … }`
- per-mode accent text rules (see above)
- `.text-display-{xl,lg,md,sm}` multiplied by `typography.scale`, when the scale
  is not `1` (skipped for `[lang="bn"]`, which has its own sizes)
- `@font-face` rules for `typography.customFonts`
- the sanitised `customCss`

Selectors use `html:root` / `html[data-theme="…"]` (specificity 0,1,1) so they
always beat the `:root` / `[data-theme="dark"]` declarations in `globals.css`
(0,1,0), whichever order the framework hoists the compiled stylesheet in.
`globals.css` keeps its own token blocks on purpose: the studio never renders
`ThemeStyle`, and a page that somehow loses the inline style still gets a
complete, legible palette.

### Custom CSS sanitisation

Owner CSS is injected verbatim except for: `</style`, HTML comment markers,
`@import`, `expression(`, `url(javascript:`, `url(data:text/html`, `behavior:`.
It is also capped at 40 000 characters.

---

## Fonts

**Google Fonts.** Put any family name in `typography.display` / `sans` /
`bangla`. `googleFontsHref()` builds one CSS2 request with the weights
`300–700` plus italic 400. `Fraunces`, `Space Grotesk` and `Hind Siliguri` are
skipped — they are already in the `@import` at the top of `globals.css` — and so
are generic/system families.

**Custom faces.** Add entries to `typography.customFonts`:

```jsonc
{ "family": "Founders Grotesk", "url": "/media/fonts/founders.woff2", "weight": "400", "style": "normal" }
```

The URL must be an absolute `https://` URL or a same-origin path; the format is
inferred from the extension (`woff2`, `woff`, `otf`, `ttf`). A family listed in
`customFonts` is never requested from Google. Then name it in `display`/`sans`/
`bangla` to use it.

**Per-language fonts.** A language row in the `Language` table with a `font` gets
`[lang="xx"] { --font-sans; --font-display }` emitted automatically. `en` and
`bn` are skipped — their typography rules are hard-coded in `globals.css`.

---

## Preview

A signed-in studio user can preview any theme:

```
/en/shop?theme_preview=<Theme id>
/en/shop?theme_preview=preset:noir
/en/shop?theme_preview=            # clears the preview
```

Because a layout cannot read `searchParams`, `ThemePreviewSync` mirrors the
query parameter into the `ory_theme_preview` cookie and refreshes. The studio
can set that cookie directly to skip the extra round trip. Either way the
**server re-checks the session** before honouring it, so a forged cookie does
nothing, and preview renders add `<meta name="robots" content="noindex,
nofollow">`.

---

## Module map

| Module | Exports |
| --- | --- |
| `src/lib/theme/types.ts` | `TOKEN_KEYS`, `TokenMap`, `ThemeLayout`, `ThemeTypography`, `ThemeDefinition`, `ResolvedTheme`, `DEFAULT_LAYOUT`, `DEFAULT_TYPOGRAPHY`, `BASE_LIGHT/DARK/BLACK`, `layoutDataAttributes()`, style enums |
| `src/lib/theme/presets.ts` | `PRESETS`, `PRESET_LIST`, `PRESET_KEYS`, `getPreset()`, `withBaseTokens()` |
| `src/lib/theme/contrast.ts` | `contrast()`, `luminance()`, `parseColor()`, `toHex()`, `toTriplet()`, `mix()`, `lift()`, `shade()`, `bestTextOn()`, `auditTokens()`, `SNOW`, `COAL` |
| `src/lib/theme/css.ts` | `buildThemeCss()`, `buildModeTokensCss()`, `themeFontFamilies()`, `googleFontsHref()`, `sanitiseCustomCss()` |
| `src/lib/theme/match.ts` | `pathMatches()`, `normalisePath()`, `isGlobalPattern()` |
| `src/lib/theme/resolve.ts` | `resolveTheme()`, `getPageThemeOverrides()`, `themeRowToDefinition()`, `definitionToRow()`, `tokenMapSchema`, `typographySchema`, `layoutSchema` (server-only) |
| `src/lib/theme/payload.ts` | `ThemeClientPayload`, `toClientTheme()`, `enabledModes()`, `effectiveMode()`, `COOKIE_THEME_PREVIEW`, `PREVIEW_PARAM` |
| `src/lib/theme/client.ts` | `ThemeProvider`, `useTheme()`, `useThemeLayout()`, `themeColorFor()` |
| `src/components/providers/ThemeStyle.tsx` | `ThemeStyle` (+ `googleFontsHref` re-export) |
| `src/components/store/header/` | `SiteHeader` entry, `variants.tsx`, `parts.tsx`, `context.tsx` |
| `src/components/store/footer/` | `SiteFooter` entry, `variants.tsx`, `parts.tsx` |

## Managing themes in the studio

Navigate to **Settings → Themes** (`/admin/settings/themes`).

- **Active theme card** shows what is live on the storefront. *Reset to built-in* reverts to the palette derived from Brand settings.
- **Visitor colour modes** controls which of light / dark / black modes visitors may use, the default mode (including *match device*), and whether the mode toggle appears in the storefront header.
- **Preset gallery** lists every built-in preset from `src/lib/theme/presets.ts`. **Apply** goes live immediately, **Preview** opens the storefront with `?theme_preview=preset:<key>` (studio users only; the page is `noindex`), **Customise** clones the preset into an editable theme and opens the editor.
- **Your themes** lists custom and imported themes with Apply / Preview / Edit / Duplicate / Export JSON / Delete. The active theme cannot be deleted.
- **Campaign assignments** apply a theme to a path pattern (`/shop`, `/collections/*`, `/product/the-form-overcoat`, or `*`), optionally to one language, inside a date/time window, with a priority. Higher priority wins when several rules match. Page-scoped assignments swap colours, fonts, radius, density, container, grid, card and button styles; header/footer component variants follow the globally active theme so navigation never remounts the chrome.
- **Import** accepts a JSON file exported from another ORYNVE store.

### Theme editor

`/admin/settings/themes/<id>` (or `/new`):

| Tab | What you can do |
|---|---|
| Colours | Every token for light, dark and black — colour picker + hex. Live WCAG badges (AA / AAA / fail) for the pairs that matter. *Copy light → dark* auto-darkens. |
| Typography | Display, sans and Bangla families (searchable list of popular Google Fonts, or any family name), size scale, and custom fonts by URL or `.woff2/.ttf` upload. |
| Layout | Header (classic, centered, split, transparent, utility), menu (mega, dropdown, drawer, inline), footer (editorial, columns, compact, minimal), container width, product grid columns, card style, button shape, corner radius, motion level, density, film grain, eyebrow casing. |
| Custom CSS | Up to 20 000 characters applied after the tokens. Reference tokens as `rgb(var(--c-ink))`. `@import`, `expression()` and `javascript:` URLs are stripped. |
| Preview | The live storefront at 390 / 820 / 1440 px with a mode switch. Save first to refresh. |

**Save & apply** saves and activates in one step. **Export JSON** downloads the definition for backup or reuse.

### Studio appearance

The studio has its own light / dark / match-device appearance (top-bar toggle, cookie `ory_studio_theme`; default from Settings → Themes → *Studio appearance*). It is independent of the storefront theme.
