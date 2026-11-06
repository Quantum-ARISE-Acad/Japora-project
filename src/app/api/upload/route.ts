import { NextRequest, NextResponse } from "next/server";
import { getCurrentVendor } from "@/lib/auth";
import { getStorageProvider } from "@/lib/storage";
import { logger } from "@/lib/logger";
import { rateLimit, tooManyRequests } from "@/lib/ratelimit";
import { optimizeImage } from "@/lib/image";

const ALLOWED: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

export async function POST(req: NextRequest) {
  const vendor = await getCurrentVendor();
  if (!vendor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rl = rateLimit({ key: `upload:${vendor.id}`, limit: 20, windowMs: 60_000 });
  if (!rl.allowed) return tooManyRequests(rl, "Too many uploads. Slow down.");

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file uploaded." }, { status: 400 });
  }
  if (file.size > 5 * 1024 * 1024) {
    return NextResponse.json({ error: "Image must be under 5MB." }, { status: 400 });
  }
  const ext = ALLOWED[file.type];
  if (!ext) {
    return NextResponse.json({ error: "Use a JPG, PNG, WebP or GIF image." }, { status: 400 });
  }

  const rawBuffer = Buffer.from(await file.arrayBuffer());
  const optimized = await optimizeImage(rawBuffer, file.type);
  const provider = getStorageProvider();
  try {
    const result = await provider.save({
      buffer: optimized.buffer,
      contentType: optimized.contentType,
      ext: optimized.ext,
    });
    logger.info("upload.success", {
      vendorId: vendor.id,
      provider: provider.name,
      bytesIn: rawBuffer.length,
      bytesOut: optimized.buffer.length,
      optimized: optimized.optimized,
      key: result.key,
    });
    return NextResponse.json({ url: result.url });
  } catch (e) {
    logger.error("upload.storage_error", {
      vendorId: vendor.id,
      provider: provider.name,
      error: e instanceof Error ? e.message : String(e),
    });
    return NextResponse.json({ error: "Upload failed." }, { status: 502 });
  }
}
