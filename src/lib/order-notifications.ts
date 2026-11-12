import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { formatMoney } from "@/lib/utils";
import { sendWhatsApp } from "@/lib/whatsapp";

const BUYER_PREFIX = "✅ *Paiement reçu";
const VENDOR_PREFIX = "💰 *Commande payée";

/**
 * WhatsApp receipts once an order is fully paid: one to the buyer, one to the
 * vendor. Never throws — a WhatsApp failure must not fail the payment callback.
 * Skips a recipient already notified for this order, so a provider retrying
 * its webhook (or two settlement paths) does not send duplicates.
 */
export async function notifyOrderPaid(orderId: string, via?: string): Promise<void> {
  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        vendorId: true,
        customerName: true,
        customerPhone: true,
        totalCents: true,
        vendor: { select: { shopName: true, currency: true, whatsappNumber: true, phone: true } },
      },
    });
    if (!order) return;

    const sent = await prisma.whatsAppMessage.findMany({
      where: { orderId, direction: "OUT", status: { not: "failed" } },
      select: { body: true },
    });
    const already = (prefix: string) => sent.some((m) => m.body.startsWith(prefix));

    const ref = `#${order.id.slice(-6).toUpperCase()}`;
    const amount = formatMoney(order.totalCents, order.vendor.currency || "XOF");
    const method = via ? ` via ${via}` : "";

    const buyer = order.customerPhone.replace(/\D/g, "");
    if (buyer && !already(BUYER_PREFIX)) {
      await sendWhatsApp({
        vendorId: order.vendorId,
        to: buyer,
        orderId,
        body:
          `${BUYER_PREFIX} !*\n\n` +
          `Boutique : *${order.vendor.shopName}*\n` +
          `Commande : *${ref}*\n` +
          `Montant payé : *${amount}*${method}\n\n` +
          `Merci ! Le vendeur prépare votre commande.`,
      });
    }

    const vendorPhone = (order.vendor.whatsappNumber || order.vendor.phone || "").replace(/\D/g, "");
    if (vendorPhone && !already(VENDOR_PREFIX)) {
      await sendWhatsApp({
        vendorId: order.vendorId,
        to: vendorPhone,
        orderId,
        body:
          `${VENDOR_PREFIX} !*\n\n` +
          `Commande : *${ref}*\n` +
          `Client : ${order.customerName}${buyer ? ` (${buyer})` : ""}\n` +
          `Montant : *${amount}*${method}\n\n` +
          `Vous pouvez préparer et livrer la commande.`,
      });
    }
  } catch (e) {
    logger.error("order.paid_whatsapp_failed", { orderId, error: String(e) });
  }
}
