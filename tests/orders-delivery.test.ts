import { after, describe, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
import { prisma } from "../src/lib/db";
import { majorUnits, formatCurrencyAmount } from "../src/lib/currency";
import { POST as placeOrder } from "../src/app/api/orders/route";
import { POST as startPayment } from "../src/app/api/payments/checkout/route";

after(async () => {
  await prisma.$disconnect();
});

async function shop(overrides: { deliveryEnabled?: boolean; deliveryZones?: string } = {}) {
  const tag = randomUUID();
  const vendor = await prisma.vendor.create({
    data: {
      email: `delivery-${tag}@example.invalid`,
      passwordHash: "test-only",
      shopName: "Livraison XOF",
      shopSlug: `delivery-${tag}`,
      currency: "XOF",
      deliveryEnabled: true,
      deliveryFeeCents: 100000,
      deliveryZones: "Lomé: 1000, Agoè: 1500",
      ...overrides,
    },
  });
  const product = await prisma.product.create({
    data: { vendorId: vendor.id, name: "Article", priceCents: 500000, stock: 10 },
  });
  return { vendor, product };
}

function request(path: string, body: Record<string, unknown>) {
  return new NextRequest(`http://localhost${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function checkout(overrides: Record<string, unknown> = {}, vendorOverrides = {}) {
  const { vendor, product } = await shop(vendorOverrides);
  const response = await placeOrder(request("/api/orders", {
    shopSlug: vendor.shopSlug,
    customerName: "Client test",
    fulfillment: "delivery",
    deliveryZone: "Lomé",
    items: [{ productId: product.id, qty: 1 }],
    ...overrides,
  }));
  return { response, body: await response.json(), vendor, product };
}

describe("catalog checkout delivery in XOF", () => {
  test("5000 XOF of goods plus 1000 XOF delivery is stored and payable as 6000 XOF", async () => {
    const { response, body } = await checkout();
    assert.equal(response.status, 200, JSON.stringify(body));
    assert.equal(body.deliveryFeeCents, 100000);
    assert.equal(body.totalCents, 600000);
    const order = await prisma.order.findUniqueOrThrow({ where: { id: body.orderId } });
    assert.equal(order.totalCents, 600000);
    assert.equal(order.deliveryFeeCents, 100000);
    assert.equal(majorUnits(order.totalCents), 6000);
    assert.match(formatCurrencyAmount(order.totalCents, "XOF"), /6\s?000 XOF/);
    const receivable = await prisma.receivable.findFirstOrThrow({ where: { orderId: order.id } });
    assert.equal(receivable.amountCents, 600000);

    // The real payment route must use the persisted server total, not the cart total.
    const payment = await startPayment(request("/api/payments/checkout", {
      orderId: order.id,
      provider: "fedapay",
      amountCents: 1,
    }));
    const paymentBody = await payment.json();
    assert.equal(payment.status, 200, JSON.stringify(paymentBody));
    const intent = await prisma.paymentIntent.findUniqueOrThrow({ where: { id: paymentBody.paymentIntentId } });
    assert.equal(intent.amountCents, 600000);
    assert.equal(intent.currency, "XOF");
  });

  test("the server ignores client amounts and uses the configured zone price", async () => {
    const { response, body } = await checkout({ deliveryZone: "AGOÈ", deliveryFeeCents: 1, totalCents: 1 });
    assert.equal(response.status, 200, JSON.stringify(body));
    assert.equal(body.deliveryFeeCents, 150000);
    assert.equal(body.totalCents, 650000);
  });

  test("pickup never adds a delivery fee", async () => {
    const { response, body } = await checkout({ fulfillment: "pickup", deliveryFeeCents: 999999 });
    assert.equal(response.status, 200, JSON.stringify(body));
    assert.equal(body.deliveryFeeCents, 0);
    assert.equal(body.totalCents, 500000);
  });

  test("legacy callers omitting fulfillment retain the goods-only total", async () => {
    const { response, body } = await checkout({ fulfillment: undefined });
    assert.equal(response.status, 200, JSON.stringify(body));
    assert.equal(body.deliveryFeeCents, 0);
    assert.equal(body.totalCents, 500000);
  });

  test("delivery without a zone selects the same first zone as the cart", async () => {
    const { response, body } = await checkout({ deliveryZone: "" });
    assert.equal(response.status, 200, JSON.stringify(body));
    assert.equal(body.deliveryFeeCents, 100000);
  });

  test("shops without specific zones use the default fee without multiplying it again", async () => {
    const { response, body } = await checkout({ deliveryZone: "" }, { deliveryZones: "" });
    assert.equal(response.status, 200, JSON.stringify(body));
    assert.equal(body.deliveryFeeCents, 100000);
    assert.equal(body.totalCents, 600000);
  });

  test("unknown zones, disabled delivery and invalid fulfillment cannot create orders or change stock", async () => {
    for (const scenario of [
      { input: { deliveryZone: "Unknown" }, vendor: {} },
      { input: {}, vendor: { deliveryEnabled: false } },
      { input: { fulfillment: "invalid" }, vendor: {} },
    ]) {
      const { response, vendor, product } = await checkout(scenario.input, scenario.vendor);
      assert.equal(response.status, 400);
      assert.equal(await prisma.order.count({ where: { vendorId: vendor.id } }), 0);
      assert.equal((await prisma.product.findUniqueOrThrow({ where: { id: product.id } })).stock, 10);
    }
  });
});
