import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentVendor } from "@/lib/auth";
import { parsePriceToCents } from "@/lib/utils";
import { enqueue, kickDrain } from "@/lib/bus";
import { becamePublished, productPublished } from "@/lib/catalog-events";

export async function GET(req: NextRequest) {
  const vendor = await getCurrentVendor();
  if (!vendor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sp = req.nextUrl.searchParams;
  const page = Math.max(1, parseInt(sp.get("page") || "1", 10) || 1);
  const pageSize = Math.min(200, Math.max(1, parseInt(sp.get("pageSize") || "100", 10) || 100));

  const where = { vendorId: vendor.id };
  const [products, total] = await Promise.all([
    prisma.product.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.product.count({ where }),
  ]);
  return NextResponse.json({ products, page, pageSize, total });
}

export async function POST(req: NextRequest) {
  const vendor = await getCurrentVendor();
  if (!vendor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const b = await req.json().catch(() => null);
  if (!b) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const name = String(b.name || "").trim();
  if (!name) return NextResponse.json({ error: "Product name is required." }, { status: 400 });

  const priceCents = parsePriceToCents(b.price ?? b.priceCents ?? 0);
  if (priceCents <= 0) return NextResponse.json({ error: "Enter a valid price." }, { status: 400 });

  const wholesalePrice = b.wholesalePrice ?? b.wholesalePriceCents;
  const wholesalePriceCents =
    wholesalePrice !== undefined && wholesalePrice !== null && wholesalePrice !== ""
      ? parsePriceToCents(wholesalePrice)
      : null;
  const wholesaleMinQty = Math.max(1, parseInt(String(b.wholesaleMinQty ?? 1), 10) || 1);
  const preOrderAllowed = Boolean(b.preOrderAllowed);
  const depositPercent = Math.min(100, Math.max(0, parseInt(String(b.depositPercent ?? 0), 10) || 0));
  const condition = ["new", "used", "refurbished"].includes(String(b.condition || ""))
    ? String(b.condition)
    : "new";
  const collectionId = typeof b.collectionId === "string" && b.collectionId.trim() ? b.collectionId.trim() : null;

  // The product and the fact about the product commit together. A product
  // created active is publicly visible, which is what `catalog.product.published`
  // means here (see catalog-events.ts); one created inactive is a draft and
  // announces nothing until the merchant turns it on.
  const product = await prisma.$transaction(async (tx) => {
    const created = await tx.product.create({
      data: {
        vendorId: vendor.id,
        name,
        description: String(b.description || "").trim(),
        priceCents,
        imageUrl: String(b.imageUrl || "").trim(),
        sizes: String(b.sizes || "").trim(),
        stock: Math.max(0, parseInt(String(b.stock ?? 0), 10) || 0),
        isActive: b.isActive !== false,
        condition,
        collectionId,
        wholesalePriceCents: wholesalePriceCents && wholesalePriceCents > 0 ? wholesalePriceCents : null,
        wholesaleMinQty,
        preOrderAllowed,
        depositPercent,
      },
    });
    if (becamePublished(null, created)) {
      await enqueue(tx, productPublished(created, vendor));
    }
    return created;
  });

  kickDrain();
  return NextResponse.json({ ok: true, product });
}
