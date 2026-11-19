import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/db";
import CatalogClient from "../../CatalogClient";
import { getPublicLocale, publicText, getServerTr } from "@/lib/public-locale";

type Params = { params: Promise<{ slug: string; colSlug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug, colSlug } = await params;
  const vendor = await prisma.vendor.findUnique({ where: { shopSlug: slug } });
  if (!vendor) return { title: (await getServerTr())("Boutique introuvable", "Shop not found") };

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
  const locale = await getPublicLocale();
  const t = (fr: string, en: string) => publicText(fr, en, locale);

  const vendor = await prisma.vendor.findUnique({ where: { shopSlug: slug } });
  if (!vendor) notFound();

  const [collection, allCollections] = await Promise.all([
    prisma.collection.findUnique({
      where: { vendorId_slug: { vendorId: vendor.id, slug: colSlug } },
      include: {
        products: {
          where: { isActive: true },
          orderBy: { createdAt: "desc" },
        },
      },
    }),
    prisma.collection.findMany({
      where: { vendorId: vendor.id },
      orderBy: { createdAt: "desc" },
      include: {
        products: {
          where: { isActive: true },
          select: { id: true, imageUrl: true },
        },
      },
    }),
  ]);
  if (!collection) notFound();

  return (
    <div>
      <div className="bg-gradient-to-r from-brand-dark via-brand to-emerald-700 text-white py-2.5 px-4 text-center text-xs font-medium shadow-xs">
        <span>
          📁 {t("Collection", "Collection")}: <strong className="font-bold">{collection.name}</strong> ({collection.products.length} {t(collection.products.length > 1 ? "articles" : "article", collection.products.length > 1 ? "items" : "item")})
        </span>
        <Link href={`/c/${vendor.shopSlug}`} className="ml-3 rounded-full bg-white/20 px-2.5 py-0.5 font-semibold hover:bg-white/30 transition">
          ← {t("Voir toute la boutique", "View the whole shop")}
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
        avatarUrl={vendor.avatarUrl}
        bio={vendor.bio}
        deliveryEnabled={vendor.deliveryEnabled}
        deliveryFeeCents={vendor.deliveryFeeCents}
        deliveryZones={vendor.deliveryZones}
        collections={allCollections.map((c) => ({
          id: c.id,
          name: c.name,
          slug: c.slug,
          description: c.description,
          productCount: c.products.length,
          coverImageUrl: c.imageUrl || c.products.find((p) => p.imageUrl)?.imageUrl || "",
        }))}
        initialCollectionId={collection.id}
        products={collection.products.map((p) => ({
          id: p.id,
          name: p.name,
          description: p.description,
          priceCents: p.priceCents,
          imageUrl: p.imageUrl,
          sizes: p.sizes,
          stock: p.stock,
          condition: p.condition || "new",
          collectionId: p.collectionId || null,
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
