import { NextRequest, NextResponse } from "next/server";
import { getCurrentVendor } from "@/lib/auth";
import { getStripe } from "@/lib/stripe";
import { appUrl } from "@/lib/token";
import { logger } from "@/lib/logger";
import { getServerTr } from "@/lib/public-locale";

/**
 * Stripe's hosted Customer Portal — handles card updates, cancellations,
 * receipts. Just give the user a one-tap link to it.
 */
export async function POST(_req: NextRequest) {
  const tr = await getServerTr();
  const vendor = await getCurrentVendor();
  if (!vendor) return NextResponse.json({ error: tr("Veuillez vous connecter.", "Please sign in.") }, { status: 401 });

  if (!vendor.stripeCustomerId) {
    return NextResponse.json(
      { error: tr("Pas encore de client Stripe : démarrez d'abord un abonnement.", "No Stripe customer yet — start a subscription first.") },
      { status: 400 },
    );
  }

  const stripe = await getStripe();
  if (!stripe) {
    return NextResponse.json({ error: tr("La facturation n'est pas configurée.", "Billing is not configured.") }, { status: 503 });
  }

  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: vendor.stripeCustomerId,
      return_url: appUrl("/dashboard/billing"),
    });
    return NextResponse.json({ url: session.url });
  } catch (e) {
    logger.error("billing.portal_failed", {
      vendorId: vendor.id,
      error: e instanceof Error ? e.message : String(e),
    });
    return NextResponse.json({ error: tr("Impossible d'ouvrir l'espace de facturation.", "Could not open billing portal.") }, { status: 502 });
  }
}
