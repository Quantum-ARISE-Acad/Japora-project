import { requireVendor } from "@/lib/auth";
import { prisma } from "@/lib/db";
import AnalyticsClient from "./AnalyticsClient";

export const dynamic = "force-dynamic";

export default async function AnalyticsPage() {
  const vendor = await requireVendor();
  const currency = vendor.currency || "XOF";

  const [
    orders,
    products,
    customers,
    funnelEvents,
    inboundCount,
    outboundCount,
    botEvents,
    campaigns,
    openReceivables,
  ] = await Promise.all([
    prisma.order.findMany({
      where: { vendorId: vendor.id, deletedAt: null },
      include: { items: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.product.findMany({
      where: { vendorId: vendor.id },
      include: { collection: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.customer.findMany({
      where: { vendorId: vendor.id, deletedAt: null },
      orderBy: { totalSpentCents: "desc" },
      take: 50,
    }),
    prisma.funnelEvent.findMany({
      where: { vendorId: vendor.id },
      select: {
        stage: true,
        sessionId: true,
        productId: true,
        orderId: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: 2500,
    }),
    prisma.whatsAppMessage.count({
      where: { vendorId: vendor.id, direction: "IN" },
    }),
    prisma.whatsAppMessage.count({
      where: { vendorId: vendor.id, direction: "OUT" },
    }),
    prisma.botEvent.findMany({
      where: { vendorId: vendor.id },
      select: { intent: true, responded: true },
      orderBy: { createdAt: "desc" },
      take: 500,
    }),
    prisma.campaign.findMany({
      where: { vendorId: vendor.id, deletedAt: null },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    prisma.receivable.findMany({
      where: { vendorId: vendor.id, status: { in: ["OPEN", "PARTIAL"] } },
      select: { amountCents: true },
    }),
  ]);

  const intentMap = new Map<string, number>();
  let botRepliesCount = 0;
  for (const b of botEvents) {
    if (b.responded) botRepliesCount++;
    const k = b.intent || "unknown";
    intentMap.set(k, (intentMap.get(k) || 0) + 1);
  }
  const topIntents = [...intentMap.entries()]
    .map(([intent, count]) => ({ intent, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const openReceivablesCents = openReceivables.reduce((s, r) => s + r.amountCents, 0);

  return (
    <AnalyticsClient
      shopName={vendor.shopName}
      shopSlug={vendor.shopSlug}
      currency={currency}
      orders={orders.map((o) => ({
        id: o.id,
        customerName: o.customerName,
        customerPhone: o.customerPhone,
        status: o.status,
        totalCents: o.totalCents,
        source: o.source || "catalog",
        createdAt: o.createdAt.toISOString(),
        items: o.items.map((it) => ({
          productId: it.productId,
          productName: it.productName,
          quantity: it.quantity,
          unitPriceCents: it.unitPriceCents,
        })),
      }))}
      products={products.map((p) => ({
        id: p.id,
        name: p.name,
        priceCents: p.priceCents,
        stock: p.stock,
        isActive: p.isActive,
        imageUrl: p.imageUrl || "",
        collectionName: p.collection?.name ?? null,
      }))}
      customers={customers.map((c) => ({
        id: c.id,
        name: c.name,
        phone: c.phone,
        totalSpentCents: c.totalSpentCents,
        orderCount: c.orderCount,
        lastOrderAt: c.lastOrderAt ? c.lastOrderAt.toISOString() : null,
      }))}
      funnelEvents={funnelEvents.map((e) => ({
        stage: e.stage,
        sessionId: e.sessionId,
        productId: e.productId,
        orderId: e.orderId,
        createdAt: e.createdAt.toISOString(),
      }))}
      whatsappMetrics={{
        inboundCount,
        outboundCount,
        botRepliesCount,
        topIntents,
      }}
      campaigns={campaigns.map((c) => ({
        id: c.id,
        name: c.name,
        clicks: c.clicks,
        orders: c.orders,
        revenueCents: c.revenueCents,
      }))}
      openReceivablesCents={openReceivablesCents}
      openReceivablesCount={openReceivables.length}
    />
  );
}
