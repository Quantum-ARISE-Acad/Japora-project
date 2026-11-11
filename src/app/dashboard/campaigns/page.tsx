import { requireVendor } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { listCampaigns } from "@/lib/campaigns";
import CampaignsClient from "./CampaignsClient";

export default async function CampaignsPage() {
  const vendor = await requireVendor();
  const [campaigns, products, productSales] = await Promise.all([
    listCampaigns(vendor.id),
    prisma.product.findMany({
      where: { vendorId: vendor.id, isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, priceCents: true },
    }),
    prisma.orderItem.groupBy({
      by: ["productId"],
      where: {
        productId: { not: null },
        order: { is: { vendorId: vendor.id, deletedAt: null, status: { in: ["PAID", "DELIVERED"] } } },
      },
      _sum: { quantity: true },
    }),
  ]);

  const paidUnitsByProduct = new Map(
    productSales
      .filter((row) => row.productId)
      .map((row) => [row.productId as string, row._sum.quantity ?? 0]),
  );
  const rankedProducts = products
    .map((product) => ({
      ...product,
      paidUnits: paidUnitsByProduct.get(product.id) ?? 0,
    }))
    .sort((a, b) => b.paidUnits - a.paidUnits || a.name.localeCompare(b.name));
  const featuredProductIds = new Set(
    rankedProducts.filter((product) => product.paidUnits > 0).slice(0, 5).map((product) => product.id),
  );
  const productOptions = rankedProducts.map((product) => ({
    ...product,
    featured: featuredProductIds.has(product.id),
  }));

  // Serialise Date → ISO for the client boundary.
  const dto = campaigns.map((c) => ({ ...c, createdAt: c.createdAt.toISOString() }));

  return (
    <CampaignsClient
      initialCampaigns={dto}
      products={productOptions}
      currency={vendor.currency}
    />
  );
}
