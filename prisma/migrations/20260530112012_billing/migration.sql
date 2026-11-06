-- AlterTable
ALTER TABLE "Vendor"
  ADD COLUMN "stripeCustomerId"     TEXT,
  ADD COLUMN "stripeSubscriptionId" TEXT,
  ADD COLUMN "subscriptionStatus"   TEXT NOT NULL DEFAULT 'trialing',
  ADD COLUMN "trialEndsAt"          TIMESTAMP(3),
  ADD COLUMN "currentPeriodEnd"     TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "Vendor_stripeCustomerId_key" ON "Vendor"("stripeCustomerId");

-- CreateIndex
CREATE UNIQUE INDEX "Vendor_stripeSubscriptionId_key" ON "Vendor"("stripeSubscriptionId");
