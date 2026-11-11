-- Per-vendor WhatsApp routing + LLM usage cap
ALTER TABLE "Vendor" ADD COLUMN "whatsappPhoneNumberId" TEXT;
CREATE UNIQUE INDEX "Vendor_whatsappPhoneNumberId_key" ON "Vendor"("whatsappPhoneNumberId");

CREATE TABLE "LlmUsage" (
  "id" TEXT NOT NULL,
  "vendorId" TEXT NOT NULL,
  "day" TEXT NOT NULL,
  "count" INTEGER NOT NULL DEFAULT 0,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LlmUsage_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "LlmUsage_vendorId_day_key" ON "LlmUsage"("vendorId", "day");
CREATE INDEX "LlmUsage_day_idx" ON "LlmUsage"("day");
