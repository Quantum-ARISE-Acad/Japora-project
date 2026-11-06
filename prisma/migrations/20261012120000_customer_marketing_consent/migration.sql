ALTER TABLE "Customer"
  ADD COLUMN "marketingConsent" BOOLEAN,
  ADD COLUMN "marketingConsentBasis" TEXT,
  ADD COLUMN "marketingConsentAt" TIMESTAMP(3),
  ADD COLUMN "marketingConsentRevokedAt" TIMESTAMP(3);
