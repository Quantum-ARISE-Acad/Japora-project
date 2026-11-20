import { NextRequest, NextResponse } from "next/server";
import { getCurrentVendor } from "@/lib/auth";
import { issueVerificationEmail } from "@/lib/verification";
import { rateLimit, tooManyRequests } from "@/lib/ratelimit";
import { getServerTr } from "@/lib/public-locale";

export async function POST(_req: NextRequest) {
  const tr = await getServerTr();
  const vendor = await getCurrentVendor();
  if (!vendor) return NextResponse.json({ error: tr("Veuillez vous connecter.", "Please sign in.") }, { status: 401 });
  if (vendor.emailVerifiedAt) return NextResponse.json({ ok: true, already: true });

  const rl = rateLimit({
    key: `verify-resend:${vendor.id}`,
    limit: 3,
    windowMs: 60 * 60_000,
  });
  if (!rl.allowed) {
    return tooManyRequests(rl, "Please wait before requesting another verification email.");
  }

  const issued = await issueVerificationEmail(vendor);
  return NextResponse.json({
    ok: true,
    verifyUrl: process.env.NODE_ENV !== "production" ? issued.verifyUrl : undefined,
  });
}
