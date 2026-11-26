import { NextRequest, NextResponse } from "next/server";
import { getCurrentVendor } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getServerTr } from "@/lib/public-locale";
import { parseWhatsAppAssistantConfig } from "@/lib/whatsapp-config";

export async function GET(req: NextRequest) {
  const tr = await getServerTr();
  const vendor = await getCurrentVendor();
  if (!vendor) return NextResponse.json({ error: tr("Veuillez vous connecter.", "Please sign in.") }, { status: 401 });

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

  const waCfg = parseWhatsAppAssistantConfig(vendor.uiPrefs);
  const recentAlerts = (waCfg.diagnostics || []).filter(
    (d) =>
      d.severity !== "ok" &&
      (!sinceParam || new Date(d.at).getTime() > since.getTime()),
  );
  const latestActiveError = (waCfg.diagnostics || []).find((d) => d.severity !== "ok") || null;

  return NextResponse.json({
    orders: newOrders,
    unreadCount,
    whatsappAlerts: recentAlerts,
    latestWhatsappIssue: latestActiveError,
    serverTime: new Date().toISOString(),
  });
}
