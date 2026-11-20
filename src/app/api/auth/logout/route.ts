import { NextResponse } from "next/server";
import { destroySession, getSession } from "@/lib/session";
import { clearUnifiedCookie } from "@/lib/unified-auth";
import { recordVendorActivity } from "@/lib/clerk-vendor-sync";

export async function POST() {
  const session = await getSession().catch(() => null);
  if (session?.vendorId) {
    await recordVendorActivity({
      vendorId: session.vendorId,
      type: "auth.session.logout",
      subjectType: "vendor",
      subjectId: session.vendorId,
      data: { email: session.email },
    });
  }
  await destroySession();
  await clearUnifiedCookie();
  return NextResponse.json({ ok: true });
}
