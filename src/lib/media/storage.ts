import "server-only";
import { mkdir, writeFile, unlink } from "node:fs/promises";
import path from "node:path";
import { randomBytes } from "node:crypto";

/**
 * Media storage adapters. Choose with MEDIA_STORAGE=local|s3.
 *  - local: writes under public/uploads (VPS, Railway volume, cPanel)
 *  - s3:    any S3-compatible bucket (AWS, Cloudflare R2, MinIO, Spaces) — use on Vercel
 */
export interface StorageAdapter {
  name: "local" | "s3";
  put(buffer: Buffer, opts: { mime: string; ext: string; folder?: string }): Promise<{ key: string; url: string }>;
  remove(key: string): Promise<void>;
}

const UPLOAD_DIR = process.env.UPLOAD_DIR ?? path.join(process.cwd(), "public", "uploads");

function keyFor(folder: string | undefined, ext: string) {
  const d = new Date();
  const id = randomBytes(8).toString("hex");
  return `${folder ? folder.replace(/[^a-z0-9_-]/gi, "") + "/" : ""}${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${id}.${ext}`;
}

const local: StorageAdapter = {
  name: "local",
  async put(buffer, { ext, folder }) {
    const key = keyFor(folder, ext);
    const full = path.join(UPLOAD_DIR, key);
    await mkdir(path.dirname(full), { recursive: true });
    await writeFile(full, buffer);
    return { key, url: `/uploads/${key}` };
  },
  async remove(key) {
    await unlink(path.join(UPLOAD_DIR, key)).catch(() => {});
  },
};

let s3Client: import("@aws-sdk/client-s3").S3Client | null = null;
async function s3(): Promise<import("@aws-sdk/client-s3").S3Client> {
  if (s3Client) return s3Client;
  const { S3Client } = await import("@aws-sdk/client-s3");
  s3Client = new S3Client({
    region: process.env.S3_REGION ?? "auto",
    endpoint: process.env.S3_ENDPOINT || undefined,
    forcePathStyle: !!process.env.S3_ENDPOINT,
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID ?? "",
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? "",
    },
  });
  return s3Client;
}

const s3Adapter: StorageAdapter = {
  name: "s3",
  async put(buffer, { mime, ext, folder }) {
    const { PutObjectCommand } = await import("@aws-sdk/client-s3");
    const key = keyFor(folder, ext);
    await (await s3()).send(
      new PutObjectCommand({
        Bucket: process.env.S3_BUCKET,
        Key: key,
        Body: buffer,
        ContentType: mime,
        CacheControl: "public, max-age=31536000, immutable",
      }),
    );
    const base = (process.env.S3_PUBLIC_URL ?? "").replace(/\/$/, "");
    return { key, url: `${base}/${key}` };
  },
  async remove(key) {
    const { DeleteObjectCommand } = await import("@aws-sdk/client-s3");
    await (await s3()).send(new DeleteObjectCommand({ Bucket: process.env.S3_BUCKET, Key: key })).catch(() => {});
  },
};

export function getStorage(): StorageAdapter {
  return (process.env.MEDIA_STORAGE ?? "local") === "s3" ? s3Adapter : local;
}

export const ALLOWED_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
  "image/gif": "gif",
  "image/svg+xml": "svg",
  "video/mp4": "mp4",
  "video/webm": "webm",
};
export const MAX_UPLOAD_BYTES = 30 * 1024 * 1024;

/** Magic-byte sniffing so a renamed .exe can't masquerade as an image. */
export function sniffMime(buf: Buffer, declared: string): string | null {
  const b = buf;
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b.length > 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (b.length > 12 && b.subarray(0, 4).toString() === "RIFF" && b.subarray(8, 12).toString() === "WEBP") return "image/webp";
  if (b.length > 6 && b.subarray(0, 6).toString() === "GIF89a") return "image/gif";
  if (b.length > 12 && b.subarray(4, 8).toString() === "ftyp") {
    const brand = b.subarray(8, 12).toString();
    return brand.startsWith("avi") ? "image/avif" : "video/mp4";
  }
  if (b.length > 4 && b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3) return "video/webm";
  if (declared === "image/svg+xml") {
    const head = b.subarray(0, 512).toString("utf8").trimStart();
    if (/^(<\?xml[^>]*>\s*)?(<!--[\s\S]*?-->\s*)*<svg[\s>]/i.test(head) && !/<script|on\w+=/i.test(b.toString("utf8"))) return "image/svg+xml";
  }
  return null;
}

/** Optional image processing with sharp (skipped gracefully when unavailable). */
export async function processImage(buf: Buffer, mime: string): Promise<{ buffer: Buffer; mime: string; ext: string; width?: number; height?: number }> {
  if (!mime.startsWith("image/") || mime === "image/svg+xml" || mime === "image/gif") {
    return { buffer: buf, mime, ext: ALLOWED_MIME[mime] };
  }
  try {
    const sharp = (await import("sharp")).default;
    const img = sharp(buf, { limitInputPixels: 60_000_000 }).rotate();
    const meta = await img.metadata();
    const maxW = 2600;
    const out = await img
      .resize({ width: Math.min(meta.width ?? maxW, maxW), withoutEnlargement: true })
      .webp({ quality: 84 })
      .toBuffer({ resolveWithObject: true });
    return { buffer: out.data, mime: "image/webp", ext: "webp", width: out.info.width, height: out.info.height };
  } catch {
    return { buffer: buf, mime, ext: ALLOWED_MIME[mime] };
  }
}
