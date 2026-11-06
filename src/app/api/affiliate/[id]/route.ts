import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentVendor } from "@/lib/auth";
import { clampPct } from "@/lib/affiliate";
import { logger } from "@/lib/logger";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  const vendor = await getCurrentVendor();
  if (!vendor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const existing = await prisma.affiliate.findFirst({
    where: { id, vendorId: vendor.id, deletedAt: null },
  });
  if (!existing) return NextResponse.json({ error: "Affiliate not found" }, { status: 404 });

  const b = await req.json().catch(() => ({}));
  const data: Record<string, unknown> = {};

  if (typeof b.name === "string" && b.name.trim()) data.name = b.name.trim();
  if (b.commissionPct !== undefined) {
    const pct =
      typeof b.commissionPct === "number"
        ? b.commissionPct
        : parseFloat(String(b.commissionPct));
    if (Number.isFinite(pct)) data.commissionPct = clampPct(pct);
  }

  const affiliate = await prisma.affiliate.update({ where: { id }, data });
  logger.info("affiliate.updated", { vendorId: vendor.id, affiliateId: id });
  return NextResponse.json({ ok: true, affiliate });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const vendor = await getCurrentVendor();
  if (!vendor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const existing = await prisma.affiliate.findFirst({
    where: { id, vendorId: vendor.id, deletedAt: null },
  });
  if (!existing) return NextResponse.json({ error: "Affiliate not found" }, { status: 404 });

  // Soft-delete so historical AffiliateAttribution rows still point at a
  // resolvable Affiliate (we keep the code reserved too — undelete-friendly).
  await prisma.affiliate.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
  logger.info("affiliate.deleted", { vendorId: vendor.id, affiliateId: id });
  return NextResponse.json({ ok: true });
}
