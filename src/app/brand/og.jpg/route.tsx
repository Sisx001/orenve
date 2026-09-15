import { ImageResponse } from "next/og";
import { getSetting } from "@/lib/settings";
import { i18nText } from "@/lib/json";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Default social share image, rendered from the brand settings so it always
 * matches the wordmark, accent colour and tagline set in the studio.
 * Referenced as /brand/og.jpg (metadata) — no binary asset needs to be committed.
 */
export async function GET() {
  const brand = await getSetting("brand");
  const name = (brand.name || "ORYNVE").toUpperCase();
  const tagline = i18nText(brand.tagline, "en");
  const accent = brand.accent || "#c2542b";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px 80px",
          background: "#0e0f0c",
          color: "#f3efe6",
          fontFamily: "serif",
          position: "relative",
        }}
      >
        {/* cut ring monogram */}
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <svg width="64" height="64" viewBox="0 0 64 64" fill="none" stroke="#f3efe6" strokeWidth="5.5" strokeLinecap="square">
            <path d="M46.5 14.5A22 22 0 1 0 51 42" />
            <path d="M38 50L58 10" stroke={accent} />
          </svg>
          <div style={{ fontSize: 22, letterSpacing: 6, opacity: 0.7, fontFamily: "sans-serif" }}>COLLECTION 001 / THE FIRST EXPRESSION</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 176, letterSpacing: 14, lineHeight: 0.9, fontWeight: 400 }}>{name}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 20, marginTop: 28 }}>
            <div style={{ width: 96, height: 3, background: accent }} />
            <div style={{ fontSize: 34, fontStyle: "italic", opacity: 0.9 }}>{tagline}</div>
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 20, letterSpacing: 5, opacity: 0.6, fontFamily: "sans-serif" }}>
          <span>INDEPENDENT IN SPIRIT · CONSIDERED BY DESIGN</span>
          <span>DHAKA · EST. MMXXVI</span>
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
