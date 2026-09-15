/**
 * ORYNVE v2 — database backup script
 * Usage: npm run db:backup  (or node scripts/backup.mjs)
 *
 * Behaviour:
 *  - SQLite   → copies the .db file to backups/ with a timestamp
 *  - PostgreSQL → runs pg_dump (must be on PATH) to backups/
 *  - MySQL    → runs mysqldump (must be on PATH) to backups/
 *
 * Keeps the 30 newest backup files and deletes the rest.
 * Prints the path of the newly created backup on stdout.
 */
import { existsSync, mkdirSync, readdirSync, statSync, copyFileSync, unlinkSync } from "node:fs";
import { resolve, dirname, basename, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

// ── Load .env manually (no external deps) ───────────────────────────────────
const envPath = resolve(root, ".env");
if (existsSync(envPath)) {
  const { readFileSync } = await import("node:fs");
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined) {
      process.env[m[1]] = m[2].replace(/^"(.*)"$/, "$1").replace(/^'(.*)'$/, "$1");
    }
  }
}

// ── Determine provider ───────────────────────────────────────────────────────
const url = process.env.DATABASE_URL ?? "file:./data/orynve.db";
let provider = (process.env.DATABASE_PROVIDER ?? "").toLowerCase();
if (!provider) {
  if (url.startsWith("postgres")) provider = "postgresql";
  else if (url.startsWith("mysql")) provider = "mysql";
  else provider = "sqlite";
}
if (provider === "postgres") provider = "postgresql";

// ── Timestamp & backup dir ───────────────────────────────────────────────────
const now = new Date();
const ts = [
  now.getFullYear(),
  String(now.getMonth() + 1).padStart(2, "0"),
  String(now.getDate()).padStart(2, "0"),
  "_",
  String(now.getHours()).padStart(2, "0"),
  String(now.getMinutes()).padStart(2, "0"),
  String(now.getSeconds()).padStart(2, "0"),
].join("");

const backupsDir = resolve(root, "backups");
mkdirSync(backupsDir, { recursive: true });

let outPath;

// ── SQLite ───────────────────────────────────────────────────────────────────
if (provider === "sqlite") {
  const filePart = url.replace(/^file:/, "");
  // The path in DATABASE_URL is relative to the prisma/ directory
  const dbPath = resolve(root, "prisma", filePart);
  if (!existsSync(dbPath)) {
    console.error(`[backup] SQLite file not found: ${dbPath}`);
    process.exit(1);
  }
  outPath = resolve(backupsDir, `orynve_${ts}.db`);
  copyFileSync(dbPath, outPath);
}

// ── PostgreSQL ───────────────────────────────────────────────────────────────
else if (provider === "postgresql") {
  outPath = resolve(backupsDir, `orynve_${ts}.sql`);
  // pg_dump accepts a connection URL directly
  const result = spawnSync("pg_dump", ["--no-password", "-f", outPath, url], {
    stdio: ["ignore", "pipe", "pipe"],
    env: process.env,
  });
  if (result.error) {
    console.error(`[backup] pg_dump not found on PATH — install postgresql-client and try again.`);
    console.error(result.error.message);
    process.exit(1);
  }
  if (result.status !== 0) {
    const stderr = result.stderr?.toString() ?? "";
    console.error(`[backup] pg_dump exited with code ${result.status}: ${stderr}`);
    process.exit(1);
  }
}

// ── MySQL ─────────────────────────────────────────────────────────────────────
else if (provider === "mysql") {
  outPath = resolve(backupsDir, `orynve_${ts}.sql`);
  // Parse the MySQL URL: mysql://user:pass@host:port/dbname
  let mysqlArgs;
  try {
    const u = new URL(url);
    const host = u.hostname;
    const port = u.port || "3306";
    const user = decodeURIComponent(u.username);
    const pass = decodeURIComponent(u.password);
    const dbName = u.pathname.replace(/^\//, "");
    mysqlArgs = [`-h${host}`, `-P${port}`, `-u${user}`, ...(pass ? [`-p${pass}`] : []), "--single-transaction", "--routines", "--result-file", outPath, dbName];
  } catch {
    console.error("[backup] Could not parse DATABASE_URL as a MySQL connection string.");
    process.exit(1);
  }
  const result = spawnSync("mysqldump", mysqlArgs, {
    stdio: ["ignore", "pipe", "pipe"],
    env: process.env,
  });
  if (result.error) {
    console.error(`[backup] mysqldump not found on PATH — install mysql-client and try again.`);
    console.error(result.error.message);
    process.exit(1);
  }
  if (result.status !== 0) {
    const stderr = result.stderr?.toString() ?? "";
    console.error(`[backup] mysqldump exited with code ${result.status}: ${stderr}`);
    process.exit(1);
  }
} else {
  console.error(`[backup] Unsupported DATABASE_PROVIDER: ${provider}`);
  process.exit(1);
}

console.log(`[backup] Created: ${outPath}`);

// ── Prune: keep the 30 newest files ─────────────────────────────────────────
const ext = provider === "sqlite" ? ".db" : ".sql";
const allBackups = readdirSync(backupsDir)
  .filter((f) => extname(f) === ext && f.startsWith("orynve_"))
  .map((f) => ({ name: f, mtime: statSync(resolve(backupsDir, f)).mtimeMs }))
  .sort((a, b) => b.mtime - a.mtime);

const toDelete = allBackups.slice(30);
for (const { name } of toDelete) {
  unlinkSync(resolve(backupsDir, name));
  console.log(`[backup] Pruned: ${name}`);
}

if (toDelete.length === 0) {
  console.log(`[backup] ${allBackups.length} backup(s) retained (max 30).`);
}
