# SPEC — Japora (`wcatalog`)

> **Starter spec, generated from the registry.** The content below is real — it
> comes from a structured decomposition of the product strategy — but every
> `[NEEDS CLARIFICATION]` is a genuine gap that blocks planning, not boilerplate.
> Fill them before writing a `PLAN.md`. Template: `_ecosystem/templates/SPEC-template.md`.

- **Registry id:** `wcatalog` · **Folder:** `WCatalog`
- **Cluster:** commerce — commerce and catalogue
- **Wave:** 2 · **Status:** in-progress · **Owner:** unassigned
- **Kill switch:** `WA_WCATALOG_DISABLED`

---

## 1. The one-sentence claim

> *One product record, kept properly — the asset every other tool reads.*

An agent must be able to deliver this from memory, on a noisy market street, in
under fifteen seconds. If it cannot be recited cold, it is not yet a message.

## 2. What this is

A catalogue is not a photo album inside an app; it is a structured product feed that happens to have one rendering inside WhatsApp. Japora owns the canonical product record (id, title, description, price, condition, availability, image link, product link), and it gets there from where merchants actually keep it: an Excel or Sheets price book ingested table-region by table-region and written back to so they never learn a new UI, or a rescue of a catalogue whose only copy lives inside the WhatsApp app — which is an app installation, not a business. It owns pricing rules and margin floors, stock and oversell guarding, images (compressed client-side for a prepaid connection, EXIF-stripped and resized server-side), collections as shareable audience cuts, the indexable schema.org storefront, the regional marketplace directory, SKU lifecycle, and the digital-goods and B2B-tiered variants. It sheds what it duplicated: auth and payments to Spine, orders to Runner, affiliates to Proof, broadcasts to Reach, destination publishing to Fanout.

## 3. Who it is for

| | |
|---|---|
| **Primary users** | micro-merchant, sme, creator, reseller-agency, diaspora-buyer |
| **Merchant tiers** | micro, small |
| **Explicitly not for** | `[NEEDS CLARIFICATION]` — a product with no "not for" has not been scoped. Article IV.5: don't over-tool a 40-SKU trader. |
| **Markets at launch** | TG-Lome — one city, then one country, then one corridor. Never "Africa". |

## 4. Entry points

- `whatsapp-inbound`
- `web`
- `qr-code`
- `google-business-profile`

WhatsApp is primary (Article I.1). Everything else is a feeder whose job is to
deliver a person into a WhatsApp conversation.

## 5. User journeys

`[NEEDS CLARIFICATION]` — one numbered journey per primary flow, each step an
observable action, every approval gate marked `**[GATE]**`. See §7 for the gates
this product already owes.

**Offline behaviour:** `[NEEDS CLARIFICATION]` (Article IV.3 — compose, browse,
record an order and check stock must work with no connection).

**Failure behaviour:** `[NEEDS CLARIFICATION]`.

## 6. Capabilities

**Owns** (exactly one owner ecosystem-wide, Article II.1):
- `canonical-product-record`
- `catalogue-render`
- `collection-definition`
- `collection-links`
- `feed-validation`
- `image-hosting`
- `indexable-storefront`
- `margin-floor`
- `price-rules`
- `sku-lifecycle-signal`
- `stock-availability`

**Consumes** (each has an owner; see `ecosystem.html` for the map):
- `ai-inference`
- `claim-screen`
- `event-bus`
- `identity`
- `infrastructure-capability`

**Depends on products:** `wabrain`, `waguard`, `waquartermaster`, `waspine`

## 6a. Internal features (not capabilities)

These are this product's own machinery. They are deliberately **not** in
`provides`, because a capability is an integration boundary — something a sibling
depends on — and nothing else consumes these. If a sibling ever needs one, promote
it to `provides` and it becomes a contract.

- `attribute-completion`
- `b2b-price-tier`
- `currency-normalization`
- `destination-spec-registry`
- `digital-product-feed`
- `image-validation`
- `listing-copy`
- `marketplace-directory`
- `ops-rail-inventory`
- `oversell-guard`
- `product-feed`
- `product-link`
- `reprice-proposal`
- `schema-org-markup`

## 7. Events

**Emits:**
- `catalog.collection.changed`
- `catalog.price.changed`
- `catalog.product.published`
- `catalog.product.updated`
- `catalog.sku.retired`
- `catalog.stock.depleted`
- `feed.validation.failed`

**Consumes:**
- `brain.confidence.low`
- `gate.approval.granted`
- `order.created`
- `order.payment.confirmed`

## 7a. How the four catalogue events reach the bus

Four of the seven emitted events are **built**: `catalog.product.published`,
`catalog.product.updated`, `catalog.price.changed` and `catalog.stock.depleted`.
The other three (`catalog.collection.changed`, `catalog.sku.retired`,
`feed.validation.failed`) are still specified and not built.

**Durable outbox, not fire-and-forget.** `src/lib/bus.ts` writes each fact to a
`BusEvent` row **inside the same transaction as the catalogue write it
describes**, and a separate pass posts it to `WASpine`'s `POST /events`.
Publishing therefore cannot refuse a merchant's catalogue write: a bus outage is
a queued row, not a failed save, and not a lost event either. The drain reports
`sent / retrying / dead / blocked / remaining` — the shape `WAGateway/outbox.py`
arrived at after its predecessor reported an empty backlog while holding one.

**Where it drains.** Best-effort from each write path, and on a schedule from
`/api/cron/maintenance`. The backlog is on `/api/health` and a `dead` row is
logged at error level, so an unreachable spine is a number somebody reads rather
than eight products quietly waiting.

**Configuration:** `SPINE_URL`, `SPINE_PRODUCT_ID`, `SPINE_PRODUCT_TOKEN` (minted
per process by the spine at startup — configuration, never committed), and
`Vendor.spineTenantId`, the spine's `mch_...` for this merchant. Any of them
missing blocks the row without consuming a delivery attempt, so supplying them
drains the backlog rather than finding it written off.

**Definitions written down rather than inferred:**

- *Published* means publicly visible: created active, or `isActive` false → true.
  A product created inactive is a draft. WAAds builds ad inventory from this.
- *Depleted* is a transition. The three decrement sites read it from the row the
  atomic decrement returns — landing on exactly zero after taking a positive
  number off means this write crossed the boundary and no concurrent one could
  also have. The one absolute stock write compares against the row already read.
  Returning stock to the shelf emits nothing: there is no
  `catalog.stock.replenished`.
- *Prices travel as minor units.* `priceCents` is hundredths-of-major for every
  currency; XOF is zero-decimal and is divided back to whole francs before it
  leaves. `priceCents` is never forwarded.

**Known gap:** the canonical record in §2 names `condition`, and the schema has
no column for it. Every destination requires one, so the event carries the
documented default `"new"` (`DEFAULT_CONDITION` in `src/lib/catalog-events.ts`).
The honest fix is a column and a form field.

## 8. Background automation vs approval gates

**Runs unattended on the merchant's behalf:**

Parses a workbook and proposes the column mapping, drafts titles, descriptions and category mappings from a photo plus a two-word row, flags missing identifiers before a destination silently rejects them, compresses and re-hosts images with a nightly reachability crawl, recomputes collection membership on every feed change, regenerates the storefront and pings the sitemap, decrements stock on payment, and computes the quarterly reprice-and-retire shortlist.

**Always stops and asks (Article VI):**

| Action | When | What the merchant sees |
|---|---|---|
| _none declared_ | | |

Drafting is always free. Sending, publishing, spending, pricing, moving money and
extending credit always stop for one tap — in WhatsApp, in the merchant's own
language, with the consequence stated.

## 8a. Unmet needs — real gaps, not oversights

The decomposition had this product consuming things nothing currently provides, or
provides only in a later wave. Recorded rather than deleted, because an unmet need
is a design decision waiting to be made.

**Capabilities:**
- `approval-gate`
- `currency-minor-units`
- `payment-checkout`
- `short-link`
- `whatsapp-transport`

**Events:**
- `delivery.completed`

For each: either a sibling takes ownership, this product absorbs it, or the
dependency is dropped. `[NEEDS CLARIFICATION]`

## 9. Acceptance criteria

- [ ] `[NEEDS CLARIFICATION]` — Given …, when …, then …
- [ ] First paint under 150 KB over the wire (Article IV.2)
- [ ] Works end-to-end on a mid-range Android at 3G with 400 ms RTT
- [ ] `WA_WCATALOG_DISABLED=1` disables cleanly with no deploy (Article VII.4)
- [ ] Every merchant-facing string localisable; voice-note output available
- [ ] No capability consumed that is not declared in `contract.json`
- [ ] No outbound path that bypasses the spine's consent → gate → limit chain

## 10. Non-goals

`[NEEDS CLARIFICATION]` — what this deliberately does not do, and which sibling
does it instead. This section prevents scope creep better than any other.

## 11. AI usage

| Job | Route | Cached prefix | Batchable |
|---|---|---|---|
| ocr-spreadsheet | `claude-sonnet-5` | no | yes |
| product-photo-vision | `claude-sonnet-5` | no | yes |
| intent-classification | `claude-haiku-4-5` | no | no |
| long-context-reasoning | `claude-opus-5` | yes | yes |

Every route must appear in `_ecosystem/ai-models.md`; `validate.py` checks it. All
calls go through `WABrain` — no product imports a model provider SDK (Article XI.5).

## 12. Regulatory surface

> **This product touches regulated activity. It does not launch in a market until the licensing question for that market has a written answer from someone qualified in that jurisdiction (Article VII.1). Where a licence is out of reach the route is a licensed partner and a referral fee — never proceeding unlicensed.**

**`marketing-claims`** — Marketing claims and guarantees. **Nigeria:** FCCPA 2018. **South Africa:** CPA 68 of 2008. **UK:** consumer protection regulations and ASA codes. **US:** FTC Act §5 and the Endorsement Guides.


## 13. Economics

| | |
|---|---|
| **Revenue model** | Free at 40 SKUs so a micro-merchant is not over-tooled. Paid above roughly 150 SKUs or multiple workbooks, plus a per-workbook onboarding fee for agencies migrating a merchant's book. The single 3% success-based commission on Japora-routed orders is collected by Spine, not charged again here. |
| **Ladder rungs** | fruit, manna, bread |
| **Payment frequency** | `[NEEDS CLARIFICATION]` — match the buyer's income frequency, not the platform's convenience |
| **Cost-to-serve per channel** | `[NEEDS CLARIFICATION]` — per channel, never blended (Article X.1) |
| **Free-window dependency** | no |

## 14. Storehouse check (Article X.1)

Before this product may open a second acquisition channel:

- [ ] Cost-to-serve per unit per channel, measured
- [ ] Delivery capacity per week at standard quality — the real demand ceiling
- [ ] Failed-delivery / return rate, with COD modelled at 15–40%
- [ ] Agent float and liquidity, if it touches an agent network
- [ ] QA on people the platform does not employ
- [ ] Growth kill-switch: threshold set in advance, and one named human who can pull it

## 15. Provenance

This product absorbs **15** candidates from the
structured decomposition of the product strategy. A product with no
provenance is an invention.

- `pricelist-ingestor`
- `catalogue-rescue`
- `feed-core`
- `listing-enricher`
- `image-pipeline`
- `price-currency-engine`
- `stock-sync`
- `collections-builder`
- `schema-storefront`
- `sku-lifecycle`
- `selar-digital-feed`
- `sabi-b2b-feed`
- `catalogue-builder`
- `whatsapp-storefront`
- `ops-rail-bridge`

