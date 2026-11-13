import { requireVendor } from "@/lib/auth";
import { listCampaigns } from "@/lib/campaigns";
import { prisma } from "@/lib/db";
import {
  getVendorMetaCampaignMap,
  getVendorMetaConfig,
} from "@/lib/meta-marketing";
import CampaignsClient from "./CampaignsClient";

export const dynamic = "force-dynamic";

export default async function CampaignsPage() {
  const vendor = await requireVendor();
  const [campaigns, products, metaMap, metaConfig] = await Promise.all([
    listCampaigns(vendor.id),
    prisma.product.findMany({
      where: { vendorId: vendor.id },
      select: {
        id: true,
        name: true,
        priceCents: true,
        imageUrl: true,
        description: true,
        stock: true,
      },
      orderBy: { createdAt: "desc" },
    }),
    getVendorMetaCampaignMap(vendor.id),
    getVendorMetaConfig(vendor.id),
  ]);

  const enrichedCampaigns = campaigns.map((c) => ({
    ...c,
    metaDetails: metaMap[c.id] ?? null,
  }));

  return (
    <CampaignsClient
      initialCampaigns={enrichedCampaigns}
      products={products}
      currency={vendor.currency}
      shopName={vendor.shopName}
      shopSlug={vendor.shopSlug}
      whatsappNumber={vendor.whatsappNumber}
      initialMetaConfig={{
        ...metaConfig,
        hasAccessToken: Boolean(metaConfig.accessToken),
        maskedToken: metaConfig.accessToken
          ? `${metaConfig.accessToken.slice(0, 8)}••••••••${metaConfig.accessToken.slice(-4)}`
          : "",
      }}
    />
  );
}
