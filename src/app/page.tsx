import { getCurrentVendor } from "@/lib/auth";
import { listShops } from "@/lib/directory";
import LandingClient from "./LandingClient";

export const dynamic = "force-dynamic";

/**
 * Aurora landing — server entry point fetching live featured shops
 * and delegating rendering to the bilingual LandingClient.
 */
export default async function LandingPage() {
  const vendor = await getCurrentVendor();

  let featuredShops: Awaited<ReturnType<typeof listShops>> = [];
  try {
    featuredShops = await listShops({ take: 6 });
  } catch (e) {
    console.warn("Could not list shops on homepage", e);
  }

  return (
    <LandingClient
      featuredShops={featuredShops}
      isAuthenticated={Boolean(vendor)}
      shopSlug={vendor?.shopSlug}
    />
  );
}
