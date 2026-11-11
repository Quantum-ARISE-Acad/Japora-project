import { describe, test, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
import { prisma } from "../src/lib/db";
import { GET, POST } from "../src/app/api/whatsapp/flow/route";
import { CATALOG_STOCK_DEPLETED } from "../src/lib/catalog-events";

/**
 * The in-chat checkout Flow, driven through the real route handler against
 * this suite's disposable SQLite database.
 *
 * Two things are under test and they are related. The Flow's completion could
 * not resolve a vendor from the token the Flow's own GET mints — so this is the
 * write site where `catalog.stock.depleted` is raised, and it was unreachable.
 * And a depletion is a transition: it belongs to the order that empties the
 * shelf, and to no other order before or after it.
 */

const vendorIds: string[] = [];
const savedSpineEnv: Record<string, string | undefined> = {};
const SPINE_KEYS = ["SPINE_URL", "SPINE_PRODUCT_TOKEN", "WA_WCATALOG_DISABLED"];

before(() => {
  // Nothing is sent from here: the facts land in the outbox and stay there,
  // which is what this test reads.
  for (const k of SPINE_KEYS) {
    savedSpineEnv[k] = process.env[k];
    delete process.env[k];
  }
});

after(async () => {
  for (const k of SPINE_KEYS) {
    if (savedSpineEnv[k] === undefined) delete process.env[k];
    else process.env[k] = savedSpineEnv[k];
  }
  for (const id of vendorIds) {
    const orders = await prisma.order.findMany({ where: { vendorId: id }, select: { id: true } });
    await prisma.orderItem.deleteMany({ where: { orderId: { in: orders.map((o) => o.id) } } });
    await prisma.order.deleteMany({ where: { vendorId: id } });
    await prisma.customer.deleteMany({ where: { vendorId: id } });
    await prisma.busEvent.deleteMany({ where: { vendorId: id } });
    await prisma.product.deleteMany({ where: { vendorId: id } });
    await prisma.vendor.delete({ where: { id } }).catch(() => {});
  }
  await prisma.$disconnect();
});

async function makeShop(stock: number) {
  const tag = randomUUID().slice(0, 8);
  const vendor = await prisma.vendor.create({
    data: {
      email: `flow_${tag}@japora.test`,
      passwordHash: "x",
      shopName: `Flow ${tag}`,
      shopSlug: `flow-${tag}`,
      currency: "XOF",
      whatsappNumber: "22890000000",
    },
  });
  vendorIds.push(vendor.id);
  const product = await prisma.product.create({
    data: { vendorId: vendor.id, name: "Wax print", priceCents: 500000, stock },
  });
  return { vendor, product };
}

function completion(flowToken: string, productId: string, qty: number) {
  return new NextRequest(
    new Request("http://localhost/api/whatsapp/flow", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        action: "complete",
        flow_token: flowToken,
        data: { product: productId, phone: "22891000001", name: "Ama", qty },
      }),
    }),
  );
}

describe("the checkout Flow resolves the vendor from its own token", () => {
  test("a completion carrying the minted flow_token places the order", async () => {
    const { vendor, product } = await makeShop(2);

    const minted = await GET(
      new NextRequest(`http://localhost/api/whatsapp/flow?slug=${vendor.shopSlug}`),
    );
    const { flowToken } = (await minted.json()) as { flowToken: string };
    assert.equal(flowToken, `japora:${vendor.id}`);

    const res = await POST(completion(flowToken, product.id, 1));
    const body = (await res.json()) as Record<string, unknown>;
    assert.equal(res.status, 200, JSON.stringify(body));
    assert.equal(body.ok, true);
  });
});

describe("catalog.stock.depleted is a transition, raised once", () => {
  test("the order that empties the shelf raises it; the one before does not", async () => {
    const { vendor, product } = await makeShop(2);
    const token = `japora:${vendor.id}`;

    const first = await POST(completion(token, product.id, 1));
    assert.equal(first.status, 200);
    assert.equal((await prisma.product.findUnique({ where: { id: product.id } }))?.stock, 1);
    assert.equal(
      await prisma.busEvent.count({ where: { vendorId: vendor.id, type: CATALOG_STOCK_DEPLETED } }),
      0,
      "a decrement that leaves stock is not a depletion",
    );

    const second = await POST(completion(token, product.id, 1));
    assert.equal(second.status, 200);
    assert.equal((await prisma.product.findUnique({ where: { id: product.id } }))?.stock, 0);

    const rows = await prisma.busEvent.findMany({
      where: { vendorId: vendor.id, type: CATALOG_STOCK_DEPLETED },
    });
    assert.equal(rows.length, 1, "exactly one depletion, on the write that crossed to zero");
    assert.equal(rows[0].subjectId, product.id);
    assert.equal((rows[0].data as Record<string, unknown>).sku, product.id);
    assert.equal((rows[0].data as Record<string, unknown>).previous_stock, 1);
    assert.ok(rows[0].correlationId, "the order that emptied the shelf is named");
    assert.equal(rows[0].status, "queued");

    // And a third attempt is refused, raising nothing: an empty shelf is
    // announced once, not on every attempt to buy from it.
    const refused = await POST(completion(token, product.id, 1));
    assert.equal(refused.status, 409);
    assert.equal(
      await prisma.busEvent.count({ where: { vendorId: vendor.id, type: CATALOG_STOCK_DEPLETED } }),
      1,
    );
  });

  test("a pre-order against an empty shelf decrements nothing and announces nothing", async () => {
    const { vendor, product } = await makeShop(0);
    await prisma.product.update({ where: { id: product.id }, data: { preOrderAllowed: true } });
    const res = await POST(completion(`japora:${vendor.id}`, product.id, 1));
    assert.equal(res.status, 200);
    assert.equal((await prisma.product.findUnique({ where: { id: product.id } }))?.stock, 0);
    assert.equal(
      await prisma.busEvent.count({ where: { vendorId: vendor.id, type: CATALOG_STOCK_DEPLETED } }),
      0,
      "the shelf emptied before this order and was announced then",
    );
  });
});
