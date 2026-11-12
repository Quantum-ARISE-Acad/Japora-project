import { describe, test, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

if (
  !process.env.DATABASE_URL ||
  process.env.WATURU_TEST_MODE !== "1" ||
  !process.env.WATURU_TEST_DB_ROOT
) {
  throw new Error("campaign-safety.test.ts must run with the isolated database environment provided by the test runner.");
}
// Campaign safety tests must never use real WhatsApp credentials.
delete process.env.WHATSAPP_TOKEN;
delete process.env.WHATSAPP_PHONE_NUMBER_ID;

// The runner assigns DATABASE_URL and prepares this suite's disposable schema
// before loading this test. The database guard validates it against the runner's
// temporary root when the Prisma client is imported below.
const { prisma } = require("../src/lib/db") as typeof import("../src/lib/db");
const {
  createRecoveryCampaign,
  approveRecoveryCampaign,
  dispatchRecoveryCampaign,
  getRecoveryApprovalPreview,
  rejectRecoveryCampaignApproval,
  getCampaign,
  softDeleteCampaign,
} = require("../src/lib/campaigns") as typeof import("../src/lib/campaigns");
const {
  setCustomerMarketingConsent,
  linkCartSessionToCustomer,
} = require("../src/lib/customers") as typeof import("../src/lib/customers");
const { normalizePhone } = require("../src/lib/otp") as typeof import("../src/lib/otp");
const { getProvider, isLiveMode, sendWhatsAppInteractive, sendWhatsAppTemplate } = require("../src/lib/whatsapp") as typeof import("../src/lib/whatsapp");
const { dispatchBroadcast, queueBroadcast, processBroadcastQueue } = require("../src/lib/broadcast") as typeof import("../src/lib/broadcast");

after(async () => {
  await prisma.$disconnect();
});

describe("test-mode provider isolation", () => {
  test("WhatsApp credentials cannot select a live provider in test mode", async () => {
    const originalTestMode = process.env.WATURU_TEST_MODE;
    const originalToken = process.env.WHATSAPP_TOKEN;
    const originalPhoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    const vendor = await createTestVendor("provider_isolation");

    process.env.WATURU_TEST_MODE = "1";
    process.env.WHATSAPP_TOKEN = "test-only-token-not-valid";
    process.env.WHATSAPP_PHONE_NUMBER_ID = "test-only-phone-id-not-valid";

    try {
      assert.equal(isLiveMode(), false);
      assert.equal(getProvider().name, "stub");

      const interactive = await sendWhatsAppInteractive({
        vendorId: vendor.id,
        to: "+22890000000",
        body: "Test-only interactive message",
        buttons: [{ id: "ok", title: "OK" }],
      });
      const template = await sendWhatsAppTemplate({
        vendorId: vendor.id,
        to: "+22890000000",
        templateName: "test_only",
        languageCode: "en",
      });

      assert.equal(interactive.provider, "stub");
      assert.equal(interactive.status, "stubbed");
      assert.equal(template.provider, "stub");
      assert.equal(template.status, "stubbed");
    } finally {
      if (originalTestMode === undefined) delete process.env.WATURU_TEST_MODE;
      else process.env.WATURU_TEST_MODE = originalTestMode;
      if (originalToken === undefined) delete process.env.WHATSAPP_TOKEN;
      else process.env.WHATSAPP_TOKEN = originalToken;
      if (originalPhoneNumberId === undefined) delete process.env.WHATSAPP_PHONE_NUMBER_ID;
      else process.env.WHATSAPP_PHONE_NUMBER_ID = originalPhoneNumberId;
    }
  });
});

async function createTestVendor(namePrefix = "vendor") {
  const id = randomUUID().slice(0, 8);
  return prisma.vendor.create({
    data: {
      email: `${namePrefix}_${id}@test.japora`,
      passwordHash: "hash123",
      shopName: `${namePrefix} Shop ${id}`,
      shopSlug: `${namePrefix}-shop-${id}`,
      currency: "XOF",
      whatsappNumber: "+22890000000",
    },
  });
}

async function createTestProduct(vendorId: string, name = "Ankara Fabric", priceCents = 2500) {
  return prisma.product.create({
    data: {
      vendorId,
      name,
      priceCents,
      stock: 50,
      isActive: true,
    },
  });
}

async function createStaleCart(vendorId: string, opts: {
  sessionId: string;
  productId: string;
  customerId?: string | null;
  customerPhone?: string | null;
  shopSlug?: string;
  hoursAgo?: number;
}) {
  const staleAt = new Date(Date.now() - (opts.hoursAgo ?? 30) * 60 * 60 * 1000);
  return prisma.funnelEvent.create({
    data: {
      vendorId,
      shopSlug: opts.shopSlug ?? "test-shop",
      stage: "cart",
      sessionId: opts.sessionId,
      productId: opts.productId,
      customerId: opts.customerId ?? null,
      customerPhone: opts.customerPhone ?? null,
      valueCents: 2500,
      createdAt: staleAt,
    },
  });
}

describe("campaign safety: approval binding & payload invalidation", () => {
  test("recovery preview and dispatch use the active product attached to the cart", async () => {
    const vendor = await createTestVendor("cart_product_payload");
    const product = await createTestProduct(vendor.id, "Blue Kente Dress");
    const customer = await prisma.customer.create({
      data: {
        vendorId: vendor.id,
        name: "Cart Buyer",
        phone: "+22890101010",
        marketingConsent: true,
      },
    });
    const sessionId = "cart-product-payload-session";
    await createStaleCart(vendor.id, {
      sessionId,
      productId: product.id,
      customerId: customer.id,
      customerPhone: customer.phone,
      shopSlug: vendor.shopSlug,
    });
    const draft = await createRecoveryCampaign(vendor.id, { sessionId, productId: product.id });

    const preview = await getRecoveryApprovalPreview(vendor.id, draft.id);
    assert.ok(preview);
    const expectedBody = `Hi Cart Buyer, your Blue Kente Dress is still waiting at ${vendor.shopName}.`;
    assert.equal(preview.renderedBody, expectedBody);
    assert.equal(preview.productId, product.id);
    await approveRecoveryCampaign(vendor.id, draft.id, {
      sessionId,
      recipientPhone: customer.phone,
      body: preview.renderedBody,
    });

    const result = await dispatchRecoveryCampaign(vendor.id, draft.id);
    assert.equal(result.status, "stubbed");
    const message = await prisma.whatsAppMessage.findFirst({
      where: { vendorId: vendor.id, contact: normalizePhone(customer.phone), direction: "OUT" },
    });
    assert.equal(message?.body, expectedBody);
  });

  test("deleted cart product renders blank and requires approval of the exact final body", async () => {
    const vendor = await createTestVendor("deleted_cart_product");
    const product = await createTestProduct(vendor.id, "Deleted Dress");
    const customer = await prisma.customer.create({
      data: {
        vendorId: vendor.id,
        name: "Deleted Product Buyer",
        phone: "+22890102020",
        marketingConsent: true,
      },
    });
    const sessionId = "deleted-cart-product-session";
    await createStaleCart(vendor.id, {
      sessionId,
      productId: product.id,
      customerId: customer.id,
      customerPhone: customer.phone,
      shopSlug: vendor.shopSlug,
    });
    await prisma.product.delete({ where: { id: product.id } });
    const draft = await createRecoveryCampaign(vendor.id, { sessionId, productId: null });

    const preview = await getRecoveryApprovalPreview(vendor.id, draft.id);
    assert.ok(preview);
    const expectedBody = `Hi Deleted Product Buyer, your is still waiting at ${vendor.shopName}.`;
    assert.equal(preview.productId, null);
    assert.equal(preview.productName, null);
    assert.equal(preview.renderedBody, expectedBody);
    assert.doesNotMatch(preview.renderedBody, /\{\{\s*product\s*\}\}|Deleted Dress|your item/i);

    await approveRecoveryCampaign(vendor.id, draft.id, {
      sessionId,
      recipientPhone: customer.phone,
      body: preview.renderedBody,
    });
    const result = await dispatchRecoveryCampaign(vendor.id, draft.id);
    assert.equal(result.status, "stubbed");
    const message = await prisma.whatsAppMessage.findFirst({
      where: { vendorId: vendor.id, contact: normalizePhone(customer.phone), direction: "OUT" },
    });
    assert.equal(message?.body, expectedBody);
  });

  test("changing the recipient phone invalidates the previous approval and blocks dispatch", async () => {
    const vendor = await createTestVendor("bind_phone");
    const product = await createTestProduct(vendor.id);
    const customerA = await prisma.customer.create({
      data: {
        vendorId: vendor.id,
        name: "Customer A",
        phone: "+22890111111",
        marketingConsent: true,
      },
    });

    const sessionId = "bind-phone-session-1";
    await createStaleCart(vendor.id, {
      sessionId,
      productId: product.id,
      customerId: customerA.id,
      customerPhone: customerA.phone,
      shopSlug: vendor.shopSlug,
    });

    const draft = await createRecoveryCampaign(vendor.id, {
      sessionId,
      productId: product.id,
      template: "Hi {{name}}, your {{product}} is still waiting at {{store}}.",
    });

    const preview = await getRecoveryApprovalPreview(vendor.id, draft.id);
    assert.ok(preview);
    assert.equal(preview.phone, normalizePhone(customerA.phone));

    // Approve for Customer A
    const approved = await approveRecoveryCampaign(vendor.id, draft.id, {
      sessionId,
      recipientPhone: customerA.phone,
      body: preview.renderedBody,
    });
    assert.equal(approved?.status, "approved");

    // Change the cart's customer phone to Customer B (+22890222222)
    const customerB = await prisma.customer.create({
      data: {
        vendorId: vendor.id,
        name: "Customer B",
        phone: "+22890222222",
        marketingConsent: true,
      },
    });
    await prisma.funnelEvent.updateMany({
      where: { vendorId: vendor.id, sessionId },
      data: { customerId: customerB.id, customerPhone: customerB.phone },
    });

    // Preview should now show approvalRequired: true because phone changed
    const previewAfterPhoneChange = await getRecoveryApprovalPreview(vendor.id, draft.id);
    assert.ok(previewAfterPhoneChange);
    assert.equal(previewAfterPhoneChange.alreadyApproved, false);
    assert.equal(previewAfterPhoneChange.approvalRequired, true);

    // Dispatch must be blocked due to approval_mismatch
    const result = await dispatchRecoveryCampaign(vendor.id, draft.id);
    assert.equal(result.status, "blocked");
    assert.equal(result.sent, 0);
    assert.equal(result.reason, "approval_mismatch");

    // Campaign in database must be marked blocked
    const dbCampaign = await prisma.campaign.findUnique({ where: { id: draft.id } });
    assert.equal(dbCampaign?.status, "blocked");
  });

  test("changing the rendered message invalidates the previous approval and blocks dispatch", async () => {
    const vendor = await createTestVendor("bind_msg");
    const product = await createTestProduct(vendor.id, "Original Item");
    const customer = await prisma.customer.create({
      data: {
        vendorId: vendor.id,
        name: "Message Buyer",
        phone: "+22890333333",
        marketingConsent: true,
      },
    });

    const sessionId = "bind-msg-session-1";
    await createStaleCart(vendor.id, {
      sessionId,
      productId: product.id,
      customerId: customer.id,
      customerPhone: customer.phone,
      shopSlug: vendor.shopSlug,
    });

    const draft = await createRecoveryCampaign(vendor.id, {
      sessionId,
      productId: product.id,
      template: "Hi {{name}}, your {{product}} is still waiting at {{store}}.",
    });

    const preview = await getRecoveryApprovalPreview(vendor.id, draft.id);
    assert.ok(preview);

    // Approve the original message
    await approveRecoveryCampaign(vendor.id, draft.id, {
      sessionId,
      recipientPhone: customer.phone,
      body: preview.renderedBody,
    });

    // Now update the product name, changing the rendered message body
    await prisma.product.update({
      where: { id: product.id },
      data: { name: "Completely Different Item" },
    });

    // Preview must show approvalRequired: true
    const previewAfterChange = await getRecoveryApprovalPreview(vendor.id, draft.id);
    assert.ok(previewAfterChange);
    assert.equal(previewAfterChange.alreadyApproved, false);
    assert.equal(previewAfterChange.approvalRequired, true);

    // Dispatch must be blocked because the rendered body no longer matches approvedBody
    const result = await dispatchRecoveryCampaign(vendor.id, draft.id);
    assert.equal(result.status, "blocked");
    assert.equal(result.sent, 0);
    assert.equal(result.reason, "approval_mismatch");
  });
});

describe("campaign safety: marketing consent enforcement", () => {
  test("missing marketing consent (null) blocks dispatch", async () => {
    const vendor = await createTestVendor("consent_null");
    const product = await createTestProduct(vendor.id);
    const customer = await prisma.customer.create({
      data: {
        vendorId: vendor.id,
        name: "No Consent Buyer",
        phone: "+22890444444",
        marketingConsent: null, // explicitly null / unset
      },
    });

    const sessionId = "consent-null-session";
    await createStaleCart(vendor.id, {
      sessionId,
      productId: product.id,
      customerId: customer.id,
      customerPhone: customer.phone,
      shopSlug: vendor.shopSlug,
    });

    const draft = await createRecoveryCampaign(vendor.id, {
      sessionId,
      productId: product.id,
    });

    // Merchant attempts to approve
    await approveRecoveryCampaign(vendor.id, draft.id, {
      sessionId,
      recipientPhone: customer.phone,
      body: "Hi No Consent Buyer, your item is waiting.",
    });

    const result = await dispatchRecoveryCampaign(vendor.id, draft.id);
    assert.equal(result.status, "blocked");
    assert.equal(result.sent, 0);
  });

  test("explicitly false or revoked marketing consent blocks dispatch", async () => {
    const vendor = await createTestVendor("consent_revoked");
    const product = await createTestProduct(vendor.id);
    const customer = await prisma.customer.create({
      data: {
        vendorId: vendor.id,
        name: "Revoked Buyer",
        phone: "+22890555555",
        marketingConsent: true,
        marketingConsentBasis: "manual",
      },
    });

    const sessionId = "consent-revoked-session";
    await createStaleCart(vendor.id, {
      sessionId,
      productId: product.id,
      customerId: customer.id,
      customerPhone: customer.phone,
      shopSlug: vendor.shopSlug,
    });

    const draft = await createRecoveryCampaign(vendor.id, {
      sessionId,
      productId: product.id,
    });

    const preview = await getRecoveryApprovalPreview(vendor.id, draft.id);
    assert.ok(preview);

    await approveRecoveryCampaign(vendor.id, draft.id, {
      sessionId,
      recipientPhone: customer.phone,
      body: preview.renderedBody,
    });

    // Customer revokes consent
    await setCustomerMarketingConsent(prisma, vendor.id, customer.id, {
      marketingConsent: false,
    });

    const result = await dispatchRecoveryCampaign(vendor.id, draft.id);
    assert.equal(result.status, "blocked");
    assert.equal(result.sent, 0);
  });
});

describe("campaign safety: customer identity enforcement", () => {
  test("cart session without identifiable customer blocks dispatch", async () => {
    const vendor = await createTestVendor("unidentified_cart");
    const product = await createTestProduct(vendor.id);

    const sessionId = "unidentified-session-1";
    await createStaleCart(vendor.id, {
      sessionId,
      productId: product.id,
      customerId: null,
      customerPhone: null,
      shopSlug: vendor.shopSlug,
    });

    const draft = await createRecoveryCampaign(vendor.id, {
      sessionId,
      productId: product.id,
    });

    // Preview returns null because no recipient can be identified
    const preview = await getRecoveryApprovalPreview(vendor.id, draft.id);
    assert.equal(preview, null);

    // Force approve with arbitrary values
    await approveRecoveryCampaign(vendor.id, draft.id, {
      sessionId,
      recipientPhone: "+22890666666",
      body: "Arbitrary text",
    });

    // Dispatch must block because no recipient can be resolved from the cart
    const result = await dispatchRecoveryCampaign(vendor.id, draft.id);
    assert.equal(result.status, "blocked");
    assert.equal(result.sent, 0);
  });

  test("invalid customer phone number format blocks dispatch", async () => {
    const vendor = await createTestVendor("invalid_phone");
    const product = await createTestProduct(vendor.id);

    // Customer with invalid phone number
    const customer = await prisma.customer.create({
      data: {
        vendorId: vendor.id,
        name: "Invalid Phone User",
        phone: "not-a-valid-phone-123",
        marketingConsent: true,
      },
    });

    const sessionId = "invalid-phone-session";
    await createStaleCart(vendor.id, {
      sessionId,
      productId: product.id,
      customerId: customer.id,
      customerPhone: customer.phone,
      shopSlug: vendor.shopSlug,
    });

    const draft = await createRecoveryCampaign(vendor.id, {
      sessionId,
      productId: product.id,
    });

    // getRecoveryApprovalPreview must return null due to invalid phone
    const preview = await getRecoveryApprovalPreview(vendor.id, draft.id);
    assert.equal(preview, null);

    await approveRecoveryCampaign(vendor.id, draft.id, {
      sessionId,
      recipientPhone: "not-a-valid-phone-123",
      body: "Text",
    });

    const result = await dispatchRecoveryCampaign(vendor.id, draft.id);
    assert.equal(result.status, "blocked");
    assert.equal(result.sent, 0);
  });
});

describe("campaign safety: weekly rate limit & duplicate dispatch guards", () => {
  test("weekly outbound sending limit (2 messages per week) is strictly enforced", async () => {
    const vendor = await createTestVendor("rate_limit");
    const product = await createTestProduct(vendor.id);
    const phone = "+22890777777";
    const customer = await prisma.customer.create({
      data: {
        vendorId: vendor.id,
        name: "Rate Limited Buyer",
        phone,
        marketingConsent: true,
      },
    });

    // Pre-seed 2 outbound WhatsApp messages within the last 7 days
    await prisma.whatsAppMessage.createMany({
      data: [
        {
          vendorId: vendor.id,
          direction: "OUT",
          contact: normalizePhone(phone),
          body: "Previous message 1",
          status: "sent",
          createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        },
        {
          vendorId: vendor.id,
          direction: "OUT",
          contact: normalizePhone(phone),
          body: "Previous message 2",
          status: "sent",
          createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
        },
      ],
    });

    const sessionId = "rate-limit-session";
    await createStaleCart(vendor.id, {
      sessionId,
      productId: product.id,
      customerId: customer.id,
      customerPhone: phone,
      shopSlug: vendor.shopSlug,
    });

    const draft = await createRecoveryCampaign(vendor.id, {
      sessionId,
      productId: product.id,
    });

    const preview = await getRecoveryApprovalPreview(vendor.id, draft.id);
    assert.ok(preview);

    await approveRecoveryCampaign(vendor.id, draft.id, {
      sessionId,
      recipientPhone: phone,
      body: preview.renderedBody,
    });

    // Dispatch must be blocked because weekly cap (2) is reached
    const result = await dispatchRecoveryCampaign(vendor.id, draft.id);
    assert.equal(result.status, "blocked");
    assert.equal(result.sent, 0);

    // Total outbound messages to this contact should remain exactly 2
    const totalOutbound = await prisma.whatsAppMessage.count({
      where: { vendorId: vendor.id, contact: normalizePhone(phone), direction: "OUT" },
    });
    assert.equal(totalOutbound, 2);
  });

  test("duplicate dispatch attempts are blocked once a campaign has been sent", async () => {
    const vendor = await createTestVendor("duplicate_guard");
    const product = await createTestProduct(vendor.id);
    const phone = "+22890888888";
    const customer = await prisma.customer.create({
      data: {
        vendorId: vendor.id,
        name: "One-shot Buyer",
        phone,
        marketingConsent: true,
      },
    });

    const sessionId = "dup-dispatch-session";
    await createStaleCart(vendor.id, {
      sessionId,
      productId: product.id,
      customerId: customer.id,
      customerPhone: phone,
      shopSlug: vendor.shopSlug,
    });

    const draft = await createRecoveryCampaign(vendor.id, {
      sessionId,
      productId: product.id,
    });

    const preview = await getRecoveryApprovalPreview(vendor.id, draft.id);
    assert.ok(preview);

    await approveRecoveryCampaign(vendor.id, draft.id, {
      sessionId,
      recipientPhone: phone,
      body: preview.renderedBody,
    });

    // First dispatch succeeds
    const firstDispatch = await dispatchRecoveryCampaign(vendor.id, draft.id);
    assert.equal(isLiveMode(), false);
    assert.equal(firstDispatch.status, "stubbed");
    assert.equal(firstDispatch.sent, 1);
    const persistedCampaign = await prisma.campaign.findUnique({ where: { id: draft.id } });
    assert.equal(persistedCampaign?.status, "stubbed");
    const persistedMessage = await prisma.whatsAppMessage.findFirst({
      where: { vendorId: vendor.id, contact: normalizePhone(phone), direction: "OUT" },
    });
    assert.equal(persistedMessage?.status, "stubbed");

    // Immediately attempt a second duplicate dispatch
    const secondDispatch = await dispatchRecoveryCampaign(vendor.id, draft.id);
    assert.equal(secondDispatch.status, "approval_required");
    assert.equal(secondDispatch.sent, 0);
    assert.equal(secondDispatch.reason, "merchant_approval_required");

    // Only 1 outbound message was recorded
    const messageCount = await prisma.whatsAppMessage.count({
      where: { vendorId: vendor.id, contact: normalizePhone(phone), direction: "OUT" },
    });
    assert.equal(messageCount, 1);
  });

  test("a successful broadcast stub is persisted as stubbed, not sent", async () => {
    const vendor = await createTestVendor("broadcast_stub");
    const customer = await prisma.customer.create({
      data: { vendorId: vendor.id, name: "Stub Buyer", phone: "+22890777777", marketingConsent: true },
    });
    const broadcast = await prisma.broadcast.create({
      data: { vendorId: vendor.id, segment: "all", body: "Hi {{name}}, {{product}} at {{store}}" },
    });

    assert.equal(isLiveMode(), false);
    await dispatchBroadcast(broadcast.id);

    const persisted = await prisma.broadcast.findUnique({ where: { id: broadcast.id } });
    assert.equal(persisted?.status, "stubbed");
    assert.equal(persisted?.sentCount, 1);
    const message = await prisma.whatsAppMessage.findFirst({
      where: { vendorId: vendor.id, contact: normalizePhone(customer.phone), direction: "OUT" },
    });
    assert.equal(message?.status, "stubbed");
    assert.equal(message?.body, `Hi Stub Buyer, at ${vendor.shopName}`);
  });
});

describe("campaign safety: approval state isolation & vendor isolation", () => {
  test("approval alone never marks a campaign as sent or delivered", async () => {
    const vendor = await createTestVendor("approval_only");
    const product = await createTestProduct(vendor.id);
    const phone = "+22890999999";
    const customer = await prisma.customer.create({
      data: {
        vendorId: vendor.id,
        name: "Approval Alone Buyer",
        phone,
        marketingConsent: true,
      },
    });

    const sessionId = "approval-alone-session";
    await createStaleCart(vendor.id, {
      sessionId,
      productId: product.id,
      customerId: customer.id,
      customerPhone: phone,
      shopSlug: vendor.shopSlug,
    });

    const draft = await createRecoveryCampaign(vendor.id, {
      sessionId,
      productId: product.id,
    });

    const preview = await getRecoveryApprovalPreview(vendor.id, draft.id);
    assert.ok(preview);

    // Approve the campaign
    const approved = await approveRecoveryCampaign(vendor.id, draft.id, {
      sessionId,
      recipientPhone: phone,
      body: preview.renderedBody,
    });

    // Campaign status must be "approved", NOT "sent" or "delivered"
    assert.equal(approved?.status, "approved");
    assert.ok(approved?.approvedAt instanceof Date);

    // No WhatsAppMessage should exist
    const messages = await prisma.whatsAppMessage.count({
      where: { vendorId: vendor.id, contact: phone },
    });
    assert.equal(messages, 0);

    // Rejection resets to draft
    const rejected = await rejectRecoveryCampaignApproval(vendor.id, draft.id);
    assert.equal(rejected?.status, "draft");
    assert.equal(rejected?.approvedAt, null);
    assert.equal(rejected?.approvalHash, null);
  });

  test("vendor isolation is enforced across campaign retrieval, preview, approval, and dispatch", async () => {
    const vendorA = await createTestVendor("isolation_A");
    const vendorB = await createTestVendor("isolation_B");
    const productA = await createTestProduct(vendorA.id);
    const customerA = await prisma.customer.create({
      data: {
        vendorId: vendorA.id,
        name: "Vendor A Customer",
        phone: "+22890123400",
        marketingConsent: true,
      },
    });

    const sessionId = "isolation-session-1";
    await createStaleCart(vendorA.id, {
      sessionId,
      productId: productA.id,
      customerId: customerA.id,
      customerPhone: customerA.phone,
      shopSlug: vendorA.shopSlug,
    });

    const campaignA = await createRecoveryCampaign(vendorA.id, {
      sessionId,
      productId: productA.id,
    });

    // Vendor B cannot retrieve Vendor A's campaign
    const bView = await getCampaign(vendorB.id, campaignA.id);
    assert.equal(bView, null);

    // Vendor B cannot get approval preview for Vendor A's campaign
    const bPreview = await getRecoveryApprovalPreview(vendorB.id, campaignA.id);
    assert.equal(bPreview, null);

    // Vendor B cannot approve Vendor A's campaign
    const bApprove = await approveRecoveryCampaign(vendorB.id, campaignA.id, {
      sessionId,
      recipientPhone: customerA.phone,
      body: "Sneaky body",
    });
    assert.equal(bApprove, null);

    // Vendor B cannot dispatch Vendor A's campaign
    const bDispatch = await dispatchRecoveryCampaign(vendorB.id, campaignA.id);
    assert.equal(bDispatch.status, "blocked");
    assert.equal(bDispatch.reason, "campaign_not_found");

    // Vendor B cannot soft-delete Vendor A's campaign
    const bDelete = await softDeleteCampaign(vendorB.id, campaignA.id);
    assert.equal(bDelete, false);

    // Vendor B cannot link Vendor A's customer to Vendor B's session
    const bLink = await linkCartSessionToCustomer(prisma, vendorB.id, sessionId, {
      customerId: customerA.id,
    });
    assert.equal(bLink, null);
  });
});


describe("durable broadcast queue after integration", () => {
  test("queued recipients are unique and consent is checked again before dispatch", async () => {
    const vendor = await createTestVendor("durable_consent");
    await prisma.vendor.update({ where: { id: vendor.id }, data: { subscriptionStatus: "active" } });
    const first = await prisma.customer.create({ data: { vendorId: vendor.id, name: "First", phone: "+22891111111", marketingConsent: true } });
    const second = await prisma.customer.create({ data: { vendorId: vendor.id, name: "Second", phone: "+22892222222", marketingConsent: true } });
    const broadcast = await prisma.broadcast.create({ data: { vendorId: vendor.id, segment: "all", body: "Bonjour {{name}}" } });
    assert.deepEqual(await queueBroadcast(vendor.id, broadcast.id), { ok: true, targetCount: 2 });
    assert.deepEqual(await queueBroadcast(vendor.id, broadcast.id), { ok: false, reason: "already_started" });
    assert.equal(await prisma.broadcastRecipient.count({ where: { broadcastId: broadcast.id } }), 2);
    await prisma.customer.update({ where: { id: second.id }, data: { marketingConsent: false } });
    await processBroadcastQueue();
    const saved = await prisma.broadcast.findUniqueOrThrow({ where: { id: broadcast.id } });
    assert.equal(saved.status, "partial");
    assert.equal(saved.sentCount, 1);
    assert.equal(saved.skippedCount, 1);
    const messages = await prisma.whatsAppMessage.findMany({ where: { broadcastId: broadcast.id } });
    assert.equal(messages.length, 1);
    assert.equal(messages[0].contact, normalizePhone(first.phone));
    assert.equal(messages[0].status, "stubbed");
    assert.equal((await processBroadcastQueue()).processed, 0);
    assert.equal(await prisma.whatsAppMessage.count({ where: { broadcastId: broadcast.id } }), 1);
  });

  test("another vendor cannot start a broadcast they do not own", async () => {
    const owner = await createTestVendor("queue_owner");
    const other = await createTestVendor("queue_other");
    const broadcast = await prisma.broadcast.create({ data: { vendorId: owner.id, segment: "all", body: "Private" } });
    assert.deepEqual(await queueBroadcast(other.id, broadcast.id), { ok: false, reason: "not_found" });
    assert.equal(await prisma.broadcastRecipient.count({ where: { broadcastId: broadcast.id } }), 0);
  });

  test("an interrupted send is marked uncertain instead of being sent twice", async () => {
    const vendor = await createTestVendor("queue_interrupted");
    const customer = await prisma.customer.create({ data: { vendorId: vendor.id, name: "Interrupted", phone: "+22893333333", marketingConsent: true } });
    const broadcast = await prisma.broadcast.create({ data: { vendorId: vendor.id, segment: "all", body: "Bonjour", status: "sending", targetCount: 1 } });
    await prisma.broadcastRecipient.create({ data: { broadcastId: broadcast.id, vendorId: vendor.id, customerId: customer.id, name: customer.name, phone: customer.phone, status: "sending", startedAt: new Date(Date.now() - 20 * 60_000), attempts: 1 } });
    const report = await processBroadcastQueue();
    assert.equal(report.processed, 0);
    assert.equal(report.uncertain, 1);
    const saved = await prisma.broadcast.findUniqueOrThrow({ where: { id: broadcast.id } });
    assert.equal(saved.status, "attention");
    assert.equal(saved.uncertainCount, 1);
    assert.equal(await prisma.whatsAppMessage.count({ where: { broadcastId: broadcast.id } }), 0);
  });
});
