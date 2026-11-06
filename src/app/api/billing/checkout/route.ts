import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentVendor } from "@/lib/auth";
import { getStripe } from "@/lib/stripe";
import { appUrl } from "@/lib/token";
import { logger } from "@/lib/logger";

export async function POST(_req: NextRequest) {
  const vendor = await getCurrentVendor();
  if (!vendor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const priceId = process.env.STRIPE_PRICE_ID;
  if (!priceId) {
    return NextResponse.json(
      { error: "Billing is not configured. Set STRIPE_SECRET_KEY + STRIPE_PRICE_ID." },
      { status: 503 },
    );
  }

  const stripe = await getStripe();
  if (!stripe) {
    return NextResponse.json(
      { error: "Stripe SDK is not installed. Run: pnpm add stripe" },
      { status: 503 },
    );
  }

  try {
    // Ensure a Stripe customer exists for this vendor.
    let customerId = vendor.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: vendor.email,
        name: vendor.shopName,
        metadata: { vendorId: vendor.id, shopSlug: vendor.shopSlug },
      });
      customerId = customer.id;
      await prisma.vendor.update({
        where: { id: vendor.id },
        data: { stripeCustomerId: customerId },
      });
    }

    // If the vendor is still in their free trial, honor that on the
    // subscription so the first charge lands when the trial ends.
    const trialEnd =
      vendor.trialEndsAt && vendor.trialEndsAt > new Date()
        ? Math.floor(vendor.trialEndsAt.getTime() / 1000)
        : undefined;

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      subscription_data: trialEnd ? { trial_end: trialEnd } : undefined,
      success_url: appUrl("/dashboard/billing?ok=1"),
      cancel_url: appUrl("/dashboard/billing?canceled=1"),
      allow_promotion_codes: true,
      billing_address_collection: "auto",
    });

    return NextResponse.json({ url: session.url });
  } catch (e) {
    logger.error("billing.checkout_failed", {
      vendorId: vendor.id,
      error: e instanceof Error ? e.message : String(e),
    });
    return NextResponse.json({ error: "Could not start checkout." }, { status: 502 });
  }
}
