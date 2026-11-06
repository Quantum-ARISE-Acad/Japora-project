import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * GET /api/ecosystem/shops
 * Exposes real Japora shops and active products for Wataru ecosystem integrations
 * (e.g. WEscrow Safe Hands deal generator, Soko CRM inventory sync).
 */
export async function GET() {
  try {
    const vendors = await prisma.vendor.findMany({
      select: {
        id: true,
        shopName: true,
        shopSlug: true,
        email: true,
        whatsappNumber: true,
        momoNumber: true,
        currency: true,
        verifiedAt: true,
        products: {
          select: {
            id: true,
            name: true,
            description: true,
            priceCents: true,
            imageUrl: true,
            isActive: true,
            collection: {
              select: {
                name: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      ok: true,
      shops: vendors.map((v) => ({
        id: v.id,
        name: v.shopName,
        slug: v.shopSlug,
        email: v.email,
        phone: v.momoNumber || v.whatsappNumber || "",
        currency: v.currency || "XOF",
        verified: Boolean(v.verifiedAt),
        products: v.products.map((p) => ({
          id: p.id,
          name: p.name,
          description: p.description,
          priceCents: p.priceCents,
          category: p.collection?.name || "goods",
          imageUrl: p.imageUrl,
          status: p.isActive ? "ACTIVE" : "INACTIVE",
        })),
      })),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
