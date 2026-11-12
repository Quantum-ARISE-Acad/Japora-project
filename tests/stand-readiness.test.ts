import { after, describe, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
import { prisma } from "../src/lib/db";
import { syncActiveVendorWhatsAppBinding } from "../src/lib/auth";
import { notifyOrderPaid } from "../src/lib/order-notifications";
import { GET as metrics } from "../src/app/api/metrics/route";

after(async () => {
  await prisma.$disconnect();
});

async function vendor(extra: Record<string, unknown> = {}) {
  const tag = randomUUID();
  return prisma.vendor.create({
    data: {
      email: `stand-${tag}@example.invalid`,
      passwordHash: "test-only",
      shopName: `Boutique ${tag.slice(0, 6)}`,
      shopSlug: `stand-${tag}`,
      currency: "XOF",
      whatsappNumber: "22890000001",
      ...extra,
    },
  });
}

describe("shared WhatsApp number never moves between shops (T-DEV-01)", () => {
  test("logging in does not take the number or the orders of another shop", async () => {
    const phoneId = `pnid-${randomUUID()}`;
    const previous = process.env.WHATSAPP_PHONE_NUMBER_ID;
    process.env.WHATSAPP_PHONE_NUMBER_ID = phoneId;
    try {
      const owner = await vendor({ whatsappPhoneNumberId: phoneId });
      const order = await prisma.order.create({
        data: { vendorId: owner.id, customerName: "Client A", source: "whatsapp", totalCents: 100000 },
      });
      const other = await vendor();

      const after = await syncActiveVendorWhatsAppBinding(other);

      assert.equal(after.whatsappPhoneNumberId, null);
      const ownerNow = await prisma.vendor.findUniqueOrThrow({ where: { id: owner.id } });
      assert.equal(ownerNow.whatsappPhoneNumberId, phoneId);
      const orderNow = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
      assert.equal(orderNow.vendorId, owner.id);
    } finally {
      if (previous === undefined) delete process.env.WHATSAPP_PHONE_NUMBER_ID;
      else process.env.WHATSAPP_PHONE_NUMBER_ID = previous;
    }
  });

  test("the first shop can claim a number nobody owns", async () => {
    const phoneId = `pnid-${randomUUID()}`;
    const previous = process.env.WHATSAPP_PHONE_NUMBER_ID;
    process.env.WHATSAPP_PHONE_NUMBER_ID = phoneId;
    try {
      const shop = await vendor();
      const after = await syncActiveVendorWhatsAppBinding(shop);
      assert.equal(after.whatsappPhoneNumberId, phoneId);
    } finally {
      if (previous === undefined) delete process.env.WHATSAPP_PHONE_NUMBER_ID;
      else process.env.WHATSAPP_PHONE_NUMBER_ID = previous;
    }
  });
});

describe("WhatsApp receipts when an order is paid (T-DEV-07)", () => {
  test("buyer and vendor each get one message, even if called twice", async () => {
    const shop = await vendor();
    const order = await prisma.order.create({
      data: {
        vendorId: shop.id,
        customerName: "Ama",
        customerPhone: "+228 90 11 22 33",
        status: "PAID",
        totalCents: 600000,
        paidCents: 600000,
      },
    });

    await notifyOrderPaid(order.id, "T-Money");
    await notifyOrderPaid(order.id, "T-Money");

    const messages = await prisma.whatsAppMessage.findMany({ where: { orderId: order.id } });
    assert.equal(messages.length, 2);
    const buyer = messages.find((m) => m.contact === "22890112233");
    const seller = messages.find((m) => m.contact === "22890000001");
    assert.ok(buyer, "buyer receipt sent to the digits-only number");
    assert.ok(seller, "vendor alert sent");
    assert.match(buyer.body, /Paiement reçu/);
    assert.match(buyer.body, /6[\s,.\u202f]?000/);
    assert.match(seller.body, /Commande payée/);
  });

  test("an unknown order is ignored without throwing", async () => {
    await notifyOrderPaid(`missing-${randomUUID()}`);
  });
});

describe("/api/metrics for the stand dashboard (T-INF-05)", () => {
  test("exposes paid orders, WhatsApp messages and catalogue visits", async () => {
    const shop = await vendor();
    await prisma.order.create({ data: { vendorId: shop.id, customerName: "B", status: "PAID", totalCents: 1 } });
    await prisma.whatsAppMessage.create({ data: { vendorId: shop.id, direction: "IN", contact: "1", body: "x" } });
    await prisma.funnelEvent.create({ data: { vendorId: shop.id, shopSlug: shop.shopSlug, stage: "visit", sessionId: "s" } });

    const res = await metrics(new NextRequest("http://localhost/api/metrics"));
    assert.equal(res.status, 200);
    assert.match(res.headers.get("content-type") || "", /text\/plain/);
    const text = await res.text();
    const value = (re: RegExp) => Number(text.match(re)?.[1] ?? NaN);
    assert.ok(value(/^japora_orders_paid_total (\d+)$/m) >= 1);
    assert.ok(value(/^japora_whatsapp_messages_total\{direction="IN"\} (\d+)$/m) >= 1);
    assert.ok(value(/^japora_catalog_visits_total (\d+)$/m) >= 1);
    assert.match(text, /^japora_metrics_up 1$/m);
  });

  test("requires the bearer token when METRICS_TOKEN is set", async () => {
    const previous = process.env.METRICS_TOKEN;
    process.env.METRICS_TOKEN = "secret-token";
    try {
      const denied = await metrics(new NextRequest("http://localhost/api/metrics"));
      assert.equal(denied.status, 401);
      const allowed = await metrics(
        new NextRequest("http://localhost/api/metrics", { headers: { authorization: "Bearer secret-token" } }),
      );
      assert.equal(allowed.status, 200);
    } finally {
      if (previous === undefined) delete process.env.METRICS_TOKEN;
      else process.env.METRICS_TOKEN = previous;
    }
  });
});
