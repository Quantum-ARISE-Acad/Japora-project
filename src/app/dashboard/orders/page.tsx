import { requireVendor } from "@/lib/auth";
import { prisma } from "@/lib/db";
import OrdersBoard from "./OrdersBoard";

export default async function OrdersPage() {
  const vendor = await requireVendor();

  const [orders, products] = await Promise.all([
    prisma.order.findMany({
      where: { vendorId: vendor.id, deletedAt: null },
      orderBy: { createdAt: "desc" },
      include: { items: true },
    }),
    prisma.product.findMany({
      where: { vendorId: vendor.id, isActive: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const orderDto = orders.map((o) => ({
    id: o.id,
    customerName: o.customerName,
    customerPhone: o.customerPhone,
    status: o.status,
    totalCents: o.totalCents,
    note: o.note,
    source: o.source,
    createdAt: o.createdAt.toISOString(),
    items: o.items.map((i) => ({
      id: i.id,
      productName: i.productName,
      size: i.size,
      quantity: i.quantity,
      unitPriceCents: i.unitPriceCents,
    })),
  }));

  const productDto = products.map((p) => ({
    id: p.id,
    name: p.name,
    priceCents: p.priceCents,
    sizes: p.sizes,
    stock: p.stock,
  }));

  return (
    <OrdersBoard
      initialOrders={orderDto}
      products={productDto}
      currency={vendor.currency}
      shopName={vendor.shopName}
    />
  );
}
