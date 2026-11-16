import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import type { Vendor } from "@prisma/client";
import { prisma } from "./db";
import { getSession } from "./session";

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(
  password: string,
  hash: string,
): Promise<boolean> {
  if (!hash || hash === "clerk_managed_auth") return false;
  return bcrypt.compare(password, hash);
}

const EMAIL_RE = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

export function validateEmail(email: boolean | string): boolean {
  if (typeof email !== "string") return false;
  return EMAIL_RE.test(email) && email.length <= 254;
}

export type PasswordCheck = { ok: true } | { ok: false; reason: string };

export function validatePassword(password: string): PasswordCheck {
  if (password.length < 8)
    return { ok: false, reason: "Le mot de passe doit contenir au moins 8 caractères." };
  if (password.length > 200)
    return { ok: false, reason: "Le mot de passe est trop long (max 200 caractères)." };
  if (!/[a-zA-Z]/.test(password))
    return { ok: false, reason: "Le mot de passe doit contenir au moins une lettre." };
  if (!/\d/.test(password))
    return { ok: false, reason: "Le mot de passe doit contenir au moins un chiffre." };
  return { ok: true };
}

/**
 * Ensure the currently logged-in dashboard vendor owns the configured
 * WHATSAPP_PHONE_NUMBER_ID so that all incoming WhatsApp webhook orders, deals,
 * and tracking requests route directly to the active vendor's dashboard.
 */
async function syncActiveVendorWhatsAppBinding(vendor: Vendor): Promise<Vendor> {
  const envPhoneId = (process.env.WHATSAPP_PHONE_NUMBER_ID || "").trim();
  if (!envPhoneId) return vendor;

  try {
    if (vendor.whatsappPhoneNumberId !== envPhoneId) {
      await prisma.vendor.updateMany({
        where: { whatsappPhoneNumberId: envPhoneId, id: { not: vendor.id } },
        data: { whatsappPhoneNumberId: null },
      });
      vendor = await prisma.vendor.update({
        where: { id: vendor.id },
        data: {
          whatsappPhoneNumberId: envPhoneId,
          ...(vendor.whatsappNumber ? {} : { whatsappNumber: "15556449932" }),
        },
      });
    }
    // Also adopt any WhatsApp / Deal orders so they always appear in the active vendor's dashboard
    await prisma.order.updateMany({
      where: {
        vendorId: { not: vendor.id },
        source: { in: ["whatsapp", "whatsapp_deal"] },
      },
      data: { vendorId: vendor.id },
    });
  } catch {
    // Ignore race conditions on concurrent requests
  }
  return vendor;
}

/** Returns the logged-in vendor, or null if there is no valid session. */
export async function getCurrentVendor(): Promise<Vendor | null> {
  // 1. Check Clerk session first if Clerk is configured
  if (process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) {
    try {
      const { auth, currentUser } = await import("@clerk/nextjs/server");
      const clerkAuth = await auth();
      if (clerkAuth?.userId) {
        const existingByClerk = await prisma.vendor.findFirst({
          where: { clerkId: clerkAuth.userId },
        });
        if (existingByClerk && !existingByClerk.deletedAt) {
          return await syncActiveVendorWhatsAppBinding(existingByClerk);
        }

        // Auto-provision or link Clerk vendor in MySQL if not yet linked
        let clerkUser: any = null;
        try {
          clerkUser = await currentUser();
        } catch {
          clerkUser = null;
        }

        const email =
          clerkUser?.emailAddresses?.[0]?.emailAddress?.trim().toLowerCase() ||
          `${clerkAuth.userId}@clerk.japora.app`;

        const unsafeMeta = (clerkUser?.unsafeMetadata || {}) as Record<
          string,
          unknown
        >;
        const hasGoogleExternal =
          Array.isArray(clerkUser?.externalAccounts) &&
          clerkUser.externalAccounts.some((acc: any) =>
            String(acc.provider || "").includes("google"),
          );

        const metaShopName =
          typeof unsafeMeta.shopName === "string"
            ? unsafeMeta.shopName.trim()
            : "";
        const metaWhatsapp =
          typeof unsafeMeta.whatsappNumber === "string"
            ? unsafeMeta.whatsappNumber.trim()
            : "";
        const metaCurrency =
          typeof unsafeMeta.currency === "string"
            ? unsafeMeta.currency.trim()
            : "XOF";
        const metaLanguage =
          typeof unsafeMeta.language === "string"
            ? unsafeMeta.language.trim()
            : "fr";
        const metaCategory =
          typeof unsafeMeta.category === "string"
            ? unsafeMeta.category.trim()
            : "fashion";
        const metaRegion =
          typeof unsafeMeta.region === "string"
            ? unsafeMeta.region.trim()
            : "lome";

        const { syncClerkUserToVendor } = await import("./clerk-vendor-sync");
        const synced = await syncClerkUserToVendor({
          clerkId: clerkAuth.userId,
          email,
          firstName: clerkUser?.firstName || null,
          lastName: clerkUser?.lastName || null,
          name: [clerkUser?.firstName, clerkUser?.lastName]
            .filter(Boolean)
            .join(" ")
            .trim(),
          avatarUrl: clerkUser?.imageUrl || null,
          shopName: metaShopName || null,
          whatsappNumber:
            metaWhatsapp ||
            clerkUser?.phoneNumbers?.[0]?.phoneNumber ||
            null,
          currency: metaCurrency,
          language: metaLanguage,
          category: metaCategory,
          region: metaRegion,
          authProvider: hasGoogleExternal ? "google" : "clerk_email",
          isGoogleOneClick: hasGoogleExternal && !metaShopName,
          completeOnboarding: Boolean(metaShopName),
        });

        if (synced.vendor && !synced.vendor.deletedAt) {
          return await syncActiveVendorWhatsAppBinding(synced.vendor);
        }
      }
    } catch {
      // Fall through to cookie session
    }
  }

  // 2. Fall back to local cookie session
  try {
    const session = await getSession();
    if (session) {
      const vendor = await prisma.vendor.findUnique({
        where: { id: session.vendorId },
      });
      if (vendor && !vendor.deletedAt) {
        return await syncActiveVendorWhatsAppBinding(vendor);
      }
    }
  } catch (err) {
    console.warn("[getCurrentVendor] session DB lookup warning:", err);
  }

  // 3. Fall back to unified Wataru SSO cookie
  try {
    const { getUnifiedCookie, syncUnifiedVendor } = await import("./unified-auth");
    const unified = await getUnifiedCookie();
    if (unified?.email) {
      const vendor = await syncUnifiedVendor(unified);
      if (vendor && !vendor.deletedAt) {
        return await syncActiveVendorWhatsAppBinding(vendor);
      }
    }
  } catch {
    // Ignore unified cookie fallback errors
  }

  return null;
}

export async function requireVendor(): Promise<Vendor> {
  const vendor = await getCurrentVendor();
  if (!vendor) redirect("/login");
  return vendor;
}
