import { requireVendor } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { priceFloorsForVendor } from "@/lib/products";
import ProductsClient from "./ProductsClient";

type Props = {
  searchParams?: Promise<{ reviews?: string; reviewProduct?: string }>;
};

export default async function ProductsPage({ searchParams }: Props) {
  const vendor = await requireVendor();
  const sp = searchParams ? await searchParams : {};

  const [products, collections, floors, reviews] = await Promise.all([
    prisma.product.findMany({
      where: { vendorId: vendor.id },
      orderBy: { createdAt: "desc" },
    }),
    prisma.collection.findMany({
      where: { vendorId: vendor.id },
      orderBy: { name: "asc" },
      select: { id: true, name: true, slug: true },
    }),
    priceFloorsForVendor(vendor.id),
    prisma.review.findMany({
      where: { vendorId: vendor.id },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        product: { select: { id: true, name: true, imageUrl: true } },
      },
    }),
  ]);

  const byProduct = new Map<string, { sum: number; count: number; unanswered: number }>();
  for (const r of reviews) {
    const cur = byProduct.get(r.productId) ?? { sum: 0, count: 0, unanswered: 0 };
    cur.sum += r.rating;
    cur.count += 1;
    if (!r.reply || r.reply.trim() === "") cur.unanswered += 1;
    byProduct.set(r.productId, cur);
  }

  const dto = products.map((p) => {
    const stats = byProduct.get(p.id);
    return {
      id: p.id,
      name: p.name,
      description: p.description,
      priceCents: p.priceCents,
      minPriceCents: floors.get(p.id) ?? null,
      imageUrl: p.imageUrl,
      sizes: p.sizes,
      stock: p.stock,
      isActive: p.isActive,
      condition: p.condition || "new",
      collectionId: p.collectionId || null,
      reviewCount: stats?.count ?? 0,
      averageRating: stats && stats.count > 0 ? Number((stats.sum / stats.count).toFixed(1)) : null,
      unansweredReviewCount: stats?.unanswered ?? 0,
    };
  });

  const reviewDtos = reviews.map((r) => ({
    id: r.id,
    productId: r.productId,
    customerName: r.customerName,
    rating: r.rating,
    comment: r.comment,
    reply: r.reply,
    createdAt: r.createdAt.toISOString(),
    product: r.product ? { id: r.product.id, name: r.product.name, imageUrl: r.product.imageUrl } : null,
  }));

  const initialReviewProductId = sp.reviewProduct || "";
  const initialReviewsOpen = sp.reviews === "1" || Boolean(initialReviewProductId);

  return (
    <ProductsClient
      initialProducts={dto}
      initialReviews={reviewDtos}
      initialReviewsOpen={initialReviewsOpen}
      initialReviewProductId={initialReviewProductId}
      collections={collections}
      currency={vendor.currency}
      shopSlug={vendor.shopSlug}
    />
  );
}
