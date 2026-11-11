import { NextRequest, NextResponse } from "next/server";
import type { Vendor } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getCurrentVendor } from "@/lib/auth";
import { getClientIp, rateLimit, tooManyRequests, envLimit } from "@/lib/ratelimit";
import { logger } from "@/lib/logger";
import { linkCartSessionToCustomer, upsertFromOrder } from "@/lib/customers";
import { createForUnpaidOrder } from "@/lib/receivables";
import { computeDeposit } from "@/lib/preorder";
import * as affiliate from "@/lib/affiliate";
import { attributeOrder } from "@/lib/campaigns";
import { enqueue, kickDrain } from "@/lib/bus";
import { crossedToZero, stockDepleted } from "@/lib/catalog-events";
import { normalizePhone, isValidPhone } from "@/lib/otp";
import { sendEmail } from "@/lib/email";
import { buyerOrderConfirmationEmail } from "@/lib/email-templates";
import { publicOrigin } from "@/lib/public-origin";
import { sendWhatsApp } from "@/lib/whatsapp";
import { formatMoney } from "@/lib/utils";
import { calculateDeliveryFee, parseDeliveryZones } from "@/lib/delivery";

export async function GET(req: NextRequest) {
  const vendor = await getCurrentVendor();
  if (!vendor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Offset pagination, bounded so a runaway query can't blow up the dashboard.
  const sp = req.nextUrl.searchParams;
  const page = Math.max(1, parseInt(sp.get("page") || "1", 10) || 1);
  const pageSize = Math.min(200, Math.max(1, parseInt(sp.get("pageSize") || "100", 10) || 100));
  const status = sp.get("status");

  const where = {
    vendorId: vendor.id,
    deletedAt: null,
    ...(status ? { status } : {}),
  };

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: { items: true },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.order.count({ where }),
  ]);

  return NextResponse.json({ orders, page, pageSize, total });
}

/**
 * Create an order. Two entry points:
 *  - Public catalog checkout: { shopSlug, items, customerName, ... }
 *  - Dashboard manual add:    { source: "manual", items, ... } (requires auth)
 */
export async function POST(req: NextRequest) {
  const b = await req.json().catch(() => null);
  if (!b) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const source = b.source === "manual" ? "manual" : "catalog";

  // Public catalog orders are spammable; throttle per (ip, shopSlug).
  if (source === "catalog") {
    const ip = getClientIp(req);
    const slug = String(b.shopSlug || "");
    const rl = rateLimit({
      key: `order:${ip}:${slug}`,
      limit: envLimit("ORDER_RATE_LIMIT", 10),
      windowMs: 5 * 60_000,
    });
    if (!rl.allowed) {
      logger.warn("order.rate_limited", { ip, slug });
      return tooManyRequests(rl, "Trop de commandes. Réessayez dans quelques minutes.");
    }
  }

  let vendor: Vendor | null;
  if (source === "manual") {
    vendor = await getCurrentVendor();
  } else {
    const shopSlug = String(b.shopSlug || "").trim();
    vendor = shopSlug ? await prisma.vendor.findUnique({ where: { shopSlug } }) : null;
  }
  if (!vendor) {
    return source === "manual"
      ? NextResponse.json({ error: "Unauthorized" }, { status: 401 })
      : NextResponse.json({ error: "Shop not found" }, { status: 404 });
  }

  const customerName = String(b.customerName || "").trim();
  if (!customerName) {
    return NextResponse.json({ error: "Please enter the customer's name." }, { status: 400 });
  }
  let customerPhone = String(b.customerPhone || "").trim();
  if (customerPhone) {
    const norm = normalizePhone(customerPhone);
    if (!isValidPhone(norm)) {
      return NextResponse.json(
        { error: "Format de numéro de téléphone invalide (8 à 15 chiffres requis)." },
        { status: 400 },
      );
    }
    customerPhone = norm;
  }
  const customerEmail = typeof b.customerEmail === "string" ? b.customerEmail.trim() : "";
  const paymentMethod = typeof b.paymentMethod === "string" ? b.paymentMethod.trim() : "";
  let note = String(b.note || "").trim();
  if (paymentMethod && !note.includes("[PAIEMENT:")) {
    note = `[PAIEMENT: ${paymentMethod}]\n${note}`.trim();
  }

  // Fees come from the vendor configuration, never from a client-supplied amount.
  // Legacy/manual callers that omit fulfillment continue to create pickup orders.
  const fulfillment = b.fulfillment ?? "pickup";
  if (fulfillment !== "pickup" && fulfillment !== "delivery") {
    return NextResponse.json({ error: "Mode de réception invalide." }, { status: 400 });
  }
  let deliveryFeeCents = 0;
  if (fulfillment === "delivery") {
    if (!vendor.deliveryEnabled) {
      return NextResponse.json({ error: "Cette boutique ne propose pas la livraison." }, { status: 400 });
    }
    const zones = parseDeliveryZones(vendor.deliveryZones, vendor.deliveryFeeCents);
    const requestedZone = typeof b.deliveryZone === "string" ? b.deliveryZone.trim() : "";
    const zone = requestedZone
      ? zones.find((z) => z.name.toLowerCase() === requestedZone.toLowerCase())
      : zones[0];
    if (requestedZone && !zone) {
      return NextResponse.json({ error: "Zone de livraison inconnue." }, { status: 400 });
    }
    deliveryFeeCents = calculateDeliveryFee(vendor, zone?.name);
  }

  const rawItems = Array.isArray(b.items) ? b.items : [];
  if (rawItems.length === 0) {
    return NextResponse.json({ error: "Add at least one item." }, { status: 400 });
  }

  const ids = [...new Set(rawItems.map((i: { productId: unknown }) => String(i.productId)))];
  const products = await prisma.product.findMany({
    where: { id: { in: ids as string[] }, vendorId: vendor.id },
  });
  const byId = new Map(products.map((p) => [p.id, p]));

  const lineItems: {
    productId: string;
    productName: string;
    size: string;
    quantity: number;
    unitPriceCents: number;
  }[] = [];

  for (const it of rawItems) {
    const p = byId.get(String(it.productId));
    if (!p) {
      return NextResponse.json({ error: "An item is no longer available." }, { status: 400 });
    }
    const qty = Math.max(1, Math.min(999, parseInt(String(it.qty ?? it.quantity ?? 1), 10) || 1));
    if (p.stock < qty) {
      return NextResponse.json(
        { error: `Only ${p.stock} of "${p.name}" left in stock.` },
        { status: 409 },
      );
    }
    lineItems.push({
      productId: p.id,
      productName: p.name,
      size: String(it.size || ""),
      quantity: qty,
      unitPriceCents: p.priceCents,
    });
  }

  const totalCents = lineItems.reduce((s, li) => s + li.unitPriceCents * li.quantity, 0) + deliveryFeeCents;
  const vendorId = vendor.id;
  const isPreOrder = Boolean(b.isPreOrder);

  // Compute deposit for pre-orders. We use the in-memory `byId` snapshot so
  // depositPercent is consistent with the price quote we just collected.
  let depositCents = 0;
  if (isPreOrder) {
    for (const li of lineItems) {
      const p = byId.get(li.productId);
      if (p) depositCents += computeDeposit(p, li.quantity);
    }
  }
  const balanceDueAt = isPreOrder
    ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    : null;

  const order = await prisma.$transaction(async (tx) => {
    const created = await tx.order.create({
      data: {
        vendorId,
        customerName,
        customerPhone,
        note,
        source,
        status: "NEW",
        totalCents,
        deliveryFeeCents,
        isPreOrder,
        depositCents,
        balanceDueAt,
        paidCents: 0,
        sessionId: typeof b.sessionId === "string" && b.sessionId.trim() ? b.sessionId.trim().slice(0, 128) : null,
        items: { create: lineItems },
      },
    });
    for (const li of lineItems) {
      const after = await tx.product.update({
        where: { id: li.productId },
        data: { stock: { decrement: li.quantity } },
      });
      // The row the atomic decrement returns is the post-value, read inside this
      // transaction. Landing on exactly zero after taking a positive number off
      // means this call crossed the boundary and no concurrent one could also
      // have — so the depletion is announced once, without a lock and without
      // trusting the pre-transaction snapshot in `byId`, which another order
      // could already have made stale.
      if (crossedToZero({ decrementedBy: li.quantity, stockAfter: after.stock })) {
        await enqueue(
          tx,
          stockDepleted(after, vendor, {
            orderId: created.id,
            previousStock: li.quantity,
          }),
        );
      }
    }

    // CRM upsert — denormalised aggregates kept in lockstep with the order
    // create. If the customer has a phone we wire the customerId back onto
    // the freshly-created order.
    const customerId = await upsertFromOrder(tx, vendorId, {
      customerName,
      customerPhone,
      customerEmail,
      totalCents,
    });
    if (customerId) {
      await tx.order.update({
        where: { id: created.id },
        data: { customerId },
      });
      if (created.sessionId) {
        await linkCartSessionToCustomer(tx, vendorId, created.sessionId, {
          customerId,
          customerPhone: customerPhone || null,
        }).catch(() => {});
      }
    }

    return created;
  });

  // Buyer email confirmation (if email provided)
  if (customerEmail && customerEmail.includes("@")) {
    try {
      const origin = publicOrigin(req);
      const payUrl = `${origin}/pay/${order.id}`;
      const emailTemplate = buyerOrderConfirmationEmail({
        orderId: order.id,
        shopName: vendor.shopName,
        customerName,
        items: lineItems.map((li) => ({
          name: li.productName,
          quantity: li.quantity,
          unitPrice: `${(li.unitPriceCents / 100).toFixed(2)} ${vendor?.currency || "USD"}`,
          size: li.size,
        })),
        total: `${(totalCents / 100).toFixed(2)} ${vendor?.currency || "USD"}`,
        payUrl,
        vendorWhatsApp: vendor.whatsappNumber || vendor.phone || undefined,
      });

      await sendEmail({
        vendorId: vendor.id,
        to: customerEmail,
        subject: emailTemplate.subject,
        html: emailTemplate.html,
        text: emailTemplate.text,
        template: "buyer_order_confirmation",
      });
    } catch (e) {
      logger.error("order.buyer_email_failed", { orderId: order.id, error: String(e) });
    }
  }

  // Send order summary + FedaPay payment link via WhatsApp Cloud API if customerPhone provided
  if (customerPhone) {
    try {
      const origin = (process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin || "http://localhost:5174").replace(/\/$/, "");
      const payUrl = `${origin}/pay/${order.id}`;
      const amountFormatted = formatMoney(totalCents, vendor.currency || "XOF");
      const itemsText = lineItems
        .map((li) => `• ${li.quantity}× ${li.productName}${li.size ? ` (${li.size})` : ""}`)
        .join("\n");

      await sendWhatsApp({
        vendorId: vendor.id,
        to: customerPhone,
        orderId: order.id,
        body:
          `🛍️ *Commande enregistrée chez ${vendor.shopName} !*\n\n` +
          `Réf : *#${order.id.slice(-6).toUpperCase()}*\n` +
          `${itemsText}\n\n` +
          `💰 Total : *${amountFormatted}*\n\n` +
          `👉 *Lien de paiement sécurisé FedaPay (T-Money, Flooz, Mobile Money & Carte) :*\n${payUrl}`,
      });
    } catch (e) {
      logger.error("order.buyer_whatsapp_failed", { orderId: order.id, error: String(e) });
    }
  }

  // Post-commit side effects — record affiliate attribution + capture an
  // unpaid balance as a receivable. We run these outside the transaction so
  // a failure here does not roll back the order.
  if (typeof b.affiliateCode === "string" && b.affiliateCode.trim()) {
    try {
      await affiliate.recordAttribution(order.id, b.affiliateCode);
    } catch (e) {
      logger.error("order.affiliate_attribution_failed", {
        orderId: order.id,
        error: String(e),
      });
    }
  }

  // CTWA last-touch attribution — credits the campaign if this phone clicked a
  // trackable link and started a WhatsApp chat before checking out on the web.
  if (customerPhone) {
    try {
      await attributeOrder({ orderId: order.id, vendorId, phone: customerPhone, revenueCents: totalCents });
    } catch (e) {
      logger.error("order.campaign_attribution_failed", { orderId: order.id, error: String(e) });
    }
  }

  // Receivable for the open balance, if any. We treat an order as unpaid if
  // paidCents < totalCents AND no PaymentIntent has succeeded yet (a fresh
  // order has neither).
  const paidCents = order.paidCents ?? 0;
  if (paidCents < totalCents) {
    const succeededIntent = await prisma.paymentIntent.findFirst({
      where: { orderId: order.id, status: "succeeded" },
      select: { id: true },
    });
    if (!succeededIntent) {
      try {
        await createForUnpaidOrder(prisma, vendorId, order.id, {
          amountCents: totalCents - paidCents,
          note: "Auto-created from unpaid order",
        });
      } catch (e) {
        logger.error("order.receivable_create_failed", {
          orderId: order.id,
          error: String(e),
        });
      }
    }
  }

  // Non-blocking sync to Soko CRM (WCRM port 4000)
  try {
    const sokoUrl = (process.env.SOKO_API_URL || "http://localhost:4000").replace(/\/$/, "");
    const syncSecret = (process.env.SOKO_SYNC_SECRET || "").trim();
    if (syncSecret) void fetch(`${sokoUrl}/api/integrations/japora-order`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${syncSecret}` },
      body: JSON.stringify({
        orderId: order.id,
        shopSlug: vendor.shopSlug,
        shopName: vendor.shopName,
        vendorEmail: vendor.email,
        vendorPhone: vendor.whatsappNumber || vendor.phone,
        customerName,
        customerPhone,
        customerEmail,
        totalCents,
        currency: vendor.currency || "XOF",
        note,
        paymentMethod: paymentMethod || undefined,
        items: lineItems.map((li) => ({
          name: li.productName,
          quantity: li.quantity,
          size: li.size,
          unitPriceCents: li.unitPriceCents,
        })),
      }),
    }).catch(() => {
      // Soko service might be offline or running standalone; continue smoothly
    });
  } catch {
    // ignore
  }

  kickDrain();
  return NextResponse.json({ ok: true, orderId: order.id, totalCents, deliveryFeeCents });
}
