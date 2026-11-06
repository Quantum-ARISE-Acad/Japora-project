import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentVendor } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { setCustomerMarketingConsent } from "@/lib/customers";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const vendor = await getCurrentVendor();
  if (!vendor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const customer = await prisma.customer.findFirst({
    where: { id, vendorId: vendor.id, deletedAt: null },
  });
  if (!customer) return NextResponse.json({ error: "Customer not found" }, { status: 404 });

  // Recent orders for the side drawer — capped so we never load a year of
  // history into a popover.
  const orders = await prisma.order.findMany({
    where: { vendorId: vendor.id, customerId: id, deletedAt: null },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: {
      id: true,
      status: true,
      totalCents: true,
      paidCents: true,
      createdAt: true,
      source: true,
    },
  });

  return NextResponse.json({ customer, orders });
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const vendor = await getCurrentVendor();
  if (!vendor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const existing = await prisma.customer.findFirst({
    where: { id, vendorId: vendor.id, deletedAt: null },
  });
  if (!existing) return NextResponse.json({ error: "Customer not found" }, { status: 404 });

  const b = await req.json().catch(() => ({}));
  const data: Record<string, unknown> = {};

  if (typeof b.name === "string" && b.name.trim()) data.name = b.name.trim().slice(0, 120);
  if (typeof b.email === "string") {
    const e = b.email.trim();
    data.email = e ? e.slice(0, 254) : null;
  }
  if (typeof b.notes === "string") data.notes = b.notes.slice(0, 5000);

  if (typeof b.marketingConsent === "boolean") {
    try {
      const customer = await setCustomerMarketingConsent(prisma, vendor.id, id, {
        marketingConsent: b.marketingConsent,
        marketingConsentBasis: typeof b.marketingConsentBasis === "string" ? b.marketingConsentBasis : null,
      });
      logger.info("customer.consent.updated", { vendorId: vendor.id, customerId: id, marketingConsent: b.marketingConsent });
      return NextResponse.json({ ok: true, customer });
    } catch (err) {
      if (err instanceof Error && err.message === "customer_not_found") {
        return NextResponse.json({ error: "Customer not found" }, { status: 404 });
      }
      if (err instanceof Error && err.message === "valid_consent_basis_required") {
        return NextResponse.json({ error: "A valid consent basis is required when granting consent." }, { status: 400 });
      }
      return NextResponse.json({ error: "Invalid consent update." }, { status: 400 });
    }
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ ok: true, customer: existing });
  }

  const customer = await prisma.customer.update({ where: { id }, data });
  logger.info("customer.updated", { vendorId: vendor.id, customerId: id });
  return NextResponse.json({ ok: true, customer });
}
