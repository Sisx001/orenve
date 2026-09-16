import { NextResponse, type NextRequest } from "next/server";
import { COOKIE_CSRF, COOKIE_LOCALE, COOKIE_SESSION, DEFAULT_LOCALE, LOCALE_SEGMENT_RE, SUPPORTED_LOCALES } from "@/lib/constants";
import { looksLikeCsrfToken, mintCsrfTokenEdge } from "@/lib/auth/csrf-edge";

const PUBLIC_FILE = /\.(.*)$/;
const LOCALES = SUPPORTED_LOCALES as readonly string[];

function pickLocale(req: NextRequest): string {
  // The cookie is set by the [locale] layout only for registered languages, so any well-formed value is trusted here.
  const cookie = req.cookies.get(COOKIE_LOCALE)?.value;
  if (cookie && LOCALE_SEGMENT_RE.test(cookie)) return cookie;
  const header = req.headers.get("accept-language") ?? "";
  for (const part of header.split(",")) {
    const code = part.split(";")[0].trim().toLowerCase().split("-")[0];
    if (LOCALES.includes(code)) return code;
  }
  return DEFAULT_LOCALE;
}

/** Guarantee the double-submit CSRF cookie exists on every HTML response. */
async function withCsrf(req: NextRequest, res: NextResponse): Promise<NextResponse> {
  if (looksLikeCsrfToken(req.cookies.get(COOKIE_CSRF)?.value)) return res;
  const token = await mintCsrfTokenEdge(process.env.SESSION_SECRET ?? "dev-secret-change-me");
  res.cookies.set(COOKIE_CSRF, token, {
    httpOnly: false,
    sameSite: "lax",
    secure: (process.env.APP_URL ?? "").startsWith("https://"),
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  return res;
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Admin: cheap cookie presence check (full verification happens server-side).
  if (pathname.startsWith("/admin")) {
    const isLogin = pathname === "/admin/login";
    const hasSession = Boolean(req.cookies.get(COOKIE_SESSION)?.value);
    if (!hasSession && !isLogin) {
      const url = req.nextUrl.clone();
      url.pathname = "/admin/login";
      url.searchParams.set("next", pathname);
      return withCsrf(req, NextResponse.redirect(url));
    }
    const res = NextResponse.next();
    res.headers.set("X-Robots-Tag", "noindex, nofollow");
    return withCsrf(req, res);
  }

  // Skip API, Next internals and static files.
  if (pathname.startsWith("/api") || pathname.startsWith("/_next") || pathname === "/uploads" || pathname.startsWith("/uploads/") || PUBLIC_FILE.test(pathname)) {
    return NextResponse.next();
  }

  // Any plausible locale segment passes; src/app/[locale]/layout.tsx 404s unknown languages.
  const first = pathname.split("/")[1];
  if (LOCALES.includes(first) || LOCALE_SEGMENT_RE.test(first)) {
    const res = NextResponse.next();
    // Only built-in codes are remembered here; the [locale] layout sets the cookie for
    // registered extra languages after validating them, so an unknown /xx never sticks.
    if (LOCALES.includes(first) && req.cookies.get(COOKIE_LOCALE)?.value !== first) {
      res.cookies.set(COOKIE_LOCALE, first, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
    }
    return withCsrf(req, res);
  }

  // No locale prefix → redirect to the detected locale, preserving path & query.
  const locale = pickLocale(req);
  const url = req.nextUrl.clone();
  url.pathname = `/${locale}${pathname === "/" ? "" : pathname}`;
  return withCsrf(req, NextResponse.redirect(url, 307));
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|robots.txt|sitemap.xml|manifest.webmanifest|sw.js).*)"],
};
