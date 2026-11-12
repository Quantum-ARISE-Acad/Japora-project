import type { Product, Vendor } from "@prisma/client";
import { prisma } from "./db";
import { parsePriceToCents } from "./utils";
import { enqueue, enqueueMany, kickDrain } from "./bus";
import {
  type BusEventInput,
  becameDepleted,
  becamePublished,
  priceChanged,
  productPublished,
  productRecord,
  productUpdated,
  stockDepleted,
} from "./catalog-events";

export type CollectionOwnershipResult =
  | { ok: true; collectionId: string | null }
  | { ok: false; status: 400 | 403 | 404; error: string };

/**
 * Verifies that a supplied `collectionId` (if non-empty) exists and belongs to
 * the given `vendorId`.
 */
export async function verifyVendorCollectionOwnership(
  vendorId: string,
  rawCollectionId: unknown,
): Promise<CollectionOwnershipResult> {
  if (
    rawCollectionId === undefined ||
    rawCollectionId === null ||
    (typeof rawCollectionId === "string" && !rawCollectionId.trim())
  ) {
    return { ok: true, collectionId: null };
  }

  if (typeof rawCollectionId !== "string") {
    return { ok: false, status: 400, error: "Invalid collectionId." };
  }

  const trimmed = rawCollectionId.trim();
  const collection = await prisma.collection.findUnique({
    where: { id: trimmed },
    select: { id: true, vendorId: true },
  });

  if (!collection) {
    return { ok: false, status: 404, error: "Collection not found." };
  }

  if (collection.vendorId !== vendorId) {
    return {
      ok: false,
      status: 403,
      error: "Forbidden: collection belongs to another vendor.",
    };
  }

  return { ok: true, collectionId: collection.id };
}

export type ProductMutationResult =
  | { ok: true; product: Product }
  | { ok: false; status: 400 | 403 | 404; error: string };

/**
 * Creates a product for the authenticated Vendor after verifying `collectionId`
 * ownership when provided.
 */
export async function createProductForVendor(
  vendor: Pick<Vendor, "id" | "currency" | "shopSlug">,
  b: Record<string, unknown>,
): Promise<ProductMutationResult> {
  const name = String(b.name || "").trim();
  if (!name) {
    return { ok: false, status: 400, error: "Product name is required." };
  }

  const priceCents = parsePriceToCents((b.price ?? b.priceCents ?? 0) as string | number);
  if (priceCents <= 0) {
    return { ok: false, status: 400, error: "Enter a valid price." };
  }

  const collectionCheck = await verifyVendorCollectionOwnership(vendor.id, b.collectionId);
  if (!collectionCheck.ok) {
    return collectionCheck;
  }

  const wholesalePrice = b.wholesalePrice ?? b.wholesalePriceCents;
  const wholesalePriceCents =
    wholesalePrice !== undefined && wholesalePrice !== null && wholesalePrice !== ""
      ? parsePriceToCents(wholesalePrice as string | number)
      : null;
  const wholesaleMinQty = Math.max(1, parseInt(String(b.wholesaleMinQty ?? 1), 10) || 1);
  const preOrderAllowed = Boolean(b.preOrderAllowed);
  const depositPercent = Math.min(100, Math.max(0, parseInt(String(b.depositPercent ?? 0), 10) || 0));
  const condition = ["new", "used", "refurbished"].includes(String(b.condition || ""))
    ? String(b.condition)
    : "new";

  const product = await prisma.$transaction(async (tx) => {
    const created = await tx.product.create({
      data: {
        vendorId: vendor.id,
        name,
        description: String(b.description || "").trim(),
        priceCents,
        imageUrl: String(b.imageUrl || "").trim(),
        sizes: String(b.sizes || "").trim(),
        stock: Math.max(0, parseInt(String(b.stock ?? 0), 10) || 0),
        isActive: b.isActive !== false,
        condition,
        collectionId: collectionCheck.collectionId,
        wholesalePriceCents: wholesalePriceCents && wholesalePriceCents > 0 ? wholesalePriceCents : null,
        wholesaleMinQty,
        preOrderAllowed,
        depositPercent,
      },
    });
    if (becamePublished(null, created)) {
      await enqueue(tx, productPublished(created, vendor));
    }
    return created;
  });

  kickDrain();
  return { ok: true, product };
}

/**
 * Updates an existing product belonging to the authenticated Vendor after
 * verifying both product ownership and (when supplied) `collectionId` ownership.
 */
export async function updateProductForVendor(
  vendor: Pick<Vendor, "id" | "currency" | "shopSlug">,
  productId: string,
  b: Record<string, unknown>,
): Promise<ProductMutationResult> {
  const existing = await prisma.product.findFirst({
    where: { id: productId, vendorId: vendor.id },
  });
  if (!existing) {
    return { ok: false, status: 404, error: "Product not found" };
  }

  const data: Record<string, unknown> = {};

  if (typeof b.name === "string" && b.name.trim()) data.name = b.name.trim();
  if (typeof b.description === "string") data.description = b.description.trim();
  if (b.price !== undefined || b.priceCents !== undefined) {
    const cents = parsePriceToCents((b.price ?? b.priceCents) as string | number);
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
      const parsed = parsePriceToCents(rawWholesale as string | number);
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
    const collectionCheck = await verifyVendorCollectionOwnership(vendor.id, b.collectionId);
    if (!collectionCheck.ok) {
      return collectionCheck;
    }
    data.collectionId = collectionCheck.collectionId;
  }

  const product = await prisma.$transaction(async (tx) => {
    const updated = await tx.product.update({
      where: { id: existing.id },
      data,
    });

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
  return { ok: true, product };
}
