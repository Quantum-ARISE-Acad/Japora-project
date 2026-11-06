-- Rattrape les changements faits sur le schéma pendant la période SQLite : sans
-- cette migration, une base PostgreSQL neuve n'a ni Collection, ni Review,
-- ni PaymentLink, ni Vendor.clerkId, et Japora plante.
-- AlterTable
ALTER TABLE "BusEvent" ALTER COLUMN "data" DROP NOT NULL,
ALTER COLUMN "data" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Campaign" ADD COLUMN     "approvalHash" TEXT,
ADD COLUMN     "approvedAt" TIMESTAMP(3),
ADD COLUMN     "approvedBody" TEXT,
ADD COLUMN     "approvedForPhone" TEXT;

-- AlterTable
ALTER TABLE "FunnelEvent" ADD COLUMN     "customerId" TEXT,
ADD COLUMN     "customerPhone" TEXT;

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "collectionId" TEXT,
ADD COLUMN     "condition" TEXT NOT NULL DEFAULT 'new';

-- AlterTable
ALTER TABLE "Vendor" ADD COLUMN     "clerkId" TEXT,
ADD COLUMN     "deliveryEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "deliveryFeeCents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "deliveryZones" TEXT NOT NULL DEFAULT '',
ALTER COLUMN "uiPrefs" DROP NOT NULL,
ALTER COLUMN "uiPrefs" DROP DEFAULT,
ALTER COLUMN "businessHours" DROP NOT NULL,
ALTER COLUMN "businessHours" DROP DEFAULT;

-- CreateTable
CREATE TABLE "Collection" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Collection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Review" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "rating" INTEGER NOT NULL DEFAULT 5,
    "comment" TEXT NOT NULL DEFAULT '',
    "reply" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentLink" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "currency" TEXT NOT NULL DEFAULT 'XOF',
    "expiresAt" TIMESTAMP(3),
    "isPaid" BOOLEAN NOT NULL DEFAULT false,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Collection_vendorId_idx" ON "Collection"("vendorId");

-- CreateIndex
CREATE UNIQUE INDEX "Collection_vendorId_slug_key" ON "Collection"("vendorId", "slug");

-- CreateIndex
CREATE INDEX "Review_productId_idx" ON "Review"("productId");

-- CreateIndex
CREATE INDEX "Review_vendorId_idx" ON "Review"("vendorId");

-- CreateIndex
CREATE INDEX "PaymentLink_vendorId_idx" ON "PaymentLink"("vendorId");

-- CreateIndex
CREATE INDEX "FunnelEvent_vendorId_customerId_idx" ON "FunnelEvent"("vendorId", "customerId");

-- CreateIndex
CREATE INDEX "FunnelEvent_vendorId_customerPhone_idx" ON "FunnelEvent"("vendorId", "customerPhone");

-- CreateIndex
CREATE INDEX "Product_collectionId_idx" ON "Product"("collectionId");

-- CreateIndex
CREATE UNIQUE INDEX "Vendor_clerkId_key" ON "Vendor"("clerkId");

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "Collection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FunnelEvent" ADD CONSTRAINT "FunnelEvent_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Collection" ADD CONSTRAINT "Collection_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentLink" ADD CONSTRAINT "PaymentLink_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

