/**
 * Prisma needs the datasource provider fixed in schema.prisma, but ORYNVE
 * supports SQLite, PostgreSQL and MySQL from one codebase. This script rewrites
 * the provider line from DATABASE_PROVIDER (or infers it from DATABASE_URL)
 * before `prisma generate` / `db push` / `migrate`.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

// Load .env manually (no dotenv dependency) if present and vars are missing.
const envPath = resolve(root, ".env");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined) {
      process.env[m[1]] = m[2].replace(/^"(.*)"$/, "$1").replace(/^'(.*)'$/, "$1");
    }
  }
}

const url = process.env.DATABASE_URL ?? "file:./data/orynve.db";
let provider = (process.env.DATABASE_PROVIDER ?? "").toLowerCase();
if (!provider) {
  if (url.startsWith("postgres")) provider = "postgresql";
  else if (url.startsWith("mysql")) provider = "mysql";
  else provider = "sqlite";
}
if (provider === "postgres") provider = "postgresql";
if (!["sqlite", "postgresql", "mysql"].includes(provider)) {
  console.error(`[db-provider] Unsupported DATABASE_PROVIDER "${provider}"`);
  process.exit(1);
}

const schemaPath = resolve(root, "prisma/schema.prisma");
const schema = readFileSync(schemaPath, "utf8");
const next = schema.replace(/provider\s*=\s*"(sqlite|postgresql|mysql)"/, `provider = "${provider}"`);
if (next !== schema) {
  writeFileSync(schemaPath, next);
  console.log(`[db-provider] schema.prisma provider set to ${provider}`);
}

if (provider === "sqlite") {
  const file = url.replace(/^file:/, "");
  const dir = dirname(resolve(root, "prisma", file));
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}
