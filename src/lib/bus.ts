/**
 * The spine bus client — a durable outbox, not a fire-and-forget.
 *
 * Japora is the first of the five pre-existing codebases to be wired to
 * `WASpine`'s event bus. The transport already existed: `WASpine/api.py` serves
 * `POST /events` under the `event:publish` scope, authenticated by an
 * `X-Product-Id` / `X-Product-Token` pair minted per process at the spine's
 * startup — configuration, never committed.
 *
 * ## The rule that shapes this file
 *
 * **Publishing must never make the catalogue write fail.** A merchant's product
 * update is not refused because the bus is unreachable. Three shapes were on the
 * table and only one satisfies that without trading it for a different lie:
 *
 * *Synchronous publish inside the request* — one 500 from the spine, or one slow
 * TLS handshake on a Lomé prepaid connection, and a merchant cannot save a
 * price. Rejected outright: it fails the rule.
 *
 * *Fire-and-forget* (`void post().catch(log)`) — never fails the write, and
 * loses the event on any blip. What is left is a log line in a stream nobody
 * watches and nothing to retry from. Eight consumers then wait for ever, which
 * is the exact failure this integration exists to end. "Contained" it is;
 * "visible" it is not.
 *
 * *An in-process retry queue* — better than nothing on a long-lived server, and
 * this is not one. `vercel.json` ships this app as serverless functions: the
 * process can be frozen or torn down the moment the response is flushed, so work
 * scheduled after the response has no guaranteed lifetime. A queue whose
 * durability depends on the platform not doing what the platform does is a
 * durability claim, not durability.
 *
 * *A durable outbox* — the row is written **in the same transaction as the
 * catalogue write it describes**, so the product and the fact about the product
 * commit together or neither does. The network is attempted afterwards and
 * separately. A failure is then a queued row rather than a lost answer, which is
 * the property `WAGateway/outbox.py` exists to preserve for replies and the same
 * property an event needs. That is the shape here.
 *
 * ## And it must not swallow a failure either
 *
 * `WAGateway/outbox.py` is also the source of the reporting, and of the mistake
 * worth not repeating: its predecessor returned `{sent, failed, remaining}` where
 * `remaining` was structurally always zero, so a dashboard read an empty backlog
 * while three replies sat queued. `DrainReport` below separates the states that
 * actually exist, and adds one that queue does not have:
 *
 *   - `sent`      — the spine took it
 *   - `retrying`  — the attempt failed and the allowance is not used up
 *   - `dead`      — the allowance is used up; a human is the next step
 *   - `blocked`   — nothing was attempted, because the *configuration* is
 *                   incomplete (no spine credentials, or a vendor with no spine
 *                   tenant). Kept apart from `retrying` on purpose: burning five
 *                   attempts against a missing config would write off a
 *                   perfectly good fact for a reason no retry can fix, and then
 *                   the backlog would drain itself into silence.
 *   - `remaining` — everything still queued afterwards, batch limit included
 *
 * A blocked row keeps `status: "queued"` and does **not** advance `attempts`, so
 * linking a vendor or supplying a token drains the backlog instead of stranding
 * it. `dead` rows stay in the table and stay counted, and going dead is logged
 * at error level: an event nobody was told about is how a consumer waits for
 * ever without anybody knowing.
 *
 * ## Configuration
 *
 *   SPINE_URL            e.g. http://127.0.0.1:8090   (absent → not configured)
 *   SPINE_PRODUCT_ID     default "wcatalog"
 *   SPINE_PRODUCT_TOKEN  minted per process by the spine at startup
 *   WA_WCATALOG_DISABLED "1" is the Article VII.4 killswitch
 *
 * Stub-first, like every other integration here: with no keys present the app
 * runs, the facts are still recorded, and nothing is sent. The killswitch stops
 * the *sending*, not the recording — refusing to write the fact down would lose
 * it, and the switch is meant to stop the product cleanly, not to erase what
 * happened while it was down.
 */

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import type { BusEventInput } from "@/lib/catalog-events";
import { CATALOG_PRODUCT_PUBLISHED, CATALOG_PRODUCT_UPDATED, CATALOG_PRICE_CHANGED, CATALOG_STOCK_DEPLETED, CATALOG_PRODUCT_DELETED } from "@/lib/catalog-events";

/**
 * Five attempts, then the event is dead and a human is the next step.
 * `WAGateway/outbox.py`'s number, kept deliberately: it is a judgement about how
 * long a downstream product should be blind, not a tuning knob.
 */
export const MAX_ATTEMPTS = 5;

export const QUEUED = "queued";
export const SENT = "sent";
export const DEAD = "dead";

/** How long one publish may take before it counts as a failed attempt. */
const PUBLISH_TIMEOUT_MS = 5000;

/** Bound the fan-out per drain pass, like every other cron job here. */
const DEFAULT_LIMIT = 100;

export type SpineConfig = {
  url: string;
  productId: string;
  token: string;
  configured: boolean;
};

export function spineConfig(): SpineConfig {
  const url = (process.env.SPINE_URL || "").trim().replace(/\/$/, "");
  const productId = (process.env.SPINE_PRODUCT_ID || "wcatalog").trim();
  const token = (process.env.SPINE_PRODUCT_TOKEN || "").trim();
  return { url, productId, token, configured: Boolean(url && token) };
}

/** Article VII.4 — read on every drain, inside this product's own process. */
export function busDisabled(): boolean {
  return process.env.WA_WCATALOG_DISABLED === "1";
}

export type DrainReport = {
  sent: number;
  retrying: number;
  dead: number;
  blocked: number;
  remaining: number;
  attempted: number;
  clear: boolean;
  disabled: boolean;
};

/**
 * Where a row lands after an attempt.
 *
 * `attemptsMade` counts this attempt. An event is only dead once it has
 * genuinely used its allowance — the off-by-one is the difference between five
 * tries and four.
 */
export function nextState(o: {
  attemptsMade: number;
  delivered: boolean;
  maxAttempts?: number;
}): typeof QUEUED | typeof SENT | typeof DEAD {
  if (o.delivered) return SENT;
  return o.attemptsMade >= (o.maxAttempts ?? MAX_ATTEMPTS) ? DEAD : QUEUED;
}

/**
 * Anything that can write the outbox: the client, or a transaction on it.
 * Callers pass `tx` from inside `prisma.$transaction` so the fact commits with
 * the write it describes.
 */
export type BusWriter = Pick<Prisma.TransactionClient, "busEvent">;

/** Record one fact. Does not touch the network. */
export async function enqueue(tx: BusWriter, input: BusEventInput): Promise<{ id: string }> {
  const row = await tx.busEvent.create({
    data: {
      type: input.type,
      vendorId: input.vendorId,
      subjectType: input.subjectType,
      subjectId: input.subjectId,
      data: (input.data ?? {}) as Prisma.InputJsonValue,
      correlationId: input.correlationId || "",
      actorType: input.actorType || "system",
      actorId: input.actorId || "",
    },
    select: { id: true },
  });
  return row;
}

/** Record several facts from one write. */
export async function enqueueMany(tx: BusWriter, inputs: BusEventInput[]): Promise<number> {
  for (const input of inputs) await enqueue(tx, input);
  return inputs.length;
}

type OutboxRow = {
  id: string;
  type: string;
  vendorId: string;
  subjectType: string;
  subjectId: string;
  data: Prisma.JsonValue;
  correlationId: string;
  actorType: string;
  actorId: string;
  occurredAt: Date;
  attempts: number;
};

type Attempt = { delivered: boolean; detail: string };

/**
 * One publish. The envelope's own fields — `event_id`, `published_at`,
 * `publisher`, `residency` — are the spine's to mint; this sends the fact and
 * the tenant it belongs to, and nothing it is not entitled to assert.
 *
 * The outbox row id travels as `Idempotency-Key`: the spine replays a recorded
 * response rather than re-applying, so a retry after a lost response does not
 * publish the same fact twice.
 */
async function publishOne(row: OutboxRow, tenantId: string, cfg: SpineConfig): Promise<Attempt> {
  try {
    const res = await fetch(`${cfg.url}/events`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Product-Id": cfg.productId,
        "X-Product-Token": cfg.token,
        "Idempotency-Key": row.id,
      },
      body: JSON.stringify({
        tenant_id: tenantId,
        type: row.type,
        subject_type: row.subjectType,
        subject_id: row.subjectId,
        data: row.data ?? {},
        correlation_id: row.correlationId || undefined,
        actor_type: row.actorType || "system",
        actor_id: row.actorId || cfg.productId,
        // A catalogue row is the merchant's own product data, not a person's.
        pii: false,
      }),
      signal: AbortSignal.timeout(PUBLISH_TIMEOUT_MS),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return { delivered: false, detail: `HTTP ${res.status} ${body.slice(0, 300)}`.trim() };
    }
    const syncSecret = (process.env.SOKO_SYNC_SECRET || "").trim();
    const sokoUrl = (process.env.SOKO_API_URL || "").trim().replace(/\/$/, "");
    const productEventTypes = new Set([CATALOG_PRODUCT_PUBLISHED, CATALOG_PRODUCT_UPDATED, CATALOG_PRICE_CHANGED, CATALOG_STOCK_DEPLETED, CATALOG_PRODUCT_DELETED]);
    if (syncSecret && sokoUrl && productEventTypes.has(row.type)) {
      const forwarded = await fetch(`${sokoUrl}/api/integrations/japora/product-events`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${syncSecret}`, "Idempotency-Key": row.id },
        body: JSON.stringify({ eventId: row.id, type: row.type, subjectId: row.subjectId, vendorId: row.vendorId, data: row.data, occurredAt: row.occurredAt.toISOString() }),
        signal: AbortSignal.timeout(PUBLISH_TIMEOUT_MS),
      }).catch(() => null);
      if (!forwarded?.ok) {
        const body = forwarded ? await forwarded.text().catch(() => "") : "Soko unavailable";
        return { delivered: false, detail: `Soko sync failed${forwarded ? ` HTTP ${forwarded.status}` : ""}: ${body.slice(0, 250)}` };
      }
    }
    return { delivered: true, detail: "" };
  } catch (e) {
    return { delivered: false, detail: String(e) };
  }
}

/**
 * Attempt every queued row, and report every state honestly.
 *
 * Never throws for a delivery reason. It is called from a cron route and,
 * best-effort, from write paths; a drain that threw would put the bus back in
 * the position of being able to break something it has no business breaking.
 */
export async function drainOutbox(opts: { limit?: number } = {}): Promise<DrainReport> {
  const limit = Math.max(1, Math.min(500, opts.limit ?? DEFAULT_LIMIT));
  const report: DrainReport = {
    sent: 0,
    retrying: 0,
    dead: 0,
    blocked: 0,
    remaining: 0,
    attempted: 0,
    clear: false,
    disabled: busDisabled(),
  };

  const pending = await prisma.busEvent.findMany({
    where: { status: QUEUED },
    orderBy: { createdAt: "asc" },
    take: limit,
    select: {
      id: true,
      type: true,
      vendorId: true,
      subjectType: true,
      subjectId: true,
      data: true,
      correlationId: true,
      actorType: true,
      actorId: true,
      occurredAt: true,
      attempts: true,
    },
  });

  const cfg = spineConfig();

  if (report.disabled) {
    // Not an attempt and not a failure. The switch is down on purpose; saying so
    // and reporting the backlog is the whole of what this pass owes anybody.
    report.blocked = pending.length;
    await note(pending, "WA_WCATALOG_DISABLED=1; not published");
    return finish(report);
  }

  if (!cfg.configured) {
    report.blocked = pending.length;
    await note(pending, "spine not configured (SPINE_URL / SPINE_PRODUCT_TOKEN)");
    if (pending.length) {
      logger.warn("bus.outbox.unconfigured", { queued: pending.length });
    }
    return finish(report);
  }

  // One lookup for the batch. A vendor with no spine tenant is a configuration
  // gap, not a delivery failure, and guessing an id would be the cross-tenant
  // leak the envelope's `tenant_id` exists to prevent.
  const vendorIds = [...new Set(pending.map((r) => r.vendorId))];
  const vendors = await prisma.vendor.findMany({
    where: { id: { in: vendorIds } },
    select: { id: true, spineTenantId: true },
  });
  const tenantOf = new Map(vendors.map((v) => [v.id, v.spineTenantId || ""]));

  for (const row of pending) {
    const tenantId = tenantOf.get(row.vendorId) || "";
    if (!tenantId) {
      report.blocked++;
      await note([row], "vendor has no spineTenantId; nothing to publish under");
      continue;
    }

    const attempts = row.attempts + 1;
    const result = await publishOne(row, tenantId, cfg);
    const status = nextState({ attemptsMade: attempts, delivered: result.delivered });

    await prisma.busEvent.update({
      where: { id: row.id },
      data: {
        status,
        attempts,
        lastError: result.detail.slice(0, 500),
        sentAt: status === SENT ? new Date() : null,
      },
    });

    if (status === SENT) {
      report.sent++;
    } else if (status === DEAD) {
      report.dead++;
      // Loud on purpose. This is the moment a consumer starts waiting for ever,
      // and it is the only moment anybody can still be told about it cheaply.
      logger.error("bus.outbox.dead", {
        id: row.id,
        type: row.type,
        vendorId: row.vendorId,
        subjectId: row.subjectId,
        attempts,
        error: result.detail.slice(0, 300),
      });
    } else {
      report.retrying++;
      logger.warn("bus.outbox.retrying", {
        id: row.id,
        type: row.type,
        attempts,
        error: result.detail.slice(0, 300),
      });
    }
  }

  return finish(report);
}

/** Record why nothing was attempted, without advancing the attempt count. */
async function note(rows: { id: string }[], reason: string): Promise<void> {
  if (!rows.length) return;
  await prisma.busEvent.updateMany({
    where: { id: { in: rows.map((r) => r.id) }, status: QUEUED },
    data: { lastError: reason },
  });
}

async function finish(report: DrainReport): Promise<DrainReport> {
  // Asked of the table rather than inferred from this pass: rows the batch limit
  // never reached are still waiting, and a caller reading `remaining` is asking
  // about the backlog, not about the batch.
  report.remaining = await prisma.busEvent.count({ where: { status: QUEUED } });
  report.attempted = report.sent + report.retrying + report.dead;
  report.clear = report.remaining === 0;
  return report;
}

/** What is waiting, and what has been given up on. The question a probe asks. */
export async function outboxBacklog(): Promise<{ queued: number; dead: number }> {
  const [queued, dead] = await Promise.all([
    prisma.busEvent.count({ where: { status: QUEUED } }),
    prisma.busEvent.count({ where: { status: DEAD } }),
  ]);
  return { queued, dead };
}

/**
 * Start a drain without waiting for it, from a write path.
 *
 * An optimisation and nothing more: the row is already durable, so a kick that
 * the serverless runtime kills mid-flight costs a few seconds of latency on one
 * event, not the event. It can never reject — an unhandled rejection from a
 * best-effort helper would take down a process that was doing fine.
 */
export function kickDrain(limit = 25): void {
  void drainOutbox({ limit }).catch((e) => {
    logger.warn("bus.outbox.kick_failed", { error: String(e) });
  });
}
