import { NextRequest, NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { uploadsDir } from "@/lib/storage";

export const dynamic = "force-dynamic";

const TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
};

// Keys are generated server-side (uuid + extension). Anything else is refused,
// which also rules out path traversal.
const SAFE_KEY = /^[A-Za-z0-9-]+\.(jpg|jpeg|png|webp|gif)$/i;

/**
 * GET /api/uploads/<key> — serves product photos from UPLOADS_DIR.
 * /uploads/<key> is rewritten here (see next.config.mjs), so photos uploaded
 * after the build are displayed and stay in the persistent folder.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  if (!SAFE_KEY.test(key)) return NextResponse.json({ error: "Not Found" }, { status: 404 });

  try {
    const file = await readFile(path.join(uploadsDir(), key));
    const ext = key.split(".").pop()!.toLowerCase();
    return new NextResponse(new Uint8Array(file), {
      headers: {
        "Content-Type": TYPES[ext] ?? "application/octet-stream",
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return NextResponse.json({ error: "Not Found" }, { status: 404 });
  }
}
