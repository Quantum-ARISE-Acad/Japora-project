import { NextRequest, NextResponse } from "next/server";
import { getCurrentVendor } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  const vendor = await getCurrentVendor();
  if (!vendor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sp = req.nextUrl.searchParams;
  const sinceParam = sp.get("since");
  const since = sinceParam ? new Date(sinceParam) : new Date(Date.now() - 60_000);

  const newOrders = await prisma.order.findMany({
    where: {
      vendorId: vendor.id,
      deletedAt: null,
      createdAt: { gt: since },
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      customerName: true,
      totalCents: true,
      status: true,
      createdAt: true,
    },
    take: 10,
  });

  const unreadCount = await prisma.order.count({
    where: {
      vendorId: vendor.id,
      status: "NEW",
      deletedAt: null,
    },
  });

  return NextResponse.json({
    orders: newOrders,
    unreadCount,
    serverTime: new Date().toISOString(),
  });
}
