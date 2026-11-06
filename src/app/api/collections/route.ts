import { NextRequest, NextResponse } from "next/server";
import { getCurrentVendor } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { slugify } from "@/lib/utils";

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
  if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const name = String(body.name || "").trim();
  if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });

  const rawSlug = String(body.slug || "").trim() || slugify(name);
  const description = String(body.description || "").trim();

  // Check unique slug per vendor
  const existing = await prisma.collection.findUnique({
    where: { vendorId_slug: { vendorId: vendor.id, slug: rawSlug } },
  });
  if (existing) {
    return NextResponse.json({ error: "A collection with this slug already exists" }, { status: 409 });
  }

  const collection = await prisma.collection.create({
    data: {
      vendorId: vendor.id,
      name,
      slug: rawSlug,
      description,
    },
  });

  return NextResponse.json({ ok: true, collection });
}
