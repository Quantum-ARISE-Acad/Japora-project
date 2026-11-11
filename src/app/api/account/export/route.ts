import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentVendor } from "@/lib/auth";
import { logger } from "@/lib/logger";

/**
 * GDPR data-export endpoint. Streams a JSON dump of everything we hold for
 * this vendor. The file downloads with a sensible filename so the user can
 * archive or send it to an authority.
 */
export async function GET() {
  const vendor = await getCurrentVendor();
  if (!vendor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [products, orders, emails, whatsappMessages] = await Promise.all([
    prisma.product.findMany({ where: { vendorId: vendor.id } }),
    prisma.order.findMany({ where: { vendorId: vendor.id }, include: { items: true } }),
    prisma.emailMessage.findMany({ where: { vendorId: vendor.id } }),
    prisma.whatsAppMessage.findMany({ where: { vendorId: vendor.id } }),
  ]);

  // Redact secrets/credentials from the export.
  const { passwordHash: _pw, ...vendorPublic } = vendor;
  void _pw;

  const payload = {
    exportedAt: new Date().toISOString(),
    vendor: vendorPublic,
    products,
    orders,
    emails: emails.map((e) => ({ ...e, body: `[${e.body.length} chars]` })),
    whatsappMessages,
  };

  logger.info("account.export", { vendorId: vendor.id });

  const filename = `wcatalog-export-${vendor.shopSlug}-${new Date().toISOString().slice(0, 10)}.json`;
  return new Response(JSON.stringify(payload, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
