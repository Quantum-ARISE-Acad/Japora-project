# Japora

**Sell on WhatsApp. Get paid. Grow your hustle.**

Japora keeps a WhatsApp shop running. A bot answers "how much?" from your live catalog. Customers pay in T-Money or Flooz inline. You get a hustle summary every evening at 6 PM. You stay in WhatsApp. Launching in **Togo first**, then across Francophone West Africa.

Pricing is **success-based, Togo-first (XOF)**: a free **Starter** tier (catalog + bot + orders; customers pay the vendor directly, Japora takes 0%) and **Pay-as-you-sell** — a single all-in **3%** fee on Japora-routed paid orders (mobile-money processing included, so the vendor "keeps 97%"), **free under 2,000 XOF** and **capped at 1,000 XOF/order**. No monthly fee. Stripe stays available as an optional flat-fee path. Reasoning: [`gtm/01-PRICING.md`](./gtm/01-PRICING.md).

The app is a multi-vendor marketplace with a public directory (`/marketplace`), per-vendor shops (`/shop/<slug>` or the legacy catalog at `/c/<slug>`), and a vendor dashboard. Voice and tone live in [`BRAND_VOICE.md`](./BRAND_VOICE.md). Internal identifiers (DB name, container, package paths) still use `wcatalog` for compatibility.

---

## Quick start

```bash
# 1. Start local Postgres (one-time per machine boot)
colima start                 # if you're using Colima; skip on Docker Desktop
docker-compose up -d         # spins up the wcatalog-db container

# 2. Install + initialise
pnpm install                 # install + auto-generates the Prisma client
pnpm db:deploy               # apply migrations
pnpm db:seed                 # populate the demo shop
pnpm dev                     # http://localhost:5174
```

After the first time, day-to-day is just `docker-compose up -d && pnpm dev`.

### Demo login

| Field    | Value                |
| -------- | -------------------- |
| Email    | `demo@wcatalog.app`  |
| Password | `demo1234`           |
| Shop     | `/shop/adas-fashion` (also `/c/adas-fashion`) |

---

## What's in it

**Onboarding accelerators (Togo-first)** — collapse signup from ~15 min to ~90 sec
- **WhatsApp OTP** — `/start` + `/api/auth/otp/{request,verify}` + `src/lib/otp.ts`. Sign up/in with a 6-digit code, no email or password. New OTP vendors default to **XOF** + a 30-day trial; they carry a placeholder `wa_<phone>@japora.local` email (settable later) so the email-keyed code keeps working. Codes are SHA-256-hashed, 10-min TTL, attempt-capped, rate-limited. In dev the code is returned as `devCode`; in production wire delivery to an Authentication-category template.
- **Stall QR codes** — `src/lib/qr.ts` + `/api/qr` + the Settings "Stall QR code" card. Printable SVG that scans into the catalog — the offline→online bridge for a market stall.
- **WhatsApp Business catalog import** — one-tap "Import from WhatsApp" on the Products page pulls the vendor's existing Meta catalog (needs `WHATSAPP_TOKEN` + `WHATSAPP_BUSINESS_ACCOUNT_ID`; friendly message until set).

**WhatsApp-first bot** — `src/lib/bot.ts` + `/api/whatsapp/webhook`
- Customers can browse, order, and check status entirely inside WhatsApp
- **Interactive buttons** — replies carry tappable buttons (See menu / Order this / My balance); taps return `MENU` / `BALANCE` / `ORDER:<id>` and drive a fast-path. Sent via `sendWhatsAppInteractive`, text fallback. The `/dashboard/bot` simulator renders them.
- **Away message + business hours** (`src/lib/hours.ts`, Settings → Hours & away) — outside hours the bot leads with the away message
- Stub-first provider — works without Cloud API creds; flips to real API once `WHATSAPP_TOKEN` is set
- Webhook signature verification (`WHATSAPP_APP_SECRET`)

**In-WhatsApp Flow checkout** — `src/lib/flow.ts` + `/api/whatsapp/flow`
- `GET ?slug=` returns the Flow JSON (PRODUCT → DETAILS → REVIEW) to paste into Meta's Flow Builder; `POST` is the data-exchange/completion endpoint that creates the order. Order + pay without leaving the chat. Connect step: publish the Flow + add RSA request encryption.

**Shop followers** — `Follower` model, `/api/follow` (public opt-in), `/api/followers/notify`
- "🔔 Follow" on every catalog; a "📣 New drop" composer on the dashboard blasts opted-in followers. The repeat-business loop.

**Social share kit** — per-product WhatsApp Status / IG / TikTok cards + a copyable caption (`AssetDownloads`). Download → post to your Status.

See `WHATSAPP_FEATURE_STRATEGY.md` for the full WhatsApp-feature → Japora map (recreate / complement / connect / inspire) and the launch roadmap.

**Daily hustle summary** — `src/lib/hustle.ts` + `/api/cron/daily-summary`
- Each morning every active vendor gets a one-line WhatsApp message: yesterday's orders, revenue, top product, low-stock alerts
- Cron-guarded with `CRON_SECRET` so it's safe to expose on Vercel cron / Railway cron / external scheduler

**African payment rails** — `src/lib/payments/*` — **West Africa first, starting from Togo**
- Native `fetch` implementations, no SDK installs needed
- Real providers: **PayGate Global** (Togo — native T-Money + Flooz), **CinetPay** (Francophone W&C Africa — T-Money/Flooz/Orange/MoMo/Wave/card), **Flutterwave** (pan-African incl. XOF), **Paystack** + **M-Pesa Daraja** (Anglophone E/W)
- Stub providers: MTN MoMo, Orange Money, Wave, Chipper, Cash-on-delivery
- **XOF (CFA franc) is zero-decimal** — `src/lib/currency.ts` converts stored cents → whole francs (and rounds to multiples of 5 for CinetPay) so a 5,000 CFA price never goes out as 500,000. Display via `Intl` shows "CFA 5,000" automatically.
- `providersForCurrency(currency)` offers buyers only the rails that fit the shop's currency, Togo-first. One unified `/api/payments/checkout` initiates; webhooks (JSON **or** form-encoded) land at `/api/payments/webhook/[provider]`, which re-verifies via the provider's check/status endpoint before settling.
- Every rail falls back to `/dev/pay-stub` when its keys are absent, so the whole order → pay → settle loop is demoable with zero credentials.

**Marketplace directory** — `/marketplace`, `/marketplace/[region]`, `/marketplace/[region]/[category]`
- Public browsing by region (`lagos-mainland`, `lagos-island`, `abuja`, `port-harcourt`, `nairobi`, `mombasa`, `kampala`, `kigali`, `accra`, `kumasi`, `dakar`, `abidjan`, `dar-es-salaam`, `johannesburg`) and category (`fashion`, `food`, `beauty`, `electronics`, `home`, `groceries`, `services`, `other`)
- Per-shop public page at `/shop/[slug]` (the legacy `/c/[slug]` URL still works)

**Affiliates + referral** — `src/lib/affiliate.ts`, `src/lib/referral.ts`, `/dashboard/affiliates`, `/dashboard/referral`
- Vendors can give out affiliate codes that pay a % on attributed orders
- Vendor-to-vendor referral codes track signups + reward the referrer

**CRM** — `/dashboard/customers`, `/dashboard/receivables`
- `customers.ts` — phone-keyed customer ledger (notes, tags, lifetime spend)
- `receivables.ts` — credit / "pay later" tab per customer, with reminders
- `preorder.ts` — pre-orders / deposits for out-of-stock items

**Broadcasts** — `/dashboard/broadcasts`, `src/lib/broadcast.ts`
- Send a templated WhatsApp blast to a customer segment (all / by tag / by region) with per-vendor rate limiting

**Bookkeeping** — `/dashboard/bookkeeping`, `src/lib/bookkeeping.ts` + `/api/account/monthly-summary`
- Auto-generated monthly P&L from confirmed orders + manual expenses
- Exportable summary suitable for an accountant or a tax filing

**PWA** — `src/app/manifest.ts`, `public/icon-*`
- Installable on Android / iOS; offline shell; works as a "phone-first" experience for vendors

**Client-side image compression** — `src/lib/client-image.ts`
- Resize + re-encode in the browser before upload so vendors on 2G/3G don't waste data
- Server-side still runs the sharp pipeline (`image.ts`) when available

**i18n** — `src/lib/i18n.ts`, `src/i18n/*`
- v1 languages: `en` (default), `pcm` (Pidgin), `sw` (Swahili), `fr` (French)
- Stub locales: `wo` (Wolof), `am` (Amharic), `ha` (Hausa)

**Vendor dashboard** — `/dashboard`
- Overview with revenue, open orders, low-stock alerts
- Product CRUD with image upload (client-side compress + server-side sharp resize + EXIF strip), sizes, stock count
- Kanban order board: **New → Confirmed → Paid → Delivered** + Cancelled, with search, status filter, soft-delete, pagination
- Manual "add order" for orders that come in via WhatsApp chat
- Billing page (commission-based by default; Stripe subscription optional)
- Settings: shop name, slug, WhatsApp number, currency, region, category, payment-provider keys, **+ data export, account deletion**

**Marketing + legal**
- `/` landing, `/pricing` (commission table), `/terms`, `/privacy`

**Auth**
- Email + password (8+ chars, must contain letter + number), bcrypt-hashed
- Signed JWT in httpOnly cookie (30-day session, `SESSION_SECRET` 64-char random)
- Email verification on signup (banner in dashboard until verified)
- Password reset flow (`/forgot-password` + `/reset-password/[token]`)
- Rate-limited login (5 / 15min / IP), signup (3 / hr / IP), forgot (5 / hr / IP), public orders (10 / 5min / IP+shop)

---

## Pluggable integrations — stub-first

Everything that needs an external account flips on automatically when you paste its credentials. No code changes.

### Payment rails (`src/lib/payments/*`)

Rails are offered to buyers Togo-first (see `providersForCurrency`).

| Provider           | Status | Markets / wallets | Env vars to set                                                          |
| ------------------ | ------ | ----------------- | ------------------------------------------------------------------------ |
| **PayGate Global** | Real   | 🇹🇬 Togo — T-Money, Flooz | `PAYGATE_AUTH_TOKEN`                                          |
| **CinetPay**       | Real   | Francophone W&C Africa — T-Money/Flooz/Orange/MoMo/Wave/card | `CINETPAY_API_KEY` + `CINETPAY_SITE_ID` (+ `CINETPAY_SECRET_KEY` for HMAC) |
| **Flutterwave**    | Real   | Pan-African incl. XOF | `FLUTTERWAVE_SECRET_KEY` + `FLUTTERWAVE_WEBHOOK_HASH`                |
| **Paystack**       | Real   | NG/GH/KE/ZA | `PAYSTACK_SECRET_KEY` (+ webhook signing automatic)                            |
| **M-Pesa (Daraja)**| Real   | KE/TZ | `MPESA_CONSUMER_KEY` + `MPESA_CONSUMER_SECRET` + `MPESA_SHORTCODE` + `MPESA_PASSKEY` |
| **MTN MoMo**       | Stub   | — | `MOMO_SUBSCRIPTION_KEY` + `MOMO_API_USER` + `MOMO_API_KEY`                          |
| **Orange Money**   | Stub   | `ORANGE_CLIENT_ID` + `ORANGE_CLIENT_SECRET`                              |
| **Wave**           | Stub   | `WAVE_API_KEY`                                                           |
| **Chipper Cash**   | Stub   | `CHIPPER_API_KEY` + `CHIPPER_API_SECRET`                                 |
| **Cash on delivery** | Stub | — always on                                                              |

### Messaging, billing, storage

| Provider                  | Env var to set                                                                          | Until then…                                                       |
| ------------------------- | --------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| **Resend (email)**        | `RESEND_API_KEY` + `EMAIL_FROM`                                                         | Stub logs + persists to `EmailMessage` table                       |
| **WhatsApp Cloud API**    | `WHATSAPP_TOKEN` + `WHATSAPP_PHONE_NUMBER_ID` + `WHATSAPP_APP_SECRET` + `WHATSAPP_BUSINESS_ACCOUNT_ID` (for catalog import) | Stub provider; webhook signature check bypassed                    |
| **Stripe (legacy / opt.)**| `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` + `STRIPE_PRICE_ID`, then `pnpm add stripe` | Commission-only billing is the default — Stripe path is optional   |
| **S3-compatible storage** | `STORAGE_S3_*` + `pnpm add @aws-sdk/client-s3`                                          | Uploads go to `./public/uploads`                                   |
| **Image optimisation**    | `pnpm add sharp` (then ensure `sharp` is in `pnpm.onlyBuiltDependencies`)               | Uploads stored at original resolution + format                     |

Each lib (`src/lib/{email,stripe,whatsapp,storage,image}.ts` and every file under `src/lib/payments/`) follows the same pattern: a provider interface, a stub default, a real impl that's lazy-imported and gracefully falls back.

---

## Project layout

```
docker-compose.yml          # local Postgres
prisma/
  schema.prisma             # Vendor, Product, Order, OrderItem, WhatsAppMessage,
                            # EmailMessage, PasswordResetToken, EmailVerificationToken,
                            # Customer, Receivable, PreOrder, Broadcast,
                            # Affiliate, ReferralCode, Payment, MonthlySummary
  migrations/               # versioned migrations (replaces `db push`)
  seed.ts                   # demo shop
src/
  i18n/                     # en, pcm, sw, fr + wo, am, ha stubs
  lib/
    db.ts                   # singleton Prisma client
    auth.ts                 # bcrypt + validators + requireVendor() guard
    session.ts              # jose JWT in httpOnly cookie
    ratelimit.ts            # in-process sliding-window limiter
    logger.ts               # structured JSON-line logger
    token.ts                # crypto-random tokens + SHA-256 hash for DB
    email.ts                # Resend / stub
    email-templates.ts      # welcome / verify / reset / new-order
    verification.ts         # signup + resend helpers
    stripe.ts               # lazy Stripe SDK + helpers (optional)
    billing.ts              # commission entitlement + optional subscription
    whatsapp.ts             # Cloud API / stub
    wa-catalog-import.ts    # WA Business catalog → Japora products
    bot.ts                  # WhatsApp conversational order flow
    broadcast.ts            # segmented WhatsApp blasts
    hustle.ts               # daily summary message builder
    customers.ts            # CRM ledger
    receivables.ts          # credit / pay-later
    preorder.ts             # pre-orders + deposits
    affiliate.ts            # affiliate codes + attribution
    referral.ts             # vendor-to-vendor referrals
    directory.ts            # marketplace listing
    regions.ts              # region taxonomy
    bookkeeping.ts          # monthly P&L
    assets.ts               # product asset urls
    storage.ts              # S3-compat (R2/S3/Supabase) / local
    image.ts                # sharp pipeline (resize + strip EXIF)
    client-image.ts         # browser-side compress before upload
    i18n.ts                 # locale resolver + t()
    payments/
      index.ts              # provider selector
      paystack.ts           # real
      flutterwave.ts        # real
      mpesa.ts              # real
      momo.ts               # stub
      orange.ts             # stub
      wave.ts               # stub
      chipper.ts            # stub
      cash.ts               # stub
    utils.ts                # formatMoney, parseSizes, waMeLink, slugify…
  app/
    page.tsx, pricing/, terms/, privacy/
    login/, signup/, forgot-password/, reset-password/[token]/, verify-email/[token]/
    marketplace/            # /, [region]/, [region]/[category]/
    shop/[slug]/            # public per-vendor shop
    c/[slug]/               # legacy alias for shop
    dashboard/              # auth-guarded layout + nav + overview +
                            #   products / orders / customers / receivables /
                            #   broadcasts / affiliates / referral /
                            #   bookkeeping / billing / settings
    api/
      auth/{signup,login,logout,forgot-password,reset-password,resend-verification}
      account/, account/export/, account/monthly-summary/
      billing/{checkout,portal,webhook}/
      payments/{checkout,webhook/[provider]}/
      products/, products/[id]/, products/[id]/asset/[format]/, products/import/
      orders/, orders/[id]/
      customers/, customers/[id]/
      receivables/, receivables/[id]/
      affiliate/, affiliate/[id]/
      referral/
      broadcasts/, broadcasts/[id]/send/
      cron/daily-summary/
      whatsapp/{webhook,send}/
      upload/, settings/, health/
```

---

## Scripts

| Script                  | What it does                                       |
| ----------------------- | -------------------------------------------------- |
| `pnpm dev`              | Next dev server on `:5174`                         |
| `pnpm build`            | Production build + type check                      |
| `pnpm start`            | Run the production build                           |
| `pnpm db:migrate`       | Create + apply a new migration (local dev)         |
| `pnpm db:deploy`        | Apply pending migrations (prod / CI)               |
| `pnpm db:push`          | Escape hatch — sync schema without migration files |
| `pnpm db:seed`          | Re-seed the demo shop (idempotent)                 |
| `pnpm db:studio`        | Prisma Studio                                      |
| `pnpm db:reset`         | Wipe + re-migrate + re-seed                        |

---

## Production checklist

The build is **ready for closed beta with real vendors**. Before opening signup to the public:

- [ ] **Generate a fresh `SESSION_SECRET`**: `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`
- [ ] **Point `DATABASE_URL` at a managed Postgres** (Supabase / Neon / Railway / RDS) and run `pnpm db:deploy`
- [ ] **Configure the Togo payment rail first** — sign up with **PayGate Global** (native T-Money + Flooz) and/or **CinetPay** (covers Togo + the rest of Francophone West Africa). Set the env vars above and point each provider's notify/webhook URL at `/api/payments/webhook/<provider>`. Flutterwave/Paystack/M-Pesa are there for later markets.
- [ ] **Set `CRON_SECRET`** and schedule `/api/cron/daily-summary` (Vercel Cron, Railway, or external scheduler) for the daily hustle summary
- [ ] **Configure WhatsApp Cloud API** — `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_APP_SECRET` (signature verification), and `WHATSAPP_BUSINESS_ACCOUNT_ID` (catalog import)
- [ ] **Register WhatsApp templates** in Meta Business Manager for outbound notifications outside the 24h customer window
- [ ] **Configure object storage** — set `STORAGE_S3_*` and `pnpm add @aws-sdk/client-s3`
- [ ] **Configure email** — set `RESEND_API_KEY` + `EMAIL_FROM` (verified domain)
- [ ] **(Optional) Configure Stripe** — only if you want a hosted subscription path alongside the default commission model
- [ ] **Install `sharp`** for image optimization: `pnpm add sharp` + add to `pnpm.onlyBuiltDependencies`
- [ ] **Wire `/api/health` to an uptime monitor** (UptimeRobot, Better Uptime, etc.)
- [ ] **Have a lawyer review `/terms` and `/privacy`** — the templates are starting points
- [ ] **Forward logs to an aggregator** (Axiom, Datadog, Loki, Logflare) — output is already JSON lines

After that:

- [ ] **Consider** Sentry for error tracking (a few lines in `instrumentation.ts`)
- [ ] **Consider** swapping `src/lib/ratelimit.ts` for Upstash Redis once you're on multiple instances
- [ ] **Consider** Cloudflare or hCaptcha in front of `/api/auth/signup` and the public shops if you start getting bot traffic

---

## What changed in this build (Japora pivot)

This release pivots WCatalog into **Japora**, a WhatsApp-first marketplace for African micro-entrepreneurs. The internal package and DB names stay `wcatalog` for compatibility, but every user-visible surface is now Japora.

- **WhatsApp-first repositioning** — the storefront is the conversation. A new bot (`src/lib/bot.ts`) handles browse / order / status inside WhatsApp; catalog import pulls products straight from WA Business.
- **Commission pricing** — 1% of confirmed paid orders, capped at 200 NGN, free under 5,000 NGN. No monthly subscription by default. Stripe stays available as an optional path.
- **African payment rails** — Paystack, Flutterwave, and M-Pesa are wired with real `fetch` calls; MoMo, Orange, Wave, Chipper, and Cash are stubbed with matching shape for easy drop-in.
- **Marketplace + affiliates** — public directory at `/marketplace`, per-shop pages at `/shop/[slug]`, affiliate + vendor-to-vendor referral programs.
- **CRM + receivables + pre-orders** — phone-keyed customer ledger, pay-later tabs, deposit-backed pre-orders.
- **Daily hustle summary** — cron-driven WhatsApp recap of yesterday's revenue, orders, top product, and low-stock alerts.
- **PWA** — installable on Android / iOS for the phone-first vendor experience.
- **i18n** — `en`, `pcm`, `sw`, `fr` shipped; `wo`, `am`, `ha` stubbed.
- **Bookkeeping** — auto monthly P&L from confirmed orders + manual expenses, ready for accountant export.

---

## Tech

Next.js 15 App Router · React 19 · TypeScript · Tailwind 3 · Prisma 6 · Postgres 16 · bcryptjs · jose · @aws-sdk/client-s3 (optional) · stripe (optional) · sharp (optional)
