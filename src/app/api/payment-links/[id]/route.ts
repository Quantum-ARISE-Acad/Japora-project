import { NextRequest, NextResponse } from "next/server";
import { getCurrentVendor } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const link = await prisma.paymentLink.findUnique({
    where: { id },
    include: {
      vendor: {
        select: {
          id: true,
          shopName: true,
          shopSlug: true,
          avatarUrl: true,
          whatsappNumber: true,
          momoNumber: true,
          currency: true,
          verifiedAt: true,
        },
      },
    },
  });

  if (!link) {
    return NextResponse.json({ error: "Lien de paiement introuvable" }, { status: 404 });
  }

  const isExpired = link.expiresAt ? new Date(link.expiresAt).getTime() < Date.now() : false;

  return NextResponse.json({
    link: {
      ...link,
      isExpired,
    },
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const vendor = await getCurrentVendor();

  const link = await prisma.paymentLink.findUnique({
    where: { id },
  });

  if (!link) {
    return NextResponse.json({ error: "Lien de paiement introuvable" }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}));

  // Vendor actions: toggle paid
  if (vendor && vendor.id === link.vendorId) {
    const isPaid = typeof body.isPaid === "boolean" ? body.isPaid : !link.isPaid;
    const updated = await prisma.paymentLink.update({
      where: { id },
      data: {
        isPaid,
        paidAt: isPaid ? new Date() : null,
      },
    });
    return NextResponse.json({ ok: true, link: updated });
  }

  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const vendor = await getCurrentVendor();
  if (!vendor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const link = await prisma.paymentLink.findUnique({ where: { id } });

  if (!link || link.vendorId !== vendor.id) {
    return NextResponse.json({ error: "Lien de paiement introuvable" }, { status: 404 });
  }

  await prisma.paymentLink.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
