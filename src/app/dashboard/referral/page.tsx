import { requireVendor } from "@/lib/auth";
import {
  ensureReferralCode,
  listReferrals,
  rewardCount,
} from "@/lib/referral";
import ReferralClient from "./ReferralClient";

export default async function ReferralPage() {
  const vendor = await requireVendor();

  const referralCode = await ensureReferralCode(vendor.id);
  const base = (process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "");
  const shareUrl = `${base}/signup?ref=${encodeURIComponent(referralCode)}`;

  const [referrals, qualified] = await Promise.all([
    listReferrals(vendor.id),
    rewardCount(vendor.id),
  ]);

  const dto = referrals.map((r) => ({
    id: r.id,
    status: r.status,
    createdAt: r.createdAt.toISOString(),
    rewardedAt: r.rewardedAt ? r.rewardedAt.toISOString() : null,
    referee: r.referee
      ? {
          shopName: r.referee.shopName,
          email: r.referee.email,
          createdAt: r.referee.createdAt.toISOString(),
        }
      : null,
  }));

  return (
    <ReferralClient
      referralCode={referralCode}
      shareUrl={shareUrl}
      referrals={dto}
      rewardCount={qualified}
      shopName={vendor.shopName}
    />
  );
}
