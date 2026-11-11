# Japora — Deployment & Go-Live Runbook

Japora is **stub-first**: it runs end-to-end with zero external credentials
(WhatsApp, payments, email, storage, LLM all fall back to safe stubs). Going
live is mostly **flipping env vars** — each integration switches from stub to
real the moment its keys are present. This doc is the switch list.

Stack: Next.js 15 (App Router) · React 19 · Prisma 6 / PostgreSQL · TypeScript.

---

## 0. Quick path

1. Provision Postgres, set `DATABASE_URL`.
2. Set `SESSION_SECRET` (required) and `NEXT_PUBLIC_APP_URL`.
3. `pnpm install && pnpm exec prisma migrate deploy && pnpm build && pnpm start`.
4. App is live in **stub mode** — fully usable, nothing sends externally.
5. Flip the integrations you want (sections 4–9) by adding their env vars.
6. Wire the two cron jobs (section 10).

Verify any time: `GET /api/health` → `{ ok: true }`.

---

## 1. Prerequisites

- Node 20+ and `pnpm`.
- A PostgreSQL 14+ database (Supabase / Neon / Railway / RDS / self-hosted).
- A host that runs a Node server **or** Vercel. Note: the local-disk upload
  fallback (`./public/uploads`) does **not** work on serverless — set S3
  storage (section 7) before deploying uploads to Vercel.

---

## 2. Database

```bash
# Point at your hosted DB
export DATABASE_URL="postgresql://USER:PASS@HOST:5432/DB?sslmode=require"

# Apply the hand-written migrations (idempotent; never use `migrate dev` in prod)
pnpm exec prisma migrate deploy
pnpm exec prisma generate
```

Optional first-run seed (demo shops): `pnpm exec tsx prisma/seed.ts` — skip in
production unless you want the demo data.

Connection-pooling note: on Supabase/Neon use the **pooled** connection string
(pgbouncer) for the app, and the **direct** string for `migrate deploy`.

---

## 3. Core env vars (required)

| Var | Required | Notes |
|-----|----------|-------|
| `DATABASE_URL` | ✅ | Postgres connection string. |
| `SESSION_SECRET` | ✅ | Signs the `wc_session` JWT cookie. Generate: `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"` (min 32 chars). |
| `NEXT_PUBLIC_APP_URL` | ✅ | Public origin, e.g. `https://app.japora.market`. Used in links, QR codes, campaign `/go` URLs, emails. |

Everything below is **optional** — absent ⇒ that feature runs in stub mode.

---

## 4. WhatsApp Cloud API (Meta)

Absent token ⇒ messages are logged + persisted, not sent (the whole bot/order
flow still works for demos).

| Var | Purpose |
|-----|---------|
| `WHATSAPP_TOKEN` | Permanent access token (System User token recommended). |
| `WHATSAPP_PHONE_NUMBER_ID` | Default sender phone number id. |
| `WHATSAPP_VERIFY_TOKEN` | Any string; must match the webhook config in Meta. |
| `WHATSAPP_APP_SECRET` | Meta App → Settings → Basic. Enables `x-hub-signature-256` verification. **Blank ⇒ signature check skipped** — set it in production. |

**Webhook setup (Meta App → WhatsApp → Configuration):**
- Callback URL: `https://<your-domain>/api/whatsapp/webhook`
- Verify token: the value of `WHATSAPP_VERIFY_TOKEN`
- Subscribe to fields: `messages` (inbound + delivery `statuses`).
- The GET handshake and POST signature check are already implemented.

**Multi-tenant routing (important at scale):** inbound messages arrive with a
`phone_number_id`. Japora maps it to a vendor in this order:
1. Env override `VENDOR_ID_FOR_PHONE_NUMBER_ID_<id>=<vendorId>` (single-tenant / staging).
2. **`Vendor.whatsappPhoneNumberId`** — set per vendor (DB or the settings API
   field `whatsappPhoneNumberId`). This is the production path.
3. Fallback to the first vendor **only if there is exactly one vendor**;
   otherwise the message is dropped with a `whatsapp.webhook.unmapped_phone_number_id`
   warning (a misconfigured line should not leak to a random tenant).

**Templates:** to message **outside the 24-hour service window** (the 6 PM
summary, receivable nudges, marketing broadcasts) you must register and use
approved templates (Marketing / Utility / Authentication categories). In-window
replies (the bot answering a customer) are free and need no template.

---

## 5. Payments — West Africa first (Togo)

Absent keys ⇒ stub checkout via `/dev/pay-stub` (guarded by
`JAPORA_ENABLE_DEV_PAY_STUB=1`, dev only). Real rails (T-Money / Flooz):

| Var | Provider |
|-----|----------|
| `CINETPAY_API_KEY`, `CINETPAY_SITE_ID`, `CINETPAY_SECRET_KEY` | CinetPay (Togo + francophone WA). `CINETPAY_CHANNELS` optional (e.g. `MOBILE_MONEY`). |
| `PAYGATE_AUTH_TOKEN` | PayGate Global (Togo T-Money / Flooz). |

Provider webhooks post to `/api/payments/webhook/<provider>`; on success the
order is marked PAID, receivables settle, and the verified-shop badge is
re-evaluated. XOF is zero-decimal (see `src/lib/currency.ts`); CinetPay amounts
are rounded to multiples of 5.

---

## 6. LLM bot upgrade (optional)

Absent key ⇒ keyword bot only (still fully functional). Present ⇒ open-ended
questions the keyword bot can't classify get a catalog-grounded answer.

| Var | Purpose |
|-----|---------|
| `ANTHROPIC_API_KEY` | Preferred. Uses `claude-3-5-haiku-latest` by default. |
| `OPENAI_API_KEY` | Fallback. Uses `gpt-4o-mini`. |
| `JAPORA_LLM_MODEL` | Override the model id. |
| `JAPORA_LLM_DAILY_CAP_PER_VENDOR` | Per-vendor daily call cap (default **200**). Over the cap, the bot falls back to keyword answers. |

Prices/stock are never invented — the model only sees the retrieved catalog.

---

## 7. Object storage (uploads)

Absent ⇒ saves to `./public/uploads` (single Node host only; breaks on
serverless). Set these for any S3-compatible bucket (AWS S3, Cloudflare R2,
Supabase Storage):

`STORAGE_S3_BUCKET`, `STORAGE_S3_REGION`, `STORAGE_S3_ACCESS_KEY_ID`,
`STORAGE_S3_SECRET_ACCESS_KEY`, `STORAGE_S3_ENDPOINT`, `STORAGE_S3_PUBLIC_URL`
(see `.env.example` for per-provider endpoint/URL formats). Requires
`pnpm add @aws-sdk/client-s3` (optional dep).

---

## 8. Email (optional)

Absent ⇒ stub (logged + persisted to `EmailMessage`, not sent). For real sends:

| Var | Purpose |
|-----|---------|
| `RESEND_API_KEY` | Resend API key. |
| `EMAIL_FROM` | Must use a Resend-verified domain, e.g. `Japora <noreply@japora.market>`. |

OTP-onboarded vendors use a placeholder `wa_<phone>@japora.local` email and are
never nagged to verify it.

---

## 9. Stripe billing (optional)

Absent ⇒ `/api/billing` returns 503; signup still grants a 30-day trial. For
live subscriptions: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`,
`STRIPE_PRICE_ID`, `NEXT_PUBLIC_STRIPE_PRICE_DISPLAY`. Webhook →
`/api/billing/webhook`. Requires `pnpm add stripe`. (Note: the headline pricing
is 1%-of-paid-order commission; Stripe is the optional flat-fee "Pro" plan.)

---

## 10. Cron jobs

Both authenticate with a shared secret: `?key=$CRON_SECRET` or `X-Cron-Key`.
Set `CRON_SECRET` to a long random value.

| Path | Schedule | Does |
|------|----------|------|
| `/api/cron/daily-summary` | `0 18 * * *` (18:00 UTC) | Per-vendor 6 PM hustle summary. |
| `/api/cron/maintenance` | `0 * * * *` (hourly) | Retries failed outbound WhatsApp sends; deletes expired OTP codes; prunes campaign touches older than the 45-day attribution window. |

On Vercel these are declared in `vercel.json` (Vercel injects `$CRON_SECRET`).
On other hosts, schedule them with any external cron / scheduler hitting the
URLs with the `key` param.

---

## 11. Pre-launch checklist

- [ ] `SESSION_SECRET` is a fresh long random value (not the example).
- [ ] `NEXT_PUBLIC_APP_URL` is the real public origin.
- [ ] `WHATSAPP_APP_SECRET` set (webhook signature verification on).
- [ ] Each live vendor has `whatsappPhoneNumberId` set (multi-tenant routing).
- [ ] `CRON_SECRET` set and both crons scheduled.
- [ ] S3 storage configured if on serverless.
- [ ] `prisma migrate deploy` run against the production DB.
- [ ] `GET /api/health` returns 200.
- [ ] WhatsApp templates registered for out-of-window sends.
- [ ] Smoke: create a shop, add a product, place a catalog order, confirm the
      order moves New → Paid, and (stub or live) a WhatsApp message is logged.

---

## 12. Rollback

Migrations are forward-only SQL in `prisma/migrations/`. To roll back a release,
redeploy the previous build; only run a down-migration you've hand-written and
tested. Data is never hard-deleted on account closure (soft-delete tombstones),
so exports/disputes remain possible.
