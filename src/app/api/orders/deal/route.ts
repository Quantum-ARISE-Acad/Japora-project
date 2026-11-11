import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { placeDealOrder } from "@/lib/bot";

/**
 * Public endpoint allowing a customer from the Shop AI Assistant to submit a
 * Deal Proposal (price negotiation) that goes directly to the vendor's Dashboard
 * (/dashboard/orders) for validation.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const shopSlug = String(body.shopSlug || "").trim();
    const productId = String(body.productId || "").trim();
    const customerName = String(body.customerName || "Client Boutique").trim();
    const customerPhone = String(body.customerPhone || "").trim();
    const proposedPrice = Number(body.proposedPrice);
    const quantity = Math.max(1, parseInt(String(body.quantity || "1"), 10) || 1);
    const customNote = String(body.note || "").trim();

    if (!shopSlug || !productId || !Number.isFinite(proposedPrice) || proposedPrice <= 0) {
      return NextResponse.json(
        { error: "Veuillez sélectionner un produit et indiquer votre prix proposé." },
        { status: 400 },
      );
    }

    const vendor = await prisma.vendor.findUnique({
      where: { shopSlug },
      select: { id: true, shopName: true, currency: true },
    });
    if (!vendor) {
      return NextResponse.json({ error: "Boutique introuvable." }, { status: 404 });
    }

    const product = await prisma.product.findFirst({
      where: { id: productId, vendorId: vendor.id, isActive: true },
    });
    if (!product) {
      return NextResponse.json({ error: "Produit introuvable dans cette boutique." }, { status: 404 });
    }

    const proposedTotalCents = Math.round(proposedPrice * 100);
    const { orderId, refCode, botReply } = await placeDealOrder({
      vendorId: vendor.id,
      fromPhone: customerPhone,
      customerName,
      product,
      proposedTotalCents,
      currency: vendor.currency,
      shopName: vendor.shopName,
      quantity,
      customNote,
    });

    return NextResponse.json({
      ok: true,
      orderId,
      refCode,
      message: botReply.reply,
    });
  } catch (e) {
    console.error("Deal creation error:", e);
    return NextResponse.json(
      { error: "Erreur lors de l'envoi de votre proposition de deal." },
      { status: 500 },
    );
  }
}

