import type Stripe from "stripe";
import { logger } from "./logger";

/**
 * Stripe SDK loaded lazily. Install with: pnpm add stripe.
 * Until then, billing endpoints return a friendly "not configured" message.
 *
 * Required env vars to go live:
 *   STRIPE_SECRET_KEY        sk_test_... (or sk_live_...)
 *   STRIPE_WEBHOOK_SECRET    whsec_... (Stripe dashboard → webhooks)
 *   STRIPE_PRICE_ID          price_... (the monthly subscription price)
 */

let cachedClient: Stripe | null = null;
let cachedLoadFailed = false;

async function loadStripe(): Promise<Stripe | null> {
  if (cachedClient) return cachedClient;
  if (cachedLoadFailed) return null;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  try {
    const StripeMod = (await import("stripe")) as unknown as {
      default?: new (k: string, o?: { apiVersion?: string }) => Stripe;
    };
    const Ctor = StripeMod.default ?? (StripeMod as unknown as new (k: string) => Stripe);
    cachedClient = new Ctor(key, { apiVersion: "2024-12-18.acacia" });
    return cachedClient;
  } catch (e) {
    cachedLoadFailed = true;
    logger.error("stripe.load_failed", {
      error: e instanceof Error ? e.message : String(e),
      hint: "Run: pnpm add stripe",
    });
    return null;
  }
}

export async function getStripe(): Promise<Stripe | null> {
  return loadStripe();
}

export function billingMode(): "live" | "stub" {
  return process.env.STRIPE_SECRET_KEY ? "live" : "stub";
}

export function priceDisplay(): string {
  return process.env.NEXT_PUBLIC_STRIPE_PRICE_DISPLAY || "$9/month";
}
