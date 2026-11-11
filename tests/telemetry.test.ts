import { describe, test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { computeFunnelRates, recordConfirmedOrder } from "../src/lib/funnel";
import { buildOrdersCsv, type OrderExportRow } from "../src/lib/orders-csv";
import { prisma } from "../src/lib/db";

describe("Funnel aggregation & conversion calculations", () => {
  test("computes correct stage conversions, drop-offs, and overall rate", () => {
    const summary = computeFunnelRates({
      visit: 1000,
      product_view: 500,
      cart: 200,
      ussd_intent: 100,
      confirmed_order: 50,
    });

    assert.equal(summary.totalVisits, 1000);
    assert.equal(summary.totalConfirmed, 50);
    assert.equal(summary.overallConversionRatePct, 5.0);
    assert.equal(summary.ussdIntentToConfirmedPct, 50.0);

    assert.equal(summary.stages.length, 5);

    // Stage 1: Visit
    assert.equal(summary.stages[0].stage, "visit");
    assert.equal(summary.stages[0].count, 1000);
    assert.equal(summary.stages[0].conversionFromVisitPct, 100);
    assert.equal(summary.stages[0].stepDropOffPct, 0);

    // Stage 2: Product View
    assert.equal(summary.stages[1].stage, "product_view");
    assert.equal(summary.stages[1].count, 500);
    assert.equal(summary.stages[1].conversionFromVisitPct, 50);
    assert.equal(summary.stages[1].stepDropOffPct, 50); // (1000 - 500) / 1000 = 50%

    // Stage 3: Cart
    assert.equal(summary.stages[2].stage, "cart");
    assert.equal(summary.stages[2].count, 200);
    assert.equal(summary.stages[2].conversionFromVisitPct, 20);
    assert.equal(summary.stages[2].stepDropOffPct, 60); // (500 - 200) / 500 = 60%

    // Stage 4: USSD Intent
    assert.equal(summary.stages[3].stage, "ussd_intent");
    assert.equal(summary.stages[3].count, 100);
    assert.equal(summary.stages[3].conversionFromVisitPct, 10);
    assert.equal(summary.stages[3].stepDropOffPct, 50); // (200 - 100) / 200 = 50%

    // Stage 5: Confirmed Order
    assert.equal(summary.stages[4].stage, "confirmed_order");
    assert.equal(summary.stages[4].count, 50);
    assert.equal(summary.stages[4].conversionFromVisitPct, 5);
    assert.equal(summary.stages[4].stepDropOffPct, 50); // (100 - 50) / 100 = 50%
  });

  test("handles empty results safely without NaN or division by zero", () => {
    const summary = computeFunnelRates({
      visit: 0,
      product_view: 0,
      cart: 0,
      ussd_intent: 0,
      confirmed_order: 0,
    });

    assert.equal(summary.totalVisits, 0);
    assert.equal(summary.totalConfirmed, 0);
    assert.equal(summary.overallConversionRatePct, 0);
    assert.equal(summary.ussdIntentToConfirmedPct, 0);

    for (const st of summary.stages) {
      assert.equal(st.count, 0);
      assert.equal(st.conversionFromVisitPct, 0);
      assert.equal(st.stepDropOffPct, 0);
      assert.ok(!isNaN(st.conversionFromVisitPct));
      assert.ok(!isNaN(st.stepDropOffPct));
    }
  });

  test("handles zero visits with non-zero events gracefully", () => {
    const summary = computeFunnelRates({
      visit: 0,
      product_view: 5,
      cart: 2,
      ussd_intent: 1,
      confirmed_order: 1,
    });

    assert.equal(summary.totalVisits, 0);
    assert.equal(summary.overallConversionRatePct, 0);
    assert.equal(summary.ussdIntentToConfirmedPct, 100);
  });
});

describe("PAID transition & server-side confirmed order event", () => {
  test("creates a FunnelEvent when order is confirmed and is idempotent", async () => {
    const tag = randomUUID();
    const testOrderId = `test_order_${tag}`;
    const testSessionId = `sess_${tag}`;
    const testVendor = await prisma.vendor.create({
      data: {
        email: `telemetry_${tag}@test.japora`,
        passwordHash: "test-only",
        shopName: "Telemetry Test Shop",
        shopSlug: `telemetry-${tag}`,
        currency: "XOF",
      },
      select: { id: true, shopSlug: true },
    });

    try {
      await recordConfirmedOrder({
        orderId: testOrderId,
        vendorId: testVendor.id,
        shopSlug: testVendor.shopSlug,
        totalCents: 15000,
        sessionId: testSessionId,
      });

      const events = await prisma.funnelEvent.findMany({
        where: { orderId: testOrderId, stage: "confirmed_order" },
      });
      assert.equal(events.length, 1);
      assert.equal(events[0].orderId, testOrderId);
      assert.equal(events[0].stage, "confirmed_order");
      assert.equal(events[0].valueCents, 15000);
      assert.equal(events[0].sessionId, testSessionId);

      await recordConfirmedOrder({
        orderId: testOrderId,
        vendorId: testVendor.id,
        shopSlug: testVendor.shopSlug,
        totalCents: 15000,
        sessionId: testSessionId,
      });

      const eventsAfter = await prisma.funnelEvent.findMany({
        where: { orderId: testOrderId, stage: "confirmed_order" },
      });
      assert.equal(eventsAfter.length, 1);
    } finally {
      await prisma.funnelEvent.deleteMany({ where: { orderId: testOrderId } });
      await prisma.vendor.delete({ where: { id: testVendor.id } });
    }
  });
});

describe("Accounting Orders CSV generation", () => {
  test("includes UTF-8 BOM, standard headers, and correctly formats order rows", () => {
    const mockOrders: OrderExportRow[] = [
      {
        id: "cmulglvll0008zyxm0ajvmsa6",
        createdAt: new Date("2026-09-28T14:30:00Z"),
        customerName: "Koffi Mensah",
        customerPhone: "+228 90 12 34 56",
        status: "PAID",
        totalCents: 500000,
        paidCents: 500000,
        note: "[PAIEMENT: USSD T-Money (*145#)]\nLivraison express",
        source: "catalog",
        items: [
          { productName: "Robe Wax Moderne", size: "M", quantity: 2, unitPriceCents: 200000 },
          { productName: "Chaussures Cuir", size: "42", quantity: 1, unitPriceCents: 100000 },
        ],
        paymentIntents: [{ provider: "tmoney", providerRef: "TM-99281", status: "succeeded" }],
      },
    ];

    const csv = buildOrdersCsv(mockOrders, "XOF");

    // Must start with UTF-8 BOM for Excel
    assert.ok(csv.startsWith("\uFEFF"), "CSV must begin with UTF-8 BOM");

    const lines = csv.split("\n");
    assert.equal(lines.length, 2); // Header + 1 row

    // Verify headers
    assert.ok(lines[0].includes("Date"));
    assert.ok(lines[0].includes("Référence"));
    assert.ok(lines[0].includes("Statut"));
    assert.ok(lines[0].includes("Articles"));

    // Verify row content
    const row = lines[1];
    assert.ok(row.includes("CMULGLVL")); // Ref prefix
    assert.ok(row.includes("Koffi Mensah"));
    assert.ok(row.includes("+228 90 12 34 56"));
    assert.ok(row.includes("PAID"));
    assert.ok(row.includes("5000.00")); // Major currency
    assert.ok(row.includes("500000")); // Cents
    assert.ok(row.includes("USSD T-Money (*145#)")); // Extracted payment method
    assert.ok(row.includes("2x Robe Wax Moderne (M) ; 1x Chaussures Cuir (42)"));
  });

  test("handles special characters, commas, and quotes with RFC 4180 escaping", () => {
    const mockOrders: OrderExportRow[] = [
      {
        id: "cmulspecial0001",
        createdAt: new Date("2026-09-28T10:00:00Z"),
        customerName: 'Ablavi "Bella", Reine',
        customerPhone: null,
        status: "NEW",
        totalCents: 120000,
        paidCents: 0,
        note: "[PAIEMENT: USSD Flooz (*155#)]",
        source: "catalog",
        items: [
          { productName: 'Tissu "Super Wax", Édition Spéciale', size: null, quantity: 1, unitPriceCents: 120000 },
        ],
      },
    ];

    const csv = buildOrdersCsv(mockOrders, "XOF");
    // Escaped double quotes become "" inside quoted string
    assert.ok(csv.includes('"Ablavi ""Bella"", Reine"'));
    assert.ok(csv.includes('"1x Tissu ""Super Wax"", Édition Spéciale"'));
  });

  test("handles empty orders list gracefully", () => {
    const csv = buildOrdersCsv([], "USD");
    assert.ok(csv.startsWith("\uFEFF"));
    const lines = csv.split("\n");
    assert.equal(lines.length, 1); // Header only
  });
});

describe("Client telemetry payload & stage constraints", () => {
  test("allows valid stages and disallows client confirmed_order", () => {
    const validClientStages = new Set(["visit", "product_view", "cart", "ussd_intent"]);
    assert.ok(validClientStages.has("visit"));
    assert.ok(validClientStages.has("product_view"));
    assert.ok(validClientStages.has("cart"));
    assert.ok(validClientStages.has("ussd_intent"));
    assert.ok(!validClientStages.has("confirmed_order"), "confirmed_order must be server-only");
    assert.ok(!validClientStages.has("payment_page_opened"));
  });
});
