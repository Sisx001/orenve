import { NextResponse, type NextRequest } from "next/server";
import { createReadStream, statSync } from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";

export const runtime = "nodejs";

/**
 * Serves local uploads with HTTP Range support (video seeking on iOS/Safari)
 * for hosts where the static file server doesn't do it (cPanel Passenger,
 * `next start` without a reverse proxy). Nginx/Vercel/Railway can serve
 * /uploads directly; this is the portable fallback at /api/media/<key>.
 */
const UPLOAD_DIR = process.env.UPLOAD_DIR ?? path.join(process.cwd(), "public", "uploads");
const MIME: Record<string, string> = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", avif: "image/avif", gif: "image/gif", svg: "image/svg+xml", mp4: "video/mp4", webm: "video/webm" };

export async function GET(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path: parts } = await ctx.params;
  const rel = parts.join("/");
  if (rel.includes("..") || rel.startsWith("/")) return new NextResponse("Bad path", { status: 400 });
  const full = path.join(UPLOAD_DIR, rel);
  let stat;
  try {
    stat = statSync(full);
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
  const ext = path.extname(full).slice(1).toLowerCase();
  const type = MIME[ext] ?? "application/octet-stream";
  const range = req.headers.get("range");
  const headers: Record<string, string> = { "Content-Type": type, "Accept-Ranges": "bytes", "Cache-Control": "public, max-age=31536000, immutable" };

  if (range) {
    const m = /bytes=(\d*)-(\d*)/.exec(range);
    const start = m && m[1] ? Number(m[1]) : 0;
    const end = m && m[2] ? Math.min(Number(m[2]), stat.size - 1) : Math.min(start + 1024 * 1024 * 2, stat.size - 1);
    if (start >= stat.size) return new NextResponse(null, { status: 416, headers: { "Content-Range": `bytes */${stat.size}` } });
    headers["Content-Range"] = `bytes ${start}-${end}/${stat.size}`;
    headers["Content-Length"] = String(end - start + 1);
    const stream = Readable.toWeb(createReadStream(full, { start, end })) as ReadableStream;
    return new NextResponse(stream, { status: 206, headers });
  }
  headers["Content-Length"] = String(stat.size);
  const stream = Readable.toWeb(createReadStream(full)) as ReadableStream;
  return new NextResponse(stream, { status: 200, headers });
}
