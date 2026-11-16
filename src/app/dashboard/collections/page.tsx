import { requireVendor } from "@/lib/auth";
import { prisma } from "@/lib/db";
import CollectionsClient from "./CollectionsClient";

export default async function CollectionsPage() {
  const vendor = await requireVendor();

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
          Organisez vos produits en collections thématiques (ex: &quot;Nouveautés&quot;, &quot;Promos&quot;, &quot;Meilleures ventes&quot;) avec un lien dédié.
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
