import { NextRequest, NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { uploadsDir } from "@/lib/storage";
import { getServerTr } from "@/lib/public-locale";

export const dynamic = "force-dynamic";

const TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  svg: "image/svg+xml",
  avif: "image/avif",
  pdf: "application/pdf",
  csv: "text/csv",
  txt: "text/plain",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

// Raster images and PDFs are displayed; other documents are downloaded.
const INLINE = new Set(["jpg", "jpeg", "png", "webp", "gif", "svg", "avif", "pdf"]);

// Keys are generated server-side (uuid + extension). Anything else is refused,
// which also rules out path traversal.
const SAFE_KEY = /^[A-Za-z0-9-]+\.(jpg|jpeg|png|webp|gif|svg|avif|pdf|csv|txt|doc|docx|xls|xlsx)$/i;

/**
 * GET /api/uploads/<key> — serves uploaded photos and documents from UPLOADS_DIR.
 * /uploads/<key> is rewritten here (see next.config.mjs), so photos uploaded
 * after the build are displayed and stay in the persistent folder.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ key: string }> }) {
  const tr = await getServerTr();
  const { key } = await params;
  if (!SAFE_KEY.test(key)) return NextResponse.json({ error: tr("Introuvable", "Not Found") }, { status: 404 });

  try {
    const file = await readFile(path.join(uploadsDir(), key));
    const ext = key.split(".").pop()!.toLowerCase();
    const headers: Record<string, string> = {
      "Content-Type": TYPES[ext] ?? "application/octet-stream",
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
      // An SVG can carry script: opened directly, it runs sandboxed (no script, no cookies).
      "Content-Security-Policy": "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; sandbox",
    };
    if (!INLINE.has(ext)) headers["Content-Disposition"] = `attachment; filename="${key}"`;
    return new NextResponse(new Uint8Array(file), { headers });
  } catch {
    return NextResponse.json({ error: tr("Introuvable", "Not Found") }, { status: 404 });
  }
}
