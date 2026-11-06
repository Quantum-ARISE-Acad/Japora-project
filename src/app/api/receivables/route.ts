import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentVendor } from "@/lib/auth";
import {
  createForUnpaidOrder,
  listForVendor,
  totalsOpen,
  RECEIVABLE_STATUSES,
  type ReceivableStatus,
} from "@/lib/receivables";
import { logger } from "@/lib/logger";

export async function GET(req: NextRequest) {
  const vendor = await getCurrentVendor();
  if (!vendor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sp = req.nextUrl.searchParams;
  const statusRaw = sp.get("status");
  const status =
    statusRaw && (RECEIVABLE_STATUSES as readonly string[]).includes(statusRaw)
      ? (statusRaw as ReceivableStatus)
      : undefined;

  const [receivables, outstandingCents] = await Promise.all([
    listForVendor(vendor.id, { status }),
    totalsOpen(vendor.id),
  ]);

  return NextResponse.json({ receivables, outstandingCents });
}

/**
 * Manual create — for receivables that don't originate from an order (e.g.
 * a vendor logs a friend's tab from memory).
 */
export async function POST(req: NextRequest) {
  const vendor = await getCurrentVendor();
  if (!vendor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const b = await req.json().catch(() => null);
  if (!b) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const amountCents = Math.max(0, Math.floor(Number(b.amountCents) || 0));
  if (amountCents <= 0) {
    return NextResponse.json({ error: "Amount must be greater than zero." }, { status: 400 });
  }

  const customerId =
    typeof b.customerId === "string" && b.customerId ? b.customerId : null;
  const orderId = typeof b.orderId === "string" && b.orderId ? b.orderId : null;
  const dueDate = typeof b.dueDate === "string" && b.dueDate ? b.dueDate : null;
  const note = typeof b.note === "string" ? b.note : "";

  // Cheap ownership checks so we don't link a vendor's IOU to another
  // vendor's customer/order.
  if (customerId) {
    const c = await prisma.customer.findFirst({ where: { id: customerId, vendorId: vendor.id } });
    if (!c) return NextResponse.json({ error: "Customer not found" }, { status: 404 });
  }
  if (orderId) {
    const o = await prisma.order.findFirst({ where: { id: orderId, vendorId: vendor.id } });
    if (!o) return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  const created = await createForUnpaidOrder(prisma, vendor.id, orderId, {
    amountCents,
    customerId,
    dueDate,
    note,
  });
  logger.info("receivable.created", {
    vendorId: vendor.id,
    receivableId: created.id,
    amountCents,
  });

  return NextResponse.json({ ok: true, receivable: created });
}
