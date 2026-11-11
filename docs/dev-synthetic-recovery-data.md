# Development-only synthetic abandoned-cart recovery data

This procedure is only for a throwaway local database. Do not run it against the real production SQLite file or any database that stores live merchant data.

## 1) Use an isolated database copy

Create a separate database file and keep it out of the production path:

```bash
cd frontend/WCatalog
cp prisma/dev.db prisma/dev-recovery-synthetic.db
```

Then set a local-only env file for this one session. Use an absolute SQLite path so Prisma cannot resolve it to the wrong file:

```bash
cat > .env.local <<'EOF'
DATABASE_URL="file:/home/student25/Pictures/wataru-fullstack/frontend/WCatalog/prisma/dev-recovery-synthetic.db"
SESSION_SECRET="replace-with-a-random-secret"
NEXT_PUBLIC_APP_URL="http://localhost:5174"
EOF
```

> Keep `.env.local` uncommitted. Never copy these test rows into the main `prisma/dev.db` file.

## 2) Seed clearly marked synthetic rows

Create a vendor, customer, and cart event that are all explicitly test-only:

- vendor email ends with `@example.test` or `@japora.test`
- customer phone is a fake test number, not a live customer number
- funnel event `sessionId` is prefixed with `synthetic-`
- `customer.marketingConsent = true`
- `customer.marketingConsentRevokedAt = null`
- `funnelEvent.stage = "cart"`
- cart createdAt is older than 30 minutes but younger than 7 days
- no matching order exists for that session

### Synthetic login for this demo

The dev-only synthetic vendor is created with these exact values:

- email: `synthetic-demo@japora.test`
- password: `SyntheticPass123`

Use those credentials on the local login page at `http://localhost:5174/login`, then open `/dashboard/campaigns`.

Example:

```sql
INSERT INTO Vendor (id, email, passwordHash, shopName, shopSlug, whatsappNumber, currency, subscriptionStatus, createdAt)
VALUES ('synthetic-vendor-1', 'demo@example.test', 'test', 'Synthetic Recovery Shop', 'synthetic-recovery-shop', '+15550000001', 'XOF', 'trialing', strftime('%s','now') * 1000);

INSERT INTO Customer (id, vendorId, name, phone, marketingConsent, marketingConsentBasis, marketingConsentAt, createdAt)
VALUES ('synthetic-customer-1', 'synthetic-vendor-1', 'Synthetic Buyer', '+15550000002', 1, 'manual', strftime('%s','now') * 1000, strftime('%s','now') * 1000);

INSERT INTO FunnelEvent (id, vendorId, shopSlug, stage, sessionId, productId, customerId, customerPhone, valueCents, createdAt)
VALUES ('synthetic-cart-1', 'synthetic-vendor-1', 'synthetic-recovery-shop', 'cart', 'synthetic-cart-123', NULL, 'synthetic-customer-1', '+15550000002', 250000, (strftime('%s','now') - 7200) * 1000);
```

## 3) Confirm the dashboard behavior

Open `/dashboard/campaigns` with the synthetic vendor session active and verify that one `Abandoned cart recovery` campaign appears in the list.

If the cart is converted, lacks customer identity, has revoked consent, or is older than the configured max-age window, it should stay excluded.

## 4) Clean-up

Delete the synthetic database file at the end of the dev session or replace it with a fresh copy before any new demo run.
