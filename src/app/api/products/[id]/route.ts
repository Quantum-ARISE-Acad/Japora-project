import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentVendor } from "@/lib/auth";
import { parsePriceToCents } from "@/lib/utils";
import { enqueueMany, kickDrain } from "@/lib/bus";
import {
  type BusEventInput,
  becameDepleted,
  becamePublished,
  priceChanged,
  productPublished,
  productDeleted,
  productRecord,
  productUpdated,
  stockDepleted,
} from "@/lib/catalog-events";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  const vendor = await getCurrentVendor();
  if (!vendor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const existing = await prisma.product.findFirst({
    where: { id, vendorId: vendor.id },
  });
  if (!existing) return NextResponse.json({ error: "Product not found" }, { status: 404 });

  const b = await req.json().catch(() => ({}));
  const data: Record<string, unknown> = {};

  if (typeof b.name === "string" && b.name.trim()) data.name = b.name.trim();
  if (typeof b.description === "string") data.description = b.description.trim();
  if (b.price !== undefined || b.priceCents !== undefined) {
    const cents = parsePriceToCents(b.price ?? b.priceCents);
    if (cents > 0) data.priceCents = cents;
  }
  if (typeof b.imageUrl === "string") data.imageUrl = b.imageUrl.trim();
  if (typeof b.sizes === "string") data.sizes = b.sizes.trim();
  if (b.stock !== undefined) data.stock = Math.max(0, parseInt(String(b.stock), 10) || 0);
  if (typeof b.isActive === "boolean") data.isActive = b.isActive;
  if (b.wholesalePrice !== undefined || b.wholesalePriceCents !== undefined) {
    const rawWholesale = b.wholesalePrice ?? b.wholesalePriceCents;
    if (rawWholesale === null || rawWholesale === "" || rawWholesale === 0) {
      data.wholesalePriceCents = null;
    } else {
      const parsed = parsePriceToCents(rawWholesale);
      data.wholesalePriceCents = parsed > 0 ? parsed : null;
    }
  }
  if (b.wholesaleMinQty !== undefined) {
    data.wholesaleMinQty = Math.max(1, parseInt(String(b.wholesaleMinQty), 10) || 1);
  }
  if (b.preOrderAllowed !== undefined) {
    data.preOrderAllowed = Boolean(b.preOrderAllowed);
  }
  if (b.depositPercent !== undefined) {
    data.depositPercent = Math.min(100, Math.max(0, parseInt(String(b.depositPercent), 10) || 0));
  }
  if (typeof b.condition === "string" && ["new", "used", "refurbished"].includes(b.condition)) {
    data.condition = b.condition;
  }
  if (b.collectionId !== undefined) {
    data.collectionId = typeof b.collectionId === "string" && b.collectionId.trim() ? b.collectionId.trim() : null;
  }

  // The single write site for the record, the price and a direct stock edit —
  // so it is the single emission site for three of the catalogue's four facts.
  //
  // The stock transition here is the one that cannot use the atomic
  // post-decrement value the order paths use, because this is an absolute write.
  // Its "before" is `existing`, the row already read above for the ownership
  // check; `becameDepleted` documents what that costs.
  //
  // A product turned OFF is an update, not a depletion: the shelf is not empty,
  // the merchant withdrew the line. Retiring a SKU is `catalog.sku.retired`,
  // which this product declares and does not yet publish.
  const product = await prisma.$transaction(async (tx) => {
    const updated = await tx.product.update({ where: { id }, data });

    const before = productRecord(existing, vendor);
    const after = productRecord(updated, vendor);
    const recordChanged = Object.keys(after).some(
      (k) =>
        k !== "price_minor" &&
        k !== "currency" &&
        JSON.stringify(after[k]) !== JSON.stringify(before[k]),
    );

    const events: BusEventInput[] = [];
    if (becamePublished(existing, updated)) {
      // The publication carries the whole record, so it stands in for the update.
      events.push(productPublished(updated, vendor));
    } else if (recordChanged) {
      events.push(productUpdated(updated, vendor));
    }
    if (updated.priceCents !== existing.priceCents) {
      events.push(priceChanged(updated, vendor, { previousPriceCents: existing.priceCents }));
    }
    if (becameDepleted(existing, updated)) {
      events.push(stockDepleted(updated, vendor, { previousStock: existing.stock }));
    }
    await enqueueMany(tx, events);
    return updated;
  });

  kickDrain();
  return NextResponse.json({ ok: true, product });
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
