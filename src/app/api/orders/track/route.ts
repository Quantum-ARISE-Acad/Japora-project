import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { digitsOnly } from "@/lib/utils";
import { findTrackedOrdersForVendor, parseDealNote } from "@/lib/bot";
import { publicOrigin } from "@/lib/public-origin";
import { getServerTr } from "@/lib/public-locale";

const STATUS_LABELS: Record<string, { label: string; progress: number }> = {
  NEW: { label: "🕒 Nouvelle — En attente de confirmation par le vendeur", progress: 25 },
  CONFIRMED: { label: "✅ Confirmée par le vendeur — En préparation", progress: 55 },
  PAID: { label: "💳 Payée — En cours d'expédition / livraison", progress: 80 },
  DELIVERED: { label: "🎉 Livrée — Commande terminée", progress: 100 },
  CANCELLED: { label: "❌ Annulée / Refusée", progress: 100 },
};

/**
 * Public order & deal tracking lookup for a specific shop.
 * Customers can search by Order Reference (`orderRef` / `query`, e.g. #AB12CD)
 * or by WhatsApp phone number (`phone` / `query`).
 *
 * Strictly enforces tenant isolation (`vendorId = vendor.id`) and requires a
 * non-empty reference or phone query.
 */
export async function POST(req: NextRequest) {
  const tr = await getServerTr();
  try {
    const body = await req.json().catch(() => ({}));
    const shopSlug = String(body.shopSlug || "").trim();
    const rawRef = String(body.orderRef || body.query || "").trim();
    const rawPhone = String(body.phone || body.query || "").trim();

    if (!shopSlug) {
      return NextResponse.json(
        { error: tr("Veuillez fournir la boutique (shopSlug).", "Please provide the shop (shopSlug).") },
        { status: 400 },
      );
    }

    const vendor = await prisma.vendor.findFirst({
      where: { shopSlug, deletedAt: null },
      select: { id: true, shopName: true, currency: true, whatsappNumber: true, whatsappPhoneNumberId: true },
    });

    if (!vendor) {
      return NextResponse.json({ error: tr("Boutique introuvable.", "Shop not found.") }, { status: 404 });
    }

    const cleanQuery = rawRef.replace(/^#/, "").trim().toLowerCase();
    const cleanDigits = digitsOnly(rawPhone);

    // An empty tracking query must never return arbitrary recent orders.
    if (cleanQuery.length < 3 && cleanDigits.length < 6) {
      return NextResponse.json({
        ok: true,
        shopName: vendor.shopName,
        currency: vendor.currency,
        orders: [],
        message: "Veuillez saisir une référence de commande (ex: #AB12CD) ou votre numéro WhatsApp.",
      });
    }

    const matches = await findTrackedOrdersForVendor(vendor.id, {
      orderRef: rawRef,
      phone: rawPhone,
      limit: 5,
    });

    const origin = publicOrigin(req);

    return NextResponse.json({
      ok: true,
      shopName: vendor.shopName,
      currency: vendor.currency,
      orders: matches.map((o) => {
        const dealMeta = parseDealNote(o.note);
        const isDeal = dealMeta.isDeal || o.source === "whatsapp_deal";
        const baseInfo = STATUS_LABELS[o.status] || { label: o.status, progress: 50 };
        let statusLabel = baseInfo.label;
        if (isDeal) {
          if (o.status === "NEW") {
            statusLabel = "🤝 Deal proposé — En attente de validation par le vendeur";
          } else if (o.status === "CONFIRMED") {
            statusLabel = "🎉 Deal ACCEPTÉ par le vendeur — En attente de paiement";
          } else if (o.status === "CANCELLED") {
            statusLabel = "❌ Deal refusé par le vendeur";
          }
        }
        return {
          id: o.id,
          refCode: o.id.slice(-6).toUpperCase(),
          customerName: o.customerName,
          status: o.status,
          statusLabel,
          progressPercent: baseInfo.progress,
          totalCents: o.totalCents,
          currency: vendor.currency,
          source: o.source,
          createdAt: o.createdAt.toISOString(),
          updatedAt: o.updatedAt.toISOString(),
          payUrl: `${origin.replace(/\/$/, "")}/pay/${o.id}`,
          items: o.items.map((it) => ({
            productName: it.productName,
            quantity: it.quantity,
            size: it.size,
            unitPriceCents: it.unitPriceCents,
          })),
        };
      }),
    });
  } catch {
    return NextResponse.json(
      { error: tr("Erreur lors de la recherche de votre commande.", "Error while looking up your order.") },
      { status: 500 },
    );
  }
}
