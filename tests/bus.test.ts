import { describe, test, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { randomUUID } from "node:crypto";
import { prisma } from "../src/lib/db";
import {
  CATALOG_PRICE_CHANGED,
  CATALOG_PRODUCT_PUBLISHED,
  CATALOG_PRODUCT_UPDATED,
  CATALOG_STOCK_DEPLETED,
  availabilityOf,
  becamePublished,
  crossedToZero,
  priceChanged,
  priceMinor,
  productPublished,
  productUpdated,
  stockDepleted,
} from "../src/lib/catalog-events";
import {
  MAX_ATTEMPTS,
  drainOutbox,
  enqueue,
  nextState,
  outboxBacklog,
  spineConfig,
} from "../src/lib/bus";

/**
 * The catalogue's four facts, and the outbox that carries them.
 *
 * Two halves. The pure half needs nothing — payload shape, minor units, and the
 * stock transition are decisions, not I/O. The durable half uses this suite's
 * disposable database and a throwaway local HTTP server standing in for the spine, so the publish call is
 * asserted against a real request rather than a mock's memory of one.
 */

// ── the pure half ────────────────────────────────────────────────────────────

const VENDOR = { id: "v1", shopSlug: "mama-fabrics", currency: "XOF", category: "textiles" };

const PRODUCT = {
  id: "p1",
  name: "Wax print 6 yards",
  description: "Grade A Hollandais, six yards",
  priceCents: 500000, // 5 000 CFA, stored as hundredths-of-major like every currency
  imageUrl: "https://cdn.example/wax.jpg",
  stock: 4,
  isActive: true,
  preOrderAllowed: false,
};

describe("priceMinor — XOF has no centimes", () => {
  test("a zero-decimal currency divides by 100", () => {
    // 5 000 CFA is stored as 500000. Forwarding that as minor units states a
    // price a hundred times too high on every destination at once.
    assert.equal(priceMinor(500000, "XOF"), 5000);
    assert.equal(priceMinor(500000, "xof"), 5000);
  });
  test("XAF / GNF / RWF / UGX divide too", () => {
    for (const c of ["XAF", "GNF", "RWF", "UGX"]) assert.equal(priceMinor(500000, c), 5000);
  });
  test("a two-decimal currency forwards the stored integer as kobo/cents", () => {
    assert.equal(priceMinor(1850000, "NGN"), 1850000);
    assert.equal(priceMinor(1999, "USD"), 1999);
  });
  test("never returns a fraction", () => {
    assert.equal(priceMinor(555, "XOF"), 6);
    assert.equal(Number.isInteger(priceMinor(555, "XOF")), true);
  });
});

describe("availabilityOf — feed vocabulary, honestly", () => {
  test("in stock", () => {
    assert.equal(availabilityOf({ stock: 4, isActive: true, preOrderAllowed: false }), "in stock");
  });
  test("out of stock at zero", () => {
    assert.equal(availabilityOf({ stock: 0, isActive: true, preOrderAllowed: false }), "out of stock");
  });
  test("preorder when the merchant takes them", () => {
    assert.equal(availabilityOf({ stock: 0, isActive: true, preOrderAllowed: true }), "preorder");
  });
  test("an inactive product is not purchasable whatever the shelf says", () => {
    assert.equal(availabilityOf({ stock: 9, isActive: false, preOrderAllowed: true }), "out of stock");
  });
});

describe("crossedToZero — the transition, not the state", () => {
  test("a positive decrement landing on zero crossed", () => {
    assert.equal(crossedToZero({ decrementedBy: 4, stockAfter: 0 }), true);
  });
  test("a decrement that leaves stock did not", () => {
    assert.equal(crossedToZero({ decrementedBy: 1, stockAfter: 3 }), false);
  });
  test("a zero-sized decrement landing on zero did NOT cross", () => {
    // The Flow route decrements by min(qty, snapshot stock), which is 0 for a
    // pre-order against an empty shelf. That write changes nothing and must not
    // announce a depletion the shelf reached earlier.
    assert.equal(crossedToZero({ decrementedBy: 0, stockAfter: 0 }), false);
  });
  test("oversold past zero is not this fact either", () => {
    assert.equal(crossedToZero({ decrementedBy: 3, stockAfter: -1 }), false);
  });
});

describe("becamePublished — creation, or the false→true flip", () => {
  test("created active is published", () => {
    assert.equal(becamePublished(null, { isActive: true }), true);
  });
  test("created inactive is a draft, not a publication", () => {
    assert.equal(becamePublished(null, { isActive: false }), false);
  });
  test("false → true is a publication", () => {
    assert.equal(becamePublished({ isActive: false }, { isActive: true }), true);
  });
  test("already-live stays published; it is not re-published", () => {
    assert.equal(becamePublished({ isActive: true }, { isActive: true }), false);
  });
  test("taken down is not a publication", () => {
    assert.equal(becamePublished({ isActive: true }, { isActive: false }), false);
  });
});

describe("catalog.product.published — what eight consumers actually read", () => {
  const ev = productPublished(PRODUCT, VENDOR);

  test("names the declared event and a product subject", () => {
    assert.equal(ev.type, CATALOG_PRODUCT_PUBLISHED);
    assert.equal(ev.subjectType, "product"); // WAStudio refuses any other subject type
    assert.equal(ev.subjectId, "p1");
    assert.equal(ev.vendorId, "v1");
  });

  test("carries every field WAFanout requires to render a row", () => {
    for (const f of [
      "title",
      "description",
      "price_minor",
      "currency",
      "availability",
      "condition",
      "image_link",
      "link",
    ]) {
      assert.ok(ev.data[f] !== undefined && ev.data[f] !== "", `missing ${f}`);
    }
    assert.equal(ev.data.price_minor, 5000);
    assert.equal(ev.data.currency, "XOF");
    assert.equal(ev.data.availability, "in stock");
  });

  test("absolute URLs — a relative image_link is the commonest silent rejection", () => {
    assert.match(String(ev.data.image_link), /^https?:\/\//);
    assert.match(String(ev.data.link), /^https?:\/\//);
    const relative = productPublished({ ...PRODUCT, imageUrl: "/uploads/wax.jpg" }, VENDOR);
    assert.match(String(relative.data.image_link), /^https?:\/\//);
  });

  test("carries the spellings the other seven consumers read", () => {
    assert.equal(ev.data.name, "Wax print 6 yards"); // WAReach, WAAuthority, WAPartner
    assert.equal(ev.data.title, "Wax print 6 yards"); // WAFanout, WAStudio
    assert.equal(ev.data.image_url, ev.data.image_link); // WASetup._has_photo
    assert.equal(ev.data.category, "textiles"); // WAPartner route overlap
    assert.equal(ev.data.sku, "p1");
  });

  test("the merchant is the actor on their own catalogue write", () => {
    assert.equal(ev.actorType, "merchant");
    assert.equal(ev.actorId, "v1");
  });
});

describe("catalog.product.updated", () => {
  test("same record, different fact", () => {
    const ev = productUpdated(PRODUCT, VENDOR);
    assert.equal(ev.type, CATALOG_PRODUCT_UPDATED);
    assert.equal(ev.data.title, "Wax print 6 yards");
    assert.equal(ev.data.price_minor, 5000);
  });
});

describe("catalog.price.changed", () => {
  const ev = priceChanged({ ...PRODUCT, priceCents: 600000 }, VENDOR, {
    previousPriceCents: 500000,
  });
  test("carries minor units and a currency, never priceCents", () => {
    assert.equal(ev.type, CATALOG_PRICE_CHANGED);
    assert.equal(ev.data.price_minor, 6000);
    assert.equal(ev.data.currency, "XOF");
    assert.equal(ev.data.priceCents, undefined);
  });
  test("carries what it was, so the change is readable", () => {
    assert.equal(ev.data.previous_price_minor, 5000);
  });
});

describe("catalog.stock.depleted", () => {
  const ev = stockDepleted({ ...PRODUCT, stock: 0 }, VENDOR, {
    orderId: "ord_9",
    previousStock: 4,
  });
  test("WAOrders reads data.sku; WAFanout and WAReach read the subject", () => {
    assert.equal(ev.type, CATALOG_STOCK_DEPLETED);
    assert.equal(ev.data.sku, "p1");
    assert.equal(ev.subjectId, "p1");
    assert.equal(ev.subjectType, "product");
  });
  test("says out of stock, and how many it was", () => {
    assert.equal(ev.data.availability, "out of stock");
    assert.equal(ev.data.previous_stock, 4);
  });
  test("an order-driven depletion correlates to the order, and no customer is named", () => {
    assert.equal(ev.correlationId, "ord_9");
    assert.equal(ev.actorType, "system");
    assert.equal(JSON.stringify(ev.data).includes("phone"), false);
  });
});

// ── the outbox state machine (pure) ──────────────────────────────────────────

describe("nextState — WAGateway/outbox.py's rule, unchanged", () => {
  test("delivered is sent", () => {
    assert.equal(nextState({ attemptsMade: 1, delivered: true }), "sent");
  });
  test("a failure below the allowance is retried, not written off", () => {
    assert.equal(nextState({ attemptsMade: 1, delivered: false }), "queued");
    assert.equal(nextState({ attemptsMade: MAX_ATTEMPTS - 1, delivered: false }), "queued");
  });
  test("a failure that used the allowance is dead", () => {
    assert.equal(nextState({ attemptsMade: MAX_ATTEMPTS, delivered: false }), "dead");
  });
});

// ── the durable half ─────────────────────────────────────────────────────────
//
// Two vendors, made once: one linked to a spine tenant and one not. The outbox
// is cleared between cases because `drainOutbox` scans the whole queue by
// design — leftovers from an earlier case would be re-attempted by a later one,
// which is right in production and only noise here.

const LINKED_TENANT = "mch_bus_test_linked";
let linked: { id: string };
let unlinked: { id: string };

async function makeVendor(spineTenantId: string | null) {
  const id = randomUUID().slice(0, 8);
  return prisma.vendor.create({
    data: {
      email: `bus_${id}@japora.test`,
      passwordHash: "x",
      shopName: `Bus ${id}`,
      shopSlug: `bus-${id}`,
      currency: "XOF",
      whatsappNumber: "22890000000",
      spineTenantId,
    },
    select: { id: true },
  });
}

function sample(vendorId: string) {
  return {
    type: CATALOG_PRODUCT_PUBLISHED,
    vendorId,
    subjectType: "product",
    subjectId: `p_${randomUUID().slice(0, 8)}`,
    data: { sku: "x", title: "t", price_minor: 5000, currency: "XOF" },
    actorType: "merchant" as const,
    actorId: vendorId,
  };
}

const ENV_KEYS = ["SPINE_URL", "SPINE_PRODUCT_ID", "SPINE_PRODUCT_TOKEN", "WA_WCATALOG_DISABLED"];
const savedEnv: Record<string, string | undefined> = {};

before(async () => {
  for (const k of ENV_KEYS) savedEnv[k] = process.env[k];
  linked = await makeVendor(LINKED_TENANT);
  unlinked = await makeVendor(null);
});

after(async () => {
  for (const k of ENV_KEYS) {
    if (savedEnv[k] === undefined) delete process.env[k];
    else process.env[k] = savedEnv[k];
  }
  for (const v of [linked, unlinked]) {
    if (!v) continue;
    await prisma.busEvent.deleteMany({ where: { vendorId: v.id } }).catch(() => {});
    await prisma.vendor.delete({ where: { id: v.id } }).catch(() => {});
  }
  await prisma.$disconnect();
});

async function resetOutbox() {
  await prisma.busEvent.deleteMany({
    where: { vendorId: { in: [linked.id, unlinked.id] } },
  });
}

function clearSpineEnv() {
  for (const k of ENV_KEYS) delete process.env[k];
}

describe("the outbox — a catalogue write is never refused for bus reasons", () => {
  test("enqueue inside the caller's transaction commits with the product", async () => {
    await resetOutbox();
    const ev = sample(linked.id);
    await prisma.$transaction(async (tx) => {
      await enqueue(tx, ev);
    });
    const row = await prisma.busEvent.findFirst({ where: { subjectId: ev.subjectId } });
    assert.ok(row, "the event should be committed with the write");
    assert.equal(row?.status, "queued");
    assert.equal(row?.attempts, 0);
  });

  test("a rolled-back write leaves no event — never a fact about a row that does not exist", async () => {
    await resetOutbox();
    const ev = sample(linked.id);
    await assert.rejects(
      prisma.$transaction(async (tx) => {
        await enqueue(tx, ev);
        throw new Error("the product write failed");
      }),
    );
    const row = await prisma.busEvent.findFirst({ where: { subjectId: ev.subjectId } });
    assert.equal(row, null);
  });
});

describe("drainOutbox — failure contained, and visible", () => {
  test("an unconfigured spine blocks the row; it does not burn an attempt or drop it", async () => {
    clearSpineEnv();
    await resetOutbox();
    assert.equal(spineConfig().configured, false);
    const ev = sample(linked.id);
    await enqueue(prisma, ev);

    const report = await drainOutbox({ limit: 50 });
    assert.ok(report.blocked >= 1, "a blocked row is reported, not swallowed");
    assert.equal(report.sent, 0);
    assert.equal(report.dead, 0);
    assert.equal(report.clear, false, "the backlog is not clear and must not say it is");

    const row = await prisma.busEvent.findFirst({ where: { subjectId: ev.subjectId } });
    assert.equal(row?.status, "queued");
    assert.equal(row?.attempts, 0, "a configuration gap is not a delivery attempt");
    assert.match(String(row?.lastError), /spine/i);
  });

  test("a vendor with no spine tenant blocks rather than guessing an id", async () => {
    clearSpineEnv();
    await resetOutbox();
    const ev = sample(unlinked.id);
    await enqueue(prisma, ev);
    await drainOutbox({ limit: 50 });
    const row = await prisma.busEvent.findFirst({ where: { subjectId: ev.subjectId } });
    assert.equal(row?.status, "queued");
    assert.equal(row?.attempts, 0);
  });

  test("the killswitch stops the send and says so; the fact is still written down", async () => {
    clearSpineEnv();
    await resetOutbox();
    process.env.WA_WCATALOG_DISABLED = "1";
    const ev = sample(linked.id);
    await enqueue(prisma, ev);
    const report = await drainOutbox({ limit: 50 });
    assert.equal(report.disabled, true);
    assert.equal(report.sent, 0);
    assert.ok(report.remaining >= 1, "the backlog is reported while the switch is down");
    const row = await prisma.busEvent.findFirst({ where: { subjectId: ev.subjectId } });
    assert.equal(row?.status, "queued");
    delete process.env.WA_WCATALOG_DISABLED;
  });
});

describe("drainOutbox — the publish call, against a stand-in spine", () => {
  let server: http.Server;
  let seen: { headers: http.IncomingHttpHeaders; body: Record<string, unknown> }[] = [];
  let status = 201;

  before(async () => {
    server = http.createServer((req, res) => {
      let raw = "";
      req.on("data", (c) => (raw += c));
      req.on("end", () => {
        seen.push({ headers: req.headers, body: JSON.parse(raw || "{}") });
        res.writeHead(status, { "Content-Type": "application/json" });
        res.end(JSON.stringify(status < 300 ? { event_id: "evt_stub" } : { error: "boom" }));
      });
    });
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  });

  after(async () => {
    await new Promise<void>((r) => server.close(() => r()));
  });

  function pointAtStub() {
    const addr = server.address();
    const port = typeof addr === "object" && addr ? addr.port : 0;
    process.env.SPINE_URL = `http://127.0.0.1:${port}`;
    process.env.SPINE_PRODUCT_ID = "wcatalog";
    process.env.SPINE_PRODUCT_TOKEN = "test-token-not-a-real-one";
    delete process.env.WA_WCATALOG_DISABLED;
  }

  test("posts the envelope with both credential headers and marks the row sent", async () => {
    seen = [];
    status = 201;
    pointAtStub();
    await resetOutbox();
    const ev = sample(linked.id);
    await enqueue(prisma, ev);

    const report = await drainOutbox({ limit: 50 });
    assert.ok(report.sent >= 1);

    const call = seen.find((c) => c.body.subject_id === ev.subjectId);
    assert.ok(call, "the stand-in spine should have been called for this row");
    assert.equal(call?.headers["x-product-id"], "wcatalog");
    assert.equal(call?.headers["x-product-token"], "test-token-not-a-real-one");
    assert.ok(call?.headers["idempotency-key"], "a retry must not double-publish");
    assert.equal(call?.body.type, CATALOG_PRODUCT_PUBLISHED);
    assert.equal(call?.body.tenant_id, LINKED_TENANT, "the spine's tenant, not the vendor id");
    assert.equal(call?.body.subject_type, "product");
    assert.equal(call?.body.pii, false);

    const row = await prisma.busEvent.findFirst({ where: { subjectId: ev.subjectId } });
    assert.equal(row?.status, "sent");
    assert.ok(row?.sentAt);
  });

  test("a sent row is not sent twice", async () => {
    seen = [];
    status = 201;
    pointAtStub();
    await resetOutbox();
    const ev = sample(linked.id);
    await enqueue(prisma, ev);
    await drainOutbox({ limit: 50 });
    await drainOutbox({ limit: 50 });
    assert.equal(seen.filter((c) => c.body.subject_id === ev.subjectId).length, 1);
  });

  test("a refusing spine retries, and gives up loudly rather than quietly", async () => {
    seen = [];
    status = 500;
    pointAtStub();
    await resetOutbox();
    const ev = sample(linked.id);
    await enqueue(prisma, ev);

    for (let i = 1; i < MAX_ATTEMPTS; i++) {
      const r = await drainOutbox({ limit: 50 });
      assert.ok(r.retrying >= 1, `pass ${i} should retry, not write off`);
      const mid = await prisma.busEvent.findFirst({ where: { subjectId: ev.subjectId } });
      assert.equal(mid?.status, "queued");
      assert.equal(mid?.attempts, i);
    }

    const last = await drainOutbox({ limit: 50 });
    assert.ok(last.dead >= 1, "the allowance is used; this is a write-off and is reported");
    const row = await prisma.busEvent.findFirst({ where: { subjectId: ev.subjectId } });
    assert.equal(row?.status, "dead");
    assert.equal(row?.attempts, MAX_ATTEMPTS);
    assert.match(String(row?.lastError), /500/);

    const backlog = await outboxBacklog();
    assert.ok(backlog.dead >= 1, "a dead event stays counted — nobody has to remember it");
  });
});
