import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentVendor } from "@/lib/auth";
import { markPaid } from "@/lib/receivables";
import { logger } from "@/lib/logger";
import { getServerTr } from "@/lib/public-locale";

type Params = { params: Promise<{ id: string }> };

/**
 * Dashboard action endpoint. `action` semantics:
 *  - paid       : mark fully settled (paidAt set, status PAID).
 *  - partial    : record a partial payment (amountCents required).
 *  - write_off  : status WRITTEN_OFF (vendor gave up chasing).
 *
 * Without `action`, falls back to updating note / dueDate only.
 */
export async function PATCH(req: NextRequest, { params }: Params) {
  const tr = await getServerTr();
  const vendor = await getCurrentVendor();
  if (!vendor) return NextResponse.json({ error: tr("Veuillez vous connecter.", "Please sign in.") }, { status: 401 });

  const { id } = await params;
  const existing = await prisma.receivable.findFirst({
    where: { id, vendorId: vendor.id },
  });
  if (!existing) {
    return NextResponse.json({ error: tr("Créance introuvable", "Receivable not found") }, { status: 404 });
  }

  const b = await req.json().catch(() => ({}));
  const action = typeof b.action === "string" ? b.action : null;

  if (action === "paid") {
    const updated = await markPaid(id, vendor.id, { amountCents: existing.amountCents });
    logger.info("receivable.paid", { vendorId: vendor.id, receivableId: id });
    return NextResponse.json({ ok: true, receivable: updated });
  }

  if (action === "partial") {
    const amount = Math.max(0, Math.floor(Number(b.amountCents) || 0));
    if (amount <= 0) {
      return NextResponse.json({ error: tr("Le montant doit être supérieur à zéro.", "Amount must be greater than zero.") }, { status: 400 });
    }
    const updated = await markPaid(id, vendor.id, { amountCents: amount });
    logger.info("receivable.partial", {
      vendorId: vendor.id,
      receivableId: id,
      amountCents: amount,
    });
    return NextResponse.json({ ok: true, receivable: updated });
  }

  if (action === "write_off") {
    const updated = await prisma.receivable.update({
      where: { id },
      data: { status: "WRITTEN_OFF" },
    });
    logger.info("receivable.written_off", { vendorId: vendor.id, receivableId: id });
    return NextResponse.json({ ok: true, receivable: updated });
  }

  // Plain field updates — note and dueDate only.
  const data: Record<string, unknown> = {};
  if (typeof b.note === "string") data.note = b.note.slice(0, 2000);
  if (typeof b.dueDate === "string") {
    data.dueDate = b.dueDate ? new Date(b.dueDate) : null;
  }
  if (Object.keys(data).length === 0) {
    return NextResponse.json({ ok: true, receivable: existing });
  }
  const updated = await prisma.receivable.update({ where: { id }, data });
  return NextResponse.json({ ok: true, receivable: updated });
}
