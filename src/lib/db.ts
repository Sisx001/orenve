import { PrismaClient } from "@prisma/client";
import { existsSync } from "node:fs";
import path from "node:path";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

/**
 * SQLite portability: Prisma resolves a relative `file:` URL against the
 * directory of the *generated client's* copy of schema.prisma. In a standalone
 * build (Docker, PM2, cPanel) that copy lives under .next/standalone, so the
 * CLI (db push / seed) and the running server would silently point at two
 * different files. We anchor relative paths at the project root instead —
 * the folder that contains prisma/schema.prisma — exactly like the CLI does.
 */
function findProjectRoot(): string {
  let dir = process.cwd();
  for (let i = 0; i < 6; i++) {
    if (existsSync(path.join(dir, "prisma", "schema.prisma"))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return process.cwd();
}

function resolveDatasourceUrl(): string | undefined {
  const url = process.env.DATABASE_URL;
  if (!url || !url.startsWith("file:")) return url;
  const raw = url.slice(5).split("?")[0];
  const query = url.includes("?") ? url.slice(url.indexOf("?")) : "";
  if (path.isAbsolute(raw)) return url;
  const abs = path.resolve(findProjectRoot(), "prisma", raw);
  return `file:${abs}${query}`;
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasourceUrl: resolveDatasourceUrl(),
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;

export type Db = typeof db;
