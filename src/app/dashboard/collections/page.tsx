import { requireVendor } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getDashboardLocale, trServer } from "@/lib/dashboard-lang";
import CollectionsClient from "./CollectionsClient";

export default async function CollectionsPage() {
  const vendor = await requireVendor();
  const locale = await getDashboardLocale(vendor.language);
  const tr = <T = string,>(frVal: T, enVal: T): T => trServer(locale, frVal, enVal);

  const [collections, allProducts] = await Promise.all([
    prisma.collection.findMany({
      where: { vendorId: vendor.id },
      orderBy: { createdAt: "desc" },
      include: {
        products: {
          select: { id: true, name: true, priceCents: true, imageUrl: true, stock: true },
        },
      },
    }),
    prisma.product.findMany({
      where: { vendorId: vendor.id },
      orderBy: { name: "asc" },
      select: { id: true, name: true, priceCents: true, imageUrl: true, stock: true, collectionId: true },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="a-headline-md text-arctic-900">Collections</h1>
        <p className="a-body-md mt-1 text-arctic-600">
          {tr(
            "Organisez vos produits en collections thématiques (ex: \"Nouveautés\", \"Promos\", \"Meilleures ventes\") avec un lien dédié.",
            "Group your products into themed collections (e.g. \"New Arrivals\", \"Sale\", \"Best Sellers\") with a dedicated shareable link.",
          )}
        </p>
      </div>

      <CollectionsClient
        initialCollections={collections.map((c) => ({
          id: c.id,
          name: c.name,
          slug: c.slug,
          description: c.description,
          imageUrl: c.imageUrl || "",
          productCount: c.products.length,
          products: c.products,
        }))}
        allProducts={allProducts}
        shopSlug={vendor.shopSlug}
        currency={vendor.currency || "USD"}
      />
    </div>
  );
}
