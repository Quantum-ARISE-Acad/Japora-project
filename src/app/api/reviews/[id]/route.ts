import { NextRequest, NextResponse } from "next/server";
import { getCurrentVendor } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getServerTr } from "@/lib/public-locale";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const tr = await getServerTr();
  const vendor = await getCurrentVendor();
  if (!vendor) return NextResponse.json({ error: tr("Veuillez vous connecter.", "Please sign in.") }, { status: 401 });

  const { id } = await params;
  const review = await prisma.review.findUnique({
    where: { id },
  });

  if (!review || review.vendorId !== vendor.id) {
    return NextResponse.json({ error: tr("Avis introuvable", "Review not found") }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: tr("JSON invalide.", "Invalid JSON") }, { status: 400 });

  const reply = typeof body.reply === "string" ? body.reply.trim().slice(0, 1000) : "";

  const updated = await prisma.review.update({
    where: { id },
    data: { reply },
  });

  return NextResponse.json({ ok: true, review: updated });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const tr = await getServerTr();
  const vendor = await getCurrentVendor();
  if (!vendor) return NextResponse.json({ error: tr("Veuillez vous connecter.", "Please sign in.") }, { status: 401 });

  const { id } = await params;
  const review = await prisma.review.findUnique({
    where: { id },
  });

  if (!review || review.vendorId !== vendor.id) {
    return NextResponse.json({ error: tr("Avis introuvable", "Review not found") }, { status: 404 });
  }

  await prisma.review.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
