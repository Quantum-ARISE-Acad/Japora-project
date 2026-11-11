-- Away message + business hours
ALTER TABLE "Vendor" ADD COLUMN "awayMessage" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Vendor" ADD COLUMN "businessHours" JSONB NOT NULL DEFAULT '{}';
ALTER TABLE "Vendor" ADD COLUMN "tzOffsetMinutes" INTEGER NOT NULL DEFAULT 0;

-- Shop followers
CREATE TABLE "Follower" (
  "id" TEXT NOT NULL,
  "vendorId" TEXT NOT NULL,
  "phone" TEXT NOT NULL,
  "name" TEXT NOT NULL DEFAULT '',
  "optInAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "unsubscribedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Follower_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Follower_vendorId_phone_key" ON "Follower"("vendorId", "phone");
CREATE INDEX "Follower_vendorId_idx" ON "Follower"("vendorId");
ALTER TABLE "Follower" ADD CONSTRAINT "Follower_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
