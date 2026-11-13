import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getCurrentVendor } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { slugify } from "@/lib/utils";
import { recordVendorActivity } from "@/lib/clerk-vendor-sync";

export async function GET() {
  const vendor = await getCurrentVendor();
  if (!vendor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const collections = await prisma.collection.findMany({
    where: { vendorId: vendor.id },
    orderBy: { createdAt: "desc" },
    include: {
      products: {
        select: { id: true, name: true, priceCents: true, imageUrl: true, stock: true },
      },
    },
  });

  return NextResponse.json({ collections });
}

export async function POST(req: NextRequest) {
  const vendor = await getCurrentVendor();
  if (!vendor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Corps de requête invalide" }, { status: 400 });

  const name = String(body.name || "").trim();
  if (!name) return NextResponse.json({ error: "Le nom de la collection est obligatoire" }, { status: 400 });

  const baseSlug = slugify(String(body.slug || "").trim() || name) || `collection-${Date.now().toString(36)}`;
  const description = String(body.description || "").trim();

  // Ensure unique slug per vendor (if custom slug was not forced, auto-suffix; if forced, check conflict)
  let finalSlug = baseSlug;
  const existing = await prisma.collection.findUnique({
    where: { vendorId_slug: { vendorId: vendor.id, slug: finalSlug } },
  });
  if (existing) {
    if (body.slug && String(body.slug).trim()) {
      return NextResponse.json({ error: "Une collection avec cet identifiant URL (slug) existe déjà." }, { status: 409 });
    }
    let counter = 2;
    while (
      await prisma.collection.findUnique({
        where: { vendorId_slug: { vendorId: vendor.id, slug: `${baseSlug}-${counter}` } },
      })
    ) {
      counter++;
    }
    finalSlug = `${baseSlug}-${counter}`;
  }

  const created = await prisma.collection.create({
    data: {
      vendorId: vendor.id,
      name,
      slug: finalSlug,
      description,
    },
  });

  // Assign selected products to this collection if passed
  if (Array.isArray(body.productIds) && body.productIds.length > 0) {
    const validIds = body.productIds.map((id: unknown) => String(id)).filter(Boolean);
    if (validIds.length > 0) {
      await prisma.product.updateMany({
        where: { id: { in: validIds }, vendorId: vendor.id },
        data: { collectionId: created.id },
      });
    }
  }

  const collection = await prisma.collection.findUnique({
    where: { id: created.id },
    include: {
      products: {
        select: { id: true, name: true, priceCents: true, imageUrl: true, stock: true },
      },
    },
  });

  revalidatePath("/dashboard/collections");
  revalidatePath("/dashboard/products");
  revalidatePath(`/c/${vendor.shopSlug}`);

  await recordVendorActivity({
    vendorId: vendor.id,
    type: "catalog.collection.created",
    subjectType: "collection",
    subjectId: created.id,
    data: {
      name: created.name,
      slug: created.slug,
      productsCount: collection?.products.length ?? 0,
    },
  });

  return NextResponse.json({ ok: true, collection });
}
