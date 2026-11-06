import { requireVendor } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { listCampaigns } from "@/lib/campaigns";
import CampaignsClient from "./CampaignsClient";

export default async function CampaignsPage() {
  const vendor = await requireVendor();
  const [campaigns, products] = await Promise.all([
    listCampaigns(vendor.id),
    prisma.product.findMany({
      where: { vendorId: vendor.id, isActive: true },
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true, priceCents: true },
    }),
  ]);

  // Serialise Date → ISO for the client boundary.
  const dto = campaigns.map((c) => ({ ...c, createdAt: c.createdAt.toISOString() }));

  return (
    <CampaignsClient
      initialCampaigns={dto}
      products={products}
      currency={vendor.currency}
    />
  );
}
