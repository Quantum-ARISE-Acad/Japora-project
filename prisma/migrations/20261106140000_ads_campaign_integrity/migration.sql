ALTER TABLE "Campaign" ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'ctwa';
ALTER TABLE "Campaign" ADD COLUMN "recoveryKey" TEXT;
ALTER TABLE "Campaign" ADD COLUMN "platform" TEXT;
ALTER TABLE "Campaign" ADD COLUMN "targetRegion" TEXT;

-- Existing grouped recovery rows cannot be safely mapped to a single recipient.
-- Keep their history intact but prevent the recovery approval flow from sending them.
UPDATE "Campaign" SET "kind" = 'legacy_recovery'
WHERE "name" IN ('Abandoned cart recovery', 'Customer reactivation');

CREATE UNIQUE INDEX "Campaign_vendorId_recoveryKey_key"
ON "Campaign"("vendorId", "recoveryKey");
