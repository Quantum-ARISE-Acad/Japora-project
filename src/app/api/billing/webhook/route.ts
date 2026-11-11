import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getStripe } from "@/lib/stripe";
import { logger } from "@/lib/logger";

/**
 * Stripe webhook handler. Verifies signature, then keeps the Vendor row in
 * sync with subscription lifecycle events. We update by Stripe customer ID,
 * which is the join key set during checkout.
 *
 * Configure in Stripe dashboard → Webhooks → endpoint
 *   <NEXT_PUBLIC_APP_URL>/api/billing/webhook
 * Events to send (minimum):
 *   customer.subscription.created
 *   customer.subscription.updated
 *   customer.subscription.deleted
 *   invoice.payment_succeeded
 *   invoice.payment_failed
 */
export async function POST(req: NextRequest) {
  const stripe = await getStripe();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !secret) {
    logger.warn("billing.webhook.not_configured");
    return NextResponse.json({ error: "Billing not configured" }, { status: 503 });
  }

  const sig = req.headers.get("stripe-signature");
  const rawBody = await req.text();
  if (!sig) return NextResponse.json({ error: "Missing signature" }, { status: 400 });

  let event: { type: string; data: { object: unknown } };
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, secret);
  } catch (e) {
    logger.warn("billing.webhook.bad_signature", {
      error: e instanceof Error ? e.message : String(e),
    });
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    await handleEvent(event.type, event.data.object);
  } catch (e) {
    logger.error("billing.webhook.handler_failed", {
      type: event.type,
      error: e instanceof Error ? e.message : String(e),
    });
    // Return 200 so Stripe doesn't retry-storm on a recurring bug; the error
    // is in our logs to investigate. (Flip to 500 if you want Stripe retries.)
  }

  return NextResponse.json({ received: true });
}

type SubLike = {
  id?: string;
  customer?: string;
  status?: string;
  current_period_end?: number;
  trial_end?: number | null;
};

type InvoiceLike = {
  customer?: string;
  subscription?: string;
  status?: string;
};

async function handleEvent(type: string, raw: unknown) {
  switch (type) {
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const sub = raw as SubLike;
      if (!sub.customer) return;
      const updates: Record<string, unknown> = {
        stripeSubscriptionId: sub.id ?? null,
        subscriptionStatus: type === "customer.subscription.deleted" ? "canceled" : sub.status ?? "unknown",
      };
      if (sub.current_period_end) {
        updates.currentPeriodEnd = new Date(sub.current_period_end * 1000);
      }
      if (sub.trial_end) {
        updates.trialEndsAt = new Date(sub.trial_end * 1000);
      }
      await prisma.vendor.updateMany({
        where: { stripeCustomerId: sub.customer },
        data: updates,
      });
      logger.info("billing.webhook.subscription_updated", {
        type,
        customer: sub.customer,
        status: updates.subscriptionStatus,
      });
      break;
    }
    case "invoice.payment_succeeded": {
      // currentPeriodEnd is also updated via subscription.updated; this is a
      // safety net in case Stripe sends invoice events before subscription ones.
      const inv = raw as InvoiceLike;
      if (!inv.customer) return;
      await prisma.vendor.updateMany({
        where: { stripeCustomerId: inv.customer },
        data: { subscriptionStatus: "active" },
      });
      break;
    }
    case "invoice.payment_failed": {
      const inv = raw as InvoiceLike;
      if (!inv.customer) return;
      await prisma.vendor.updateMany({
        where: { stripeCustomerId: inv.customer },
        data: { subscriptionStatus: "past_due" },
      });
      logger.warn("billing.webhook.payment_failed", { customer: inv.customer });
      break;
    }
    default:
      logger.debug("billing.webhook.ignored", { type });
  }
}
