/**
 * Shared theme contracts. Import from here in both the storefront resolver and the studio editor.
 * Colour tokens are "r g b" triplets so Tailwind alpha modifiers keep working.
 */
export const TOKEN_KEYS = ["ink", "paper", "bone", "line", "muted", "oxide", "brass", "olive", "success", "danger", "warning", "elev"] as const;
export type TokenKey = (typeof TOKEN_KEYS)[number];
export type TokenMap = Record<TokenKey, string>;

export const TOKEN_LABELS: Record<TokenKey, { label: string; hint: string }> = {
  ink: { label: "Ink", hint: "Primary text and solid buttons" },
  paper: { label: "Paper", hint: "Page background" },
  bone: { label: "Bone", hint: "Raised surfaces, cards, inputs" },
  line: { label: "Line", hint: "Borders and dividers" },
  muted: { label: "Muted", hint: "Secondary text" },
  oxide: { label: "Accent", hint: "Links, badges, highlights" },
  brass: { label: "Brass", hint: "Italic accents, ratings" },
  olive: { label: "Olive", hint: "Tertiary accent" },
  success: { label: "Success", hint: "Positive states" },
  danger: { label: "Danger", hint: "Errors, destructive actions" },
  warning: { label: "Warning", hint: "Pending, low stock" },
  elev: { label: "Elevated", hint: "Popovers and modals" },
};

export const HEADER_STYLES = ["classic", "centered", "split", "transparent", "utility"] as const;
export const MENU_STYLES = ["mega", "dropdown", "drawer", "inline"] as const;
export const FOOTER_STYLES = ["editorial", "columns", "compact", "minimal"] as const;
export const CONTAINERS = ["narrow", "regular", "wide", "full"] as const;
export const CARD_STYLES = ["editorial", "minimal", "bordered", "overlay"] as const;
export const BUTTON_STYLES = ["square", "rounded", "pill"] as const;
export const MOTION_LEVELS = ["full", "reduced", "none"] as const;
export const DENSITIES = ["airy", "regular", "compact"] as const;

export type HeaderStyle = (typeof HEADER_STYLES)[number];
export type MenuStyle = (typeof MENU_STYLES)[number];
export type FooterStyle = (typeof FOOTER_STYLES)[number];
export type ContainerWidth = (typeof CONTAINERS)[number];
export type CardStyle = (typeof CARD_STYLES)[number];
export type ButtonStyle = (typeof BUTTON_STYLES)[number];
export type MotionLevel = (typeof MOTION_LEVELS)[number];
export type Density = (typeof DENSITIES)[number];

export type ThemeLayout = {
  header: HeaderStyle;
  menu: MenuStyle;
  footer: FooterStyle;
  container: ContainerWidth;
  productGrid: 2 | 3 | 4;
  cardStyle: CardStyle;
  buttonStyle: ButtonStyle;
  radius: number; // px, 0–24
  motion: MotionLevel;
  density: Density;
  grain: boolean; // film-grain overlay on dark surfaces
  uppercaseEyebrows: boolean;
};

export type CustomFont = { family: string; url: string; weight?: string; style?: "normal" | "italic" };
export type ThemeTypography = {
  display: string; // Google Font family or custom family name
  sans: string;
  bangla: string;
  scale: number; // 0.85–1.2 multiplier on display sizes
  customFonts: CustomFont[];
};

export type ThemeDefinition = {
  key: string; // preset key or db id
  name: string;
  description: string;
  light: TokenMap;
  dark: TokenMap;
  black: TokenMap;
  typography: ThemeTypography;
  layout: ThemeLayout;
  customCss: string;
};

export const DEFAULT_LAYOUT: ThemeLayout = {
  header: "classic",
  menu: "mega",
  footer: "editorial",
  container: "regular",
  productGrid: 4,
  cardStyle: "editorial",
  buttonStyle: "square",
  radius: 2,
  motion: "full",
  density: "regular",
  grain: true,
  uppercaseEyebrows: true,
};

export const DEFAULT_TYPOGRAPHY: ThemeTypography = { display: "Fraunces", sans: "Space Grotesk", bangla: "Hind Siliguri", scale: 1, customFonts: [] };

/** The shipped ORYNVE palette — also the fallback whenever a token is missing. */
export const BASE_LIGHT: TokenMap = { ink: "14 15 12", paper: "250 248 243", bone: "243 239 230", line: "216 211 199", muted: "104 99 90", oxide: "178 74 36", brass: "201 162 92", olive: "62 68 50", success: "46 125 75", danger: "185 52 43", warning: "150 98 18", elev: "255 255 255" };
export const BASE_DARK: TokenMap = { ink: "243 239 230", paper: "14 15 12", bone: "24 25 22", line: "48 49 45", muted: "168 166 158", oxide: "214 104 62", brass: "214 178 110", olive: "126 136 104", success: "76 175 110", danger: "232 96 84", warning: "224 170 60", elev: "30 31 28" };
export const BASE_BLACK: TokenMap = { ...BASE_DARK, paper: "0 0 0", bone: "12 12 12", line: "38 38 38", elev: "18 18 18" };

export type ThemeMode = "light" | "dark" | "black";
export type ThemeModePreference = ThemeMode | "system";

/** A theme after merging brand settings, the active theme and any assignment — what the layout renders. */
export type ResolvedTheme = ThemeDefinition & {
  modes: Record<ThemeMode, boolean>;
  defaultMode: ThemeModePreference;
  allowVisitorToggle: boolean;
  source: "preset" | "custom" | "assignment" | "preview";
};

/** Data attributes the layout sets on <html> so CSS can react to layout choices without JS. */
export function layoutDataAttributes(l: ThemeLayout): Record<string, string> {
  return {
    "data-header": l.header,
    "data-menu": l.menu,
    "data-footer": l.footer,
    "data-container": l.container,
    "data-grid": String(l.productGrid),
    "data-cards": l.cardStyle,
    "data-buttons": l.buttonStyle,
    "data-motion": l.motion,
    "data-density": l.density,
    "data-grain": l.grain ? "on" : "off",
  };
}
