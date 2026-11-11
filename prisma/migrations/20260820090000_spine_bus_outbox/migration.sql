-- Spine tenant id for a vendor (`mch_...`), minted by WASpine. Nullable: a
-- vendor nobody has linked yet has none, and the outbox blocks rather than
-- guessing. Unique: two vendors sharing one tenant is a cross-tenant leak.
ALTER TABLE "Vendor" ADD COLUMN "spineTenantId" TEXT;
CREATE UNIQUE INDEX "Vendor_spineTenantId_key" ON "Vendor"("spineTenantId");

-- The bus outbox. Written in the same transaction as the catalogue write it
-- describes; drained separately, so a bus outage cannot fail a merchant's write.
CREATE TABLE "BusEvent" (
  "id" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "vendorId" TEXT NOT NULL,
  "subjectType" TEXT NOT NULL,
  "subjectId" TEXT NOT NULL,
  "data" JSONB NOT NULL DEFAULT '{}',
  "correlationId" TEXT NOT NULL DEFAULT '',
  "actorType" TEXT NOT NULL DEFAULT 'system',
  "actorId" TEXT NOT NULL DEFAULT '',
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "status" TEXT NOT NULL DEFAULT 'queued',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "lastError" TEXT NOT NULL DEFAULT '',
  "sentAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BusEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "BusEvent_status_createdAt_idx" ON "BusEvent"("status", "createdAt");
CREATE INDEX "BusEvent_vendorId_idx" ON "BusEvent"("vendorId");
CREATE INDEX "BusEvent_subjectId_idx" ON "BusEvent"("subjectId");
