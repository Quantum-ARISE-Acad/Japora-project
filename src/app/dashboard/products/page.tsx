import { requireVendor } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { priceFloorsForVendor } from "@/lib/products";
import ProductsClient from "./ProductsClient";

export default async function ProductsPage() {
  const vendor = await requireVendor();
  const [products, collections, floors] = await Promise.all([
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
  ]);

  const dto = products.map((p) => ({
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
  }));

  return (
    <ProductsClient
      initialProducts={dto}
      collections={collections}
      currency={vendor.currency}
      shopSlug={vendor.shopSlug}
    />
  );
}
