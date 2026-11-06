# WhatsApp feature analysis → Japora strategy

How every WhatsApp / WhatsApp Business capability maps to Japora, and where it
should be **Recreated**, **Complemented**, **Connected**, or used to **Inspire**
something net-new. Tagged by the goal it serves: 💰 accelerate business ·
🌱 accelerate adoption · 🚪 quick market entry.

> Sources: scrape of whatsappbusiness.com (the resource library + Business App
> pages — confirms Business Platform, WhatsApp Flows, the Marketing/Utility/
> Authentication/Service message categories, Business App, Meta Business AI
> agent, Ads that Click to WhatsApp, Business Broadcasts, Business Profile,
> Product Showcase, automated greeting/away) combined with the established
> WhatsApp Business App + Cloud API (Platform) feature set. Meta's marketing
> pages are deliberately thin; the inventory below is the real surface area.

---

## The one insight that frames everything

**WhatsApp already gives the vendor the *primitives*. It never gives them the
*operating system*.**

- WhatsApp **Labels** (New customer · New order · Pending payment · Paid · Order
  complete) are *literally Japora's kanban* — but they're free-text tags on chats
  with no stock, no totals, no receivables, no history.
- WhatsApp **Catalog** lists products — but no inventory count, no variants
  logic, no low-stock alerts, no multi-vendor marketplace.
- WhatsApp **Broadcasts** blast 256 saved contacts — but no segments, no CRM, no
  attribution.
- WhatsApp **Pay** exists — but only in India, Brazil, Singapore. **Not one
  West African country.**

So Japora's job is **not to replace WhatsApp** — it's to be the **ledger, the
inventory, the payments rail, and the brain** sitting on top of the channel the
vendor already lives in. Recreate the primitives we must control; connect to the
ones Meta does better; invent the layer Meta will never build.

---

## Master map

| WhatsApp feature | What it does | Japora today | Verdict | Action |
|---|---|---|---|---|
| **Business Profile** | Name, hours, address, category, logo | `/shop/[slug]` + settings (richer: region, bio, marketplace) | **Recreate ✓ + Connect** | Pull WA profile via API at onboarding to pre-fill |
| **Catalog / Product Showcase** | List products w/ price, image, link | Full catalog + stock + variants + wholesale | **Recreate ✓ + Connect** | Finish WA-catalog *import* (`wa-catalog-import.ts` is stubbed) → zero-setup onboarding 🚪 |
| **Cart** | Customer assembles items, sends as message | In-app cart on `/c/[slug]` | **Recreate ✓ + Connect** | Optionally accept native WA cart messages via API |
| **Labels** (order pipeline) | Free-text chat tags | Kanban New→Confirmed→Paid→Delivered + stock/receivables | **Recreate ✓ (and beat)** | This is our core. Nothing to do but market it |
| **Quick replies** | Saved `/shortcut` canned responses | Bot auto-replies | **Complement** | Vendor-managed saved replies + bot fallback 🌱 |
| **Greeting message** | Auto-hello on first contact | Bot greeting intent | **Recreate ✓** | — |
| **Away message / business hours** | Auto-reply when offline | ❌ gap | **Complement** | Add business hours + away copy to the bot 🌱 |
| **Broadcast lists** (≤256, saved contacts only) | One-to-many blast | Segmented broadcasts (all/recent/unpaid/wholesale), unlimited | **Recreate ✓ (and beat) + Connect** | Live mode needs **approved templates** (see below) |
| **Click-to-chat / wa.me / QR** | Link or QR that opens a chat | `wa.me` links everywhere | **Complement** | **Generate QR codes** for catalog/shop → market-stall signage, offline→online 🚪 (quick win) |
| **Status** (24h ephemeral) | Disappearing posts to all contacts | We already render Status-sized social cards | **Connect / Inspire** | One-tap "post this product to my WhatsApp Status" 💰 |
| **Channels** (follower broadcast) | One-to-many, follower-based | ❌ | **Inspire** | **Japora shop followers** + "new drop" notifications → repeat business 💰🌱 |
| **Communities** (group of groups) | Federated groups | ❌ | **Inspire** | **Cooperative / market-association onboarding** — sign up a whole market at once 🌱🚪 |
| **WhatsApp Flows** (multi-screen in-chat forms) | Booking, lead-gen, surveys inside chat | ❌ (we redirect to web) | **Connect + Inspire** | **In-WhatsApp checkout Flow** (size → qty → address → pay) — the real "never leave WhatsApp" 💰 |
| **Message templates** (Marketing/Utility/Auth) | Pre-approved messages sendable outside 24h | Free-text only (works in-window) | **Connect (required for live)** | Register + manage templates so hustle summary, order updates, receivable nudges send legally 💰 |
| **Authentication messages** (OTP) | One-time codes, one-tap autofill | Email+password auth | **Connect + Inspire** | **WhatsApp OTP signup/login** — passwordless, no email → huge friction drop 🚪🌱 |
| **Ads that Click to WhatsApp (CTWA)** | FB/IG ad → opens a chat | ❌ | **Connect + Inspire** | Turn our asset generator into **CTWA-ready ad creatives + deep links + order attribution** — the #1 acquisition channel in African WA commerce 💰🚪 |
| **Interactive messages** (reply buttons, lists) | Tappable buttons in chat | `sendWhatsAppInteractive` stub exists | **Connect** | Bot sends **Confirm / Menu / Pay buttons** instead of "reply ORDER X" → fewer typos 💰 |
| **Message status** (sent/delivered/read) | Delivery receipts | ❌ | **Connect** | Surface "customer read it ✓✓" on the order card 🌱 |
| **Meta Business AI agent** | LLM answering for the business | Keyword + fuzzy multilingual bot | **Complement / Inspire** | Optional LLM upgrade w/ catalog retrieval; keyword bot stays the cheap default |
| **WhatsApp Pay** | In-chat P2M payments | ❌ in WA for W.Africa | **Recreate (our moat)** | We built T-Money/Flooz/CinetPay — Meta can't. Lean in 💰🚪 |
| **Meta Verified** (blue tick) | Paid verified badge + support | Japora trust signals | **Connect / Complement** | Japora "verified shop" badge; assist Meta Verified later 🌱 |
| **Media / location / contact / reactions / stickers** | Rich message types | text + links | **Connect (incremental)** | Accept location for delivery; send product images via API |

---

## The four buckets, distilled

### 🔁 Recreate (own it — we already have, or must control)
Catalog, cart, the order pipeline (Labels→kanban), greeting, broadcasts,
profile, **and payments**. These are the spine of the product and we can't
outsource them to a free app with no database. **Mostly done.** Payments
(West-Africa XOF rails) is the one Meta structurally *cannot* match here — our
deepest moat.

### ➕ Complement (fill what WhatsApp leaves thin)
Away-message + business hours · vendor-managed quick replies · QR codes ·
read-receipt surfacing · verified-shop badge. Small, high-trust polish that
makes Japora feel like the "pro" layer.

### 🔌 Connect (don't rebuild — integrate via Cloud API)
Message **templates** (required to send outside the 24h window — gates live
hustle summary / order alerts / receivable nudges) · **interactive buttons** ·
**WhatsApp OTP** · **Flows** · **CTWA** · catalog import · status receipts ·
post-to-Status. These are where Meta's platform does the heavy lifting and we
just orchestrate.

### 💡 Inspire (net-new, only possible because we sit *above* WhatsApp)
1. **In-WhatsApp checkout Flow** — order + pay without leaving the chat.
2. **Shop followers / channel** — opt-in "new drop" notifications → repeat sales.
3. **Cooperative onboarding (Communities pattern)** — enroll a whole market
   association in one motion; horizontal, WhatsApp-group-native growth.
4. **CTWA creative studio** — auto-built ads that click to a *specific product*,
   with the resulting order attributed back (closes the ad→sale loop nobody
   serves for small WA vendors).
5. **WhatsApp OTP onboarding** — a vendor signs up with a code on their phone,
   no email, no password. For low-literacy / low-trust contexts this is the
   single biggest adoption unlock.

---

## What WhatsApp will *never* do (Japora's durable moat)
- **Local payment rails** (T-Money, Flooz, Moov, CinetPay) — WA Pay isn't in
  West Africa and won't be soon.
- **A real ledger** — inventory, receivables ("gbese"), pre-order deposits,
  bookkeeping for loans.
- **A multi-vendor marketplace + discovery** — Meta keeps each business siloed.
- **Cross-vendor commission economics** (1% capped) instead of per-message fees.
- **A bot wired to live stock + multilingual fuzzy matching** tuned for Pidgin /
  Ewe / French, not generic LLM English.

---

## Sequenced roadmap

### NOW — quick market entry (🚪) — days, mostly "Connect"
1. **WhatsApp OTP signup/login** (Auth templates) — passwordless onboarding.
2. **QR code generator** for every catalog + shop (Complement click-to-chat) —
   printable market-stall signage. ~half a day.
3. **Finish WA Business catalog import** (`wa-catalog-import.ts`) — zero-setup:
   pull the vendor's existing WA catalog on day one.
4. **Template library + registration** — unlocks legal sending of the hustle
   summary, order updates, and receivable nudges outside the 24h window.

### NEXT — accelerate adoption + business (🌱💰) — weeks
5. **Interactive bot buttons** (Confirm / Menu / Pay) — wire `sendWhatsAppInteractive`.
6. **In-WhatsApp Flow checkout** — size/qty/address/pay without leaving chat.
7. **Post-to-Status** one-tap (reuse the social asset generator).
8. **Shop followers + "new drop" broadcast** (Channels pattern).
9. **Away message + business hours** on the bot.

### LATER — scale + virality
10. ✅ **CTWA creative studio** + order attribution (paid acquisition loop). *Shipped.*
11. ✅ **Cooperative / market-association onboarding** (Communities pattern). *Shipped.*
12. ✅ **LLM bot upgrade** with catalog retrieval (optional, on top of keyword bot). *Shipped.*
13. ✅ **Read-receipt surfacing** + **verified-shop badge**. *Shipped.*

#### Shipped in the LATER tier
**CTWA creative studio** (`src/lib/campaigns.ts`, `/dashboard/campaigns`):
- One **trackable link per campaign** — `/go/<refCode>` counts the click then
  302s into WhatsApp with a pre-filled `(ref: CODE)` tag. Drop it into a
  Facebook/Instagram "Ads that Click to WhatsApp" creative, a Status post, or a
  flyer QR.
- **Auto-built ad creatives** (Status / IG / TikTok SVGs) reuse the share-asset
  renderer with the campaign headline + product image + trackable link.
- **Last-touch attribution**: the first inbound message records a
  `CampaignTouch` (or Meta's `referral.source_id` on a real CTWA click); any
  later order — bot, in-chat Flow, or web catalog — credits the campaign with
  orders + revenue. The studio shows clicks, orders, revenue, click→order, ROAS.
- Stub-first: works fully without Meta credentials (verified end-to-end via the
  bot simulator → click 1, order 1, ROAS 3.7×).

**Cooperative onboarding** (`src/lib/cooperative.ts`, settings card, `/join/<code>`):
- A coordinator creates a cooperative → one **join code + link + QR**. New shops
  onboard straight into it (`/start?coop=`, `/signup?coop=`, `/login?coop=`); a
  one-tap join button covers already-logged-in vendors.
- **Paste-to-invite**: drop a list of market phone numbers, we blast each the
  join link over WhatsApp (stub-first send). Settings shows the live roster.
- The horizontal-growth play: sign up a whole market association in an afternoon
  instead of one vendor at a time.

**LLM bot upgrade** (`src/lib/llm.ts`, wired into `src/lib/bot.ts`):
- An **answer layer on top of** the keyword bot — not a replacement. The keyword
  bot stays authoritative for money intents (price, order, balance, menu); only
  open questions the parser can't resolve ("do you deliver to Kara?", "is the
  blue one cotton?") fall through to the LLM.
- **Grounded retrieval**: ranks catalog items by token overlap with the question
  and passes them as context. The system prompt forbids inventing prices/stock
  and instructs replies in the customer's language (FR/EN/Pidgin/Ewe).
- **Stub-first, no SDK**: REST calls via `fetch` to Anthropic (preferred) or
  OpenAI, gated on `ANTHROPIC_API_KEY` / `OPENAI_API_KEY`. With no key it returns
  null and the keyword fallback fires — verified: a dummy key produced a live
  API attempt (401) then graceful fallback; no key → keyword reply. Bot dashboard
  shows an "AI assist" status pill.

**Read-receipt surfacing** (`src/lib/whatsapp.ts`, webhook, bot dashboard):
- Outbound sends now persist the Meta `wamid` (`WhatsAppMessage.messageId`). The
  webhook's `statuses[]` array drives `applyStatusUpdate` → sent → delivered →
  read (out-of-order events never downgrade; "failed" always honoured).
- The bot page renders a **delivery log with WhatsApp-style ticks** (✓ / ✓✓ /
  blue ✓✓ read). Verified end-to-end over the live webhook: a posted `read`
  status moved the row to `read`.

**Verified-shop badge** (`src/lib/trust.ts`, `VerifiedBadge`, public surfaces):
- Japora's own trust signal (a stepping stone to Meta Verified). Auto-granted when
  a vendor's **WhatsApp number is verified AND they've fulfilled ≥3 paid orders**
  — re-evaluated on every paid order (webhook + dev stub + manual PAID) and on
  settings load. Manual approval = setting `verifiedAt`.
- The ✓ badge renders on the **public catalog header** and **every marketplace
  card**; settings shows a progress checklist. Verified live: granting flipped
  the demo shop and the badge appeared on `/c/adas-fashion` + `/marketplace`.

---

## Economics note (matters for the broadcast/summary cost model)
WhatsApp moved to **per-message pricing** for Marketing / Utility / Authentication
template categories (service/in-window replies are free). So: keep the bot's
in-window auto-replies free; budget template sends (summary, nudges, marketing
broadcasts) as a real per-message cost — which *reinforces* the 1%-commission
model (we already earn on the order the message drives) and argues for letting
vendors choose which notifications go out as paid templates vs. free in-window.

---

## Single sharpest recommendation
Ship **WhatsApp OTP onboarding + QR codes + catalog import** first. Those three
turn "download a web app, type an email, re-enter your products" into "scan a
code, tap to confirm, your shop is live with the products you already had."
That collapses time-to-first-shop from ~15 minutes to ~90 seconds — the metric
that decides a Togo closed beta.
