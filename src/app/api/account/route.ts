import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentVendor } from "@/lib/auth";
import { destroySession } from "@/lib/session";
import { logger } from "@/lib/logger";
import { getServerTr } from "@/lib/public-locale";

/**
 * Soft-delete the current vendor's account. We keep the row (so we can honour
 * tax/dispute obligations) but mark it deleted and anonymise the email so it
 * can be re-registered. Session is cleared so the user is signed out.
 *
 * NOT a hard delete — the GDPR "right to erasure" still applies, but giving a
 * 12-month tombstone is a defensible interpretation and is documented in the
 * Privacy Policy. Hard-delete the row from your DB once the window passes.
 */
export async function DELETE(req: NextRequest) {
  const tr = await getServerTr();
  const vendor = await getCurrentVendor();
  if (!vendor) return NextResponse.json({ error: tr("Veuillez vous connecter.", "Please sign in.") }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  // Belt-and-braces: require the user to type their shop name to confirm.
  if (String(body?.confirm || "") !== vendor.shopName) {
    return NextResponse.json(
      { error: tr("Pour confirmer, tapez exactement le nom de votre boutique.", "To confirm, type your shop name exactly.") },
      { status: 400 },
    );
  }

  const oldSlug = vendor.shopSlug;
  const tombstoneEmail = `deleted_${vendor.id}@deleted.local`;
  const tombstoneSlug = `deleted-${vendor.id}`;

  if (vendor.clerkId && process.env.CLERK_SECRET_KEY) {
    try {
      const { clerkClient } = await import("@clerk/nextjs/server");
      const client = await clerkClient();
      await client.users.deleteUser(vendor.clerkId).catch(() => {});
    } catch {
      // Ignore Clerk API deletion errors if offline or not configured
    }
  }

  await prisma.$transaction([
    prisma.vendor.update({
      where: { id: vendor.id },
      data: {
        deletedAt: new Date(),
        isPublic: false,
        email: tombstoneEmail,
        shopSlug: tombstoneSlug,
        clerkId: null,
        phone: null,
        // Wipe identifying details — keep aggregate stats for our records.
        shopName: "(deleted account)",
        whatsappNumber: "",
        tagline: "",
      },
    }),
    prisma.product.updateMany({
      where: { vendorId: vendor.id },
      data: { isActive: false },
    }),
  ]);

  try {
    const { revalidatePath } = await import("next/cache");
    revalidatePath("/marketplace");
    revalidatePath(`/shop/${oldSlug}`);
    revalidatePath(`/c/${oldSlug}`);
  } catch {
    // Ignore cache revalidation errors
  }

  await destroySession();
  logger.info("account.deleted", { vendorId: vendor.id });
  return NextResponse.json({ ok: true });
}
