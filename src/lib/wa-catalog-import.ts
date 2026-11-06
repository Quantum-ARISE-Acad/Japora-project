/**
 * Japora — one-shot import from a vendor's existing WhatsApp Business catalog.
 *
 * Vendors often already maintain a product catalog inside the Meta Business
 * Manager. Rather than asking them to re-key every SKU, we hit the Graph API,
 * iterate the catalogs attached to their business account, and upsert each
 * product into our Product table. Duplicates are skipped by `name` per vendor
 * (the Graph API doesn't give us a stable cross-system ID we want to store).
 *
 * Returns `{ ok: false, error }` if credentials are missing so the caller can
 * surface a friendly "Connect WhatsApp Business first" message.
 */
import { prisma } from "./db";
import { logger } from "./logger";
import { enqueue, kickDrain } from "./bus";
import { becamePublished, productPublished } from "./catalog-events";

const GRAPH_VERSION = "v21.0";

type GraphCatalog = {
  id: string;
  name?: string;
};

type GraphProduct = {
  id?: string;
  name?: string;
  description?: string;
  price?: string; // Graph returns "1000 NGN"
  image_url?: string;
  retailer_id?: string;
  availability?: string;
};

type ImportResult =
  | { ok: true; count: number; skipped: number }
  | { ok: false; error: string };

/**
 * Parse Graph's "1000 NGN" / "12.50 USD" / "1500" price string into integer
 * cents. Graph is not consistent across regions so we fall back to 0 instead
 * of throwing — a product with no price is still useful to import.
 */
function parseGraphPriceToCents(raw: string | undefined): number {
  if (!raw) return 0;
  const match = raw.match(/[\d.,]+/);
  if (!match) return 0;
  const normalized = match[0].replace(/,/g, "");
  const parsed = parseFloat(normalized);
  if (!Number.isFinite(parsed)) return 0;
  return Math.round(parsed * 100);
}

export async function importFromWhatsAppCatalog(
  vendorId: string,
): Promise<ImportResult> {
  const token = process.env.WHATSAPP_TOKEN;
  const businessAccountId = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID;

  if (!token || !businessAccountId) {
    logger.info("wa_catalog.import_skipped_no_credentials", { vendorId });
    return {
      ok: false,
      error:
        "WhatsApp Business credentials not configured. Set WHATSAPP_TOKEN and WHATSAPP_BUSINESS_ACCOUNT_ID.",
    };
  }

  // Read once, not per product: `catalog.product.published` carries the
  // storefront link and the currency, and both live on the vendor.
  const vendor = await prisma.vendor.findUnique({
    where: { id: vendorId },
    select: { id: true, shopSlug: true, currency: true, category: true },
  });
  if (!vendor) {
    logger.warn("wa_catalog.import_unknown_vendor", { vendorId });
    return { ok: false, error: "Unknown vendor." };
  }

  try {
    const catalogsRes = await fetch(
      `https://graph.facebook.com/${GRAPH_VERSION}/${businessAccountId}/product_catalogs`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!catalogsRes.ok) {
      const text = await catalogsRes.text();
      logger.error("wa_catalog.list_failed", {
        vendorId,
        status: catalogsRes.status,
        body: text.slice(0, 500),
      });
      return {
        ok: false,
        error: `Could not list WhatsApp catalogs (${catalogsRes.status}).`,
      };
    }
    const catalogsBody = (await catalogsRes.json()) as { data?: GraphCatalog[] };
    const catalogs = catalogsBody.data ?? [];

    let imported = 0;
    let skipped = 0;

    for (const catalog of catalogs) {
      const productsRes = await fetch(
        `https://graph.facebook.com/${GRAPH_VERSION}/${catalog.id}/products`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (!productsRes.ok) {
        logger.warn("wa_catalog.products_fetch_failed", {
          vendorId,
          catalogId: catalog.id,
          status: productsRes.status,
        });
        continue;
      }
      const productsBody = (await productsRes.json()) as {
        data?: GraphProduct[];
      };
      const products = productsBody.data ?? [];

      for (const p of products) {
        const name = (p.name || "").trim();
        if (!name) {
          skipped++;
          continue;
        }
        const existing = await prisma.product.findFirst({
          where: { vendorId, name },
          select: { id: true },
        });
        if (existing) {
          skipped++;
          continue;
        }
        // Same rule as the dashboard's own create: an imported row that lands
        // active is publicly visible, and a row imported as out of stock lands
        // inactive and announces nothing until the merchant turns it on.
        await prisma.$transaction(async (tx) => {
          const created = await tx.product.create({
            data: {
              vendorId,
              name,
              description: (p.description || "").trim(),
              priceCents: parseGraphPriceToCents(p.price),
              imageUrl: (p.image_url || "").trim(),
              isActive: (p.availability ?? "in stock") !== "out of stock",
            },
          });
          if (becamePublished(null, created)) {
            await enqueue(tx, productPublished(created, vendor));
          }
        });
        imported++;
      }
    }

    logger.info("wa_catalog.import_complete", {
      vendorId,
      imported,
      skipped,
      catalogCount: catalogs.length,
    });

    if (imported) kickDrain();
    return { ok: true, count: imported, skipped };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    logger.error("wa_catalog.import_error", { vendorId, error });
    return { ok: false, error };
  }
}
