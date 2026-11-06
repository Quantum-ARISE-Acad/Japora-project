import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { digitsOnly } from "@/lib/utils";
import { parseDealNote } from "@/lib/bot";

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
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const shopSlug = String(body.shopSlug || "").trim();
    const rawRef = String(body.orderRef || body.query || "").trim();
    const rawPhone = String(body.phone || body.query || "").trim();

    if (!shopSlug) {
      return NextResponse.json(
        { error: "Veuillez fournir la boutique (shopSlug)." },
        { status: 400 },
      );
    }

    const vendor = await prisma.vendor.findUnique({
      where: { shopSlug },
      select: { id: true, shopName: true, currency: true, whatsappNumber: true, whatsappPhoneNumberId: true },
    });

    if (!vendor) {
      return NextResponse.json({ error: "Boutique introuvable." }, { status: 404 });
    }

    const cleanQuery = rawRef.replace(/^#/, "").trim().toLowerCase();
    const cleanDigits = digitsOnly(rawPhone);

    // Query both the shop's orders and any recent WhatsApp/deal orders that match the phone/ref
    const recentOrders = await prisma.order.findMany({
      where: {
        deletedAt: null,
        OR: [
          { vendorId: vendor.id },
          { source: { in: ["whatsapp", "whatsapp_deal"] } },
        ],
      },
      include: { items: true },
      orderBy: { createdAt: "desc" },
      take: 200,
    });

    const matches =
      !cleanQuery && !cleanDigits
        ? recentOrders.filter((o) => o.vendorId === vendor.id || o.source === "whatsapp" || o.source === "whatsapp_deal")
        : recentOrders.filter((o) => {
            const idLower = o.id.toLowerCase();
            const refEnd = idLower.slice(-6);
            const refStart = idLower.slice(0, 8);
            if (
              cleanQuery.length >= 3 &&
              (idLower === cleanQuery ||
                refEnd === cleanQuery ||
                refStart === cleanQuery ||
                idLower.endsWith(cleanQuery) ||
                idLower.startsWith(cleanQuery) ||
                idLower.includes(cleanQuery))
            ) {
              return true;
            }
            if (cleanDigits.length >= 6 && o.customerPhone) {
              const orderDigits = digitsOnly(o.customerPhone);
              if (
                orderDigits === cleanDigits ||
                orderDigits.endsWith(cleanDigits.slice(-8)) ||
                cleanDigits.endsWith(orderDigits.slice(-8)) ||
                orderDigits.includes(cleanDigits)
              ) {
                return true;
              }
            }
            return false;
          });

    // Auto-adopt any matched WhatsApp orders into this shop's vendorId so the Dashboard stays 100% in sync
    for (const m of matches.slice(0, 10)) {
      if (m.vendorId !== vendor.id && (m.source === "whatsapp" || m.source === "whatsapp_deal")) {
        await prisma.order.update({ where: { id: m.id }, data: { vendorId: vendor.id } }).catch(() => {});
      }
    }

    const origin =
      req.nextUrl.origin || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:5174";

    return NextResponse.json({
      ok: true,
      shopName: vendor.shopName,
      currency: vendor.currency,
      orders: matches.slice(0, 5).map((o) => {
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
      { error: "Erreur lors de la recherche de votre commande." },
      { status: 500 },
    );
  }
}
