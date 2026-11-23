-- Automatic bargaining (secret floor price + negotiation rounds) and hand-off to the vendor.
CREATE TABLE "ProductPriceFloor" (
  "productId" TEXT NOT NULL,
  "vendorId" TEXT NOT NULL,
  "minPriceCents" INTEGER NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProductPriceFloor_pkey" PRIMARY KEY ("productId"),
  CONSTRAINT "ProductPriceFloor_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "ProductPriceFloor_vendorId_idx" ON "ProductPriceFloor"("vendorId");

CREATE TABLE "Negotiation" (
  "id" TEXT NOT NULL,
  "vendorId" TEXT NOT NULL,
  "contact" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL DEFAULT 1,
  "round" INTEGER NOT NULL DEFAULT 0,
  "lastCounterCents" INTEGER NOT NULL DEFAULT 0,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Negotiation_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Negotiation_vendorId_contact_productId_key" ON "Negotiation"("vendorId", "contact", "productId");

CREATE TABLE "BotHandoff" (
  "id" TEXT NOT NULL,
  "vendorId" TEXT NOT NULL,
  "contact" TEXT NOT NULL,
  "reason" TEXT NOT NULL DEFAULT '',
  "lastMessage" TEXT NOT NULL DEFAULT '',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "resolvedAt" TIMESTAMP(3),
  CONSTRAINT "BotHandoff_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "BotHandoff_vendorId_contact_idx" ON "BotHandoff"("vendorId", "contact");
CREATE INDEX "BotHandoff_vendorId_resolvedAt_idx" ON "BotHandoff"("vendorId", "resolvedAt");
