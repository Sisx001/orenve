import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { verifyCsrf } from "@/lib/auth/csrf";
import { audit } from "@/lib/audit";
import { handleError, jsonError, jsonOk } from "@/lib/api-server";
import { ALLOWED_MIME, MAX_UPLOAD_BYTES, getStorage, processImage, sniffMime } from "@/lib/media/storage";
import type { MediaRow } from "@/lib/admin/types";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Multipart upload used by the media library and every picker.
 * Content type is decided by magic bytes, not by what the browser claims.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await requireUser("media.write");
    if (!(await verifyCsrf())) return jsonError("Invalid or missing CSRF token.", 403);

    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return jsonError("No file was uploaded.", 400);
    if (file.size === 0) return jsonError("That file is empty.", 400);
    if (file.size > MAX_UPLOAD_BYTES) return jsonError(`Files must be under ${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)} MB.`, 413);

    const folder = String(form.get("folder") ?? "library").replace(/[^a-z0-9_-]/gi, "") || "library";
    const raw = Buffer.from(await file.arrayBuffer());

    const sniffed = sniffMime(raw, file.type);
    if (!sniffed || !ALLOWED_MIME[sniffed]) {
      return jsonError("That file type is not allowed. Use JPEG, PNG, WebP, AVIF, GIF, SVG, MP4 or WebM.", 415);
    }
    if (file.type && file.type !== sniffed && !(file.type === "image/jpg" && sniffed === "image/jpeg")) {
      // A mismatch is suspicious but not fatal for images processed below; block
      // it for anything we cannot re-encode.
      if (sniffed.startsWith("video/") || sniffed === "image/svg+xml") {
        return jsonError("The file contents do not match its type.", 415);
      }
    }

    const processed = await processImage(raw, sniffed);
    const storage = getStorage();
    const { key, url } = await storage.put(processed.buffer, { mime: processed.mime, ext: processed.ext, folder });

    const baseName = (file.name || "upload").replace(/\.[^.]+$/, "").slice(0, 120) || "upload";
    const media = await db.media.create({
      data: {
        url,
        key,
        name: baseName,
        mime: processed.mime,
        size: processed.buffer.byteLength,
        width: processed.width ?? null,
        height: processed.height ?? null,
        folder,
        storage: storage.name,
      },
    });

    await audit(user.id, "media.upload", "media", media.id, { name: media.name, size: media.size, mime: media.mime });

    const row: MediaRow = {
      id: media.id,
      url: media.url,
      name: media.name,
      alt: media.alt,
      mime: media.mime,
      size: media.size,
      width: media.width,
      height: media.height,
      folder: media.folder,
      createdAt: media.createdAt.toISOString(),
    };
    return jsonOk({ media: row });
  } catch (e) {
    return handleError(e);
  }
}
