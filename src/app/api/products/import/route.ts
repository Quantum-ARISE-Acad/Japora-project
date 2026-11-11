import { NextRequest, NextResponse } from "next/server";
import { getCurrentVendor } from "@/lib/auth";
import { importFromWhatsAppCatalog } from "@/lib/wa-catalog-import";

export async function POST(_req: NextRequest) {
  const vendor = await getCurrentVendor();
  if (!vendor) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await importFromWhatsAppCatalog(vendor.id);
  if (!result.ok) {
    // 503 when the upstream WhatsApp Graph API is not configured / unreachable.
    return NextResponse.json(result, { status: 503 });
  }

  return NextResponse.json(result);
}
