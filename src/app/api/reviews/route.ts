import { NextRequest, NextResponse } from "next/server";
import { getCurrentVendor } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getServerTr } from "@/lib/public-locale";

export async function GET(req: NextRequest) {
  const tr = await getServerTr();
  const { searchParams } = new URL(req.url);
  const productId = searchParams.get("productId");
  const vendorIdParam = searchParams.get("vendorId");
  const mine = searchParams.get("mine") === "1";

  let resolvedVendorId = vendorIdParam;
  if (mine) {
    const vendor = await getCurrentVendor();
    if (!vendor) {
      return NextResponse.json({ error: tr("Veuillez vous connecter.", "Please sign in.") }, { status: 401 });
    }
    resolvedVendorId = vendor.id;
  }

  if (!productId && !resolvedVendorId) {
    return NextResponse.json({ error: tr("productId ou vendorId est obligatoire.", "productId or vendorId required") }, { status: 400 });
  }

  const whereClause = productId
    ? resolvedVendorId
      ? { productId, vendorId: resolvedVendorId }
      : { productId }
    : { vendorId: resolvedVendorId! };

  const take = Math.min(100, Math.max(1, parseInt(searchParams.get("take") || "50", 10) || 50));

  const [reviews, agg] = await Promise.all([
    prisma.review.findMany({
      where: whereClause,
      orderBy: { createdAt: "desc" },
      take,
      include: {
        product: {
          select: { id: true, name: true, imageUrl: true },
        },
      },
    }),
    prisma.review.aggregate({
      where: whereClause,
      _count: { _all: true },
      _avg: { rating: true },
    }),
  ]);

  const count = agg._count._all;
  const averageRating =
    count > 0 && agg._avg.rating != null
      ? Number(agg._avg.rating.toFixed(1))
      : 5.0;

  return NextResponse.json({ reviews, count, averageRating });
}

export async function POST(req: NextRequest) {
  const tr = await getServerTr();
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: tr("JSON invalide.", "Invalid JSON") }, { status: 400 });

  const { productId, customerName, rating, comment } = body;

  if (!productId || typeof productId !== "string") {
    return NextResponse.json({ error: tr("productId est obligatoire.", "productId is required") }, { status: 400 });
  }

  const name = String(customerName || "").trim();
  if (!name) {
    return NextResponse.json({ error: tr("Le nom du client est obligatoire.", "customerName is required") }, { status: 400 });
  }

  const numRating = Number(rating);
  if (!numRating || numRating < 1 || numRating > 5) {
    return NextResponse.json({ error: tr("La note doit être comprise entre 1 et 5.", "rating must be between 1 and 5") }, { status: 400 });
  }

  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { id: true, vendorId: true },
  });

  if (!product) {
    return NextResponse.json({ error: tr("Produit introuvable", "Product not found") }, { status: 404 });
  }

  const review = await prisma.review.create({
    data: {
      productId: product.id,
      vendorId: product.vendorId,
      customerName: name,
      rating: Math.round(numRating),
      comment: String(comment || "").trim().slice(0, 1000),
    },
  });

  return NextResponse.json({ ok: true, review }, { status: 201 });
}
