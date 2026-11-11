import { describe, test, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prisma } from "../src/lib/db";
import { createCampaign, recordTouchFromText, attributeOrder, getCampaign } from "../src/lib/campaigns";
import {
  createCooperative,
  joinByCode,
  getCooperativeForVendor,
  leaveCooperative,
} from "../src/lib/cooperative";
import { meetsCriteria, evaluateAndGrant, VERIFY_MIN_PAID_ORDERS } from "../src/lib/trust";
import {
  isCustomerEligibleForReactivation,
  customerReactivationEligibility,
  isCustomerVip,
  linkCartSessionToCustomer,
  resolveCustomerForCartSession,
  setCustomerMarketingConsent,
  qualifyingOrderCountsForCustomers,
} from "../src/lib/customers";
import {
  findAbandonedCartRecoveryCandidates,
  renderRecoveryTemplate,
  createRecoveryCampaign,
  approveRecoveryCampaign,
  dispatchRecoveryCampaign,
  getRecoveryApprovalPreview,
  rejectRecoveryCampaignApproval,
  listCampaigns,
} from "../src/lib/campaigns";

/**
 * DB-backed integration tests for campaigns, cooperative, trust, and customer
 * reactivation. The test runner supplies a fresh disposable SQLite database
 * for this suite. Every created vendor is tracked and removed in `after`.
 */

const created: string[] = []; // vendor ids to delete
const coopIds: string[] = [];

async function makeVendor(opts: Partial<{ phoneVerifiedAt: Date }> = {}) {
  const id = randomUUID().slice(0, 8);
  const v = await prisma.vendor.create({
    data: {
      email: `it_${id}@japora.test`,
      passwordHash: "x",
      shopName: `IT ${id}`,
      shopSlug: `it-${id}`,
      currency: "XOF",
      whatsappNumber: "22890000000",
      phoneVerifiedAt: opts.phoneVerifiedAt ?? null,
    },
  });
  created.push(v.id);
  return v;
}

async function makeProduct(vendorId: string, priceCents: number) {
  return prisma.product.create({
    data: { vendorId, name: "Test item", priceCents, stock: 10 },
  });
}

after(async () => {
  // Coops first (vendors reference them via SetNull, but delete explicitly).
  for (const id of created) {
    await prisma.vendor.update({ where: { id }, data: { cooperativeId: null } }).catch(() => {});
  }
  for (const id of coopIds) {
    await prisma.cooperative.delete({ where: { id } }).catch(() => {});
  }
  for (const id of created) {
    await prisma.vendor.delete({ where: { id } }).catch(() => {});
  }
  await prisma.$disconnect();
});

describe("campaigns: create → touch → attribute (last-touch)", () => {
  test("an order from a touched phone credits the campaign", async () => {
    const vendor = await makeVendor();
    const product = await makeProduct(vendor.id, 500000); // 5,000 XOF*100
    const campaign = await createCampaign(vendor.id, { name: "IT promo", productId: product.id });
    assert.match(campaign.refCode, /^[A-Z0-9]{6}$/);

    const phone = "22890123456";
    const touchId = await recordTouchFromText(vendor.id, phone, `Hi! (ref: ${campaign.refCode})`);
    assert.equal(touchId, campaign.id);

    const order = await prisma.order.create({
      data: {
        vendorId: vendor.id,
        customerName: phone,
        customerPhone: phone,
        status: "NEW",
        totalCents: 500000,
      },
    });

    const attributed = await attributeOrder({
      orderId: order.id,
      vendorId: vendor.id,
      phone,
      revenueCents: 500000,
    });
    assert.equal(attributed, campaign.id);

    const stats = await getCampaign(vendor.id, campaign.id);
    assert.equal(stats?.orders, 1);
    assert.equal(stats?.revenueCents, 500000);

    const reloaded = await prisma.order.findUnique({ where: { id: order.id }, select: { campaignId: true } });
    assert.equal(reloaded?.campaignId, campaign.id);
  });

  test("attribution is idempotent — a second call doesn't double-count", async () => {
    const vendor = await makeVendor();
    const campaign = await createCampaign(vendor.id, { name: "IT idem" });
    const phone = "22890999111";
    await recordTouchFromText(vendor.id, phone, `(ref: ${campaign.refCode})`);
    const order = await prisma.order.create({
      data: { vendorId: vendor.id, customerName: phone, customerPhone: phone, status: "NEW", totalCents: 1000 },
    });
    await attributeOrder({ orderId: order.id, vendorId: vendor.id, phone, revenueCents: 1000 });
    await attributeOrder({ orderId: order.id, vendorId: vendor.id, phone, revenueCents: 1000 });
    const stats = await getCampaign(vendor.id, campaign.id);
    assert.equal(stats?.orders, 1);
    assert.equal(stats?.revenueCents, 1000);
  });

  test("no touch → no attribution", async () => {
    const vendor = await makeVendor();
    const campaign = await createCampaign(vendor.id, { name: "IT none" });
    const order = await prisma.order.create({
      data: { vendorId: vendor.id, customerName: "x", customerPhone: "22890000777", status: "NEW", totalCents: 1000 },
    });
    const attributed = await attributeOrder({ orderId: order.id, vendorId: vendor.id, phone: "22890000777", revenueCents: 1000 });
    assert.equal(attributed, null);
    const stats = await getCampaign(vendor.id, campaign.id);
    assert.equal(stats?.orders, 0);
  });
});

describe("campaigns: abandoned-cart recovery", () => {
  test("detects stale cart sessions, blocks duplicate draft recovery, and requires approval before send", async () => {
    const vendor = await makeVendor();
    const otherVendor = await makeVendor();
    const product = await makeProduct(vendor.id, 2500);
    const now = Date.now();
    const stale = new Date(now - 5 * 60 * 60 * 1000);
    const recent = new Date(now - 30 * 60 * 1000);

    await prisma.funnelEvent.createMany({
      data: [
        { vendorId: vendor.id, shopSlug: vendor.shopSlug, stage: "cart", sessionId: "cart-1", productId: product.id, valueCents: 2500, createdAt: stale },
        { vendorId: vendor.id, shopSlug: vendor.shopSlug, stage: "cart", sessionId: "cart-2", productId: product.id, valueCents: 3200, createdAt: stale },
        { vendorId: vendor.id, shopSlug: vendor.shopSlug, stage: "cart", sessionId: "cart-3", productId: product.id, valueCents: 1500, createdAt: recent },
        { vendorId: otherVendor.id, shopSlug: otherVendor.shopSlug, stage: "cart", sessionId: "cart-other", productId: product.id, valueCents: 500, createdAt: stale },
      ],
    });

    await prisma.order.create({
      data: {
        vendorId: vendor.id,
        customerName: "Amina",
        customerPhone: "22890000005",
        sessionId: "cart-2",
        status: "NEW",
        totalCents: 3200,
      },
    });

    const candidates = await findAbandonedCartRecoveryCandidates(vendor.id, { now, staleAfterMs: 2 * 60 * 60 * 1000 });
    assert.equal(candidates.some((c) => c.sessionId === "cart-1"), true);
    assert.equal(candidates.some((c) => c.sessionId === "cart-2"), false);
    assert.equal(candidates.some((c) => c.sessionId === "cart-other"), false);

    const preview = renderRecoveryTemplate(
      "Hi {{name}}, your {{product}} is still waiting at {{store}}.",
      { name: "Ada", product: "Ankara Gown", store: "Ada's Fashion House" },
    );
    assert.match(preview, /Ada/);
    assert.match(preview, /Ankara Gown/);
    assert.match(preview, /Ada's Fashion House/);

    const draft = await createRecoveryCampaign(vendor.id, {
      sessionId: "cart-1",
      productId: product.id,
      template: preview,
    });
    assert.equal(draft.status, "draft");

    const duplicate = await createRecoveryCampaign(vendor.id, {
      sessionId: "cart-1",
      productId: product.id,
      template: preview,
    });
    assert.equal(duplicate.id, draft.id);

    const draftDispatch = await dispatchRecoveryCampaign(vendor.id, draft.id);
    assert.equal(draftDispatch.status, "approval_required");

    const approved = await approveRecoveryCampaign(vendor.id, draft.id);
    assert.ok(approved, "draft approval should return the vendor-scoped campaign");
    assert.equal(approved.status, "approved");

    const blocked = await dispatchRecoveryCampaign(vendor.id, draft.id);
    assert.equal(blocked.status, "blocked");
    assert.equal(blocked.sent, 0);
  });
});

describe("campaigns: cart identity + consent guardrails", () => {
  test("links a cart session to the correct customer within the same merchant and blocks cross-merchant identity reuse", async () => {
    const vendor = await makeVendor();
    const otherVendor = await makeVendor();
    const customer = await prisma.customer.create({
      data: {
        vendorId: vendor.id,
        name: "Ada",
        phone: "22890000099",
        marketingConsent: true,
      },
    });
    await prisma.customer.create({
      data: {
        vendorId: otherVendor.id,
        name: "Other Ada",
        phone: "22890000099",
        marketingConsent: true,
      },
    });

    await prisma.funnelEvent.create({
      data: {
        vendorId: vendor.id,
        shopSlug: vendor.shopSlug,
        stage: "cart",
        sessionId: "identity-merchant-scope",
        valueCents: 2400,
      },
    });

    const linked = await linkCartSessionToCustomer(prisma, vendor.id, "identity-merchant-scope", {
      customerPhone: "22890000099",
    });
    assert.deepEqual(linked, { customerId: customer.id, customerPhone: "22890000099" });

    const resolved = await resolveCustomerForCartSession(prisma, vendor.id, "identity-merchant-scope");
    assert.equal(resolved?.customerId, customer.id);
    assert.equal(resolved?.customerPhone, "22890000099");

    const blocked = await linkCartSessionToCustomer(prisma, otherVendor.id, "identity-merchant-scope", {
      customerId: customer.id,
    });
    assert.equal(blocked, null);
  });

  test("rejected consent, revoked consent, or changed identity require a fresh approval before send", async () => {
    const vendor = await makeVendor();
    const product = await makeProduct(vendor.id, 2500);
    const customer = await prisma.customer.create({
      data: {
        vendorId: vendor.id,
        name: "Mawuli",
        phone: "22890000123",
        marketingConsent: true,
      },
    });

    const staleCart = new Date(Date.now() - 30 * 60 * 60 * 1000);
    await prisma.funnelEvent.create({
      data: {
        vendorId: vendor.id,
        shopSlug: vendor.shopSlug,
        stage: "cart",
        sessionId: "identity-approval-check",
        productId: product.id,
        customerId: customer.id,
        customerPhone: customer.phone,
        valueCents: 2500,
        createdAt: staleCart,
      },
    });

    const draft = await createRecoveryCampaign(vendor.id, {
      sessionId: "identity-approval-check",
      productId: product.id,
      template: "Hi {{name}}, your {{product}} is still waiting.",
    });
    await approveRecoveryCampaign(vendor.id, draft.id, {
      sessionId: "identity-approval-check",
      recipientPhone: customer.phone,
      body: "Hi Mawuli, your Test item is still waiting.",
    });

    await prisma.customer.update({
      where: { id: customer.id },
      data: { phone: "22890000999", marketingConsent: false, marketingConsentRevokedAt: new Date() },
    });

    const blocked = await dispatchRecoveryCampaign(vendor.id, draft.id);
    assert.equal(blocked.status, "blocked");
    assert.equal(blocked.sent, 0);

    const secondCustomer = await prisma.customer.create({
      data: {
        vendorId: vendor.id,
        name: "Mawuli 2",
        phone: "22890000444",
        marketingConsent: true,
      },
    });
    await prisma.funnelEvent.updateMany({
      where: { vendorId: vendor.id, sessionId: "identity-approval-check" },
      data: { customerId: secondCustomer.id, customerPhone: secondCustomer.phone },
    });

    const fresh = await approveRecoveryCampaign(vendor.id, draft.id, {
      sessionId: "identity-approval-check",
      recipientPhone: secondCustomer.phone,
      body: "Hi Mawuli 2, your Test item is still waiting.",
    });
    assert.ok(fresh, "fresh approval should return the updated campaign");
    assert.equal(fresh.status, "approved");

    const final = await dispatchRecoveryCampaign(vendor.id, draft.id);
    assert.equal(final.status, "stubbed");
    assert.equal(final.sent, 1);
  });
});

describe("campaigns: dashboard recovery retrieval", () => {
  test("listCampaigns reconciles eligible stale carts into the vendor-scoped dashboard list", async () => {
    const vendor = await makeVendor();
    const otherVendor = await makeVendor();
    const product = await makeProduct(vendor.id, 2500);

    const stale = new Date(Date.now() - 30 * 60 * 60 * 1000);
    await prisma.funnelEvent.create({
      data: {
        vendorId: vendor.id,
        shopSlug: vendor.shopSlug,
        stage: "cart",
        sessionId: "dashboard-recovery-sync",
        productId: product.id,
        valueCents: 2500,
        createdAt: stale,
      },
    });
    await prisma.funnelEvent.create({
      data: {
        vendorId: otherVendor.id,
        shopSlug: otherVendor.shopSlug,
        stage: "cart",
        sessionId: "dashboard-recovery-sync-other",
        productId: product.id,
        valueCents: 2500,
        createdAt: stale,
      },
    });

    const vendorCampaigns = await listCampaigns(vendor.id);
    const otherVendorCampaigns = await listCampaigns(otherVendor.id);

    assert.ok(vendorCampaigns.some((c) => c.name === "Abandoned cart recovery" && c.status === "draft"));
    assert.equal(otherVendorCampaigns.some((c) => c.name === "Abandoned cart recovery"), true);

    const persisted = await prisma.campaign.findMany({
      where: { vendorId: vendor.id, name: "Abandoned cart recovery" },
      select: { id: true, status: true, productId: true },
    });
    assert.ok(persisted.some((c) => c.status === "draft"));
  });
});

describe("campaigns: approval preview and merchant action", () => {
  test("preview and approval logic bind the exact recipient and message payload", async () => {
    const vendor = await makeVendor();
    const product = await makeProduct(vendor.id, 2500);
    const customer = await prisma.customer.create({
      data: {
        vendorId: vendor.id,
        name: "Ada",
        phone: "22890000222",
        marketingConsent: true,
      },
    });

    await prisma.funnelEvent.create({
      data: {
        vendorId: vendor.id,
        shopSlug: vendor.shopSlug,
        stage: "cart",
        sessionId: "approval-route-demo",
        productId: product.id,
        customerId: customer.id,
        customerPhone: customer.phone,
        valueCents: 2500,
        createdAt: new Date(Date.now() - 30 * 60 * 60 * 1000),
      },
    });

    const draft = await createRecoveryCampaign(vendor.id, {
      sessionId: "approval-route-demo",
      productId: product.id,
      template: "Hi {{name}}, your {{product}} is still waiting at {{store}}.",
    });

    const preview = await getRecoveryApprovalPreview(vendor.id, draft.id);
    assert.ok(preview);
    assert.equal(preview?.phone, customer.phone);
    assert.match(preview?.renderedBody || "", /Ada/);
    assert.match(preview?.renderedBody || "", /still waiting/);

    const rejected = await rejectRecoveryCampaignApproval(vendor.id, draft.id);
    assert.equal(rejected?.status, "draft");

    const blockedBeforeApproval = await dispatchRecoveryCampaign(vendor.id, draft.id);
    assert.equal(blockedBeforeApproval.status, "approval_required");

    const approved = await approveRecoveryCampaign(vendor.id, draft.id, {
      sessionId: "approval-route-demo",
      recipientPhone: customer.phone,
      body: preview?.renderedBody || "",
    });
    assert.equal(approved?.status, "approved");
    assert.equal(approved?.approvedForPhone, customer.phone);

    const result = await dispatchRecoveryCampaign(vendor.id, draft.id);
    assert.equal(result.status, "stubbed");
    assert.equal(result.sent, 1);
  });
});

describe("cooperative: create → join → roster → leave", () => {
  test("admin creates, a second vendor joins, roster reflects both", async () => {
    const admin = await makeVendor();
    const coop = await createCooperative(admin.id, { name: "IT Market", region: "Lomé" });
    coopIds.push(coop.id);
    assert.match(coop.joinCode, /^[A-Z0-9]{6}$/);

    // Re-creating while already a member is refused.
    await assert.rejects(() => createCooperative(admin.id, { name: "again" }), /already_member/);

    const member = await makeVendor();
    const joined = await joinByCode(member.id, coop.joinCode);
    assert.equal(joined?.id, coop.id);

    const view = await getCooperativeForVendor(admin.id);
    assert.equal(view?.memberCount, 2);
    assert.equal(view?.isAdmin, true);

    await leaveCooperative(member.id);
    const after2 = await getCooperativeForVendor(admin.id);
    assert.equal(after2?.memberCount, 1);
  });

  test("unknown join code returns null", async () => {
    const v = await makeVendor();
    const r = await joinByCode(v.id, "ZZZZZZ");
    assert.equal(r, null);
  });
});

describe("trust: verified-shop criteria", () => {
  test("grants only after phone-verified + threshold paid orders", async () => {
    const vendor = await makeVendor({ phoneVerifiedAt: new Date() });

    // Below threshold → not met, not granted.
    assert.equal(await meetsCriteria(vendor.id), false);
    assert.equal(await evaluateAndGrant(vendor.id), false);

    for (let i = 0; i < VERIFY_MIN_PAID_ORDERS; i++) {
      await prisma.order.create({
        data: { vendorId: vendor.id, customerName: "c", status: "PAID", totalCents: 1000 },
      });
    }

    assert.equal(await meetsCriteria(vendor.id), true);
    assert.equal(await evaluateAndGrant(vendor.id), true); // newly granted
    assert.equal(await evaluateAndGrant(vendor.id), false); // already verified

    const v = await prisma.vendor.findUnique({ where: { id: vendor.id }, select: { verifiedAt: true } });
    assert.ok(v?.verifiedAt);
  });

  test("phone unverified never qualifies", async () => {
    const vendor = await makeVendor(); // no phoneVerifiedAt
    for (let i = 0; i < VERIFY_MIN_PAID_ORDERS + 1; i++) {
      await prisma.order.create({
        data: { vendorId: vendor.id, customerName: "c", status: "PAID", totalCents: 1000 },
      });
    }
    assert.equal(await meetsCriteria(vendor.id), false);
  });
});

describe("reactivation: Japora customer rules", () => {
  test("at the exact 30-day boundary it is eligible, just before it is not", () => {
    const now = new Date("2026-01-31T00:00:00Z").getTime();
    const threshold = 30 * 24 * 60 * 60 * 1000;

    assert.equal(customerReactivationEligibility(
      {
        marketingConsent: true,
        lastOrderAt: new Date(now - threshold),
      },
      now,
    ), true);

    assert.equal(customerReactivationEligibility(
      {
        marketingConsent: true,
        lastOrderAt: new Date(now - threshold + 1),
      },
      now,
    ), false);

    assert.equal(isCustomerEligibleForReactivation({
      marketingConsent: true,
      lastOrderAt: null,
    }, now), false);
  });

  test("marketing consent is required and VIP is tracked separately from reactivation", () => {
    const now = Date.now();

    assert.equal(customerReactivationEligibility(
      {
        marketingConsent: false,
        lastOrderAt: new Date(now - 40 * 24 * 60 * 60 * 1000),
      },
      now,
    ), false);

    assert.equal(customerReactivationEligibility(
      {
        marketingConsent: true,
        marketingConsentRevokedAt: new Date(now - 2 * 24 * 60 * 60 * 1000),
        lastOrderAt: new Date(now - 40 * 24 * 60 * 60 * 1000),
      },
      now,
    ), false);

    assert.equal(customerReactivationEligibility(
      {
        marketingConsent: true,
        orderCount: 3,
        lastOrderAt: new Date(now - 40 * 24 * 60 * 60 * 1000),
      },
      now,
    ), true);

    assert.equal(isCustomerVip({ qualifyingOrderCount: 3 }), true);
    assert.equal(isCustomerVip({ qualifyingOrderCount: 2 }), false);
  });

  test("customer page VIP count excludes cancelled, unpaid, and deleted orders", async () => {
    const vendor = await makeVendor();
    const customer = await prisma.customer.create({
      data: { vendorId: vendor.id, name: "VIP filter customer", phone: "22890000012", orderCount: 6 },
    });
    const orders = ["PAID", "DELIVERED", "CANCELLED", "NEW", "CONFIRMED", "PAID"];
    for (const [index, status] of orders.entries()) {
      await prisma.order.create({
        data: {
          vendorId: vendor.id,
          customerId: customer.id,
          customerName: customer.name,
          customerPhone: customer.phone,
          status,
          totalCents: 1000,
          deletedAt: index === 1 ? new Date() : null,
        },
      });
    }

    const counts = await qualifyingOrderCountsForCustomers(vendor.id, [customer.id]);
    assert.equal(counts.get(customer.id), 2);
    assert.equal(isCustomerVip({ qualifyingOrderCount: counts.get(customer.id), orderCount: customer.orderCount }), false);
  });

  test("customer consent persists in the database and reactivates only after a fresh explicit grant", async () => {
    const vendor = await makeVendor();
    const customer = await prisma.customer.create({
      data: {
        vendorId: vendor.id,
        name: "Consent customer",
        phone: "22890000011",
        email: "consent@test.local",
      },
    });

    await setCustomerMarketingConsent(prisma, vendor.id, customer.id, { marketingConsent: true, marketingConsentBasis: "manual" });
    let persisted = await prisma.customer.findUnique({ where: { id: customer.id } });
    assert.equal(persisted?.marketingConsent, true);
    assert.equal(persisted?.marketingConsentRevokedAt, null);
    assert.ok(persisted?.marketingConsentAt);
    assert.equal(customerReactivationEligibility({
      marketingConsent: persisted?.marketingConsent ?? false,
      marketingConsentRevokedAt: persisted?.marketingConsentRevokedAt,
      lastOrderAt: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000),
    }, Date.now()), true);

    await setCustomerMarketingConsent(prisma, vendor.id, customer.id, { marketingConsent: false, marketingConsentBasis: "manual" });
    persisted = await prisma.customer.findUnique({ where: { id: customer.id } });
    assert.equal(persisted?.marketingConsent, false);
    assert.ok(persisted?.marketingConsentRevokedAt);
    assert.equal(customerReactivationEligibility({
      marketingConsent: persisted?.marketingConsent ?? false,
      marketingConsentRevokedAt: persisted?.marketingConsentRevokedAt,
      lastOrderAt: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000),
    }, Date.now()), false);

    await assert.rejects(
      () => setCustomerMarketingConsent(prisma, vendor.id, customer.id, { marketingConsent: true, marketingConsentBasis: "bogus" }),
      /valid_consent_basis_required|marketingConsent must be boolean/
    );

    await setCustomerMarketingConsent(prisma, vendor.id, customer.id, { marketingConsent: true, marketingConsentBasis: "signup" });
    persisted = await prisma.customer.findUnique({ where: { id: customer.id } });
    assert.equal(persisted?.marketingConsent, true);
    assert.equal(persisted?.marketingConsentRevokedAt, null);
    assert.ok(persisted?.marketingConsentAt);
  });
});
