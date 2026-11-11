import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { parseWhatsAppAssistantConfig } from "@/lib/whatsapp-config";
import CatalogClient from "./CatalogClient";

type Params = { params: Promise<{ slug: string }>; searchParams?: Promise<{ product?: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const vendor = await prisma.vendor.findUnique({ where: { shopSlug: slug } });
  if (!vendor) return { title: "Shop not found" };
  return {
    title: `${vendor.shopName} — Catalog`,
    description: vendor.tagline || `Browse and order from ${vendor.shopName} on WhatsApp.`,
  };
}

export default async function CatalogPage({ params, searchParams }: Params) {
  const { slug } = await params;
  const { product: directProductId } = (await searchParams) ?? {};

  const vendor = await prisma.vendor.findUnique({ where: { shopSlug: slug } });
  if (!vendor) notFound();

  const products = await prisma.product.findMany({
    where: { vendorId: vendor.id, isActive: true },
    orderBy: { createdAt: "desc" },
  });

  const waAssistant = parseWhatsAppAssistantConfig(vendor.uiPrefs);

  return (
    <CatalogClient
      shopName={vendor.shopName}
      shopSlug={vendor.shopSlug}
      tagline={vendor.tagline}
      verified={Boolean(vendor.verifiedAt)}
      whatsappNumber={vendor.whatsappNumber}
      momoNumber={vendor.momoNumber || vendor.whatsappNumber || ""}
      currency={vendor.currency}
      avatarUrl={vendor.avatarUrl}
      bio={vendor.bio}
      deliveryEnabled={vendor.deliveryEnabled}
      deliveryFeeCents={vendor.deliveryFeeCents}
      deliveryZones={vendor.deliveryZones}
      directProductId={directProductId ?? null}
      assistantConfig={{
        aiEnabled: waAssistant.aiEnabled,
        assistantName: waAssistant.assistantName,
        welcomeMessage: waAssistant.welcomeMessage,
        whatsappPrefillMessage: waAssistant.whatsappPrefillMessage,
        showQrOnShop: waAssistant.showQrOnShop,
      }}
      products={products.map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        priceCents: p.priceCents,
        imageUrl: p.imageUrl,
        sizes: p.sizes,
        stock: p.stock,
        condition: p.condition || "new",
        createdAt: p.createdAt.toISOString(),
        wholesalePriceCents: p.wholesalePriceCents,
        wholesaleMinQty: p.wholesaleMinQty,
        preOrderAllowed: p.preOrderAllowed,
        depositPercent: p.depositPercent,
      }))}
    />
  );
}
