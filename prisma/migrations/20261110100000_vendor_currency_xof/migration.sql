-- Ferdinand's Togo-first default: applies only to future rows. Existing vendor
-- currencies are preserved, including shops already using USD or another unit.
ALTER TABLE "Vendor" ALTER COLUMN "currency" SET DEFAULT 'XOF';
