# GTM Decision 1 — Pricing

> Status: **DECIDED & SHIPPED** (you delegated the call). Locked model below;
> the app now reflects it. Numbers live in `src/lib/billing.ts` (`PRICING`) — one
> edit re-prices everything. Tune the rate/floor/cap there whenever you want.
>
> **Locked:** Starter **0%** (vendor-direct payment) · Pay-as-you-sell **3% all-in**
> on Japora-routed paid orders ("keep 97%", mobile-money processing folded in) ·
> **free under 2,000 XOF** · **capped at 1,000 XOF/order** · no monthly fee.
> Currency switched NGN → **XOF** across pricing/landing/README.

## TL;DR recommendation

1. **Keep the acquisition wedge: "free until you sell."** Zero upfront, zero
   monthly — the single biggest reason a Lomé micro-vendor will try it.
2. **Fix the currency.** The app is Togo-first (XOF) but the pricing copy quotes
   **NGN** ("1%, capped at 200 NGN, free under 5,000 NGN"). That's a Nigeria
   artifact and reads as "not for me" to a Togolese vendor. Re-express in **XOF**.
3. **Make the real rate honest: ~2.5%, not 1%.** A bare 1% does **not** cover
   the mobile-money processing fee Japora pays to route the payment (see math).
   Headline can stay "pay only when you sell"; the number should be ~2.5%.
4. **Two tiers:** a genuinely-free Starter (vendor-direct payment, Japora takes
   nothing, monetized later via ads/badge) and a pay-as-you-sell tier (Japora-
   routed inline payment with the per-order fee).

**The decision only you can make:** the exact rate + cap, and whether Japora
**absorbs** or **passes through** the payment-processor fee.

---

## The structural fact that drives everything

Japora's 1% is collected by **routing the payment** (CinetPay / PayGate →
`PaymentIntent` → order marked PAID). That is the only reliable way to collect a
commission from a micro-vendor — you net it at settlement; you never have to
invoice or chase. The code already assumes this (the payment rails exist).

But routing the payment means Japora (or the vendor) pays the **mobile-money
processing fee**. In Togo, T-Money / Flooz merchant collection runs roughly
**1.5–2.5%**. So:

```
Order: 8,000 XOF
  Japora "1%" commission ........  80 XOF   (revenue)
  Mobile-money processing ~1.8% . 144 XOF   (cost to whoever is merchant-of-record)
  ----------------------------------------
  If Japora absorbs the PSP fee:  -64 XOF PER ORDER  → you lose money on every sale
```

**A literal 1% is below cost.** Three honest ways out:

| Option | Vendor sees | Japora margin | Notes |
|---|---|---|---|
| **A. Pass-through + margin** | "2.5% per paid order" (≈ processing + ~0.7% Japora) | thin but positive | Simplest, honest. Recommended. |
| **B. PSP fee shown separately** | "1% Japora + standard mobile-money fee" | ~1% | More transparent, more line items; micro-vendors dislike multiple fees. |
| **C. Absorb, monetize elsewhere** | "0% — free" | negative on payments | Only viable if ads/subscription/float covers it. Risky at micro-scale. |

Recommendation: **Option A** — one number, "2.5% per paid order, you keep
97.5%," covers processing and leaves a thin margin. It still beats every
competitor on risk (free to start, pay only on a sale).

---

## Recommended structure

**Starter — free, forever**
- Catalog, bot, orders, marketplace listing, share kit.
- Payment is **vendor-direct** (their own T-Money / Flooz number) — Japora takes
  **nothing**. Keeps onboarding frictionless and truthful.
- Monetize later via opt-ins: CTWA ad studio, verified-shop badge, priority
  marketplace placement.

**Pro — pay only when you sell (no monthly fee)**
- Everything in Starter **+ inline payment** (customer pays in-chat via Japora).
- **2.5% per paid order**, **free under 2,000 XOF** (don't tax tiny sales),
  **capped at 1,000 XOF/order** (don't punish a 100,000 XOF sale).
- Includes verified-badge eligibility + the 6 PM summary as a paid template.

Why a floor + cap: the floor removes the "you taxed my 1,500 XOF sandwich sale"
complaint; the cap removes the "you took 2,500 XOF off one big order" complaint.
Both are cheap goodwill that protect the "fair" narrative.

---

## Sensitivity (per paid order, AOV 8,000 XOF, ~1.8% PSP)

| Headline rate | Japora gross | PSP cost | **Net / order** | At 1,000 orders/mo across beta |
|---|---|---|---|---|
| 1.0% | 80 | 144 | **−64** | −64,000 XOF (loss) |
| 2.0% | 160 | 144 | **+16** | +16,000 XOF |
| 2.5% | 200 | 144 | **+56** | +56,000 XOF |
| 3.0% | 240 | 144 | **+96** | +96,000 XOF |

(Replace 1.8% with CinetPay/PayGate's actual Togo merchant rate when you have
the contract — that single number moves the whole table.)

---

## Competitor read (why the wedge wins, why the rate must be honest)

- **Subscription tools** (Bumpa, Catlog, Selll — Nigeria): ₦/month tiers.
  Predictable revenue but a hard sell to a vendor with no cash and no trust.
  Japora's "no monthly fee, pay on a sale" removes that wall.
- **Marketplaces** (Jumia): 10–20% + fees, but they *own the customer*. Japora
  deliberately doesn't — the vendor keeps their WhatsApp relationship. That's a
  feature; price accordingly (you provide rails, not demand).
- **Meta WhatsApp Catalog**: free, but no orders, no payment, no records. Japora
  competes with "free + manual labour" — so the pitch is *time + lost orders +
  faster payment*, and the price must be small enough to feel like nothing.
- **Mobile-money merchant fees** (the real floor): ~1.5–2.5% in Togo. Your price
  can't pretend that cost away — hence ~2.5%, not 1%.

---

## Code changes that follow (once you pick numbers)

- Replace NGN with XOF in `src/app/pricing/page.tsx`, the landing hero, and
  `README` (the "1% / 200 NGN / 5,000 NGN" lines).
- Centralize the rate/floor/cap as constants (e.g. `src/lib/billing.ts`) and
  apply them where the commission is computed at settlement, so changing the
  number is one edit.
- Optional: a Starter-vs-Pro toggle on `/pricing`.

**→ DECISION FOR YOU:** (a) final rate (recommend **2.5%**), (b) floor (recommend
**2,000 XOF**), (c) cap (recommend **1,000 XOF**), (d) absorb vs pass-through PSP
(recommend Option A — fold it into 2.5%). Give me those four and I'll update the
app + billing config in one pass.
