import type { NextConfig } from "next";

/**
 * ORYNVE — Next.js configuration.
 *
 * DEPLOY_TARGET controls the output mode:
 *   - "standalone" (default; Docker / Railway / PM2): self-contained .next/standalone
 *   - "server": classic `next start` (cPanel Passenger, shared hosts, simple VPS)
 *   - "vercel": let Vercel manage the build output
 */
const target = process.env.DEPLOY_TARGET ?? "standalone";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(self)" },
  { key: "X-DNS-Prefetch-Control", value: "on" },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' https://js.stripe.com https://checkout.stripe.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' data: https://fonts.gstatic.com",
      "img-src 'self' data: blob: https:",
      "media-src 'self' blob: https:",
      "connect-src 'self' https://api.stripe.com https://*.sslcommerz.com",
      "frame-src 'self' https://js.stripe.com https://checkout.stripe.com https://*.sslcommerz.com https://www.google.com https://maps.google.com https://www.youtube-nocookie.com https://player.vimeo.com",
      "frame-ancestors 'self'",
      "base-uri 'self'",
      "form-action 'self' https://*.sslcommerz.com https://checkout.stripe.com",
      "object-src 'none'",
      "upgrade-insecure-requests",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  output: target === "standalone" ? "standalone" : undefined,
  reactStrictMode: true,
  poweredByHeader: false,
  compress: true,
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [{ protocol: "https", hostname: "**" }],
    // Shared hosts without sharp can set IMAGE_UNOPTIMIZED=true.
    unoptimized: process.env.IMAGE_UNOPTIMIZED === "true",
  },
  experimental: {
    serverActions: { bodySizeLimit: "35mb" },
  },
  serverExternalPackages: ["sharp", "@prisma/client"],
  async headers() {
    if (process.env.NODE_ENV !== "production") return [];
    return [
      { source: "/(.*)", headers: securityHeaders },
      {
        source: "/uploads/(.*)",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
    ];
  },
};

export default nextConfig;
