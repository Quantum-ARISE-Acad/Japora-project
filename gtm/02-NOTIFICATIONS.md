# GTM Decision 2 — Notifications: free in-window vs. paid templates

> Status: **recommendation + one engineering optimization worth doing regardless.**

## How WhatsApp charges (2024–2025 model — confirm Meta's current Togo rate card)

- **Service messages** — any reply **inside the customer's open 24-hour window**
  (they messaged you first): **FREE**.
- **Utility templates** (order/payment/account updates): **FREE when sent inside
  an open 24h window**; **paid** outside it.
- **Marketing templates** (promos, new-drop blasts): **always paid**, per message
  — the most expensive category.
- **Authentication templates** (OTP): **paid** per message.

Rates are per-country. I don't have a published Togo line; West/Central Africa is
roughly **marketing $0.02–0.05**, **utility $0.005–0.015**, **auth $0.01–0.03**
per message. Treat these as order-of-magnitude until you see the contract.

**The one rule that saves the most money:** an update sent **while the customer's
window is open is free** (utility or plain service text). Most order updates
happen minutes after the customer ordered — i.e. the window is open — so they can
be **free** if Japora sends them as in-window messages instead of cold templates.

---

## Japora's message inventory → recommendation

| # | Message | To | Category | Window usually open? | Cost | Recommendation |
|---|---|---|---|---|---|---|
| 1 | Bot reply ("how much?", menu, order) | Customer | Service | **Yes** (they just messaged) | **Free** | Keep as-is. |
| 2 | Order confirmed / paid / delivered | Customer | Utility | **Usually** (just ordered) | **Free in-window**, else paid | **Send in-window** → free. Optimize the code to prefer this. |
| 3 | **6 PM hustle summary** | **Vendor** | Utility | **No** (vendor isn't chatting the bot) | **Paid utility** ×vendors×daily | **Pay it** — it's the habit hook. Offer free **email** summary as the default/alternative. |
| 4 | Receivable nudge ("you owe X") | Customer | Utility | **No** (debt is old) | **Paid utility** | Pay selectively; prefer in-window if the customer is active. Cap frequency. |
| 5 | New-drop broadcast | Followers | **Marketing** | No | **Paid marketing** (expensive) | **Vendor-funded / quota.** Don't absorb at scale. |
| 6 | OTP onboarding code | New vendor | Auth | No | **Paid auth** (low volume) | **Pay it** — required for signup, tiny volume. |
| 7 | Cooperative invite (bulk) | Prospects | Marketing/Utility | No | **Paid** | Throttle; this is outreach, treat like marketing spend. |

---

## What Japora should absorb vs. make vendor-funded

**Absorb (cheap + core to the product):**
- In-window bot replies + order updates (≈ **free** — the bulk of traffic).
- 6 PM summary (1 utility/vendor/day; the retention engine — cheap insurance).
- OTP auth (one-time per vendor).

**Vendor-funded or quota'd (could blow up the bill):**
- **Marketing broadcasts** (new-drop). This is the only category that scales with
  *audience size* and is always paid. Options: (a) include N free broadcast
  recipients/month then charge, (b) show the vendor the cost and let them
  approve, (c) require the Pro tier. Recommend **(a) + (b)**.
- Cold cooperative invites — count against a small free allowance.

**Daily cost intuition (illustrative):** 30 beta vendors × 1 summary/day ≈ 30
utility templates/day ≈ **$0.15–0.45/day** total. Negligible. A single vendor
blasting 2,000 followers a marketing template ≈ **$40–100** — that's the one to
not absorb.

---

## Engineering optimization worth doing regardless of the policy

Right now order-status updates (`OrdersBoard` "Update", and the status sends) go
out as plain text via `sendWhatsApp`. That's already the **free in-window** path
**when the window is open** — good. To make it deliberate and cheap at scale:

1. Track each customer's `lastInboundAt` (we already log inbound messages).
2. On a status update: if `now − lastInboundAt < 24h`, send the **free in-window
   message**; else send the registered **utility template** (paid).
3. Log which path was taken so the WhatsApp bill is explainable.

This is a small, self-contained change (a window check + a template fallback). I
can implement it; it turns "we might be paying for order updates" into "we only
pay when we have to."

---

## Templates to register with Meta (so out-of-window sends are possible)

- `order_update` (Utility): confirmed / paid / delivered — `{shop} {ref} {status}`.
- `daily_summary` (Utility): the 6 PM hustle digest — `{shop} {orders} {revenue} {unpaid}`.
- `receivable_nudge` (Utility): `{shop} {amount} {due}`.
- `new_drop` (Marketing): `{shop} {product} {price} {link}`.
- `otp_code` (Authentication): `{code}`.

**→ DECISION FOR YOU:** (a) confirm Japora **absorbs** summary + OTP + in-window
updates (recommend yes), (b) pick the **broadcast policy** — free quota size then
vendor-funded? (recommend ~200 free recipients/vendor/month, then their cost),
(c) say the word and I'll implement the 24h-window check so order updates stay
free by default + register the template shapes above.
