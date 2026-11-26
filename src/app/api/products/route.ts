import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentVendor } from "@/lib/auth";
import { createProductForVendor, priceFloorsForVendor } from "@/lib/products";
import { recordVendorActivity } from "@/lib/clerk-vendor-sync";
import { getServerTr } from "@/lib/public-locale";

export async function GET(req: NextRequest) {
  const tr = await getServerTr();
  const vendor = await getCurrentVendor();
  if (!vendor) return NextResponse.json({ error: tr("Veuillez vous connecter.", "Please sign in.") }, { status: 401 });

  const sp = req.nextUrl.searchParams;
  const page = Math.max(1, parseInt(sp.get("page") || "1", 10) || 1);
  const pageSize = Math.min(200, Math.max(1, parseInt(sp.get("pageSize") || "100", 10) || 100));

  const where = { vendorId: vendor.id };
  const [products, total, reviewGroups, unansweredGroups] = await Promise.all([
    prisma.product.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.product.count({ where }),
    prisma.review.groupBy({
      by: ["productId"],
      where: { vendorId: vendor.id },
      _count: { _all: true },
      _avg: { rating: true },
    }),
    prisma.review.groupBy({
      by: ["productId"],
      where: { vendorId: vendor.id, reply: "" },
      _count: { _all: true },
    }),
  ]);
  const reviewMap = new Map(
    reviewGroups.map((g) => [
      g.productId,
      {
        count: g._count._all,
        avg: g._avg.rating != null ? Number(g._avg.rating.toFixed(1)) : null,
      },
    ]),
  );
  const unansweredMap = new Map(unansweredGroups.map((g) => [g.productId, g._count._all]));
  // The vendor's own secret minimum prices, for the dashboard form.
  const floors = await priceFloorsForVendor(vendor.id);
  return NextResponse.json({
    products: products.map((p) => {
      const r = reviewMap.get(p.id);
      return {
        ...p,
        minPriceCents: floors.get(p.id) ?? null,
        reviewCount: r?.count ?? 0,
        averageRating: r?.avg ?? null,
        unansweredReviewCount: unansweredMap.get(p.id) ?? 0,
      };
    }),
    page,
    pageSize,
    total,
  });
}

export async function POST(req: NextRequest) {
  const tr = await getServerTr();
  const vendor = await getCurrentVendor();
  if (!vendor) return NextResponse.json({ error: tr("Veuillez vous connecter.", "Please sign in.") }, { status: 401 });

  const b = await req.json().catch(() => null);
  if (!b || typeof b !== "object" || Array.isArray(b)) {
    return NextResponse.json({ error: tr("Requête invalide.", "Invalid request") }, { status: 400 });
  }

  const result = await createProductForVendor(vendor, b as Record<string, unknown>);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  await recordVendorActivity({
    vendorId: vendor.id,
    type: "catalog.product.created",
    subjectType: "product",
    subjectId: result.product.id,
    data: {
      name: result.product.name,
      priceCents: result.product.priceCents,
      stock: result.product.stock,
      collectionId: result.product.collectionId,
    },
  });
  return NextResponse.json({ ok: true, product: result.product });
}
