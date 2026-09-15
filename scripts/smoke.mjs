/**
 * Post-deploy smoke test: hits the public routes and APIs and reports status.
 *   node scripts/smoke.mjs http://localhost:3000
 * Exits non-zero if any critical check fails.
 */
const base = (process.argv[2] ?? process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");

const checks = [
  ["GET", "/api/health", 200],
  ["GET", "/", [307, 308]],
  ["GET", "/en", 200],
  ["GET", "/bn", 200],
  ["GET", "/en/shop", 200],
  ["GET", "/en/collections", 200],
  ["GET", "/en/track", 200],
  ["GET", "/en/contact", 200],
  ["GET", "/en/about", 200],
  ["GET", "/en/checkout", 200],
  ["GET", "/en/this-page-does-not-exist", 404],
  ["GET", "/brand/og.jpg", 200],
  ["GET", "/sitemap.xml", 200],
  ["GET", "/robots.txt", 200],
  ["GET", "/manifest.webmanifest", 200],
  ["GET", "/admin", [307, 308]], // redirects to login without session
  ["GET", "/admin/login", 200],
  ["GET", "/api/products?all=1", 200],
];

let failed = 0;
for (const [method, path, expected] of checks) {
  const t0 = Date.now();
  try {
    const res = await fetch(base + path, { method, redirect: "manual" });
    const ok = Array.isArray(expected) ? expected.includes(res.status) : res.status === expected;
    console.log(`${ok ? "✔" : "✘"} ${method} ${path} → ${res.status} (${Date.now() - t0}ms)`);
    if (!ok) failed++;
  } catch (e) {
    console.log(`✘ ${method} ${path} → ${e.message}`);
    failed++;
  }
}

// Demo-data API checks (only meaningful when SEED_DEMO_DATA=true)
try {
  const products = await (await fetch(`${base}/api/products?all=1`)).json();
  const first = products.products?.[0] ?? products[0];
  console.log(`ℹ products index: ${products.products?.length ?? products.length ?? "?"} items`);
  const track = await fetch(`${base}/api/track`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reference: "7KQ2MHT9", phone: "01700000000", locale: "en" }) });
  console.log(`${track.status === 200 ? "✔" : "ℹ"} POST /api/track demo order → ${track.status}`);
  if (first?.slug) {
    const p = await fetch(`${base}/en/product/${first.slug}`);
    console.log(`${p.status === 200 ? "✔" : "✘"} GET /en/product/${first.slug} → ${p.status}`);
    if (p.status !== 200) failed++;
  }
} catch (e) {
  console.log(`ℹ demo checks skipped: ${e.message}`);
}

console.log(failed ? `\n${failed} check(s) failed` : "\nAll checks passed");
process.exit(failed ? 1 : 0);
