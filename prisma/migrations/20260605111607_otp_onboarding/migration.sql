-- WhatsApp OTP onboarding
ALTER TABLE "Vendor" ADD COLUMN "phone" TEXT;
ALTER TABLE "Vendor" ADD COLUMN "phoneVerifiedAt" TIMESTAMP(3);
CREATE UNIQUE INDEX "Vendor_phone_key" ON "Vendor"("phone");

CREATE TABLE "OtpCode" (
  "id" TEXT NOT NULL,
  "phone" TEXT NOT NULL,
  "codeHash" TEXT NOT NULL,
  "purpose" TEXT NOT NULL DEFAULT 'login',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "consumedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OtpCode_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "OtpCode_phone_idx" ON "OtpCode"("phone");
