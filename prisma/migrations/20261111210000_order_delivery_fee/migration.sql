-- Existing orders keep their original total; delivery fees apply to new checkouts.
ALTER TABLE "Order" ADD COLUMN "deliveryFeeCents" INTEGER NOT NULL DEFAULT 0;
