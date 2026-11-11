import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { appUrl } from "@/lib/token";

function authorized(req: NextRequest): boolean {
  const expected = (process.env.SOKO_SYNC_SECRET || "").trim();
  const supplied = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim() || "";
  if (!expected || !supplied) return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(supplied);
  return a.length === b.length && timingSafeEqual(a, b);
}

// Snapshot used by Soko's authenticated reconciliation/backfill worker.
export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const requestedVendorId = (req.nextUrl.searchParams.get("vendorId") || "").trim();
  const localVendorIds = new Set((process.env.SOKO_SYNC_LOCAL_VENDOR_IDS || "").split(",").map((id) => id.trim()).filter(Boolean));
  const localVendorRequest = process.env.NODE_ENV !== "production" && process.env.SOKO_SYNC_LOCAL_MAPPING_ENABLED === "true" && Boolean(requestedVendorId && localVendorIds.has(requestedVendorId));
  const email = (req.nextUrl.searchParams.get("email") || "").trim().toLowerCase();
  if (!localVendorRequest && !email) return NextResponse.json({ error: "email required" }, { status: 400 });

  const vendor = localVendorRequest
    ? await prisma.vendor.findUnique({ where: { id: requestedVendorId } })
    : await prisma.vendor.findUnique({ where: { email } });
  if (!vendor || vendor.deletedAt || (!localVendorRequest && !vendor.emailVerifiedAt)) {
    return NextResponse.json({ error: "Eligible vendor not found" }, { status: 404 });
  }
  const products = await prisma.product.findMany({ where: { vendorId: vendor.id } });
  return NextResponse.json({
    vendor: { id: vendor.id, email: vendor.email.trim().toLowerCase() },
    products: products.map((p) => ({
      id: p.id,
      vendorId: vendor.id,
      vendorEmail: vendor.email.trim().toLowerCase(),
      name: p.name,
      description: p.description,
      category: vendor.category,
      priceCents: p.priceCents,
      currency: vendor.currency,
      imageUrl: p.imageUrl,
      sizes: p.sizes,
      stock: p.stock,
      isActive: p.isActive,
      condition: p.condition,
      updatedAt: new Date().toISOString(),
      url: appUrl(`/c/${vendor.shopSlug}?product=${encodeURIComponent(p.id)}`),
    })),
  });
}
