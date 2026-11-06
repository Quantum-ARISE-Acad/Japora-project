-- Vendor mobile-money payee number for USSD/dial-code payments. Defaults to
-- empty; the pay surface falls back to whatsappNumber when blank.
ALTER TABLE "Vendor" ADD COLUMN "momoNumber" TEXT NOT NULL DEFAULT '';
