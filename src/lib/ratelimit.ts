import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

/**
 * In-process sliding-window rate limiter. Good for single-instance MVPs.
 *
 * Upgrade path to multi-instance: swap `store` for Upstash Redis or Vercel KV
 * (`@upstash/ratelimit` is a drop-in). The function signature stays the same.
 *
 * Keys are caller-defined — typically `${endpoint}:${ip}` or
 * `${endpoint}:${vendorId}` — so the same store handles every endpoint.
 */

type Bucket = { count: number; resetAt: number };

const store = new Map<string, Bucket>();
let lastGc = 0;

function maybeGc(now: number) {
  // Cheap periodic cleanup so the map doesn't grow unbounded.
  if (now - lastGc < 60_000) return;
  lastGc = now;
  for (const [k, b] of store) {
    if (b.resetAt < now) store.delete(k);
  }
}

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  retryAfterSeconds?: number;
};

export function rateLimit(opts: {
  key: string;
  limit: number;
  windowMs: number;
}): RateLimitResult {
  const now = Date.now();
  maybeGc(now);

  const existing = store.get(opts.key);
  if (!existing || existing.resetAt < now) {
    const fresh = { count: 1, resetAt: now + opts.windowMs };
    store.set(opts.key, fresh);
    return { allowed: true, remaining: opts.limit - 1, resetAt: fresh.resetAt };
  }

  if (existing.count >= opts.limit) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: existing.resetAt,
      retryAfterSeconds: Math.ceil((existing.resetAt - now) / 1000),
    };
  }

  existing.count++;
  return {
    allowed: true,
    remaining: opts.limit - existing.count,
    resetAt: existing.resetAt,
  };
}

/** Best-effort client IP. Trusts the first X-Forwarded-For value (set by your proxy/CDN). */
export function getClientIp(req: NextRequest): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  const real = req.headers.get("x-real-ip");
  if (real) return real;
  return "unknown";
}

/** Convenience: 429 response with Retry-After + rate-limit headers. */
export function tooManyRequests(result: RateLimitResult, message = "Too many requests.") {
  const headers = new Headers({
    "Retry-After": String(result.retryAfterSeconds ?? 60),
    "X-RateLimit-Remaining": "0",
    "X-RateLimit-Reset": String(Math.floor(result.resetAt / 1000)),
  });
  return NextResponse.json({ error: message }, { status: 429, headers });
}
