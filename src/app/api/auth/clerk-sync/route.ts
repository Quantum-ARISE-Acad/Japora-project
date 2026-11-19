import { errorMessage } from "@/lib/errors";
import { NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { createSession } from "@/lib/session";
import { resolveOrProvisionClerkVendor } from "@/lib/auth";
import { getServerTr } from "@/lib/public-locale";

export async function POST(req: Request) {
  const tr = await getServerTr();
  try {
    const clerkAuth = await auth();
    if (!clerkAuth?.userId) {
      return NextResponse.json({ error: tr("Veuillez vous connecter.", "Please sign in.") }, { status: 401 });
    }

    const clerkUser = await currentUser();
    if (!clerkUser || clerkUser.id !== clerkAuth.userId) {
      return NextResponse.json({ error: tr("Veuillez vous connecter.", "Please sign in.") }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const hints = {
      name: typeof body?.name === "string" ? body.name : "",
      shopName: typeof body?.shopName === "string" ? body.shopName : "",
      whatsappNumber: typeof body?.whatsappNumber === "string" ? body.whatsappNumber : "",
      currency: typeof body?.currency === "string" ? body.currency : "",
      category: typeof body?.category === "string" ? body.category : "",
    };

    const vendor = await resolveOrProvisionClerkVendor(clerkAuth.userId, clerkUser, hints);
    if (!vendor) {
      return NextResponse.json(
        { error: tr("Impossible de trouver un e-mail ou un téléphone vérifié pour ce compte Clerk.", "Unable to resolve a verified email or phone identity for this Clerk user.") },
        { status: 400 },
      );
    }

    // Establish session cookie so dashboard and all existing APIs work seamlessly
    await createSession({
      vendorId: vendor.id,
      email: vendor.email,
    });

    return NextResponse.json({
      ok: true,
      role: "seller",
      vendorId: vendor.id,
      shopSlug: vendor.shopSlug,
    });
  } catch (err) {
    console.error("[clerk-sync error]", err);
    return NextResponse.json({ error: errorMessage(err, "Sync failed") }, { status: 500 });
  }
}
