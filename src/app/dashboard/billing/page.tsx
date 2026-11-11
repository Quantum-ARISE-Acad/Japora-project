import { requireVendor } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getEntitlement, computeCommissionCents } from "@/lib/billing";
import { getVendorFedaPayConfig } from "@/lib/payments/fedapay";
import MoneyDashboardClient from "./MoneyDashboardClient";

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; canceled?: string; ref?: string }>;
}) {
  const vendor = await requireVendor();
  const ent = getEntitlement(vendor);
  const sp = await searchParams;
  const fedaConfig = await getVendorFedaPayConfig(vendor.id);

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  const [orders, paymentLinks, paymentIntents] = await Promise.all([
    prisma.order.findMany({
      where: { vendorId: vendor.id, deletedAt: null },
      select: {
        id: true,
        totalCents: true,
        paidCents: true,
        status: true,
        customerName: true,
        createdAt: true,
      },
    }),
    prisma.paymentLink.findMany({
      where: { vendorId: vendor.id },
      select: {
        id: true,
        amountCents: true,
        isPaid: true,
        description: true,
      },
    }),
    prisma.paymentIntent.findMany({
      where: { vendorId: vendor.id },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
  ]);

  const paidOrders = orders.filter((o) => o.status === "PAID" || o.status === "DELIVERED");
  const pendingOrders = orders.filter(
    (o) => o.status !== "PAID" && o.status !== "DELIVERED" && o.status !== "CANCELLED",
  );

  const paidThisMonth = paidOrders.filter(
    (o) => o.createdAt >= monthStart && o.createdAt < monthEnd,
  );
  const commissionCents = paidThisMonth.reduce(
    (sum, o) => sum + computeCommissionCents(o.totalCents, vendor.commissionPct || undefined),
    0,
  );

  const paidOrdersCents = paidOrders.reduce((s, o) => s + o.totalCents, 0);
  const paidLinks = paymentLinks.filter((l) => l.isPaid);
  const paidLinksCents = paidLinks.reduce((s, l) => s + l.amountCents, 0);

  // Also include standalone succeeded Sandbox test transactions
  const standaloneFedaCents = paymentIntents
    .filter((pi) => pi.status === "succeeded" && !pi.orderId)
    .reduce((s, pi) => {
      try {
        const m = pi.metadata ? JSON.parse(pi.metadata) : {};
        if (m.paymentLinkId) return s; // already counted in paidLinksCents
      } catch {
        // ignore
      }
      return s + pi.amountCents;
    }, 0);

  const totalCollectedCents = paidOrdersCents + paidLinksCents + standaloneFedaCents;

  const pendingOrdersCents = pendingOrders.reduce(
    (s, o) => s + Math.max(0, o.totalCents - o.paidCents),
    0,
  );
  const pendingLinksCents = paymentLinks
    .filter((l) => !l.isPaid)
    .reduce((s, l) => s + l.amountCents, 0);
  const pendingCents = pendingOrdersCents + pendingLinksCents;

  const fedaSuccessCount = paymentIntents.filter(
    (pi) => pi.provider === "fedapay" && pi.status === "succeeded",
  ).length;

  const transactions = paymentIntents.map((pi) => {
    let meta: Record<string, any> = {};
    try {
      meta = pi.metadata ? JSON.parse(pi.metadata) : {};
    } catch {
      meta = {};
    }
    const linkedOrder = pi.orderId ? orders.find((o) => o.id === pi.orderId) : null;
    return {
      id: pi.id,
      orderId: pi.orderId,
      provider: pi.provider,
      providerRef: pi.providerRef || pi.id,
      amountCents: pi.amountCents,
      currency: pi.currency,
      status: pi.status,
      wallet: String(meta.wallet || meta.network || ""),
      title:
        meta.title ||
        (linkedOrder
          ? `Commande #${linkedOrder.id.slice(-6).toUpperCase()}`
          : "Paiement Japora"),
      customerName:
        meta.customerName || linkedOrder?.customerName || "",
      createdAt: pi.createdAt.toISOString(),
    };
  });

  return (
    <MoneyDashboardClient
      currency={vendor.currency || "XOF"}
      shopName={vendor.shopName}
      shopSlug={vendor.shopSlug}
      momoNumber={vendor.momoNumber || ""}
      whatsappNumber={vendor.whatsappNumber || ""}
      initialFedaConfig={{
        environment: fedaConfig.environment,
        publicKey: fedaConfig.publicKey,
        secretKey: fedaConfig.secretKey,
        webhookSecret: fedaConfig.webhookSecret || "",
        enabled: fedaConfig.enabled,
      }}
      stats={{
        totalCollectedCents,
        pendingCents,
        commissionCents,
        commissionPct: vendor.commissionPct,
        paidOrdersCount: paidOrders.length,
        paidLinksCount: paidLinks.length,
        fedaSuccessCount,
      }}
      entitlement={{
        active: ent.active,
        status: ent.status,
        summary: ent.summary,
        trialDaysRemaining: ent.trialDaysRemaining,
      }}
      transactions={transactions}
      queryStatus={sp}
    />
  );
}
