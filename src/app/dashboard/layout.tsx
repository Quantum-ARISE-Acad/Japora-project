import { redirect } from "next/navigation";
import { getCurrentVendor } from "@/lib/auth";
import { parseUiPrefs, uiPrefsToCssVars } from "@/lib/uiPrefs";
import DashboardShell from "./DashboardShell";
import UnverifiedBanner from "./UnverifiedBanner";
import LiveOrderNotifier from "@/components/LiveOrderNotifier";
import ShopOnboardingModal from "@/components/ShopOnboardingModal";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const vendor = await getCurrentVendor();
  if (!vendor) redirect("/login");

  // Apply the vendor's Aurora customization at the dashboard root. Children
  // inherit the CSS custom properties — every component that references
  // `var(--aurora-dur-short)` etc. reskins automatically.
  const prefs = parseUiPrefs(vendor.uiPrefs);
  const style = uiPrefsToCssVars(prefs) as React.CSSProperties;

  // OTP vendors carry a placeholder wa_*@japora.local email — don't nag them to
  // verify an address they never gave us.
  const hasRealEmail = Boolean(vendor.email) && !vendor.email.endsWith("@japora.local");

  return (
    <div className="min-h-screen" style={style}>
      {hasRealEmail && !vendor.emailVerifiedAt && <UnverifiedBanner email={vendor.email} />}
      <LiveOrderNotifier currency={vendor.currency || "XOF"} />
      <ShopOnboardingModal
        initial={{
          shopName: vendor.shopName,
          shopSlug: vendor.shopSlug,
          tagline: vendor.tagline || "",
          whatsappNumber: vendor.whatsappNumber || "",
          momoNumber: vendor.momoNumber || "",
          currency: vendor.currency || "XOF",
          language: vendor.language || "fr",
          region: vendor.region || "lome",
          category: vendor.category || "fashion",
          bio: vendor.bio || "",
          avatarUrl: vendor.avatarUrl || "",
          email: vendor.email,
          needsOnboarding: !vendor.onboardedAt,
        }}
      />
      <DashboardShell
        shopName={vendor.shopName}
        shopSlug={vendor.shopSlug}
        avatarUrl={vendor.avatarUrl || ""}
      >
        {children}
      </DashboardShell>
    </div>
  );
}
