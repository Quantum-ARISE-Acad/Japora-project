/**
 * Japora public marketplace directory.
 *
 * Read-only helpers for the unauthenticated /marketplace/* and /shop/* pages.
 * Every query filters `isPublic: true` AND `deletedAt: null` so suspended /
 * soft-deleted vendors never leak out. Only the columns the public UI needs
 * are selected — passwordHash and billing fields stay server-side.
 */

import { prisma } from "@/lib/db";

export type ShopCard = {
  id: string;
  shopName: string;
  shopSlug: string;
  bio: string;
  avatarUrl: string;
  region: string;
  category: string;
  currency: string;
  tagline: string;
  verified: boolean;
  products?: { id: string; name: string; priceCents: number; imageUrl: string }[];
};

export type ListShopsOpts = {
  region?: string;
  category?: string;
  q?: string;
  take?: number;
};

const PUBLIC_SHOP_SELECT = {
  id: true,
  shopName: true,
  shopSlug: true,
  bio: true,
  avatarUrl: true,
  region: true,
  category: true,
  currency: true,
  tagline: true,
  verifiedAt: true,
  products: {
    where: { isActive: true },
    take: 3,
    select: { id: true, name: true, priceCents: true, imageUrl: true },
  },
} as const;

/** Map the raw row (verifiedAt) into the public ShopCard (verified boolean). */
function toCard<T extends { verifiedAt: Date | null }>(row: T): Omit<T, "verifiedAt"> & { verified: boolean } {
  const { verifiedAt, ...rest } = row;
  return { ...rest, verified: Boolean(verifiedAt) };
}

/**
 * List public shops. Filters are additive and all optional; pass nothing to
 * get the most recent 24 public shops site-wide.
 */
export async function listShops(opts: ListShopsOpts = {}): Promise<ShopCard[]> {
  const where: Record<string, unknown> = {
    isPublic: true,
    deletedAt: null,
    NOT: {
      email: {
        in: [
          "demo@wcatalog.app",
          "ameyo@soko.app",
          "nouveau.vendeur.google@japora.app",
          "google.merchant@japora.app",
        ],
      },
    },
  };

  if (opts.region && opts.region.trim()) where.region = opts.region.trim();
  if (opts.category && opts.category.trim()) where.category = opts.category.trim();
  if (opts.q && opts.q.trim()) {
    where.shopName = { contains: opts.q.trim() };
  }

  const shops = await prisma.vendor.findMany({
    where,
    select: PUBLIC_SHOP_SELECT,
    orderBy: { createdAt: "desc" },
    take: opts.take ?? 24,
  });

  return shops.map(toCard);
}

/**
 * Public-safe single shop lookup. Returns null for missing / private /
 * soft-deleted vendors so callers can render a 404 without leaking existence.
 */
export async function getShop(slug: string): Promise<
  | (ShopCard & { whatsappNumber: string })
  | null
> {
  if (!slug || typeof slug !== "string") return null;

  const shop = await prisma.vendor.findFirst({
    where: { shopSlug: slug, isPublic: true, deletedAt: null },
    select: { ...PUBLIC_SHOP_SELECT, whatsappNumber: true },
  });

  return shop ? toCard(shop) : null;
}
