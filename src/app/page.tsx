import { getCurrentVendor } from "@/lib/auth";
import { redirect } from "next/navigation";
import { listShops } from "@/lib/directory";
import LandingClient from "./LandingClient";

/**
 * Aurora landing — server entry point fetching live featured shops
 * and delegating rendering to the bilingual LandingClient.
 */
export default async function LandingPage() {
  const vendor = await getCurrentVendor();
  if (vendor) redirect("/dashboard");

  let featuredShops: Awaited<ReturnType<typeof listShops>> = [];
  try {
    featuredShops = await listShops({ take: 6 });
  } catch (e) {
    console.warn("Could not list shops on homepage", e);
  }

  return <LandingClient featuredShops={featuredShops} />;
}
