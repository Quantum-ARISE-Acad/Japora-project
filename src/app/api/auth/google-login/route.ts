import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createSession } from "@/lib/session";
import { setUnifiedCookie } from "@/lib/unified-auth";
import { slugify } from "@/lib/utils";
import { hashPassword } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const email = String(body?.email || "google.vendor@wataru.app").trim().toLowerCase();
    const name = String(body?.name || "Google Merchant").trim();
    const shopName = String(body?.shopName || `${name}'s Boutique`).trim();
    const currency = String(body?.currency || "XOF");
    const isSignUp = Boolean(body?.isSignUp);

    let vendor = await prisma.vendor.findUnique({ where: { email } });

    if (!vendor) {
      const base = slugify(shopName) || "google-shop";
      let shopSlug = base;
      let n = 1;
      while (await prisma.vendor.findUnique({ where: { shopSlug } })) {
        shopSlug = `${base}-${n++}`;
      }

      const now = new Date();
      const trialEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

      vendor = await prisma.vendor.create({
        data: {
          email,
          passwordHash: await hashPassword("google_oauth_placeholder_" + Date.now()),
          shopName,
          shopSlug,
          currency,
          language: "fr",
          subscriptionStatus: "trialing",
          trialEndsAt: trialEnd,
          emailVerifiedAt: now,
          onboardedAt: null,
        },
      });
    } else if (isSignUp) {
      // When testing Google sign-up, reset onboardedAt so the onboarding popup triggers
      vendor = await prisma.vendor.update({
        where: { id: vendor.id },
        data: { onboardedAt: null },
      });
    }

    await createSession({
      vendorId: vendor.id,
      email: vendor.email,
    });

    await setUnifiedCookie({
      sub: vendor.email,
      email: vendor.email,
      name: vendor.shopName || name,
      role: "VENDOR",
      originApp: "japora",
    });

    return NextResponse.json({
      ok: true,
      redirectUrl: "/dashboard",
      vendor: {
        id: vendor.id,
        email: vendor.email,
        shopName: vendor.shopName,
        shopSlug: vendor.shopSlug,
      },
    });
  } catch (err: any) {
    console.error("[google-login error]", err);
    return NextResponse.json({ error: err.message || "Google login failed" }, { status: 500 });
  }
}
