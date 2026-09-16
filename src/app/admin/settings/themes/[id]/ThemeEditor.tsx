"use client";

import { useActionState, useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Monitor, Smartphone, Tablet, RefreshCw, Save, Download, Trash2 } from "lucide-react";
import { CsrfInput } from "@/components/admin/Csrf";
import { FormBanner, SubmitButton } from "@/components/admin/Fields";
import { idleState } from "@/lib/admin/action-state";
import {
  applyThemeAction,
  deleteThemeAction,
  saveThemeAction,
} from "@/lib/admin/actions/themes";
import {
  TOKEN_KEYS,
  TOKEN_LABELS,
  HEADER_STYLES,
  MENU_STYLES,
  FOOTER_STYLES,
  CONTAINERS,
  CARD_STYLES,
  BUTTON_STYLES,
  MOTION_LEVELS,
  DENSITIES,
  type ThemeDefinition,
  type TokenMap,
  type TokenKey,
  type ThemeLayout,
  type ThemeTypography,
  type CustomFont,
} from "@/lib/theme/types";
import { cn } from "@/lib/utils";

/* ═══════════════════════════════════════════════════════════════════
   Colour helpers
   ═══════════════════════════════════════════════════════════════════ */

function tripletToHex(t: string): string {
  const p = t.trim().split(/\s+/).map(Number);
  if (p.length < 3 || p.some(isNaN)) return "#000000";
  return "#" + p.map((n) => Math.max(0, Math.min(255, n)).toString(16).padStart(2, "0")).join("");
}

function hexToTriplet(hex: string): string {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex.trim());
  if (!m) return "0 0 0";
  return `${parseInt(m[1], 16)} ${parseInt(m[2], 16)} ${parseInt(m[3], 16)}`;
}

function tripletToRgb(t: string): [number, number, number] {
  const p = t.trim().split(/\s+/).map(Number);
  if (p.length < 3 || p.some(isNaN)) return [0, 0, 0];
  return [Math.max(0, Math.min(255, p[0])), Math.max(0, Math.min(255, p[1])), Math.max(0, Math.min(255, p[2]))];
}

function relativeLuminance(r: number, g: number, b: number): number {
  const srgb = [r, g, b].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * srgb[0] + 0.7152 * srgb[1] + 0.0722 * srgb[2];
}

function contrastRatio(t1: string, t2: string): number {
  const [r1, g1, b1] = tripletToRgb(t1);
  const [r2, g2, b2] = tripletToRgb(t2);
  const l1 = relativeLuminance(r1, g1, b1);
  const l2 = relativeLuminance(r2, g2, b2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

/** Darken all channels by amount (0–1). */
function darkenTriplet(t: string, amount: number): string {
  const [r, g, b] = tripletToRgb(t);
  const f = 1 - Math.max(0, Math.min(1, amount));
  return `${Math.round(r * f)} ${Math.round(g * f)} ${Math.round(b * f)}`;
}

/** Build an auto-darkened dark map from a light map. */
function autoDarken(light: TokenMap): TokenMap {
  return {
    ink: darkenTriplet(light.paper, 0),          // invert: ink in dark = paper in light (simplified)
    paper: darkenTriplet(light.ink, 0),           // paper in dark = ink in light
    bone: darkenTriplet(light.ink, 0.85),         // near paper
    line: darkenTriplet(light.ink, 0.75),
    muted: darkenTriplet(light.muted, 0.2),
    oxide: darkenTriplet(light.oxide, 0),         // keep accent close
    brass: darkenTriplet(light.brass, 0),
    olive: darkenTriplet(light.olive, 0),
    success: darkenTriplet(light.success, 0),
    danger: darkenTriplet(light.danger, 0),
    warning: darkenTriplet(light.warning, 0),
    elev: darkenTriplet(light.ink, 0.9),
  };
}

type ContrastBadge = { ratio: number; aa: boolean; aaa: boolean };

function ContrastBadge({ ratio }: ContrastBadge) {
  const aa = ratio >= 4.5;
  const aaa = ratio >= 7;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[0.58rem] font-semibold uppercase tracking-wider",
        aaa ? "bg-success/15 text-success" : aa ? "bg-warning/15 text-warning" : "bg-danger/15 text-danger",
      )}
      title={`Contrast ratio: ${ratio.toFixed(2)}:1`}
    >
      {ratio.toFixed(1)} {aaa ? "AAA" : aa ? "AA" : "Fail"}
    </span>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   Google Fonts popular list (searchable)
   ═══════════════════════════════════════════════════════════════════ */

const POPULAR_FONTS = [
  "Fraunces","Playfair Display","Cormorant Garamond","Instrument Serif","Lora","Libre Baskerville",
  "Crimson Text","EB Garamond","Merriweather","Gentium Plus","Spectral","Gelasio",
  "Space Grotesk","Inter","Manrope","DM Sans","Outfit","Plus Jakarta Sans","Nunito Sans",
  "Geist","Lexend","Figtree","Urbanist","Sora","Epilogue","Albert Sans","Barlow",
  "Roboto","Open Sans","Source Sans 3","Noto Sans","Lato","Raleway","Montserrat","Poppins",
  "Work Sans","Jost","Mulish","Josefin Sans","Karla","Rubik","Cabin","Quicksand",
  "Hind Siliguri","Noto Sans Bengali","Tiro Bangla","Baloo Da 2","Kalpurush",
];

/* ═══════════════════════════════════════════════════════════════════
   Sub-components
   ═══════════════════════════════════════════════════════════════════ */

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "px-4 py-2.5 text-[0.65rem] font-semibold uppercase tracking-[0.14em] transition border-b-2",
        active
          ? "border-oxide text-oxide"
          : "border-transparent text-muted hover:text-ink",
      )}
    >
      {children}
    </button>
  );
}

type TokenRowProps = {
  tokenKey: TokenKey;
  value: string;
  bgKey?: TokenKey;
  map: TokenMap;
  onChange: (k: TokenKey, v: string) => void;
};

function TokenRow({ tokenKey, value, bgKey, map, onChange }: TokenRowProps) {
  const [hex, setHex] = useState(tripletToHex(value));
  const { label, hint } = TOKEN_LABELS[tokenKey];

  // Sync hex when value changes externally
  useEffect(() => setHex(tripletToHex(value)), [value]);

  function handleColorChange(h: string) {
    setHex(h);
    onChange(tokenKey, hexToTriplet(h));
  }

  function handleHexChange(h: string) {
    setHex(h);
    const m = /^#?[0-9a-f]{6}$/i.test(h.trim());
    if (m) onChange(tokenKey, hexToTriplet(h.startsWith("#") ? h : `#${h}`));
  }

  // Contrast checks against selected backgrounds
  const contrastChecks: { against: string; ratio: number }[] = [];
  if (bgKey && map[bgKey]) {
    const ratio = contrastRatio(value, map[bgKey]);
    contrastChecks.push({ against: bgKey, ratio });
  }

  return (
    <div className="flex items-center gap-2 py-1.5 border-b border-line/40 last:border-0">
      <input
        type="color"
        value={hex}
        onChange={(e) => handleColorChange(e.target.value)}
        className="h-8 w-10 shrink-0 cursor-pointer border border-line bg-paper p-0.5 rounded"
        title={label}
      />
      <input
        value={hex}
        onChange={(e) => handleHexChange(e.target.value)}
        className="w-24 shrink-0 field-box font-mono text-xs py-1 px-2"
        placeholder="#000000"
        maxLength={7}
      />
      <div className="min-w-0 flex-1">
        <span className="text-xs font-medium">{label}</span>
        {hint && <p className="text-[0.62rem] text-muted">{hint}</p>}
      </div>
      {contrastChecks.map(({ against, ratio }) => (
        <ContrastBadge key={against} ratio={ratio} aa={ratio >= 4.5} aaa={ratio >= 7} />
      ))}
    </div>
  );
}

/* ─── Colour tab ─────────────────────────────────────────────────── */

const CONTRAST_PAIRS: Partial<Record<TokenKey, TokenKey>> = {
  ink: "paper",
  muted: "paper",
  oxide: "paper",
  brass: "paper",
  olive: "paper",
  success: "paper",
  danger: "paper",
  warning: "paper",
};

function ColourTab({
  definition,
  onChange,
}: {
  definition: ThemeDefinition;
  onChange: (partial: Partial<ThemeDefinition>) => void;
}) {
  function updateMode(mode: "light" | "dark" | "black", key: TokenKey, value: string) {
    onChange({ [mode]: { ...definition[mode], [key]: value } });
  }

  function copyLightToDark() {
    onChange({ dark: autoDarken(definition.light) });
    toast("Auto-darkened dark tokens from light palette.");
  }

  function copyDarkToBlack() {
    onChange({ black: { ...definition.dark, paper: "0 0 0", bone: "12 12 12", line: "38 38 38", elev: "18 18 18" } });
    toast("Black tokens derived from dark palette.");
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-2">
        <button type="button" onClick={copyLightToDark} className="btn-outline px-3 py-1.5 text-[0.65rem]">
          Copy light → dark (auto-darken)
        </button>
        <button type="button" onClick={copyDarkToBlack} className="btn-outline px-3 py-1.5 text-[0.65rem]">
          Copy dark → black
        </button>
      </div>
      <div className="grid gap-5 lg:grid-cols-3">
        {(["light", "dark", "black"] as const).map((mode) => (
          <div key={mode} className="card p-3">
            <p className="mb-2 text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-muted">
              {mode === "light" ? "Light" : mode === "dark" ? "Dark" : "Black"}
            </p>
            {TOKEN_KEYS.map((k) => (
              <TokenRow
                key={k}
                tokenKey={k}
                value={definition[mode][k]}
                bgKey={CONTRAST_PAIRS[k]}
                map={definition[mode]}
                onChange={(key, val) => updateMode(mode, key, val)}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Typography tab ─────────────────────────────────────────────── */

function TypographyTab({
  typography,
  onChange,
}: {
  typography: ThemeTypography;
  onChange: (t: ThemeTypography) => void;
}) {
  const [uploadingIndex, setUploadingIndex] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function set<K extends keyof ThemeTypography>(key: K, value: ThemeTypography[K]) {
    onChange({ ...typography, [key]: value });
  }

  function setFont(key: "display" | "sans" | "bangla", value: string) {
    set(key, value);
  }

  function addCustomFont() {
    onChange({ ...typography, customFonts: [...typography.customFonts, { family: "", url: "", weight: "400", style: "normal" }] });
  }

  function updateCustomFont(i: number, partial: Partial<CustomFont>) {
    const next = typography.customFonts.map((f, idx) => (idx === i ? { ...f, ...partial } : f));
    set("customFonts", next);
  }

  function removeCustomFont(i: number) {
    set("customFonts", typography.customFonts.filter((_, idx) => idx !== i));
  }

  async function uploadFont(i: number, file: File) {
    setUploadingIndex(i);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("folder", "fonts");
      const res = await fetch("/api/admin/media/upload", { method: "POST", body: fd });
      if (!res.ok) throw new Error("Upload failed.");
      const data = (await res.json()) as { url?: string };
      if (data.url) updateCustomFont(i, { url: data.url });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setUploadingIndex(null);
    }
  }

  // Build Google Fonts link tag for preview fonts
  const previewFonts = [typography.display, typography.sans].filter(Boolean).join("&family=");
  const gfLink = previewFonts ? `https://fonts.googleapis.com/css2?family=${encodeURIComponent(typography.display).replace(/%20/g, "+")}&family=${encodeURIComponent(typography.sans).replace(/%20/g, "+")}` : null;

  return (
    <div className="space-y-5">
      {gfLink && <link rel="stylesheet" href={gfLink} />}

      <div className="card p-4 space-y-4">
        <p className="text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-muted">Font families</p>
        {(["display", "sans", "bangla"] as const).map((key) => (
          <div key={key}>
            <label className="mb-1 block text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-muted">
              {key === "display" ? "Display / serif" : key === "sans" ? "Sans-serif" : "Bangla"}
            </label>
            <input
              type="text"
              value={typography[key]}
              onChange={(e) => setFont(key, e.target.value)}
              list={`font-list-${key}`}
              className="field-box"
              placeholder="Font family name…"
            />
            <datalist id={`font-list-${key}`}>
              {POPULAR_FONTS.map((f) => <option key={f} value={f} />)}
            </datalist>
            {typography[key] && (
              <p
                className="mt-2 text-base text-muted"
                style={{ fontFamily: `'${typography[key]}', serif` }}
              >
                The quick brown fox jumps over the lazy dog — 0123456789
              </p>
            )}
          </div>
        ))}

        <div>
          <label className="mb-1 block text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-muted">
            Scale — {typography.scale.toFixed(2)}×
          </label>
          <input
            type="range"
            min={0.7}
            max={1.5}
            step={0.05}
            value={typography.scale}
            onChange={(e) => set("scale", Number(e.target.value))}
            className="w-full accent-[rgb(var(--c-oxide))]"
          />
          <p className="mt-1 text-xs text-muted">Multiplies display heading sizes. 1.0 is the default; below 1.0 is more restrained.</p>
        </div>
      </div>

      <div className="card p-4">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-muted">Custom fonts</p>
          <button type="button" onClick={addCustomFont} className="btn-outline px-3 py-1.5 text-[0.65rem]">
            Add font
          </button>
        </div>
        {typography.customFonts.length === 0 ? (
          <p className="text-sm text-muted">No custom fonts. Upload .woff2/.ttf files or paste a direct URL.</p>
        ) : (
          <div className="space-y-4">
            {typography.customFonts.map((font, i) => (
              <div key={i} className="grid gap-2 rounded border border-line/60 p-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-muted">Family name</label>
                  <input
                    type="text"
                    value={font.family}
                    onChange={(e) => updateCustomFont(i, { family: e.target.value })}
                    className="field-box"
                    placeholder="MyBrandFont"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-muted">URL or file</label>
                  <div className="flex gap-1">
                    <input
                      type="text"
                      value={font.url}
                      onChange={(e) => updateCustomFont(i, { url: e.target.value })}
                      className="field-box flex-1"
                      placeholder="https://…/font.woff2"
                    />
                    <label className="btn-outline flex h-10 cursor-pointer items-center px-2 text-xs" title="Upload font file">
                      {uploadingIndex === i ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "↑"}
                      <input
                        type="file"
                        accept=".woff2,.woff,.ttf,.otf"
                        className="sr-only"
                        onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadFont(i, f); }}
                      />
                    </label>
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-muted">Weight</label>
                  <input
                    type="text"
                    value={font.weight ?? "400"}
                    onChange={(e) => updateCustomFont(i, { weight: e.target.value })}
                    className="field-box"
                    placeholder="400 or 100 900"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-muted">Style</label>
                  <select
                    value={font.style ?? "normal"}
                    onChange={(e) => updateCustomFont(i, { style: e.target.value as "normal" | "italic" })}
                    className="field-box pr-8"
                  >
                    <option value="normal">Normal</option>
                    <option value="italic">Italic</option>
                  </select>
                </div>
                <div className="col-span-full flex justify-end">
                  <button type="button" onClick={() => removeCustomFont(i)} className="btn-outline px-3 py-1.5 text-[0.65rem] text-danger hover:border-danger">
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
        <p className="mt-2 text-xs text-muted">Custom fonts are injected as @font-face rules. Use them in the Custom CSS tab or they will override font-family values in the theme.</p>
      </div>
    </div>
  );
}

/* ─── Layout tab ─────────────────────────────────────────────────── */

type SegmentedProps<T extends string> = {
  label: string;
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
};

function Segmented<T extends string>({ label, options, value, onChange }: SegmentedProps<T>) {
  return (
    <div>
      <p className="mb-1.5 text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-muted">{label}</p>
      <div className="flex flex-wrap gap-1">
        {options.map((o) => (
          <button
            key={o}
            type="button"
            onClick={() => onChange(o)}
            className={cn(
              "border px-3 py-1.5 text-xs capitalize transition",
              value === o ? "border-ink bg-ink text-paper" : "border-line text-muted hover:border-ink hover:text-ink",
            )}
          >
            {o}
          </button>
        ))}
      </div>
    </div>
  );
}

function LayoutTab({
  layout,
  onChange,
}: {
  layout: ThemeLayout;
  onChange: (l: ThemeLayout) => void;
}) {
  function set<K extends keyof ThemeLayout>(key: K, value: ThemeLayout[K]) {
    onChange({ ...layout, [key]: value });
  }

  return (
    <div className="space-y-5">
      <div className="card p-4 space-y-4">
        <p className="text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-muted">Structure</p>
        <Segmented label="Header style" options={HEADER_STYLES} value={layout.header} onChange={(v) => set("header", v)} />
        <Segmented label="Navigation menu" options={MENU_STYLES} value={layout.menu} onChange={(v) => set("menu", v)} />
        <Segmented label="Footer style" options={FOOTER_STYLES} value={layout.footer} onChange={(v) => set("footer", v)} />
        <Segmented label="Content container" options={CONTAINERS} value={layout.container} onChange={(v) => set("container", v)} />
      </div>

      <div className="card p-4 space-y-4">
        <p className="text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-muted">Products</p>
        <div>
          <p className="mb-1.5 text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-muted">Product grid columns</p>
          <div className="flex gap-1">
            {([2, 3, 4] as const).map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => set("productGrid", n)}
                className={cn(
                  "border px-3 py-1.5 text-xs transition",
                  layout.productGrid === n ? "border-ink bg-ink text-paper" : "border-line text-muted hover:border-ink hover:text-ink",
                )}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
        <Segmented label="Card style" options={CARD_STYLES} value={layout.cardStyle} onChange={(v) => set("cardStyle", v)} />
      </div>

      <div className="card p-4 space-y-4">
        <p className="text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-muted">Details</p>
        <Segmented label="Button shape" options={BUTTON_STYLES} value={layout.buttonStyle} onChange={(v) => set("buttonStyle", v)} />
        <div>
          <p className="mb-1.5 text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-muted">Corner radius — {layout.radius}px</p>
          <input
            type="range"
            min={0}
            max={24}
            step={1}
            value={layout.radius}
            onChange={(e) => set("radius", Number(e.target.value))}
            className="w-full accent-[rgb(var(--c-oxide))]"
          />
        </div>
        <Segmented label="Motion" options={MOTION_LEVELS} value={layout.motion} onChange={(v) => set("motion", v)} />
        <Segmented label="Density" options={DENSITIES} value={layout.density} onChange={(v) => set("density", v)} />
        <div className="flex flex-wrap gap-4 pt-1">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={layout.grain}
              onChange={(e) => set("grain", e.target.checked)}
              className="h-4 w-4 accent-[rgb(var(--c-oxide))]"
            />
            Film-grain overlay on dark surfaces
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={layout.uppercaseEyebrows}
              onChange={(e) => set("uppercaseEyebrows", e.target.checked)}
              className="h-4 w-4 accent-[rgb(var(--c-oxide))]"
            />
            Uppercase eyebrow labels
          </label>
        </div>
      </div>
    </div>
  );
}

/* ─── CSS tab ────────────────────────────────────────────────────── */

function CssTab({ css, onChange }: { css: string; onChange: (v: string) => void }) {
  const maxLen = 20_000;
  const len = css.length;
  return (
    <div className="card p-4">
      <p className="mb-1 text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-muted">Custom CSS</p>
      <p className="mb-3 text-xs text-muted">
        Applied after the theme tokens. Use <code className="font-mono text-[0.7rem]">rgb(var(--c-ink))</code> etc. to reference token colours.
        Maximum {maxLen.toLocaleString()} characters.
      </p>
      <textarea
        value={css}
        onChange={(e) => onChange(e.target.value.slice(0, maxLen))}
        rows={20}
        className="field-box min-h-[340px] resize-y font-mono text-xs"
        placeholder="/* e.g.: .product-card { box-shadow: none; } */"
        spellCheck={false}
      />
      <p className={cn("mt-1 text-right text-xs", len > maxLen * 0.9 ? "text-warning" : "text-muted")}>
        {len.toLocaleString()} / {maxLen.toLocaleString()}
      </p>
    </div>
  );
}

/* ─── Preview tab ────────────────────────────────────────────────── */

type DeviceWidth = 390 | 820 | 1440;

function PreviewTab({ themeId, hasUnsaved }: { themeId: string | null; hasUnsaved: boolean }) {
  const [width, setWidth] = useState<DeviceWidth>(1440);
  const [mode, setMode] = useState<"light" | "dark" | "black">("light");
  const [key, setKey] = useState(0);

  const previewUrl = themeId
    ? `/en/?theme_preview=${encodeURIComponent(themeId)}&mode=${mode}`
    : null;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1 border border-line rounded">
          {([390, 820, 1440] as DeviceWidth[]).map((w) => (
            <button
              key={w}
              type="button"
              onClick={() => setWidth(w)}
              title={`${w}px`}
              className={cn("flex items-center gap-1 px-3 py-1.5 text-[0.65rem] transition", width === w ? "bg-ink text-paper" : "text-muted hover:text-ink")}
            >
              {w === 390 ? <Smartphone className="h-3 w-3" /> : w === 820 ? <Tablet className="h-3 w-3" /> : <Monitor className="h-3 w-3" />}
              {w}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1 border border-line rounded">
          {(["light", "dark", "black"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={cn("px-3 py-1.5 text-[0.65rem] capitalize transition", mode === m ? "bg-ink text-paper" : "text-muted hover:text-ink")}
            >
              {m}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setKey((k) => k + 1)}
          className="btn-outline inline-flex items-center gap-1.5 px-3 py-1.5 text-[0.65rem]"
        >
          <RefreshCw className="h-3 w-3" />
          Reload
        </button>
        {hasUnsaved && (
          <span className="text-xs text-warning">Unsaved changes — save to update the preview.</span>
        )}
      </div>
      {!themeId ? (
        <div className="flex h-64 items-center justify-center rounded border border-line bg-bone text-sm text-muted">
          Save the theme first to enable the preview.
        </div>
      ) : (
        <div className="overflow-hidden rounded border border-line bg-bone" style={{ height: "70vh" }}>
          <div style={{ width: "100%", height: "100%", display: "flex", justifyContent: "center", alignItems: "flex-start", overflow: "auto" }}>
            <iframe
              key={key}
              src={previewUrl ?? ""}
              style={{ width, minWidth: width, height: "100%", border: "none", display: "block" }}
              title="Theme preview"
            />
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   ThemeEditor — main export
   ═══════════════════════════════════════════════════════════════════ */

type Tab = "colours" | "typography" | "layout" | "css" | "preview";

export function ThemeEditor({
  initialDefinition,
  csrf,
  themeId,
}: {
  initialDefinition: ThemeDefinition;
  csrf: string;
  themeId: string | null;
}) {
  const router = useRouter();
  const [def, setDef] = useState<ThemeDefinition>(initialDefinition);
  const [tab, setTab] = useState<Tab>("colours");
  const [hasUnsaved, setHasUnsaved] = useState(false);

  const [saveState, saveAction] = useActionState(saveThemeAction, idleState);
  const [applyState, applyAction] = useActionState(applyThemeAction, idleState);
  const [deleteState, deleteAction] = useActionState(deleteThemeAction, idleState);

  const currentId = useRef<string | null>(themeId);

  useEffect(() => {
    if (saveState.error) toast.error(saveState.error);
    else if (saveState.ok) {
      toast.success(saveState.message ?? "Saved.");
      setHasUnsaved(false);
      if (saveState.data?.id && !currentId.current) {
        currentId.current = saveState.data.id;
        router.push(`/admin/settings/themes/${saveState.data.id}`);
      }
    }
  }, [saveState, router]);

  useEffect(() => {
    if (applyState.error) toast.error(applyState.error);
    else if (applyState.ok && applyState.message) toast.success(applyState.message);
  }, [applyState]);

  useEffect(() => {
    if (deleteState.error) toast.error(deleteState.error);
    else if (deleteState.ok) {
      toast.success(deleteState.message ?? "Deleted.");
      router.push("/admin/settings/themes");
    }
  }, [deleteState, router]);

  function update(partial: Partial<ThemeDefinition>) {
    setDef((d) => ({ ...d, ...partial }));
    setHasUnsaved(true);
  }

  // Build FormData for save action
  function buildSaveFormData(extraField?: { name: string; value: string }) {
    const fd = new FormData();
    fd.append("_csrf", csrf);
    if (themeId) fd.append("id", themeId);
    const payload = {
      name: def.name,
      description: def.description,
      light: def.light,
      dark: def.dark,
      black: def.black,
      typography: def.typography,
      layout: def.layout,
      customCss: def.customCss,
    };
    fd.append("definition", JSON.stringify(payload));
    if (extraField) fd.append(extraField.name, extraField.value);
    return fd;
  }

  async function handleSave() {
    saveAction(buildSaveFormData());
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: "colours", label: "Colours" },
    { key: "typography", label: "Typography" },
    { key: "layout", label: "Layout" },
    { key: "css", label: "Custom CSS" },
    { key: "preview", label: "Preview" },
  ];

  const currentThemeId = themeId ?? currentId.current;

  return (
    <div className="space-y-4">
      {/* Name / description row */}
      <div className="card p-4 grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-muted">Theme name</label>
          <input
            type="text"
            value={def.name}
            onChange={(e) => update({ name: e.target.value })}
            className="field-box"
            placeholder="My custom theme"
            required
            maxLength={120}
          />
        </div>
        <div>
          <label className="mb-1 block text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-muted">Description (optional)</label>
          <input
            type="text"
            value={def.description}
            onChange={(e) => update({ description: e.target.value })}
            className="field-box"
            placeholder="When and why to use this theme…"
            maxLength={500}
          />
        </div>
      </div>

      {/* Action bar */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={!def.name.trim()}
          className="btn inline-flex items-center gap-1.5 px-4 py-2.5 text-[0.65rem]"
        >
          <Save className="h-3.5 w-3.5" />
          {hasUnsaved ? "Save changes" : "Saved"}
        </button>

        {/* Save & apply */}
        {currentThemeId && (
          <form action={applyAction} className="inline">
            <CsrfInput value={csrf} />
            <input type="hidden" name="id" value={currentThemeId} />
            <SubmitButton size="sm" variant="outline" pendingLabel="Applying…">
              Save &amp; apply
            </SubmitButton>
          </form>
        )}

        {/* Export */}
        {currentThemeId && (
          <a
            href={`/api/admin/themes/${currentThemeId}/export`}
            className="btn-outline inline-flex items-center gap-1.5 px-3 py-2.5 text-[0.65rem]"
          >
            <Download className="h-3.5 w-3.5" />
            Export JSON
          </a>
        )}

        {/* Delete */}
        {currentThemeId && (
          <form
            action={deleteAction}
            className="inline"
            onSubmit={(e) => { if (!confirm(`Delete "${def.name}"? This cannot be undone.`)) e.preventDefault(); }}
          >
            <CsrfInput value={csrf} />
            <input type="hidden" name="id" value={currentThemeId} />
            <SubmitButton size="sm" variant="danger" pendingLabel="Deleting…">
              <Trash2 className="h-3.5 w-3.5" />
              Delete
            </SubmitButton>
          </form>
        )}

        <FormBanner state={saveState} />
      </div>

      {/* Tabs */}
      <div className="border-b border-line">
        <div className="flex gap-0 overflow-x-auto">
          {tabs.map((t) => (
            <TabButton key={t.key} active={tab === t.key} onClick={() => setTab(t.key)}>
              {t.label}
            </TabButton>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div>
        {tab === "colours" && (
          <ColourTab definition={def} onChange={update} />
        )}
        {tab === "typography" && (
          <TypographyTab typography={def.typography} onChange={(t) => update({ typography: t })} />
        )}
        {tab === "layout" && (
          <LayoutTab layout={def.layout} onChange={(l) => update({ layout: l })} />
        )}
        {tab === "css" && (
          <CssTab css={def.customCss} onChange={(c) => update({ customCss: c })} />
        )}
        {tab === "preview" && (
          <PreviewTab themeId={currentThemeId} hasUnsaved={hasUnsaved} />
        )}
      </div>
    </div>
  );
}
