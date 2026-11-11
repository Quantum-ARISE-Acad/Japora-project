import { NextRequest, NextResponse } from "next/server";
import { getCurrentVendor } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  const vendor = await getCurrentVendor();
  if (!vendor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const links = await prisma.paymentLink.findMany({
    where: { vendorId: vendor.id },
    orderBy: { createdAt: "desc" },
  });

  const totalCollectedCents = links
    .filter((l) => l.isPaid)
    .reduce((sum, l) => sum + l.amountCents, 0);

  const pendingCents = links
    .filter((l) => !l.isPaid)
    .reduce((sum, l) => sum + l.amountCents, 0);

  return NextResponse.json({
    links,
    stats: {
      total: links.length,
      paidCount: links.filter((l) => l.isPaid).length,
      totalCollectedCents,
      pendingCents,
    },
  });
}

export async function POST(req: NextRequest) {
  const vendor = await getCurrentVendor();
  if (!vendor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  const amountCents = Number(body.amountCents);
  if (!amountCents || amountCents <= 0 || !Number.isFinite(amountCents)) {
    return NextResponse.json({ error: "Montant invalide" }, { status: 400 });
  }

  const description = String(body.description || "").trim().slice(0, 300);
  const currency = String(body.currency || vendor.currency || "XOF").toUpperCase().slice(0, 3);
  
  let expiresAt: Date | null = null;
  if (body.expiresAt) {
    const parsed = new Date(body.expiresAt);
    if (!isNaN(parsed.getTime())) {
      expiresAt = parsed;
    }
  }

  const link = await prisma.paymentLink.create({
    data: {
      vendorId: vendor.id,
      amountCents: Math.round(amountCents),
      description,
      currency,
      expiresAt,
    },
  });

  return NextResponse.json({ ok: true, link }, { status: 201 });
}
