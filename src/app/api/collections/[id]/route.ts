import { NextRequest, NextResponse } from "next/server";
import { getCurrentVendor } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { slugify } from "@/lib/utils";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  const vendor = await getCurrentVendor();
  if (!vendor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const existing = await prisma.collection.findFirst({
    where: { id, vendorId: vendor.id },
  });
  if (!existing) return NextResponse.json({ error: "Collection not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const data: Record<string, unknown> = {};

  if (typeof body.name === "string" && body.name.trim()) {
    data.name = body.name.trim();
  }
  if (typeof body.slug === "string" && body.slug.trim()) {
    data.slug = slugify(body.slug.trim());
  }
  if (typeof body.description === "string") {
    data.description = body.description.trim();
  }

  // Handle product associations if passed
  if (Array.isArray(body.productIds)) {
    // Unset all currently in this collection
    await prisma.product.updateMany({
      where: { collectionId: id, vendorId: vendor.id },
      data: { collectionId: null },
    });
    // Set for specified products
    if (body.productIds.length > 0) {
      await prisma.product.updateMany({
        where: { id: { in: body.productIds }, vendorId: vendor.id },
        data: { collectionId: id },
      });
    }
  }

  const updated = await prisma.collection.update({
    where: { id },
    data,
    include: {
      products: { select: { id: true, name: true, priceCents: true, imageUrl: true } },
    },
  });

  return NextResponse.json({ ok: true, collection: updated });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const vendor = await getCurrentVendor();
  if (!vendor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const existing = await prisma.collection.findFirst({
    where: { id, vendorId: vendor.id },
  });
  if (!existing) return NextResponse.json({ error: "Collection not found" }, { status: 404 });

  // Unlink products before deleting collection
  await prisma.product.updateMany({
    where: { collectionId: id, vendorId: vendor.id },
    data: { collectionId: null },
  });

  await prisma.collection.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
