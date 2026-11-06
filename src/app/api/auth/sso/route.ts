import { NextRequest, NextResponse } from "next/server";
import {
  WATARU_SSO_COOKIE,
  verifyUnifiedToken,
  syncUnifiedVendor,
  createSsoTicket,
  setUnifiedCookie,
} from "@/lib/unified-auth";
import { createSession } from "@/lib/session";
import { getCurrentVendor } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const ticket = searchParams.get("ticket");
  const redirectUrl = searchParams.get("redirect") || "/dashboard";
  const format = searchParams.get("format");

  // 1. Check ticket in query param or cookie wataru_sso
  const cookieToken = req.cookies.get(WATARU_SSO_COOKIE)?.value;
  const tokenToVerify = ticket || cookieToken;

  if (!tokenToVerify) {
    if (format === "json") {
      return NextResponse.json({ error: "No ticket or unified session found" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/login?error=no_session", req.url));
  }

  const payload = await verifyUnifiedToken(tokenToVerify);
  if (!payload || !payload.email) {
    if (format === "json") {
      return NextResponse.json({ error: "Invalid or expired SSO token" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/login?error=invalid_sso", req.url));
  }

  // 2. Synchronize or provision the Vendor
  try {
    const vendor = await syncUnifiedVendor(payload);
    await createSession({ vendorId: vendor.id, email: vendor.email });
    await setUnifiedCookie({
      sub: vendor.email,
      email: vendor.email,
      name: vendor.shopName,
      phone: vendor.phone || vendor.whatsappNumber || undefined,
      role: "VENDOR",
      originApp: "japora",
    });

    if (format === "json") {
      return NextResponse.json({
        ok: true,
        vendor: {
          id: vendor.id,
          name: vendor.shopName,
          email: vendor.email,
          slug: vendor.shopSlug,
        },
      });
    }

    return NextResponse.redirect(new URL(redirectUrl, req.url));
  } catch (err: any) {
    console.error("[SSO Japora error]", err);
    if (format === "json") {
      return NextResponse.json({ error: err.message || "SSO error" }, { status: 500 });
    }
    return NextResponse.redirect(new URL("/login?error=sso_failed", req.url));
  }
}

// POST endpoint to generate an SSO ticket to switch to WEscrow or Soko CRM
export async function POST(_req: NextRequest) {
  try {
    const vendor = await getCurrentVendor();
    if (!vendor) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const ticket = await createSsoTicket({
      sub: vendor.email,
      email: vendor.email,
      name: vendor.shopName,
      phone: vendor.phone || vendor.whatsappNumber || undefined,
      role: "VENDOR",
      originApp: "japora",
    });

    return NextResponse.json({ ok: true, ticket });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to issue ticket" }, { status: 500 });
  }
}
