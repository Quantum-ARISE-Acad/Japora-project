-- Togo-first default for payment intents created without an explicit currency.
-- Existing rows keep their currency.
ALTER TABLE "PaymentIntent" ALTER COLUMN "currency" SET DEFAULT 'XOF';
