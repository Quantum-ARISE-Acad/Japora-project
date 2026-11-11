-- Cooperatives + CTWA campaigns
ALTER TABLE "Vendor" ADD COLUMN "cooperativeId" TEXT;
ALTER TABLE "Order" ADD COLUMN "campaignId" TEXT;

CREATE TABLE "Cooperative" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "region" TEXT NOT NULL DEFAULT '',
  "joinCode" TEXT NOT NULL,
  "adminVendorId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Cooperative_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Cooperative_joinCode_key" ON "Cooperative"("joinCode");

CREATE TABLE "Campaign" (
  "id" TEXT NOT NULL,
  "vendorId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "productId" TEXT,
  "headline" TEXT NOT NULL DEFAULT '',
  "body" TEXT NOT NULL DEFAULT '',
  "cta" TEXT NOT NULL DEFAULT 'Shop now',
  "refCode" TEXT NOT NULL,
  "clicks" INTEGER NOT NULL DEFAULT 0,
  "orders" INTEGER NOT NULL DEFAULT 0,
  "revenueCents" INTEGER NOT NULL DEFAULT 0,
  "spendCents" INTEGER NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL DEFAULT 'active',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "Campaign_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Campaign_refCode_key" ON "Campaign"("refCode");
CREATE INDEX "Campaign_vendorId_idx" ON "Campaign"("vendorId");

CREATE TABLE "CampaignTouch" (
  "id" TEXT NOT NULL,
  "campaignId" TEXT NOT NULL,
  "phone" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CampaignTouch_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "CampaignTouch_phone_idx" ON "CampaignTouch"("phone");
CREATE INDEX "CampaignTouch_campaignId_idx" ON "CampaignTouch"("campaignId");

CREATE INDEX "Vendor_cooperativeId_idx" ON "Vendor"("cooperativeId");

ALTER TABLE "Vendor" ADD CONSTRAINT "Vendor_cooperativeId_fkey" FOREIGN KEY ("cooperativeId") REFERENCES "Cooperative"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CampaignTouch" ADD CONSTRAINT "CampaignTouch_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
