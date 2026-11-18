import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
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
  if (!existing) return NextResponse.json({ error: "Collection introuvable" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const data: Record<string, unknown> = {};

  if (typeof body.name === "string" && body.name.trim()) {
    data.name = body.name.trim();
  }
  if (typeof body.slug === "string" && body.slug.trim()) {
    const candidateSlug = slugify(body.slug.trim());
    if (candidateSlug && candidateSlug !== existing.slug) {
      const conflict = await prisma.collection.findUnique({
        where: { vendorId_slug: { vendorId: vendor.id, slug: candidateSlug } },
      });
      if (conflict && conflict.id !== id) {
        return NextResponse.json({ error: "Une autre collection utilise déjà ce slug." }, { status: 409 });
      }
      data.slug = candidateSlug;
    }
  }
  if (typeof body.description === "string") {
    data.description = body.description.trim();
  }
  if (typeof body.imageUrl === "string") {
    data.imageUrl = body.imageUrl.trim();
  }

  // Handle product associations if passed
  if (Array.isArray(body.productIds)) {
    // Unset all currently in this collection
    await prisma.product.updateMany({
      where: { collectionId: id, vendorId: vendor.id },
      data: { collectionId: null },
    });
    // Set for specified products
    const validIds = body.productIds.map((pid: unknown) => String(pid)).filter(Boolean);
    if (validIds.length > 0) {
      await prisma.product.updateMany({
        where: { id: { in: validIds }, vendorId: vendor.id },
        data: { collectionId: id },
      });
    }
  }

  const updated = await prisma.collection.update({
    where: { id },
    data,
    include: {
      products: { select: { id: true, name: true, priceCents: true, imageUrl: true, stock: true } },
    },
  });

  revalidatePath("/dashboard/collections");
  revalidatePath("/dashboard/products");
  revalidatePath(`/c/${vendor.shopSlug}`);
  revalidatePath(`/c/${vendor.shopSlug}/collection/${updated.slug}`);

  return NextResponse.json({ ok: true, collection: updated });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const vendor = await getCurrentVendor();
  if (!vendor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const existing = await prisma.collection.findFirst({
    where: { id, vendorId: vendor.id },
  });
  if (!existing) return NextResponse.json({ error: "Collection introuvable" }, { status: 404 });

  // Unlink products before deleting collection
  await prisma.product.updateMany({
    where: { collectionId: id, vendorId: vendor.id },
    data: { collectionId: null },
  });

  await prisma.collection.delete({ where: { id } });

  revalidatePath("/dashboard/collections");
  revalidatePath("/dashboard/products");
  revalidatePath(`/c/${vendor.shopSlug}`);

  return NextResponse.json({ ok: true });
}
