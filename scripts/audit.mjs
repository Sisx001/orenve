/**
 * Visual + accessibility audit. Screenshots every route in every locale, theme
 * and viewport, and reports: low-contrast text, horizontal overflow,
 * untranslated i18n keys, broken images, console errors, and 4xx/5xx.
 *
 *   node scripts/audit.mjs http://localhost:3000 [--admin-cookie=TOKEN] [--out=audit]
 * Requires: npm i -D playwright && npx playwright install chromium
 */
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const args = Object.fromEntries(process.argv.slice(3).map((a) => a.replace(/^--/, "").split("=")));
const base = (process.argv[2] ?? "http://localhost:3000").replace(/\/$/, "");
const out = path.resolve(args.out ?? "audit");
mkdirSync(out, { recursive: true });

const locales = (args.locales ?? "en,bn").split(",");
const themes = (args.themes ?? "light,dark").split(",");
const viewports = { mobile: { width: 390, height: 844 }, tablet: { width: 820, height: 1180 }, desktop: { width: 1440, height: 900 } };
const storeRoutes = ["/", "/shop", "/collections", "/collections/the-first-expression", "/product/the-form-overcoat", "/lookbook", "/about", "/contact", "/track", "/checkout", "/wishlist", "/order/7KQ2MHT9", "/faq", "/this-does-not-exist"];
const adminRoutes = ["/admin/login", "/admin", "/admin/orders", "/admin/orders/new", "/admin/products", "/admin/products/new", "/admin/inventory", "/admin/customers", "/admin/coupons", "/admin/shipping", "/admin/catalog", "/admin/homepage", "/admin/pages", "/admin/media", "/admin/reviews", "/admin/messages", "/admin/concierge", "/admin/profile", "/admin/settings/brand", "/admin/settings/features", "/admin/settings/checkout", "/admin/settings/couriers", "/admin/settings/address", "/admin/settings/languages", "/admin/concierge/test", "/admin/concierge/requests", "/admin/settings/currency", "/admin/settings/seo", "/admin/settings/site", "/admin/settings/contact", "/admin/settings/ai", "/admin/settings/translations", "/admin/users", "/admin/audit", "/admin/backups"];

const findings = [];
const add = (f) => findings.push(f);

const inPageAudit = () => {
  const lum = (r, g, b) => {
    const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const parse = (s) => { const m = s.match(/rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)/); return m ? [+m[1], +m[2], +m[3], m[4] === undefined ? 1 : +m[4]] : null; };
  const bgOf = (el) => {
    let e = el;
    while (e && e !== document.documentElement) {
      const cs = getComputedStyle(e);
      const bg = parse(cs.backgroundColor);
      if (bg && bg[3] > 0.6) return bg;
      if (cs.backgroundImage && cs.backgroundImage !== "none") return null; // image behind → skip
      e = e.parentElement;
    }
    const root = parse(getComputedStyle(document.body).backgroundColor);
    return root && root[3] > 0 ? root : [255, 255, 255, 1];
  };
  const results = { lowContrast: [], untranslated: [], overflow: document.documentElement.scrollWidth > window.innerWidth + 1, brokenImages: [], emptyAlt: 0 };
  const seen = new Set();
  for (const el of document.querySelectorAll("body *")) {
    const cs = getComputedStyle(el);
    if (cs.visibility === "hidden" || cs.display === "none" || +cs.opacity === 0) continue;
    const text = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent.trim()).join(" ").trim();
    if (!text) continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0 || r.bottom < 0 || r.top > document.documentElement.scrollHeight) continue;
    if (el.closest("[aria-hidden=\"true\"], [aria-hidden=\"\"]")) continue;
    // Text layered over media (image/video/background-image) — the page bg is not its backdrop.
    let onMedia = Boolean(el.closest("[data-media], .on-media"));
    for (let a = el.parentElement, i = 0; a && i < 6; a = a.parentElement, i++) {
      if (a.querySelector(":scope > img, :scope > picture, :scope > video, :scope > .on-media, :scope > [data-media]") || getComputedStyle(a).backgroundImage !== "none") { onMedia = true; break; }
    }
    if (onMedia) continue;
    if (/^[a-z]+(\.[a-zA-Z0-9_]+)+$/.test(text) && text.length < 60 && !el.closest("code, kbd, pre, .font-mono") && !/\.(com|bd|net|org|io|dev|app|co|json)$/.test(text)) results.untranslated.push(text);
    const fg = parse(cs.color);
    const bg = bgOf(el);
    if (!fg || !bg || fg[3] < 0.5) continue;
    const l1 = lum(...fg), l2 = lum(...bg);
    const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
    const large = parseFloat(cs.fontSize) >= 24 || (parseFloat(cs.fontSize) >= 18.66 && +cs.fontWeight >= 700);
    const min = large ? 3 : 4.5;
    if (ratio < min) {
      const key = `${text.slice(0, 40)}|${cs.color}|${bg.join(",")}`;
      if (seen.has(key)) continue;
      seen.add(key);
      results.lowContrast.push({ text: text.slice(0, 60), ratio: +ratio.toFixed(2), color: cs.color, bg: `rgb(${bg.slice(0, 3).join(",")})`, tag: el.tagName.toLowerCase(), cls: (el.className || "").toString().slice(0, 80) });
    }
  }
  for (const img of document.images) {
    if (img.complete && img.naturalWidth === 0 && img.src) results.brokenImages.push(img.src.slice(0, 120));
    if (!img.hasAttribute("alt") && !img.getAttribute("aria-hidden") && !img.closest("[aria-hidden]")) results.emptyAlt++;
  }
  return results;
};

const browser = await chromium.launch();
try {
  for (const [vpName, vp] of Object.entries(viewports)) {
    for (const theme of themes) {
      for (const locale of locales) {
        const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: 1, locale: locale === "bn" ? "bn-BD" : "en-GB", reducedMotion: "reduce" });
        await ctx.addCookies([
          { name: "ory_theme", value: theme, url: base },
          { name: "ory_locale", value: locale, url: base },
          ...(args["admin-cookie"] ? [{ name: "ory_session", value: args["admin-cookie"], url: base }] : []),
        ]);
        await ctx.addInitScript(() => { try { sessionStorage.setItem("orynve-intro-seen", "1"); sessionStorage.setItem("orynve.intro.v2", "1"); } catch {} });
        const page = await ctx.newPage();
        const consoleErrors = [];
        let currentRoute = "";
        page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource/.test(m.text())) consoleErrors.push(m.text().slice(0, 200)); });
        page.on("response", (res) => { if (res.status() >= 400 && !res.url().replace(base, "").split("?")[0].replace(/\/$/, "").endsWith(currentRoute)) consoleErrors.push(`${res.status()} ${res.url().replace(base, "").slice(0, 160)}`); });
        page.on("pageerror", (e) => consoleErrors.push(`pageerror: ${e.message.slice(0, 200)}`));

        const routes = [...storeRoutes.map((r) => `/${locale}${r === "/" ? "" : r}`), ...(vpName === "desktop" && locale === "en" ? adminRoutes : [])];
        for (const route of routes) {
          currentRoute = route;
          consoleErrors.length = 0;
          const url = base + route;
          let status = 0;
          try {
            const res = await page.goto(url, { waitUntil: "networkidle", timeout: 45000 });
            status = res?.status() ?? 0;
          } catch (e) {
            add({ route, locale, theme, vp: vpName, type: "navigation", detail: e.message.slice(0, 200) });
            continue;
          }
          // Walk the page so scroll-triggered reveals fire before we measure.
          await page.evaluate(async () => {
            const h = document.documentElement.scrollHeight;
            for (let y = 0; y < h; y += 600) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 60)); }
            window.scrollTo(0, 0);
          });
          await page.waitForTimeout(700);
          const name = `${vpName}_${theme}_${locale}_${route.replace(/[^a-z0-9]+/gi, "_").replace(/^_|_$/g, "") || "home"}.png`;
          await page.screenshot({ path: path.join(out, name), fullPage: true }).catch(() => {});
          const r = await page.evaluate(inPageAudit).catch(() => null);
          const expected404 = route.includes("this-does-not-exist");
          if ((status >= 400 && !expected404) || (expected404 && status !== 404)) add({ route, locale, theme, vp: vpName, type: "status", detail: String(status) });
          if (r) {
            for (const lc of r.lowContrast.slice(0, 25)) add({ route, locale, theme, vp: vpName, type: "contrast", detail: `${lc.ratio}:1 "${lc.text}" ${lc.color} on ${lc.bg} <${lc.tag} class="${lc.cls}">` });
            for (const u of [...new Set(r.untranslated)]) add({ route, locale, theme, vp: vpName, type: "untranslated", detail: u });
            if (r.overflow) add({ route, locale, theme, vp: vpName, type: "overflow", detail: "horizontal scroll" });
            for (const b of r.brokenImages) add({ route, locale, theme, vp: vpName, type: "broken-image", detail: b });
            if (r.emptyAlt) add({ route, locale, theme, vp: vpName, type: "a11y", detail: `${r.emptyAlt} images without alt` });
          }
          for (const c of [...new Set(consoleErrors)]) add({ route, locale, theme, vp: vpName, type: "console", detail: c });
          process.stdout.write(`${status} ${vpName.padEnd(7)} ${theme.padEnd(5)} ${locale} ${route}\n`);
        }
        await ctx.close();
      }
    }
  }
} finally {
  await browser.close();
}

writeFileSync(path.join(out, "findings.json"), JSON.stringify(findings, null, 2));
const byType = findings.reduce((a, f) => ((a[f.type] = (a[f.type] ?? 0) + 1), a), {});
const md = [`# Visual audit — ${new Date().toISOString()}`, "", `Total findings: ${findings.length}`, ...Object.entries(byType).map(([k, v]) => `- ${k}: ${v}`), "", "| Type | Route | Locale | Theme | Viewport | Detail |", "|---|---|---|---|---|---|", ...findings.map((f) => `| ${f.type} | ${f.route} | ${f.locale} | ${f.theme} | ${f.vp} | ${f.detail.replace(/\|/g, "\\|")} |`)];
writeFileSync(path.join(out, "AUDIT.md"), md.join("\n"));
console.log(`\n${findings.length} findings → ${out}/AUDIT.md`);
console.log(byType);
