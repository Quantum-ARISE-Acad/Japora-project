-- Verified-shop badge + read-receipt message ids
ALTER TABLE "Vendor" ADD COLUMN "verifiedAt" TIMESTAMP(3);
ALTER TABLE "WhatsAppMessage" ADD COLUMN "messageId" TEXT;
CREATE INDEX "WhatsAppMessage_messageId_idx" ON "WhatsAppMessage"("messageId");
