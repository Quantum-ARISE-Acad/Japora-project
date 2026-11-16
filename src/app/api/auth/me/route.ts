import { NextResponse } from "next/server";
import { getCurrentVendor } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const vendor = await getCurrentVendor();
    if (!vendor) {
      return NextResponse.json({ authenticated: false }, { status: 200 });
    }
    return NextResponse.json({
      authenticated: true,
      vendorId: vendor.id,
      email: vendor.email,
      shopName: vendor.shopName,
      shopSlug: vendor.shopSlug,
    });
  } catch {
    return NextResponse.json({ authenticated: false }, { status: 200 });
  }
}

