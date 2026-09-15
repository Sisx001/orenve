/**
 * After `next build` with output: "standalone", Next.js expects `public/` and
 * `.next/static` to live inside `.next/standalone`. This copies them so
 * `npm run start:standalone` (PM2, plain VPS) works without manual steps, and
 * links `prisma/` into the bundle so the SQLite file and schema are shared with
 * the CLI. No-op for other DEPLOY_TARGET values.
 */
import { cpSync, existsSync, mkdirSync, symlinkSync, rmSync, lstatSync } from "node:fs";
import { resolve, relative } from "node:path";

const root = process.cwd();
const standalone = resolve(root, ".next/standalone");
if ((process.env.DEPLOY_TARGET ?? "standalone") !== "standalone" || !existsSync(standalone)) {
  process.exit(0);
}

const pairs = [
  [resolve(root, "public"), resolve(standalone, "public")],
  [resolve(root, ".next/static"), resolve(standalone, ".next/static")],
];
for (const [from, to] of pairs) {
  if (!existsSync(from)) continue;
  mkdirSync(to, { recursive: true });
  cpSync(from, to, { recursive: true, force: true, filter: (src) => !src.includes("/public/uploads/") || src.endsWith(".gitkeep") });
}

// prisma/ → symlink (copy on platforms without symlink support) so schema + sqlite data are shared
const prismaSrc = resolve(root, "prisma");
const prismaDst = resolve(standalone, "prisma");
if (existsSync(prismaSrc)) {
  try {
    if (existsSync(prismaDst) || safeLstat(prismaDst)) rmSync(prismaDst, { recursive: true, force: true });
    symlinkSync(relative(standalone, prismaSrc), prismaDst, "dir");
  } catch {
    cpSync(prismaSrc, prismaDst, { recursive: true, force: true, filter: (src) => !/\/data\//.test(src) });
  }
}

function safeLstat(p) {
  try {
    return lstatSync(p);
  } catch {
    return null;
  }
}

console.log("[postbuild] standalone bundle prepared (public, .next/static, prisma)");
