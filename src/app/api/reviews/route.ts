import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getServerTr } from "@/lib/public-locale";

export async function GET(req: NextRequest) {
  const tr = await getServerTr();
  const { searchParams } = new URL(req.url);
  const productId = searchParams.get("productId");
  const vendorId = searchParams.get("vendorId");

  if (!productId && !vendorId) {
    return NextResponse.json({ error: tr("productId ou vendorId est obligatoire.", "productId or vendorId required") }, { status: 400 });
  }

  const whereClause = productId ? { productId } : { vendorId: vendorId! };

  const reviews = await prisma.review.findMany({
    where: whereClause,
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  const count = reviews.length;
  const averageRating =
    count > 0
      ? Number((reviews.reduce((acc, r) => acc + r.rating, 0) / count).toFixed(1))
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
