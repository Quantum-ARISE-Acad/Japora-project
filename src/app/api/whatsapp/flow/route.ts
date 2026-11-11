import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { upsertFromOrder } from "@/lib/customers";
import { buildCheckoutFlowJson, type FlowCompletion } from "@/lib/flow";
import { attributeOrder } from "@/lib/campaigns";
import { enqueue, kickDrain } from "@/lib/bus";
import { crossedToZero, stockDepleted } from "@/lib/catalog-events";

/**
 * GET /api/whatsapp/flow?slug=<shopSlug> — returns the checkout Flow JSON for a
 * shop, ready to paste into Meta's Flow Builder. Public (it's a form template).
 */
export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get("slug") || "";
  if (!slug) return NextResponse.json({ error: "Pass ?slug=<shopSlug>." }, { status: 400 });
  const vendor = await prisma.vendor.findFirst({
    where: { shopSlug: slug, deletedAt: null },
    select: { id: true, shopName: true, currency: true },
  });
  if (!vendor) return NextResponse.json({ error: "Shop not found." }, { status: 404 });
  const products = await prisma.product.findMany({
    where: { vendorId: vendor.id, isActive: true },
    select: { id: true, name: true, priceCents: true, sizes: true, stock: true },
    take: 60,
  });
  const flow = buildCheckoutFlowJson({
    shopName: vendor.shopName,
    currency: vendor.currency,
    products,
  });
  return NextResponse.json({ flowToken: `${FLOW_TOKEN_PREFIX}${vendor.id}`, flow });
}

/**
 * POST /api/whatsapp/flow — WhatsApp Flows data-exchange + completion endpoint.
 *
 * Meta calls this as the customer moves through the in-chat checkout Flow. We
 * support:
 *   - action "ping"      → health check, return active
 *   - action "complete"  → the customer tapped "Place order"; create the order
 *   - (data_exchange / INIT navigation is handled client-side by the Flow JSON
 *      in src/lib/flow.ts; only completion needs server state here)
 *
 * vendor is resolved from the flow_token we mint when launching the Flow
 * (`japora:<vendorId>`), or an explicit vendorId (used by tests / our own UI).
 *
 * PRODUCTION (Connect step): Meta encrypts the request body with your RSA
 * public key (AES-GCM session key + RSA-OAEP). Decrypt before this handler and
 * re-encrypt the response. The business logic below is unchanged by that layer;
 * here we accept the plaintext shape so the flow is testable without keys.
 */

/** The flow token we mint in GET, and parse in POST. One constant, both ends. */
const FLOW_TOKEN_PREFIX = "japora:";

function vendorIdFrom(body: Record<string, unknown>): string | null {
  const token = typeof body.flow_token === "string" ? body.flow_token : "";
  // `"japora:".length` is 7. This sliced 5, so every completion arriving with
  // the token the GET above mints resolved to "ra:<vendorId>", found no vendor's
  // product, and answered 404 — the in-chat checkout could be opened and never
  // completed. Nothing covered it because the tests pass `vendorId` directly,
  // which is the branch below. Derived from the prefix now, so the two cannot
  // drift again.
  if (token.startsWith(FLOW_TOKEN_PREFIX)) return token.slice(FLOW_TOKEN_PREFIX.length) || null;
  if (typeof body.vendorId === "string" && body.vendorId) return body.vendorId;
  return null;
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const action = String(body.action || "");

  // Meta health check.
  if (action === "ping") {
    return NextResponse.json({ data: { status: "active" } });
  }

  // Completion (or a direct completion-shaped call from our own UI/tests).
  const isComplete = action === "complete" || action === "" ;
  if (!isComplete) {
    // Other navigation actions need no server data for this Flow.
    return NextResponse.json({ data: {} });
  }

  const data = (body.data as FlowCompletion) || (body as FlowCompletion);
  const vendorId = vendorIdFrom(body);
  if (!vendorId) return NextResponse.json({ error: "Unknown shop." }, { status: 400 });

  const productId = String(data.product || "").trim();
  const phone = String(data.phone || "").trim();
  const name = String(data.name || "").trim() || phone || "WhatsApp customer";
  const size = String(data.size || "").trim();
  const address = String(data.address || "").trim();
  const qty = Math.max(1, Math.min(999, parseInt(String(data.qty ?? 1), 10) || 1));

  if (!productId || !phone) {
    return NextResponse.json({ error: "Missing product or phone." }, { status: 400 });
  }

  const product = await prisma.product.findFirst({
    where: { id: productId, vendorId, isActive: true },
  });
  if (!product) return NextResponse.json({ error: "Product unavailable." }, { status: 404 });
  if (product.stock < qty && !product.preOrderAllowed) {
    return NextResponse.json({ error: `Only ${product.stock} left.` }, { status: 409 });
  }

  const totalCents = product.priceCents * qty;

  const order = await prisma.$transaction(async (tx) => {
    const created = await tx.order.create({
      data: {
        vendorId,
        customerName: name,
        customerPhone: phone,
        note: address ? `Deliver to: ${address}` : "",
        source: "whatsapp-flow",
        status: "NEW",
        totalCents,
        items: {
          create: [
            {
              productId: product.id,
              productName: product.name,
              size,
              quantity: qty,
              unitPriceCents: product.priceCents,
            },
          ],
        },
      },
    });
    // `decrementedBy` is captured rather than assumed: a pre-order against an
    // empty shelf decrements by zero, and a zero-sized write landing on zero is
    // not a depletion — the shelf emptied earlier and was announced then.
    const decrementedBy = Math.min(qty, product.stock);
    const after = await tx.product.update({
      where: { id: product.id },
      data: { stock: { decrement: decrementedBy } },
    });
    if (crossedToZero({ decrementedBy, stockAfter: after.stock })) {
      await enqueue(
        tx,
        stockDepleted(after, { id: vendorId }, {
          orderId: created.id,
          previousStock: decrementedBy,
        }),
      );
    }
    const customerId = await upsertFromOrder(tx, vendorId, {
      customerName: name,
      customerPhone: phone,
      totalCents,
    });
    if (customerId) {
      await tx.order.update({ where: { id: created.id }, data: { customerId } });
    }
    return created;
  });

  logger.info("flow.order_created", { vendorId, orderId: order.id, qty });
  // Last-touch CTWA attribution (no-op if this phone has no campaign touch).
  try {
    await attributeOrder({ orderId: order.id, vendorId, phone, revenueCents: totalCents });
  } catch (e) {
    logger.warn("flow.attribute_failed", { orderId: order.id, error: String(e) });
  }
  kickDrain();
  return NextResponse.json({
    ok: true,
    orderId: order.id,
    ref: order.id.slice(-6).toUpperCase(),
  });
}
