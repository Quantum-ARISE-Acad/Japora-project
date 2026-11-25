import { getCurrentVendor } from "@/lib/auth";
import { listShops } from "@/lib/directory";
import { PRICING, PRICING_FEE_PERCENT, PRICING_KEEP_PERCENT } from "@/lib/billing";
import { formatMoney } from "@/lib/utils";
import LandingClient from "./LandingClient";
import type { PricingFacts } from "@/components/landing/PricingPreview";

export const dynamic = "force-dynamic";

/** A sale at roughly the launch market's average order value. */
const EXAMPLE_ORDER_CENTS = 800_000;

/**
 * Aurora landing — server entry point fetching live featured shops
 * and delegating rendering to the bilingual LandingClient.
 *
 * Money is formatted here rather than in the client tree: Intl resolves a
 * different locale on the server than in the browser, and a price that changes
 * on hydration is both a React warning and a trust problem on a pricing block.
 */
export default async function LandingPage() {
  const vendor = await getCurrentVendor();

  let featuredShops: Awaited<ReturnType<typeof listShops>> = [];
  try {
    featuredShops = await listShops({ take: 6 });
  } catch (e) {
    console.warn("Could not list shops on homepage", e);
  }

  const cur = PRICING.displayCurrency;
  const pricing: PricingFacts = {
    feePercent: PRICING_FEE_PERCENT,
    keepPercent: PRICING_KEEP_PERCENT,
    floor: formatMoney(PRICING.freeBelowCents, cur),
    cap: formatMoney(PRICING.feeCapCents, cur),
    exampleOrder: formatMoney(EXAMPLE_ORDER_CENTS, cur),
    exampleFee: formatMoney(
      Math.min(
        Math.round(EXAMPLE_ORDER_CENTS * PRICING.proRatePct),
        PRICING.feeCapCents
      ),
      cur
    ),
  };

  return (
    <LandingClient
      featuredShops={featuredShops}
      isAuthenticated={Boolean(vendor)}
      shopSlug={vendor?.shopSlug}
      pricing={pricing}
    />
  );
}
