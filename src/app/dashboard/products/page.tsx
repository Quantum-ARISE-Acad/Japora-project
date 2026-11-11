import { requireVendor } from "@/lib/auth";
import { prisma } from "@/lib/db";
import ProductsClient from "./ProductsClient";

export default async function ProductsPage() {
  const vendor = await requireVendor();
  const [products, collections] = await Promise.all([
    prisma.product.findMany({
      where: { vendorId: vendor.id },
      orderBy: { createdAt: "desc" },
    }),
    prisma.collection.findMany({
      where: { vendorId: vendor.id },
      orderBy: { name: "asc" },
      select: { id: true, name: true, slug: true },
    }),
  ]);

  const dto = products.map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    priceCents: p.priceCents,
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
