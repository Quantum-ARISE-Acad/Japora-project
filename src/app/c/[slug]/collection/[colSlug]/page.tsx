import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/db";
import CatalogClient from "../../CatalogClient";

type Params = { params: Promise<{ slug: string; colSlug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug, colSlug } = await params;
  const vendor = await prisma.vendor.findUnique({ where: { shopSlug: slug } });
  if (!vendor) return { title: "Shop not found" };

  const collection = await prisma.collection.findUnique({
    where: { vendorId_slug: { vendorId: vendor.id, slug: colSlug } },
  });

  return {
    title: collection
      ? `${collection.name} — ${vendor.shopName}`
      : `${vendor.shopName} — Collection`,
    description: collection?.description || vendor.tagline,
  };
}

export default async function PublicCollectionPage({ params }: Params) {
  const { slug, colSlug } = await params;

  const vendor = await prisma.vendor.findUnique({ where: { shopSlug: slug } });
  if (!vendor) notFound();

  const collection = await prisma.collection.findUnique({
    where: { vendorId_slug: { vendorId: vendor.id, slug: colSlug } },
    include: {
      products: {
        where: { isActive: true },
        orderBy: { createdAt: "desc" },
      },
    },
  });
  if (!collection) notFound();

  return (
    <div>
      <div className="bg-arctic-800 text-white py-2 px-4 text-center text-xs font-medium">
        <span>Collection : <strong>{collection.name}</strong></span>
        <Link href={`/c/${vendor.shopSlug}`} className="ml-3 underline hover:text-arctic-200">
          ← Voir toute la boutique
        </Link>
      </div>

      <CatalogClient
        shopName={vendor.shopName}
        shopSlug={vendor.shopSlug}
        tagline={collection.description || vendor.tagline}
        verified={Boolean(vendor.verifiedAt)}
        whatsappNumber={vendor.whatsappNumber}
        momoNumber={vendor.momoNumber || vendor.whatsappNumber || ""}
        currency={vendor.currency}
        products={collection.products.map((p) => ({
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
    </div>
  );
}
