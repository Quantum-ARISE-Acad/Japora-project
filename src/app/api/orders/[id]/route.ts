import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentVendor } from "@/lib/auth";
import { formatMoney, isOrderStatus } from "@/lib/utils";
import { evaluateAndGrant } from "@/lib/trust";
import { enqueue, kickDrain } from "@/lib/bus";
import { crossedToZero, stockDepleted } from "@/lib/catalog-events";
import { recordConfirmedOrder } from "@/lib/funnel";
import { sendWhatsApp, sendWhatsAppInteractive, sendWhatsAppTemplate } from "@/lib/whatsapp";
import { parseWhatsAppAssistantConfig } from "@/lib/whatsapp-config";
import { parseDealNote } from "@/lib/bot";
import { createForUnpaidOrder } from "@/lib/receivables";
import { logger } from "@/lib/logger";
import { publicOrigin } from "@/lib/public-origin";
import { getServerTr } from "@/lib/public-locale";

type Params = { params: Promise<{ id: string }> };

function buildOrderStatusWhatsAppMessage(opts: {
  orderId: string;
  customerName: string;
  shopName: string;
  status: string;
  totalCents: number;
  currency: string;
  itemsSummary: string;
  payUrl: string;
  isDeal?: boolean;
  originalCents?: number;
}): string {
  const ref = opts.orderId.slice(-6).toUpperCase();
  const total = formatMoney(opts.totalCents, opts.currency);
  const name = opts.customerName || "Client";

  if (opts.isDeal) {
    if (opts.status === "CONFIRMED") {
      const origPart = opts.originalCents
        ? ` (au lieu de ${formatMoney(opts.originalCents, opts.currency)})`
        : "";
      return (
        `🎉 Bonne nouvelle ${name} ! Votre proposition de DEAL #${ref} chez ${opts.shopName} a été ACCEPTÉE par le vendeur !\n\n` +
        `Articles : ${opts.itemsSummary}\n` +
        `Prix accordé : ${total}${origPart}\n` +
        `Paiement & Suivi : ${opts.payUrl}\n\n` +
        `Merci pour votre confiance !`
      );
    }
    if (opts.status === "CANCELLED") {
      return (
        `🤝 Bonjour ${name}, le vendeur de ${opts.shopName} n'a pas pu retenir votre proposition de deal #${ref} (${total}).\n\n` +
        `Vous pouvez proposer un autre montant en répondant "Deal" ou commander au tarif catalogue.`
      );
    }
  }

  switch (opts.status) {
    case "CONFIRMED":
      return (
        `✅ Bonjour ${name}, votre commande #${ref} chez ${opts.shopName} est CONFIRMÉE !\n\n` +
        `Articles : ${opts.itemsSummary}\n` +
        `Total : ${total}\n` +
        `Lien paiement & suivi : ${opts.payUrl}\n\n` +
        `Nous préparons votre commande.`
      );
    case "PAID":
      return (
        `💳 Merci ${name} ! Le paiement de ${total} pour votre commande #${ref} chez ${opts.shopName} a bien été reçu.\n\n` +
        `Votre commande est en cours de préparation / expédition.\n` +
        `Suivi : ${opts.payUrl}`
      );
    case "DELIVERED":
      return (
        `🎉 Bonjour ${name}, votre commande #${ref} chez ${opts.shopName} a été LIVRÉE !\n\n` +
        `Merci pour votre confiance et à très bientôt chez ${opts.shopName} 💚`
      );
    case "CANCELLED":
      return (
        `❌ Bonjour ${name}, votre commande #${ref} chez ${opts.shopName} a été annulée.\n\n` +
        `Répondez à ce message ou appuyez sur un bouton ci-dessous si vous souhaitez commander à nouveau.`
      );
    default:
      return (
        `📦 Mise à jour de votre commande #${ref} chez ${opts.shopName} : Statut = ${opts.status} (${total}).\n` +
        `Suivi : ${opts.payUrl}`
      );
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const tr = await getServerTr();
  const vendor = await getCurrentVendor();
  if (!vendor) return NextResponse.json({ error: tr("Veuillez vous connecter.", "Please sign in.") }, { status: 401 });

  const { id } = await params;
  const order = await prisma.order.findFirst({
    where: { id, vendorId: vendor.id, deletedAt: null },
    include: { items: true },
  });
  if (!order) return NextResponse.json({ error: tr("Commande introuvable", "Order not found") }, { status: 404 });

  const b = await req.json().catch(() => ({}));
  const data: Record<string, unknown> = {};

  if (typeof b.note === "string") data.note = b.note.trim();
  if (typeof b.customerName === "string" && b.customerName.trim()) {
    data.customerName = b.customerName.trim();
  }
  if (typeof b.customerPhone === "string") data.customerPhone = b.customerPhone.trim();

  if (typeof b.status === "string") {
    if (!isOrderStatus(b.status)) {
      return NextResponse.json({ error: tr("Statut invalide.", "Invalid status.") }, { status: 400 });
    }
    data.status = b.status;
  }

  const newStatus = (data.status as string) ?? order.status;
  const wasCancelled = order.status === "CANCELLED";
  const willCancel = newStatus === "CANCELLED";
  const dealInfo = parseDealNote(order.note);
  const isDealOrder = dealInfo.isDeal || order.source === "whatsapp_deal";

  // Update deal marker inside note when vendor confirms or cancels a deal
  if (isDealOrder && typeof data.note === "undefined" && order.note) {
    if (newStatus === "CONFIRMED") {
      data.note = order.note.replace(/^\[DEAL_PENDING/, "[DEAL_ACCEPTED");
    } else if (newStatus === "CANCELLED") {
      data.note = order.note.replace(/^\[DEAL_(?:PENDING|ACCEPTED)/, "[DEAL_REJECTED");
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.order.update({ where: { id }, data });

    // For deal orders: stock was not decremented while PENDING (status === NEW).
    // When vendor accepts (NEW -> CONFIRMED), decrement stock now.
    if (isDealOrder && order.status === "NEW" && newStatus === "CONFIRMED") {
      for (const it of order.items) {
        if (it.productId) {
          await tx.product.update({
            where: { id: it.productId },
            data: { stock: { decrement: it.quantity } },
          });
        }
      }
    } else if (willCancel && !wasCancelled && !(isDealOrder && order.status === "NEW")) {
      for (const it of order.items) {
        if (it.productId) {
          await tx.product.update({
            where: { id: it.productId },
            data: { stock: { increment: it.quantity } },
          });
        }
      }
    } else if (!willCancel && wasCancelled) {
      for (const it of order.items) {
        if (it.productId) {
          const after = await tx.product.update({
            where: { id: it.productId },
            data: { stock: { decrement: it.quantity } },
          });
          if (crossedToZero({ decrementedBy: it.quantity, stockAfter: after.stock })) {
            await enqueue(
              tx,
              stockDepleted(after, vendor, { orderId: id, previousStock: it.quantity }),
            );
          }
        }
      }
    }
  });

  if (isDealOrder && order.status === "NEW" && newStatus === "CONFIRMED") {
    await createForUnpaidOrder(prisma, vendor.id, id, {
      amountCents: order.totalCents,
      note: "Deal validé par le vendeur",
    }).catch(() => {});
  }

  if ((newStatus === "PAID" || newStatus === "DELIVERED") && newStatus !== order.status) {
    await evaluateAndGrant(vendor.id).catch(() => {});
    await recordConfirmedOrder({
      orderId: id,
      vendorId: vendor.id,
      shopSlug: vendor.shopSlug,
      totalCents: order.totalCents,
      sessionId: order.sessionId,
    }).catch(() => {});
  }

  // Automatic WhatsApp status update to customer when status changes
  const targetPhone =
    (typeof b.customerPhone === "string" ? b.customerPhone.trim() : order.customerPhone) || "";
  const waCfg = parseWhatsAppAssistantConfig(vendor.uiPrefs);
  if (newStatus !== order.status && targetPhone && waCfg.autoNotifyOrderStatus) {
    try {
      const origin =
        publicOrigin(req);
      const payUrl = `${origin.replace(/\/$/, "")}/pay/${id}`;
      const itemsSummary = order.items
        .map((it) => `${it.quantity}× ${it.productName}`)
        .join(", ");
      const msgBody = buildOrderStatusWhatsAppMessage({
        orderId: id,
        customerName: order.customerName,
        shopName: vendor.shopName,
        status: newStatus,
        totalCents: order.totalCents,
        currency: vendor.currency,
        itemsSummary,
        payUrl,
        isDeal: isDealOrder,
        originalCents: dealInfo.originalCents,
      });
      const ir = await sendWhatsAppInteractive({
        vendorId: vendor.id,
        to: targetPhone,
        body: msgBody,
        orderId: id,
        buttons: isDealOrder && newStatus === "CANCELLED"
          ? [
              { id: "DEAL", title: "🤝 Nouvelle offre" },
              { id: "MENU", title: "🛍️ Voir catalogue" },
            ]
          : [
              { id: `TRACK:${id}`, title: "📦 Suivre commande" },
              { id: "MENU", title: "🛍️ Voir catalogue" },
            ],
      });
      if (ir.status === "failed") {
        const textResult = await sendWhatsApp({
          vendorId: vendor.id,
          to: targetPhone,
          body: msgBody,
          orderId: id,
        });
        // If outside the 24h Meta session window (error 131047), fall back to Meta's approved template
        if (textResult.status === "failed" && newStatus === "CONFIRMED") {
          const refShort = id.slice(-6).toUpperCase();
          const dateLabel = new Date().toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          });
          await sendWhatsAppTemplate({
            vendorId: vendor.id,
            to: targetPhone,
            templateName: "jaspers_market_order_confirmation_v1",
            languageCode: "en_US",
            parameters: [order.customerName || "Client", refShort, dateLabel],
            orderId: id,
          });
        }
      }
    } catch (e) {
      logger.warn("order.whatsapp_auto_notify_failed", { orderId: id, error: String(e) });
    }
  }

  kickDrain();
  return NextResponse.json({ ok: true, note: data.note ?? order.note });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const tr = await getServerTr();
  const vendor = await getCurrentVendor();
  if (!vendor) return NextResponse.json({ error: tr("Veuillez vous connecter.", "Please sign in.") }, { status: 401 });

  const { id } = await params;
  const order = await prisma.order.findFirst({
    where: { id, vendorId: vendor.id, deletedAt: null },
    include: { items: true },
  });
  if (!order) return NextResponse.json({ error: tr("Commande introuvable", "Order not found") }, { status: 404 });

  await prisma.$transaction(async (tx) => {
    if (order.status !== "CANCELLED") {
      for (const it of order.items) {
        if (it.productId && order.source !== "whatsapp_deal") {
          await tx.product.update({
            where: { id: it.productId },
            data: { stock: { increment: it.quantity } },
          });
        }
      }
    }
    await tx.order.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  });

  return NextResponse.json({ ok: true });
}
