import { NextRequest, NextResponse } from "next/server";
import { getCurrentVendor } from "@/lib/auth";
import { getStorageProvider } from "@/lib/storage";
import { logger } from "@/lib/logger";
import { rateLimit, tooManyRequests } from "@/lib/ratelimit";
import { optimizeImage } from "@/lib/image";
import { getServerTr } from "@/lib/public-locale";

// Seth's upload rules: images (including SVG and AVIF) and documents, up to 10 MB.
const ALLOWED_IMAGES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/svg+xml": "svg",
  "image/avif": "avif",
};

const ALLOWED_DOCS: Record<string, string> = {
  "application/pdf": "pdf",
  "text/csv": "csv",
  "text/plain": "txt",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.ms-excel": "xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
};

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

export async function POST(req: NextRequest) {
  const tr = await getServerTr();
  const vendor = await getCurrentVendor();
  if (!vendor) return NextResponse.json({ error: tr("Veuillez vous connecter.", "Please sign in.") }, { status: 401 });

  const rl = rateLimit({ key: `upload:${vendor.id}`, limit: 30, windowMs: 60_000 });
  if (!rl.allowed) return tooManyRequests(rl, "Too many uploads. Slow down.");

  const form = await req.formData();
  const file = form.get("file");
  const rawFolder = form.get("folder");
  const folderInput = typeof rawFolder === "string" && rawFolder.trim() ? rawFolder.trim() : "general";

  if (!(file instanceof File)) {
    return NextResponse.json({ error: tr("Aucun fichier reçu.", "No file uploaded.") }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: tr("Le fichier ne doit pas dépasser 10 Mo.", "The file must be 10 MB or less.") },
      { status: 400 },
    );
  }

  const mime = (file.type || "").toLowerCase();
  const imageExt = ALLOWED_IMAGES[mime];
  const docExt = ALLOWED_DOCS[mime];

  if (!imageExt && !docExt) {
    return NextResponse.json(
      {
        error: tr(
          "Format non pris en charge. Utilisez une image (JPG, PNG, WebP, GIF, SVG, AVIF) ou un document (PDF, CSV, DOCX, XLSX).",
          "Unsupported format. Use an image (JPG, PNG, WebP, GIF, SVG, AVIF) or a document (PDF, CSV, DOCX, XLSX).",
        ),
      },
      { status: 400 },
    );
  }

  const rawBuffer = Buffer.from(await file.arrayBuffer());
  const folder = `${folderInput}/${vendor.id}`;

  let uploadBuffer: Buffer = rawBuffer;
  let uploadContentType = mime;
  let uploadExt = imageExt || docExt;
  let wasOptimized = false;

  // Optimize raster images via sharp if available; keep SVG/AVIF/documents untouched
  if (imageExt && mime !== "image/svg+xml" && mime !== "image/avif") {
    const optimized = await optimizeImage(rawBuffer, mime);
    uploadBuffer = optimized.buffer;
    uploadContentType = optimized.contentType;
    uploadExt = optimized.ext;
    wasOptimized = optimized.optimized;
  }

  const provider = getStorageProvider();
  try {
    const result = await provider.save({
      buffer: uploadBuffer,
      contentType: uploadContentType,
      ext: uploadExt,
      folder,
    });
    logger.info("upload.success", {
      vendorId: vendor.id,
      provider: provider.name,
      folder: folderInput,
      bytesIn: rawBuffer.length,
      bytesOut: uploadBuffer.length,
      optimized: wasOptimized,
      key: result.key,
    });
    return NextResponse.json({
      url: result.url,
      key: result.key,
      provider: provider.name,
      contentType: uploadContentType,
    });
  } catch (e) {
    logger.error("upload.storage_error", {
      vendorId: vendor.id,
      provider: provider.name,
      error: e instanceof Error ? e.message : String(e),
    });
    return NextResponse.json(
      { error: tr("Échec du téléversement vers le stockage.", "Upload to storage failed.") },
      { status: 502 },
    );
  }
}
