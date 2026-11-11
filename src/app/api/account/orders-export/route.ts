import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentVendor } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { buildOrdersCsv } from "@/lib/orders-csv";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const vendor = await getCurrentVendor();
  if (!vendor) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const fromParam = searchParams.get("from");
  const toParam = searchParams.get("to");
  const statusParam = searchParams.get("status");

  const whereClause: {
    vendorId: string;
    deletedAt: null;
    status?: string;
    createdAt?: { gte?: Date; lte?: Date };
  } = {
    vendorId: vendor.id,
    deletedAt: null,
  };

  if (statusParam && statusParam.trim()) {
    whereClause.status = statusParam.trim();
  }

  if (fromParam || toParam) {
    whereClause.createdAt = {};
    if (fromParam) {
      const fromDate = new Date(fromParam);
      if (!isNaN(fromDate.getTime())) whereClause.createdAt.gte = fromDate;
    }
    if (toParam) {
      const toDate = new Date(toParam);
      if (!isNaN(toDate.getTime())) whereClause.createdAt.lte = toDate;
    }
  }

  const orders = await prisma.order.findMany({
    where: whereClause,
    include: {
      items: true,
      paymentIntents: {
        select: {
          provider: true,
          providerRef: true,
          status: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const currency = vendor.currency || "XOF";
  const csvData = buildOrdersCsv(orders, currency);

  logger.info("account.orders_csv_exported", {
    vendorId: vendor.id,
    count: orders.length,
  });

  const filename = `commandes_${vendor.shopSlug}_${new Date().toISOString().slice(0, 10)}.csv`;

  return new Response(csvData, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
  });
}
