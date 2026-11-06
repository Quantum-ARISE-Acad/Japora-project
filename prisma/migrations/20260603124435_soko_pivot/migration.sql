-- Soko pivot: regional commission marketplace + CRM + receivables + broadcasts
-- + affiliates + referrals + unified payment intents + WhatsApp bot ledger.
-- Additive — every new column is nullable or has a default so existing rows
-- carry over untouched.

-- AlterTable Vendor: regional targeting, public profile, commission model.
ALTER TABLE "Vendor"
  ADD COLUMN "region"             TEXT    NOT NULL DEFAULT '',
  ADD COLUMN "category"           TEXT    NOT NULL DEFAULT '',
  ADD COLUMN "language"           TEXT    NOT NULL DEFAULT 'en',
  ADD COLUMN "referralCode"       TEXT,
  ADD COLUMN "referredByVendorId" TEXT,
  ADD COLUMN "commissionPct"      DOUBLE PRECISION NOT NULL DEFAULT 0.01,
  ADD COLUMN "isPublic"           BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "bio"                TEXT    NOT NULL DEFAULT '',
  ADD COLUMN "avatarUrl"          TEXT    NOT NULL DEFAULT '',
  ADD COLUMN "wholesaleEnabled"   BOOLEAN NOT NULL DEFAULT false;

-- AlterTable Product: wholesale + pre-order.
ALTER TABLE "Product"
  ADD COLUMN "wholesalePriceCents" INTEGER,
  ADD COLUMN "wholesaleMinQty"     INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "preOrderAllowed"     BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "depositPercent"      INTEGER NOT NULL DEFAULT 0;

-- AlterTable Order: CRM link, affiliate attribution, wholesale/pre-order, partial pay tracking.
ALTER TABLE "Order"
  ADD COLUMN "customerId"    TEXT,
  ADD COLUMN "affiliateId"   TEXT,
  ADD COLUMN "isWholesale"   BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "isPreOrder"    BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "depositCents"  INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "depositPaidAt" TIMESTAMP(3),
  ADD COLUMN "balanceDueAt"  TIMESTAMP(3),
  ADD COLUMN "paidCents"     INTEGER NOT NULL DEFAULT 0;

-- CreateTable Customer
CREATE TABLE "Customer" (
    "id"              TEXT NOT NULL,
    "vendorId"        TEXT NOT NULL,
    "name"            TEXT NOT NULL,
    "phone"           TEXT NOT NULL,
    "email"           TEXT,
    "totalSpentCents" INTEGER NOT NULL DEFAULT 0,
    "orderCount"      INTEGER NOT NULL DEFAULT 0,
    "lastOrderAt"     TIMESTAMP(3),
    "notes"           TEXT NOT NULL DEFAULT '',
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt"       TIMESTAMP(3),

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable Receivable
CREATE TABLE "Receivable" (
    "id"          TEXT NOT NULL,
    "vendorId"    TEXT NOT NULL,
    "customerId"  TEXT,
    "orderId"     TEXT,
    "amountCents" INTEGER NOT NULL,
    "status"      TEXT NOT NULL DEFAULT 'OPEN',
    "dueDate"     TIMESTAMP(3),
    "paidAt"      TIMESTAMP(3),
    "note"        TEXT NOT NULL DEFAULT '',
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Receivable_pkey" PRIMARY KEY ("id")
);

-- CreateTable Broadcast
CREATE TABLE "Broadcast" (
    "id"           TEXT NOT NULL,
    "vendorId"     TEXT NOT NULL,
    "body"         TEXT NOT NULL,
    "segment"      TEXT NOT NULL DEFAULT 'all',
    "targetCount"  INTEGER NOT NULL DEFAULT 0,
    "sentCount"    INTEGER NOT NULL DEFAULT 0,
    "status"       TEXT NOT NULL DEFAULT 'draft',
    "scheduledFor" TIMESTAMP(3),
    "sentAt"       TIMESTAMP(3),
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Broadcast_pkey" PRIMARY KEY ("id")
);

-- CreateTable Affiliate
CREATE TABLE "Affiliate" (
    "id"               TEXT NOT NULL,
    "vendorId"         TEXT NOT NULL,
    "code"             TEXT NOT NULL,
    "name"             TEXT NOT NULL,
    "commissionPct"    DOUBLE PRECISION NOT NULL DEFAULT 0.10,
    "totalEarnedCents" INTEGER NOT NULL DEFAULT 0,
    "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt"        TIMESTAMP(3),

    CONSTRAINT "Affiliate_pkey" PRIMARY KEY ("id")
);

-- CreateTable AffiliateAttribution
CREATE TABLE "AffiliateAttribution" (
    "id"              TEXT NOT NULL,
    "orderId"         TEXT NOT NULL,
    "affiliateId"     TEXT NOT NULL,
    "commissionCents" INTEGER NOT NULL,
    "status"          TEXT NOT NULL DEFAULT 'pending',
    "paidAt"          TIMESTAMP(3),
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AffiliateAttribution_pkey" PRIMARY KEY ("id")
);

-- CreateTable Referral
CREATE TABLE "Referral" (
    "id"               TEXT NOT NULL,
    "referrerVendorId" TEXT NOT NULL,
    "refereeVendorId"  TEXT NOT NULL,
    "status"           TEXT NOT NULL DEFAULT 'pending',
    "rewardedAt"       TIMESTAMP(3),
    "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Referral_pkey" PRIMARY KEY ("id")
);

-- CreateTable PaymentIntent
CREATE TABLE "PaymentIntent" (
    "id"          TEXT NOT NULL,
    "orderId"     TEXT,
    "vendorId"    TEXT NOT NULL,
    "provider"    TEXT NOT NULL,
    "providerRef" TEXT,
    "amountCents" INTEGER NOT NULL,
    "currency"    TEXT NOT NULL DEFAULT 'NGN',
    "status"      TEXT NOT NULL DEFAULT 'created',
    "method"      TEXT,
    "metadata"    TEXT NOT NULL DEFAULT '',
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "PaymentIntent_pkey" PRIMARY KEY ("id")
);

-- CreateTable BotEvent
CREATE TABLE "BotEvent" (
    "id"        TEXT NOT NULL,
    "vendorId"  TEXT,
    "from"      TEXT NOT NULL,
    "intent"    TEXT NOT NULL DEFAULT 'unknown',
    "raw"       TEXT NOT NULL,
    "responded" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BotEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex Vendor.referralCode (unique).
CREATE UNIQUE INDEX "Vendor_referralCode_key" ON "Vendor"("referralCode");

-- CreateIndex Order.customerId
CREATE INDEX "Order_customerId_idx" ON "Order"("customerId");

-- CreateIndex Customer
CREATE UNIQUE INDEX "Customer_vendorId_phone_key" ON "Customer"("vendorId", "phone");
CREATE INDEX "Customer_vendorId_idx" ON "Customer"("vendorId");

-- CreateIndex Receivable
CREATE INDEX "Receivable_vendorId_status_idx" ON "Receivable"("vendorId", "status");

-- CreateIndex Broadcast
CREATE INDEX "Broadcast_vendorId_idx" ON "Broadcast"("vendorId");

-- CreateIndex Affiliate
CREATE UNIQUE INDEX "Affiliate_code_key" ON "Affiliate"("code");
CREATE INDEX "Affiliate_vendorId_idx" ON "Affiliate"("vendorId");

-- CreateIndex AffiliateAttribution
CREATE INDEX "AffiliateAttribution_affiliateId_idx" ON "AffiliateAttribution"("affiliateId");
CREATE INDEX "AffiliateAttribution_orderId_idx" ON "AffiliateAttribution"("orderId");

-- CreateIndex Referral
CREATE UNIQUE INDEX "Referral_refereeVendorId_key" ON "Referral"("refereeVendorId");
CREATE INDEX "Referral_referrerVendorId_idx" ON "Referral"("referrerVendorId");

-- CreateIndex PaymentIntent
CREATE INDEX "PaymentIntent_vendorId_idx" ON "PaymentIntent"("vendorId");
CREATE INDEX "PaymentIntent_orderId_idx" ON "PaymentIntent"("orderId");
CREATE INDEX "PaymentIntent_provider_status_idx" ON "PaymentIntent"("provider", "status");

-- CreateIndex BotEvent
CREATE INDEX "BotEvent_vendorId_idx" ON "BotEvent"("vendorId");
CREATE INDEX "BotEvent_from_idx" ON "BotEvent"("from");

-- AddForeignKey Order.customerId -> Customer (SetNull)
ALTER TABLE "Order" ADD CONSTRAINT "Order_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey Customer.vendorId -> Vendor (Cascade)
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey Receivable.vendorId -> Vendor (Cascade)
ALTER TABLE "Receivable" ADD CONSTRAINT "Receivable_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey Receivable.customerId -> Customer (SetNull)
ALTER TABLE "Receivable" ADD CONSTRAINT "Receivable_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey Receivable.orderId -> Order (SetNull)
ALTER TABLE "Receivable" ADD CONSTRAINT "Receivable_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey Broadcast.vendorId -> Vendor (Cascade)
ALTER TABLE "Broadcast" ADD CONSTRAINT "Broadcast_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey Affiliate.vendorId -> Vendor (Cascade)
ALTER TABLE "Affiliate" ADD CONSTRAINT "Affiliate_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey AffiliateAttribution.affiliateId -> Affiliate (Cascade)
ALTER TABLE "AffiliateAttribution" ADD CONSTRAINT "AffiliateAttribution_affiliateId_fkey" FOREIGN KEY ("affiliateId") REFERENCES "Affiliate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey PaymentIntent.orderId -> Order (SetNull)
ALTER TABLE "PaymentIntent" ADD CONSTRAINT "PaymentIntent_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey PaymentIntent.vendorId -> Vendor (Cascade)
ALTER TABLE "PaymentIntent" ADD CONSTRAINT "PaymentIntent_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey BotEvent.vendorId -> Vendor (SetNull)
ALTER TABLE "BotEvent" ADD CONSTRAINT "BotEvent_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;
