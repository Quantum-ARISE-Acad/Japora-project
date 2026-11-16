import { requireVendor } from "@/lib/auth";
import { isLiveMode } from "@/lib/whatsapp";
import { storageMode } from "@/lib/storage";
import { ensureReferralCode, rewardCount } from "@/lib/referral";
import { getCooperativeForVendor } from "@/lib/cooperative";
import { verificationProgress, evaluateAndGrant } from "@/lib/trust";
import SettingsForm from "./SettingsForm";
import AuroraCustomization from "./AuroraCustomization";
import AwayHoursCard from "./AwayHoursCard";
import CooperativeCard from "./CooperativeCard";
import VerifiedShopCard from "./VerifiedShopCard";

import ShopThemeCard from "./ShopThemeCard";

export default async function SettingsPage() {
  const vendor = await requireVendor();

  // Make sure the vendor has a referralCode before we render — old accounts
  // pre-dating the program won't have one.
  let referralCode = vendor.referralCode || "";
  if (!referralCode) {
    try {
      referralCode = await ensureReferralCode(vendor.id);
    } catch {
      referralCode = "";
    }
  }
  const qualifiedReferrals = await rewardCount(vendor.id).catch(() => 0);

  // Lazily re-check verified-shop criteria on settings load, then read progress.
  await evaluateAndGrant(vendor.id).catch(() => {});
  const verification = await verificationProgress(vendor.id).catch(() => ({
    verified: false,
    verifiedAt: null,
    phoneVerified: false,
    paidOrders: 0,
    paidOrdersNeeded: 3,
  }));

  const cooperative = await getCooperativeForVendor(vendor.id).catch(() => null);
  const coopDto = cooperative
    ? {
        ...cooperative,
        members: cooperative.members.map((m) => ({
          ...m,
          createdAt: m.createdAt.toISOString(),
        })),
      }
    : null;

  return (
    <div className="space-y-6">
      <VerifiedShopCard progress={verification} />
      <CooperativeCard cooperative={coopDto} />
      <AwayHoursCard
        initial={{
          awayMessage: vendor.awayMessage,
          businessHours:
            vendor.businessHours && typeof vendor.businessHours === "object"
              ? (vendor.businessHours as Record<string, unknown>)
              : {},
        }}
      />
      <ShopThemeCard shopSlug={vendor.shopSlug} />
      <AuroraCustomization initial={vendor.uiPrefs} />
      <SettingsForm
      initial={{
        shopName: vendor.shopName,
        shopSlug: vendor.shopSlug,
        tagline: vendor.tagline,
        whatsappNumber: vendor.whatsappNumber,
        momoNumber: vendor.momoNumber,
        currency: vendor.currency,
        email: vendor.email,
        region: vendor.region || "",
        category: vendor.category || "",
        language: vendor.language || "en",
        bio: vendor.bio || "",
        avatarUrl: vendor.avatarUrl || "",
        isPublic: vendor.isPublic,
        wholesaleEnabled: vendor.wholesaleEnabled,
        deliveryEnabled: vendor.deliveryEnabled,
        deliveryFeeCents: vendor.deliveryFeeCents,
        deliveryZones: vendor.deliveryZones,
        referralCode,
        qualifiedReferrals,
      }}
      whatsappLive={isLiveMode(vendor)}
      storageMode={storageMode()}
    />
    </div>
  );
}
