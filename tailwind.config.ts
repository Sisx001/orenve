import type { Config } from "tailwindcss";

/**
 * ORYNVE design tokens.
 * Colours are CSS variables (see src/app/globals.css) so the owner can retheme
 * from the studio without a rebuild, and dark mode is a data attribute.
 */
const config: Config = {
  darkMode: ["selector", '[data-theme="dark"]'],
  content: ["./src/**/*.{ts,tsx,mdx}"],
  theme: {
    screens: {
      xs: "420px",
      sm: "640px",
      md: "768px",
      lg: "1024px",
      xl: "1280px",
      "2xl": "1536px",
      "3xl": "1920px", // large desktop
      tv: "2560px", // 4K / TV browsers
    },
    extend: {
      colors: {
        ink: "rgb(var(--c-ink) / <alpha-value>)",
        bone: "rgb(var(--c-bone) / <alpha-value>)",
        paper: "rgb(var(--c-paper) / <alpha-value>)",
        line: "rgb(var(--c-line) / <alpha-value>)",
        muted: "rgb(var(--c-muted) / <alpha-value>)",
        oxide: "rgb(var(--c-oxide) / <alpha-value>)",
        brass: "rgb(var(--c-brass) / <alpha-value>)",
        olive: "rgb(var(--c-olive) / <alpha-value>)",
        success: "rgb(var(--c-success) / <alpha-value>)",
        danger: "rgb(var(--c-danger) / <alpha-value>)",
        warning: "rgb(var(--c-warning) / <alpha-value>)",
      },
      fontFamily: {
        display: ["var(--font-display)", "Georgia", "serif"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        bangla: ["var(--font-bangla)", "sans-serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      fontSize: {
        "display-xl": ["clamp(3.5rem, 9vw, 11rem)", { lineHeight: "0.9", letterSpacing: "-0.03em" }],
        "display-lg": ["clamp(2.75rem, 6vw, 7rem)", { lineHeight: "0.95", letterSpacing: "-0.025em" }],
        "display-md": ["clamp(2rem, 4vw, 4.5rem)", { lineHeight: "1", letterSpacing: "-0.02em" }],
        "display-sm": ["clamp(1.5rem, 2.5vw, 2.75rem)", { lineHeight: "1.05", letterSpacing: "-0.01em" }],
        eyebrow: ["0.6875rem", { lineHeight: "1", letterSpacing: "0.18em" }],
      },
      spacing: {
        gutter: "var(--gutter)",
        section: "var(--section-gap)",
      },
      maxWidth: {
        page: "var(--page-max)",
      },
      borderRadius: {
        brand: "var(--radius)",
      },
      transitionTimingFunction: {
        editorial: "cubic-bezier(0.22, 1, 0.36, 1)",
        snap: "cubic-bezier(0.76, 0, 0.24, 1)",
      },
      keyframes: {
        marquee: { from: { transform: "translateX(0)" }, to: { transform: "translateX(-50%)" } },
        rise: { from: { opacity: "0", transform: "translateY(24px)" }, to: { opacity: "1", transform: "translateY(0)" } },
        fade: { from: { opacity: "0" }, to: { opacity: "1" } },
        shimmer: { from: { backgroundPosition: "-200% 0" }, to: { backgroundPosition: "200% 0" } },
        pulseDot: { "0%, 100%": { opacity: "1" }, "50%": { opacity: "0.35" } },
      },
      animation: {
        marquee: "marquee 40s linear infinite",
        rise: "rise 0.8s cubic-bezier(0.22, 1, 0.36, 1) both",
        fade: "fade 0.6s ease both",
        shimmer: "shimmer 1.6s linear infinite",
        pulseDot: "pulseDot 2s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
