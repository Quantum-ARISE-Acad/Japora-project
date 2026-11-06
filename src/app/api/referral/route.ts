import { NextResponse } from "next/server";
import { getCurrentVendor } from "@/lib/auth";
import {
  ensureReferralCode,
  listReferrals,
  rewardCount,
} from "@/lib/referral";

export async function GET() {
  const vendor = await getCurrentVendor();
  if (!vendor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const referralCode = await ensureReferralCode(vendor.id);
  const base = (process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "");
  const shareUrl = `${base}/signup?ref=${referralCode}`;

  const [referrals, qualified] = await Promise.all([
    listReferrals(vendor.id),
    rewardCount(vendor.id),
  ]);

  return NextResponse.json({
    referralCode,
    shareUrl,
    referrals,
    rewardCount: qualified,
  });
}
