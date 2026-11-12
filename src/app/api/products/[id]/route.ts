import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentVendor } from "@/lib/auth";
import { enqueueMany, kickDrain } from "@/lib/bus";
import { productDeleted } from "@/lib/catalog-events";
import { updateProductForVendor } from "@/lib/products";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  const vendor = await getCurrentVendor();
  if (!vendor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const b = await req.json().catch(() => ({}));
  if (!b || typeof b !== "object" || Array.isArray(b)) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const result = await updateProductForVendor(vendor, id, b as Record<string, unknown>);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ ok: true, product: result.product });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const vendor = await getCurrentVendor();
  if (!vendor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const existing = await prisma.product.findFirst({
    where: { id, vendorId: vendor.id },
  });
  if (!existing) return NextResponse.json({ error: "Product not found" }, { status: 404 });

  await prisma.$transaction(async (tx) => {
    await tx.product.delete({ where: { id } });
    await enqueueMany(tx, [productDeleted(existing, vendor)]);
  });
  kickDrain();
  return NextResponse.json({ ok: true });
}
