-- Add sessionId to Order
ALTER TABLE "Order" ADD COLUMN "sessionId" TEXT;
CREATE INDEX "Order_sessionId_idx" ON "Order"("sessionId");

-- CreateTable FunnelEvent
CREATE TABLE "FunnelEvent" (
  "id" TEXT NOT NULL,
  "vendorId" TEXT NOT NULL,
  "shopSlug" TEXT NOT NULL,
  "stage" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "productId" TEXT,
  "orderId" TEXT,
  "carrier" TEXT,
  "valueCents" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "FunnelEvent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "FunnelEvent_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "FunnelEvent_vendorId_stage_createdAt_idx" ON "FunnelEvent"("vendorId", "stage", "createdAt");
CREATE INDEX "FunnelEvent_sessionId_idx" ON "FunnelEvent"("sessionId");
CREATE INDEX "FunnelEvent_orderId_idx" ON "FunnelEvent"("orderId");
