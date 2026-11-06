import { requireVendor } from "@/lib/auth";
import { prisma } from "@/lib/db";
import ProductsClient from "./ProductsClient";

export default async function ProductsPage() {
  const vendor = await requireVendor();
  const products = await prisma.product.findMany({
    where: { vendorId: vendor.id },
    orderBy: { createdAt: "desc" },
  });

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
  }));

  return (
    <ProductsClient
      initialProducts={dto}
      currency={vendor.currency}
      shopSlug={vendor.shopSlug}
    />
  );
}
