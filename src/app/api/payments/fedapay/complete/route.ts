import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getCurrentVendor } from "@/lib/auth";
import { getPaymentProvider, newReference } from "@/lib/payments";
import { formatMoney } from "@/lib/utils";
import { sendWhatsApp } from "@/lib/whatsapp";
import { evaluateAndGrant } from "@/lib/trust";
import { recordConfirmedOrder } from "@/lib/funnel";

/**
 * POST /api/payments/fedapay/complete
 *
 * Handles:
 * 1. `action: "initiate_link"` — creates a FedaPay PaymentIntent for a PaymentLink and returns `checkoutUrl`.
 * 2. `action: "initiate_test"` — creates a FedaPay Sandbox test PaymentIntent from the vendor Money dashboard.
 * 3. `action: "initiate_subscription"` — creates a FedaPay PaymentIntent for the vendor's Japora Pro subscription.
 * 4. `action: "complete"` (default) — completes/settles a FedaPay Sandbox PaymentIntent (approve or decline),
 *    updates linked Order / PaymentLink / Subscription, and sends WhatsApp Cloud API confirmation.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Corps de requête invalide." }, { status: 400 });
  }

  const action = String(body.action || "complete");

  // 1. Initiate FedaPay checkout for a PaymentLink
  if (action === "initiate_link") {
    const paymentLinkId = String(body.paymentLinkId || "").trim();
    const customerName = String(body.customerName || "Client").trim();
    const customerPhone = String(body.customerPhone || "").trim();
    const network = String(body.network || "T-Money").trim();

    if (!paymentLinkId) {
      return NextResponse.json({ error: "paymentLinkId requis." }, { status: 400 });
    }

    const link = await prisma.paymentLink.findUnique({
      where: { id: paymentLinkId },
      include: { vendor: { select: { id: true, shopName: true, currency: true } } },
    });
    if (!link) {
      return NextResponse.json({ error: "Lien de paiement introuvable." }, { status: 404 });
    }
    if (link.isPaid) {
      return NextResponse.json({ error: "Ce lien de paiement a déjà été réglé." }, { status: 409 });
    }

    const reference = newReference();
    const returnUrl = `/pay/link/${link.id}?paid=1`;

    const intent = await prisma.paymentIntent.create({
      data: {
        vendorId: link.vendorId,
        provider: "fedapay",
        providerRef: reference,
        amountCents: link.amountCents,
        currency: link.currency || link.vendor.currency || "XOF",
        status: "pending",
        metadata: JSON.stringify({
          type: "payment_link",
          paymentLinkId: link.id,
          title: link.description || "Lien de paiement",
          customerName,
          customerPhone,
          network,
          returnUrl,
        }),
      },
    });

    const provider = getPaymentProvider("fedapay");
    const initRes = await provider.initiate({
      orderId: link.id,
      vendorId: link.vendorId,
      amountCents: link.amountCents,
      currency: link.currency || link.vendor.currency || "XOF",
      customerName,
      customerPhone,
      reference,
      network,
      returnUrl,
      metadata: { paymentLinkId: link.id, title: link.description || "Lien de paiement" },
    });

    await prisma.paymentIntent.update({
      where: { id: intent.id },
      data: { providerRef: initRes.providerRef },
    });

    return NextResponse.json({
      ok: true,
      paymentIntentId: intent.id,
      providerRef: initRes.providerRef,
      checkoutUrl: initRes.checkoutUrl || `/pay/fedapay-sandbox/${reference}`,
    });
  }

  // 2. Initiate a FedaPay Sandbox Test Payment or Pro Subscription from Dashboard Money
  if (action === "initiate_test" || action === "initiate_subscription") {
    const vendor = await getCurrentVendor();
    if (!vendor) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    const isSub = action === "initiate_subscription";
    const currency = vendor.currency || "XOF";
    const defaultAmountCents = isSub
      ? currency === "XOF" || currency === "XAF"
        ? 5000 * 100
        : 900
      : Number(body.amountCents) > 0
        ? Number(body.amountCents)
        : currency === "XOF" || currency === "XAF"
          ? 2500 * 100
          : 1000;

    const reference = newReference();
    const returnUrl = `/dashboard/billing?ok=1&ref=${reference}`;

    const intent = await prisma.paymentIntent.create({
      data: {
        vendorId: vendor.id,
        provider: "fedapay",
        providerRef: reference,
        amountCents: defaultAmountCents,
        currency,
        status: "pending",
        metadata: JSON.stringify({
          type: isSub ? "subscription" : "sandbox_test",
          subscriptionVendorId: isSub ? vendor.id : undefined,
          title: isSub ? "Abonnement Japora Pro (Mensuel)" : String(body.title || "Paiement Test FedaPay Sandbox"),
          customerName: vendor.shopName,
          customerPhone: vendor.whatsappNumber || vendor.momoNumber || "+22890000001",
          returnUrl,
        }),
      },
    });

    const provider = getPaymentProvider("fedapay");
    const initRes = await provider.initiate({
      orderId: intent.id,
      vendorId: vendor.id,
      amountCents: defaultAmountCents,
      currency,
      customerName: vendor.shopName,
      customerPhone: vendor.whatsappNumber || "+22890000001",
      reference,
      returnUrl,
      metadata: {
        type: isSub ? "subscription" : "sandbox_test",
        subscriptionVendorId: isSub ? vendor.id : undefined,
      },
    });

    await prisma.paymentIntent.update({
      where: { id: intent.id },
      data: { providerRef: initRes.providerRef },
    });

    return NextResponse.json({
      ok: true,
      paymentIntentId: intent.id,
      providerRef: initRes.providerRef,
      checkoutUrl: initRes.checkoutUrl || `/pay/fedapay-sandbox/${reference}`,
    });
  }

  // 3. Complete / Settle a FedaPay Sandbox Transaction
  const providerRef = String(body.providerRef || "").trim();
  const outcome = body.outcome === "failed" ? "failed" : "succeeded";
  const wallet = String(body.wallet || "T-Money Togo").trim();
  const customerPhone = String(body.customerPhone || "").trim();
  const customerName = String(body.customerName || "").trim();

  if (!providerRef) {
    return NextResponse.json({ error: "Référence de transaction manquante." }, { status: 400 });
  }

  const intent = await prisma.paymentIntent.findFirst({
    where: { providerRef },
  });

  if (!intent) {
    return NextResponse.json({ error: "Transaction introuvable." }, { status: 404 });
  }

  let meta: Record<string, string> = {};
  try {
    meta = intent.metadata ? JSON.parse(intent.metadata) : {};
  } catch {
    meta = {};
  }

  const updatedMeta = {
    ...meta,
    wallet,
    customerPhone: customerPhone || meta.customerPhone || undefined,
    customerName: customerName || meta.customerName || undefined,
    sandboxSettledAt: new Date().toISOString(),
    fedaSandboxTxId: `feda_sbx_${intent.id.slice(-8)}`,
  };

  await prisma.paymentIntent.update({
    where: { id: intent.id },
    data: {
      status: outcome,
      completedAt: new Date(),
      metadata: JSON.stringify(updatedMeta),
    },
  });

  let redirectUrl = meta.returnUrl || "/dashboard/billing";

  if (outcome === "succeeded") {
    const vendor = await prisma.vendor.findUnique({
      where: { id: intent.vendorId },
      select: { id: true, shopName: true, shopSlug: true, currency: true, whatsappNumber: true },
    });

    // A) Settle linked Order if present
    if (intent.orderId) {
      const order = await prisma.order.findUnique({
        where: { id: intent.orderId },
      });
      if (order) {
        const newPaid = Math.max(order.totalCents, order.paidCents + intent.amountCents);
        await prisma.order.update({
          where: { id: order.id },
          data: {
            paidCents: newPaid,
            status: "PAID",
            ...(customerPhone && !order.customerPhone ? { customerPhone } : {}),
            ...(customerName && (!order.customerName || order.customerName === "Guest")
              ? { customerName }
              : {}),
          },
        });

        // Settle open receivables
        await prisma.receivable.updateMany({
          where: { orderId: order.id, status: { not: "PAID" } },
          data: { status: "PAID", paidAt: new Date() },
        });

        await evaluateAndGrant(order.vendorId).catch(() => {});
        if (vendor) {
          await recordConfirmedOrder({
            orderId: order.id,
            vendorId: order.vendorId,
            shopSlug: vendor.shopSlug,
            totalCents: order.totalCents,
            sessionId: order.sessionId,
          }).catch(() => {});
        }

        const amountText = formatMoney(intent.amountCents, intent.currency);
        const buyerPhone = customerPhone || order.customerPhone;
        if (buyerPhone && vendor) {
          await sendWhatsApp({
            vendorId: vendor.id,
            to: buyerPhone,
            orderId: order.id,
            body:
              `✅ *Paiement confirmé via FedaPay (${wallet}) !*\n\n` +
              `Boutique : *${vendor.shopName}*\n` +
              `Commande : *#${order.id.slice(-6).toUpperCase()}*\n` +
              `Montant réglé : *${amountText}*\n` +
              `Réf FedaPay : \`${providerRef}\`\n\n` +
              `Merci pour votre confiance ! Votre commande est en cours de préparation.`,
          }).catch(() => {});
        }

        if (vendor?.whatsappNumber) {
          await sendWhatsApp({
            vendorId: vendor.id,
            to: vendor.whatsappNumber,
            orderId: order.id,
            body:
              `💰 *Nouveau paiement FedaPay reçu !*\n\n` +
              `Commande : *#${order.id.slice(-6).toUpperCase()}*\n` +
              `Client : ${customerName || order.customerName} (${buyerPhone || "N/A"})\n` +
              `Montant : *${amountText}* via *${wallet}*`,
          }).catch(() => {});
        }

        redirectUrl = meta.returnUrl || `/pay/${order.id}?paid=1`;
        revalidatePath(`/pay/${order.id}`);
        revalidatePath("/dashboard/orders");
      }
    }

    // B) Settle linked PaymentLink if present
    if (meta.paymentLinkId) {
      const link = await prisma.paymentLink.findUnique({
        where: { id: String(meta.paymentLinkId) },
      });
      if (link) {
        await prisma.paymentLink.update({
          where: { id: link.id },
          data: { isPaid: true, paidAt: new Date() },
        });

        const amountText = formatMoney(link.amountCents, link.currency);
        const buyerPhone = customerPhone || meta.customerPhone;
        if (buyerPhone && vendor) {
          await sendWhatsApp({
            vendorId: vendor.id,
            to: buyerPhone,
            body:
              `✅ *Paiement reçu via FedaPay (${wallet})*\n\n` +
              `Objet : *${link.description || "Lien de paiement"}*\n` +
              `Boutique : *${vendor.shopName}*\n` +
              `Montant : *${amountText}*\n` +
              `Réf : \`${providerRef}\`\n\n` +
              `Merci pour votre règlement !`,
          }).catch(() => {});
        }

        redirectUrl = meta.returnUrl || `/pay/link/${link.id}?paid=1`;
        revalidatePath(`/pay/link/${link.id}`);
        revalidatePath("/dashboard/payment-links");
      }
    }

    // C) Activate Subscription if present
    if (meta.subscriptionVendorId) {
      await prisma.vendor.update({
        where: { id: String(meta.subscriptionVendorId) },
        data: { subscriptionStatus: "active" },
      });
      redirectUrl = "/dashboard/billing?ok=1";
    }
  } else {
    // Failed outcome
    if (intent.orderId) {
      redirectUrl = `/pay/${intent.orderId}?failed=1`;
    } else if (meta.paymentLinkId) {
      redirectUrl = `/pay/link/${meta.paymentLinkId}?failed=1`;
    } else {
      redirectUrl = "/dashboard/billing?canceled=1";
    }
  }

  revalidatePath("/dashboard/billing");
  revalidatePath("/dashboard");

  return NextResponse.json({
    ok: true,
    status: outcome,
    redirectUrl,
    providerRef,
  });
}
