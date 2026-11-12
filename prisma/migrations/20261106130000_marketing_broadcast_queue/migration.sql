ALTER TABLE "Broadcast" ADD COLUMN "messageMode" TEXT NOT NULL DEFAULT 'text';
ALTER TABLE "Broadcast" ADD COLUMN "templateName" TEXT;
ALTER TABLE "Broadcast" ADD COLUMN "templateLanguage" TEXT;
ALTER TABLE "Broadcast" ADD COLUMN "templateParams" TEXT NOT NULL DEFAULT '[]';
ALTER TABLE "Broadcast" ADD COLUMN "failedCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Broadcast" ADD COLUMN "skippedCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Broadcast" ADD COLUMN "uncertainCount" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "WhatsAppMessage" ADD COLUMN "broadcastId" TEXT;
CREATE INDEX "WhatsAppMessage_broadcastId_idx" ON "WhatsAppMessage"("broadcastId");
CREATE INDEX "Broadcast_status_createdAt_idx" ON "Broadcast"("status", "createdAt");

CREATE TABLE "BroadcastRecipient" (
  "id" TEXT NOT NULL,
  "broadcastId" TEXT NOT NULL,
  "vendorId" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "phone" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "startedAt" TIMESTAMP(3),
  "sentAt" TIMESTAMP(3),
  "error" TEXT NOT NULL DEFAULT '',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BroadcastRecipient_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "BroadcastRecipient_broadcastId_fkey" FOREIGN KEY ("broadcastId") REFERENCES "Broadcast"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "BroadcastRecipient_broadcastId_customerId_key" ON "BroadcastRecipient"("broadcastId", "customerId");
CREATE INDEX "BroadcastRecipient_status_createdAt_idx" ON "BroadcastRecipient"("status", "createdAt");
CREATE INDEX "BroadcastRecipient_broadcastId_status_idx" ON "BroadcastRecipient"("broadcastId", "status");
CREATE INDEX "BroadcastRecipient_vendorId_customerId_idx" ON "BroadcastRecipient"("vendorId", "customerId");
