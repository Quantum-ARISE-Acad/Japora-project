-- Pricing model: default Japora commission 1% -> 3% (all-in, success-based).
ALTER TABLE "Vendor" ALTER COLUMN "commissionPct" SET DEFAULT 0.03;
UPDATE "Vendor" SET "commissionPct" = 0.03 WHERE "commissionPct" = 0.01;
