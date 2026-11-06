/**
 * Client-side image compression utility.
 *
 * Resizes an image so its longest side is at most `maxDim` pixels,
 * then re-encodes as WebP (falling back to JPEG) at the given quality.
 * On any error, silently returns the original file so uploads never break.
 *
 * No React imports. Runs only in browsers that expose <canvas> / createImageBitmap.
 */

export type CompressOptions = {
  maxDim?: number;
  quality?: number;
};

const DEFAULT_MAX_DIM = 1200;
const DEFAULT_QUALITY = 0.82;

function canUseOffscreen(): boolean {
  return (
    typeof OffscreenCanvas !== "undefined" &&
    typeof (OffscreenCanvas.prototype as unknown as { convertToBlob?: unknown })
      .convertToBlob === "function"
  );
}

async function loadBitmap(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(file);
    } catch {
      // fall through to HTMLImageElement
    }
  }
  return await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = (err) => {
      URL.revokeObjectURL(url);
      reject(err);
    };
    img.src = url;
  });
}

function getDims(src: ImageBitmap | HTMLImageElement): {
  width: number;
  height: number;
} {
  if ("width" in src && "height" in src) {
    return { width: src.width, height: src.height };
  }
  return { width: 0, height: 0 };
}

function computeTarget(
  width: number,
  height: number,
  maxDim: number,
): { w: number; h: number } {
  if (width <= 0 || height <= 0) return { w: width, h: height };
  const longest = Math.max(width, height);
  if (longest <= maxDim) return { w: width, h: height };
  const scale = maxDim / longest;
  return { w: Math.round(width * scale), h: Math.round(height * scale) };
}

async function encodeOffscreen(
  bitmap: ImageBitmap | HTMLImageElement,
  w: number,
  h: number,
  quality: number,
): Promise<{ blob: Blob; mime: string } | null> {
  try {
    const canvas = new OffscreenCanvas(w, h);
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(bitmap as CanvasImageSource, 0, 0, w, h);
    try {
      const blob = await canvas.convertToBlob({ type: "image/webp", quality });
      if (blob && blob.type) return { blob, mime: "image/webp" };
    } catch {
      // fall through to jpeg
    }
    const jpeg = await canvas.convertToBlob({ type: "image/jpeg", quality });
    return jpeg ? { blob: jpeg, mime: "image/jpeg" } : null;
  } catch {
    return null;
  }
}

async function encodeCanvas(
  bitmap: ImageBitmap | HTMLImageElement,
  w: number,
  h: number,
  quality: number,
): Promise<{ blob: Blob; mime: string } | null> {
  try {
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(bitmap as CanvasImageSource, 0, 0, w, h);

    const tryType = (type: string): Promise<Blob | null> =>
      new Promise((resolve) => {
        canvas.toBlob((b) => resolve(b), type, quality);
      });

    const webp = await tryType("image/webp");
    if (webp && webp.type === "image/webp") return { blob: webp, mime: "image/webp" };
    const jpeg = await tryType("image/jpeg");
    return jpeg ? { blob: jpeg, mime: "image/jpeg" } : null;
  } catch {
    return null;
  }
}

function swapExt(name: string, mime: string): string {
  const ext = mime === "image/webp" ? "webp" : "jpg";
  const dot = name.lastIndexOf(".");
  const base = dot > 0 ? name.slice(0, dot) : name;
  return `${base}.${ext}`;
}

export async function compressImage(
  file: File,
  opts: CompressOptions = {},
): Promise<File> {
  try {
    if (!file || !file.type || !file.type.startsWith("image/")) return file;
    // Skip animated formats; canvas would flatten them.
    if (file.type === "image/gif" || file.type === "image/svg+xml") return file;

    const maxDim = opts.maxDim ?? DEFAULT_MAX_DIM;
    const quality = opts.quality ?? DEFAULT_QUALITY;

    const bitmap = await loadBitmap(file);
    const { width, height } = getDims(bitmap);
    if (!width || !height) return file;

    const { w, h } = computeTarget(width, height, maxDim);

    let encoded: { blob: Blob; mime: string } | null = null;
    if (canUseOffscreen()) {
      encoded = await encodeOffscreen(bitmap, w, h, quality);
    }
    if (!encoded) {
      encoded = await encodeCanvas(bitmap, w, h, quality);
    }
    if ("close" in bitmap && typeof bitmap.close === "function") {
      try {
        bitmap.close();
      } catch {
        /* noop */
      }
    }
    if (!encoded) return file;

    // If the result somehow got bigger, keep the original.
    if (encoded.blob.size >= file.size && w === width && h === height) {
      return file;
    }

    const newName = swapExt(file.name || "image", encoded.mime);
    return new File([encoded.blob], newName, {
      type: encoded.mime,
      lastModified: Date.now(),
    });
  } catch {
    return file;
  }
}
