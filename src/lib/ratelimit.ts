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

/**
 * Read a positive integer from the environment (e.g. SIGNUP_RATE_LIMIT=500),
 * falling back to `fallback` when unset or invalid. Lets an event (a fair, a
 * shared Wi-Fi) raise a limit without a code change.
 */
export function envLimit(name: string, fallback: number): number {
  const n = Number.parseInt(process.env[name] ?? "", 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/** Cookie set by the middleware so each browser is counted separately. */
export const VISITOR_COOKIE = "jp_vid";

function shortHash(input: string): string {
  // FNV-1a — non-cryptographic, only used to bucket anonymous visitors.
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

/**
 * Best-effort client identity for rate limiting. Uses the proxy/CDN headers
 * when present. Without any (e.g. `next start` behind no proxy) the old code
 * returned "unknown" for EVERYONE, so one counter was shared by all visitors.
 * We now fall back to a fingerprint of the browser (user-agent + language) so
 * visitors are told apart instead of sharing a single bucket.
 */
export function getClientIp(req: NextRequest): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0].trim();
    if (first) return first;
  }
  const real = req.headers.get("x-real-ip") || req.headers.get("cf-connecting-ip");
  if (real) return real;
  // No proxy header: use the visitor cookie set by the middleware (one per
  // browser), then, for a very first request, a browser fingerprint.
  const vid = req.cookies?.get?.(VISITOR_COOKIE)?.value;
  if (vid && /^[A-Za-z0-9-]{8,64}$/.test(vid)) return `vid-${vid}`;
  const ua = req.headers.get("user-agent") || "";
  const lang = req.headers.get("accept-language") || "";
  if (!ua && !lang) return "unknown";
  return `anon-${shortHash(`${ua}|${lang}`)}`;
}

/** Convenience: 429 response with Retry-After + rate-limit headers. */
export function tooManyRequests(result: RateLimitResult, message = "Trop de requêtes. Réessayez dans un instant.") {
  const headers = new Headers({
    "Retry-After": String(result.retryAfterSeconds ?? 60),
    "X-RateLimit-Remaining": "0",
    "X-RateLimit-Reset": String(Math.floor(result.resetAt / 1000)),
  });
  return NextResponse.json({ error: message }, { status: 429, headers });
}
