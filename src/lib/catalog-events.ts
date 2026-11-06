/**
 * The four facts the catalogue owes the ecosystem.
 *
 * Japora ships the behaviour for `catalog.product.published`,
 * `catalog.product.updated`, `catalog.price.changed` and
 * `catalog.stock.depleted` and has never published one of them. Sixteen
 * subscriptions across eight products point at those four names; eleven of them
 * are live handlers with real bodies. This module builds the payloads; `bus.ts`
 * carries them.
 *
 * Payloads were chosen by reading what the consumers actually take out of
 * `data`, not by inventing a shape:
 *
 *   - WAFanout rebuilds a Meta/Google feed row and *requires* title,
 *     description, price_minor, currency, availability, condition, image_link
 *     and link. A payload missing any of them files the product under
 *     "announced by the catalogue, not renderable here".
 *   - WAStudio refuses a subject whose type is not `product`, and reads `title`.
 *   - WAReach, WAAuthority and WAPartner read `name` (falling back to `title`);
 *     WAPartner also reads `category`.
 *   - WASetup asks two questions of every published product — has it a price,
 *     has it a photograph — and looks for the photograph under `image_url`,
 *     never `image_link`. Both spellings are carried, with the same value.
 *   - WAAds keeps ids only, and refuses to launch a dynamic-product campaign
 *     while its list is empty.
 *   - WAOrders reads `data.sku` on a depletion, falling back to the subject id.
 *
 * ## Two decisions written down rather than inferred
 *
 * **"Published" means publicly visible.** A product created active, or an
 * existing product whose `isActive` goes false → true. A product created
 * inactive is a draft and announces nothing; taking one down is an update, not
 * a publication. WAAds builds ad inventory from this event, so the answer
 * belongs in code rather than in a reader's head.
 *
 * **Minor units, never `priceCents`.** Japora stores every price as
 * hundredths-of-major-unit for every currency (see `currency.ts`). XOF — Togo's
 * currency and the launch market's — is ISO-4217 zero-decimal: there are no
 * centimes, so its minor unit *is* the franc. Forwarding the stored integer
 * would state a price a hundred times too high on seven surfaces at once, which
 * `WASpine/money.py` calls the single most common way to be wrong by a factor of
 * 100 in West African software.
 *
 * ## What this module cannot say honestly, and does not pretend to
 *
 * `condition` is part of the canonical product record in SPEC.md and has no
 * column in the schema. Every destination requires it. It is emitted as the
 * documented default below; the honest fix is a column and a form field, and
 * that is a product change, not an event one.
 *
 * `link` is the storefront page that carries the product, because Japora has no
 * per-product page to deep-link to.
 */

import { isZeroDecimal, majorUnits, minorUnits } from "@/lib/currency";
import { appUrl } from "@/lib/token";

export const CATALOG_PRODUCT_PUBLISHED = "catalog.product.published";
export const CATALOG_PRODUCT_UPDATED = "catalog.product.updated";
export const CATALOG_PRICE_CHANGED = "catalog.price.changed";
export const CATALOG_STOCK_DEPLETED = "catalog.stock.depleted";
export const CATALOG_PRODUCT_DELETED = "catalog.product.deleted";

/**
 * Japora has no `condition` column, and every feed destination demands one.
 * Named, not inlined, so the assumption is visible to whoever adds the column.
 */
export const DEFAULT_CONDITION = "new";

export type ActorType = "customer" | "merchant" | "operator" | "system";

/** One fact, ready for the envelope the spine builds around it. */
export type BusEventInput = {
  type: string;
  vendorId: string;
  subjectType: string;
  subjectId: string;
  data: Record<string, unknown>;
  correlationId?: string;
  actorType?: ActorType;
  actorId?: string;
};

/** The product fields these events read. Structural, so tests need no DB row. */
export type CatalogProduct = {
  id: string;
  name: string;
  description?: string;
  priceCents: number;
  imageUrl?: string;
  stock: number;
  sizes?: string;
  isActive: boolean;
  preOrderAllowed?: boolean;
};

/** The vendor fields these events read. */
export type CatalogVendor = {
  id: string;
  email?: string;
  emailVerifiedAt?: Date | null;
  shopSlug: string;
  currency: string;
  category?: string;
};

/**
 * The price in the currency's own minor units.
 *
 * XOF and the other zero-decimal currencies have no sub-unit, so the stored
 * hundredths divide back down to whole francs. Everything else stores minor
 * units already.
 */
export function priceMinor(priceCents: number, currency: string): number {
  const cents = minorUnits(priceCents);
  return isZeroDecimal(currency) ? Math.round(majorUnits(cents)) : cents;
}

/**
 * Feed availability, in the vocabulary every destination shares.
 *
 * An inactive product is "out of stock" rather than something more precise:
 * that is the strongest true statement the shared vocabulary can carry about a
 * product the merchant has taken down, and it is what stops seven surfaces
 * going on selling it.
 */
export function availabilityOf(
  p: Pick<CatalogProduct, "stock" | "isActive" | "preOrderAllowed">,
): string {
  if (!p.isActive) return "out of stock";
  if (p.stock > 0) return "in stock";
  return p.preOrderAllowed ? "preorder" : "out of stock";
}

/** Absolute, always: a relative image link is the commonest silent rejection. */
function absolute(url: string): string {
  const u = (url || "").trim();
  if (!u) return "";
  if (/^https?:\/\//i.test(u)) return u;
  return appUrl(u.startsWith("/") ? u : `/${u}`);
}

/** The canonical record, in the shape the destinations expect. */
export function productRecord(
  p: CatalogProduct,
  v: CatalogVendor,
): Record<string, unknown> {
  const image = absolute(p.imageUrl || "");
  return {
    sku: p.id,
    vendor_id: v.id,
    vendor_email: v.emailVerifiedAt ? (v.email || "").trim().toLowerCase() : "",
    price_cents: p.priceCents,
    sizes: p.sizes || "",
    is_active: p.isActive,
    // Both spellings, same value: WAFanout and WAStudio read `title`, WAReach,
    // WAAuthority and WAPartner read `name`. Sending one and hoping is how a
    // consumer files a product under its own id.
    name: p.name,
    title: p.name,
    description: p.description || "",
    price_minor: priceMinor(p.priceCents, v.currency),
    currency: (v.currency || "").toUpperCase(),
    availability: availabilityOf(p),
    condition: DEFAULT_CONDITION,
    image_link: image,
    image_url: image, // WASetup._has_photo looks here and nowhere else
    link: appUrl(`/c/${v.shopSlug}?product=${encodeURIComponent(p.id)}`),
    category: (v.category || "").trim(),
    stock: Math.max(0, p.stock),
  };
}

/** A product deletion is a fact; consumers retain a tombstone, never a stale listing. */
export function productDeleted(p: Pick<CatalogProduct, "id">, v: CatalogVendor): BusEventInput {
  return {
    type: CATALOG_PRODUCT_DELETED,
    vendorId: v.id,
    subjectType: "product",
    subjectId: p.id,
    data: {
      sku: p.id,
      vendor_id: v.id,
      vendor_email: v.emailVerifiedAt ? (v.email || "").trim().toLowerCase() : "",
      deleted: true,
      is_active: false,
    },
    actorType: "merchant",
    actorId: v.id,
  };
}

/** A product the public can now see. */
export function productPublished(p: CatalogProduct, v: CatalogVendor): BusEventInput {
  return {
    type: CATALOG_PRODUCT_PUBLISHED,
    vendorId: v.id,
    subjectType: "product",
    subjectId: p.id,
    data: productRecord(p, v),
    actorType: "merchant",
    actorId: v.id,
  };
}

/** A record that changed. Carries the whole record: WAFanout re-checks it. */
export function productUpdated(p: CatalogProduct, v: CatalogVendor): BusEventInput {
  return {
    type: CATALOG_PRODUCT_UPDATED,
    vendorId: v.id,
    subjectType: "product",
    subjectId: p.id,
    data: productRecord(p, v),
    actorType: "merchant",
    actorId: v.id,
  };
}

/**
 * The merchant's own figure changed.
 *
 * Separate from `catalog.product.updated` because it is the expensive one: a
 * live listing quoting a price the merchant changed sells at the old price on
 * every order it takes, and WAFanout ranks it above every other change for
 * exactly that reason.
 */
export function priceChanged(
  p: CatalogProduct,
  v: CatalogVendor,
  opts: { previousPriceCents?: number } = {},
): BusEventInput {
  const data: Record<string, unknown> = {
    sku: p.id,
    vendor_id: v.id,
    vendor_email: v.emailVerifiedAt ? (v.email || "").trim().toLowerCase() : "",
    name: p.name,
    title: p.name,
    price_cents: p.priceCents,
    price_minor: priceMinor(p.priceCents, v.currency),
    currency: (v.currency || "").toUpperCase(),
  };
  if (opts.previousPriceCents !== undefined) {
    data.previous_price_minor = priceMinor(opts.previousPriceCents, v.currency);
  }
  return {
    type: CATALOG_PRICE_CHANGED,
    vendorId: v.id,
    subjectType: "product",
    subjectId: p.id,
    data,
    actorType: "merchant",
    actorId: v.id,
  };
}

/**
 * The shelf just emptied.
 *
 * A transition, not a state: see `crossedToZero`. The actor is the system even
 * when a customer's order caused it — the fact is Japora's own bookkeeping, and
 * naming the buyer would put a person on a bus message that has no reason to
 * carry one. The order id travels as `correlation_id` instead, which is what
 * lets a consumer reconstruct the sequence without a customer's name in it.
 */
export function stockDepleted(
  p: CatalogProduct,
  // Narrower than the other three on purpose: an empty shelf is not a
  // storefront render, so this fact needs the merchant and nothing else about
  // them. The checkout Flow can raise it without a second vendor query.
  v: Pick<CatalogVendor, "id">,
  opts: { orderId?: string; previousStock?: number } = {},
): BusEventInput {
  const data: Record<string, unknown> = {
    // WAOrders reads `data.sku` first and the subject second; WAFanout and
    // WAReach read the subject. Both are populated with the same id.
    sku: p.id,
    vendor_id: v.id,
    name: p.name,
    title: p.name,
    availability: "out of stock",
    stock: 0,
  };
  if (opts.previousStock !== undefined) data.previous_stock = opts.previousStock;
  return {
    type: CATALOG_STOCK_DEPLETED,
    vendorId: v.id,
    subjectType: "product",
    subjectId: p.id,
    data,
    correlationId: opts.orderId || "",
    actorType: "system",
    actorId: v.id,
  };
}

/**
 * Did *this* write take the shelf to empty?
 *
 * `catalog.stock.depleted` is a transition and firing it on every decrement
 * would be wrong. The previous value has to be knowable, and where it is
 * knowable differs by call site:
 *
 * **The three decrement sites** (`POST /api/orders`, the un-cancel branch of
 * `PATCH /api/orders/[id]`, and `POST /api/whatsapp/flow`) do not need to read
 * it. `prisma.product.update({ data: { stock: { decrement: n } } })` returns the
 * row *after* the atomic decrement, inside the transaction, and
 * `after === 0` with `n > 0` means `before === n > 0` — the boundary was crossed
 * by this call and by no other, because two concurrent decrements cannot both
 * land on exactly zero. That makes the transition race-free without a
 * read-before-write and without a lock.
 *
 * The `n > 0` half is not decoration: the Flow route decrements by
 * `min(qty, snapshot stock)`, which is zero for a pre-order against a shelf that
 * was already empty. That write changes nothing and must not announce a
 * depletion that happened earlier.
 *
 * **The one absolute write** (`stock` set outright in `PATCH
 * /api/products/[id]`) uses `becameDepleted` below instead.
 *
 * The increment sites — an order cancelled, an order deleted — announce
 * nothing. There is no `catalog.stock.replenished` event; WAOrders says so in
 * its own source, and recomputes the blocked list on read for that reason.
 */
export function crossedToZero(o: { decrementedBy: number; stockAfter: number }): boolean {
  return o.decrementedBy > 0 && o.stockAfter === 0;
}

/**
 * The same question for an absolute write, where the previous value is the row
 * the handler already read.
 *
 * Weaker than `crossedToZero` and knowingly so: the read is not serialised
 * against the write, so two concurrent absolute writes to the same row could
 * both see a non-zero `before`. Reaching that needs a merchant racing themselves
 * on their own product, and WAFanout is idempotent on it — it returns "the
 * record already says out of stock" and changes nothing. Stated here rather
 * than papered over with a lock the rest of this file does not need.
 */
export function becameDepleted(before: { stock: number }, after: { stock: number }): boolean {
  return before.stock > 0 && after.stock <= 0;
}

/**
 * Did this write make the product publicly visible?
 *
 * `before` is null for a creation. See the module docstring for why creation
 * with `isActive: false` is not a publication.
 */
export function becamePublished(
  before: { isActive: boolean } | null,
  after: { isActive: boolean },
): boolean {
  if (!after.isActive) return false;
  return before === null ? true : !before.isActive;
}
