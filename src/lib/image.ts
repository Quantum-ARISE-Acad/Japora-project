import { logger } from "./logger";

/**
 * Auto-resize uploaded product photos to a max 1200×1200 (preserving aspect)
 * and re-encode to webp (or png for transparent images) to strip EXIF
 * metadata and shrink file size. Drops typical phone photos from 4-6MB to
 * 50-200KB without any visible quality loss in product cards.
 *
 * Sharp is loaded lazily — if the native package isn't installed, the
 * function falls through and returns the original buffer. Install with:
 *   pnpm add sharp
 * (then ensure pnpm.onlyBuiltDependencies in package.json includes "sharp").
 */

type SharpFn = (input: Buffer) => {
  rotate: () => ReturnType<SharpFn>;
  resize: (opts: {
    width?: number;
    height?: number;
    fit?: "cover" | "contain" | "fill" | "inside" | "outside";
    withoutEnlargement?: boolean;
  }) => ReturnType<SharpFn>;
  png: (opts?: { compressionLevel?: number }) => ReturnType<SharpFn>;
  webp: (opts?: { quality?: number }) => ReturnType<SharpFn>;
  toBuffer: () => Promise<Buffer>;
};

let sharpLoadAttempted = false;
let sharp: SharpFn | null = null;

async function loadSharp(): Promise<SharpFn | null> {
  if (sharpLoadAttempted) return sharp;
  sharpLoadAttempted = true;
  try {
    const mod = (await import("sharp")) as unknown as {
      default?: SharpFn;
    };
    sharp = (mod.default ?? (mod as unknown as SharpFn)) as SharpFn;
    return sharp;
  } catch (e) {
    logger.warn("image.sharp_unavailable", {
      hint: "Run: pnpm add sharp (then add 'sharp' to pnpm.onlyBuiltDependencies)",
      error: e instanceof Error ? e.message : String(e),
    });
    return null;
  }
}

export type OptimizeResult = {
  buffer: Buffer;
  contentType: string;
  ext: string;
  optimized: boolean;
};

function fallbackExt(contentType: string): string {
  if (contentType === "image/png") return "png";
  if (contentType === "image/webp") return "webp";
  if (contentType === "image/gif") return "gif";
  return "jpg";
}

export async function optimizeImage(
  buffer: Buffer,
  contentType: string,
): Promise<OptimizeResult> {
  // Skip GIFs — animations would lose frames on re-encode.
  if (contentType === "image/gif") {
    return { buffer, contentType, ext: "gif", optimized: false };
  }

  const s = await loadSharp();
  if (!s) {
    return { buffer, contentType, ext: fallbackExt(contentType), optimized: false };
  }

  try {
    const pipeline = s(buffer)
      .rotate() // apply EXIF orientation before stripping it
      .resize({ width: 1200, height: 1200, fit: "inside", withoutEnlargement: true });

    if (contentType === "image/png") {
      return {
        buffer: await pipeline.png({ compressionLevel: 9 }).toBuffer(),
        contentType: "image/png",
        ext: "png",
        optimized: true,
      };
    }
    // JPEG, WebP, anything else → webp for best size/quality.
    return {
      buffer: await pipeline.webp({ quality: 82 }).toBuffer(),
      contentType: "image/webp",
      ext: "webp",
      optimized: true,
    };
  } catch (e) {
    logger.error("image.optimize_failed", {
      contentType,
      error: e instanceof Error ? e.message : String(e),
    });
    // Better to ship the original than fail the upload.
    return { buffer, contentType, ext: fallbackExt(contentType), optimized: false };
  }
}
