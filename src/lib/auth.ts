import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import type { Vendor } from "@prisma/client";
import { prisma } from "./db";
import { getSession } from "./session";
import type { ClerkResource } from "./clerk-signup-flow";

/** Prisma client, or an in-memory double in tests. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type VendorStore = any;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(
  password: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

const EMAIL_RE = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

export function validateEmail(email: boolean | string): boolean {
  if (typeof email !== "string") return false;
  return EMAIL_RE.test(email) && email.length <= 254;
}

export type PasswordCheck = { ok: true } | { ok: false; reason: string };

export function validatePassword(password: string): PasswordCheck {
  if (password.length < 8) return { ok: false, reason: "Le mot de passe doit contenir au moins 8 caractères." };
  if (password.length > 200) return { ok: false, reason: "Le mot de passe est trop long (200 caractères max)." };
  if (!/[a-zA-Z]/.test(password)) return { ok: false, reason: "Le mot de passe doit contenir au moins une lettre." };
  if (!/\d/.test(password)) return { ok: false, reason: "Le mot de passe doit contenir au moins un chiffre." };
  return { ok: true };
}

function slugifyName(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}

export interface ClerkProvisionHints {
  name?: string;
  shopName?: string;
  whatsappNumber?: string;
  currency?: string;
  category?: string;
}

/**
 * Resolve or provision a Vendor from a server-verified Clerk user.
 * Supports email-only, phone-only (fallback email `wa_<digits>@japora.local`),
 * and combined email+phone Clerk accounts, while reading `unsafeMetadata`
 * (`shopName`, `whatsappNumber`, `currency`) without overwriting existing data.
 */
export async function resolveOrProvisionClerkVendor(
  clerkUserId: string,
  clerkUser: ClerkResource,
  hints?: ClerkProvisionHints,
  database: VendorStore = prisma,
): Promise<Vendor | null> {
  if (!clerkUserId) return null;

  const meta =
    clerkUser?.unsafeMetadata && typeof clerkUser.unsafeMetadata === "object"
      ? (clerkUser.unsafeMetadata as Record<string, unknown>)
      : {};
  const metaShopName = typeof meta.shopName === "string" ? meta.shopName.trim() : "";
  const metaWhatsappNumber = typeof meta.whatsappNumber === "string" ? meta.whatsappNumber.trim() : "";
  const metaCurrency = typeof meta.currency === "string" ? meta.currency.trim().toUpperCase() : "";
  const metaCategory = typeof meta.category === "string" ? meta.category.trim() : "";

  // Only a VERIFIED email may identify a vendor: an unverified address added to a
  // Clerk account must never be enough to take over the shop that uses it.
  const verifiedEmailObj =
    clerkUser?.emailAddresses?.find(
      (e: ClerkResource) => e.id === clerkUser.primaryEmailAddressId && e.verification?.status === "verified",
    ) ?? clerkUser?.emailAddresses?.find((e: ClerkResource) => e.verification?.status === "verified");
  const clerkEmail = verifiedEmailObj?.emailAddress?.trim().toLowerCase() || "";

  const verifiedPhoneObj =
    clerkUser?.phoneNumbers?.find(
      (p: ClerkResource) => p.id === clerkUser.primaryPhoneNumberId && p.verification?.status === "verified",
    ) ?? clerkUser?.phoneNumbers?.find((p: ClerkResource) => p.verification?.status === "verified");
  const clerkPhone = verifiedPhoneObj?.phoneNumber?.trim() || "";
  const clerkPhoneDigits = clerkPhone.replace(/\D/g, "");
  const isPhoneVerified = Boolean(clerkPhoneDigits && verifiedPhoneObj?.verification?.status === "verified");

  const fallbackPhoneEmail =
    isPhoneVerified && clerkPhoneDigits ? `wa_${clerkPhoneDigits}@japora.local` : "";
  const effectiveEmail = clerkEmail || fallbackPhoneEmail;

  const canClaimPhone = async (candidatePhone: string, excludeVendorId?: string): Promise<boolean> => {
    if (!candidatePhone) return false;
    const owner = await database.vendor.findFirst({
      where: {
        phone: candidatePhone,
        deletedAt: null,
        ...(excludeVendorId ? { id: { not: excludeVendorId } } : {}),
      },
      select: { id: true },
    });
    return !owner;
  };

  // 1. Check by verified clerkId first
  let vendor = await database.vendor.findFirst({
    where: { clerkId: clerkUserId },
  });

  if (vendor) {
    if (vendor.deletedAt) {
      // The user previously had an account with this clerkId that was deleted.
      // Free the clerkId from the deleted tombstone so the user can re-register or provision a new shop.
      await database.vendor.update({
        where: { id: vendor.id },
        data: {
          clerkId: null,
          phone: null,
        },
      }).catch(() => {});
      vendor = null;
    } else {
      const updates: Record<string, unknown> = {};
      if (clerkPhone && !vendor.phone && (await canClaimPhone(clerkPhone, vendor.id))) {
        updates.phone = clerkPhone;
      }
      if (isPhoneVerified && !vendor.phoneVerifiedAt) {
        updates.phoneVerifiedAt = new Date();
      }
      if (!vendor.whatsappNumber) {
        const candidateWa = metaWhatsappNumber || hints?.whatsappNumber?.trim() || clerkPhone;
        if (candidateWa) updates.whatsappNumber = candidateWa;
      }
      if (Object.keys(updates).length > 0) {
        vendor = await database.vendor.update({
          where: { id: vendor.id },
          data: updates,
        });
      }
      return vendor;
    }
  }

  if (!effectiveEmail) return null;

  // 2. Match existing vendor by verified email or verified phone
  if (clerkEmail) {
    vendor = await database.vendor.findUnique({ where: { email: clerkEmail } });
    if (vendor && vendor.deletedAt) {
      // The email belongs to a deleted tombstone vendor.
      // Anonymize the deleted vendor's email so the user can recreate their shop with this email.
      await database.vendor.update({
        where: { id: vendor.id },
        data: {
          email: `deleted_${vendor.id}_${vendor.email}`,
          clerkId: null,
          phone: null,
        },
      }).catch(() => {});
      vendor = null;
    }
  }
  if (!vendor && isPhoneVerified && clerkPhone) {
    const phoneOrConditions: Record<string, string>[] = [{ phone: clerkPhone }];
    if (clerkPhoneDigits && clerkPhoneDigits !== clerkPhone) {
      phoneOrConditions.push({ phone: clerkPhoneDigits });
    }
    if (fallbackPhoneEmail) {
      phoneOrConditions.push({ email: fallbackPhoneEmail });
    }
    vendor = await database.vendor.findFirst({
      where: { OR: phoneOrConditions },
    });
    if (vendor && vendor.deletedAt) {
      await database.vendor.update({
        where: { id: vendor.id },
        data: {
          phone: null,
          clerkId: null,
        },
      }).catch(() => {});
      vendor = null;
    }
  }

  const now = new Date();

  if (vendor) {
    const updates: Record<string, unknown> = {
      clerkId: clerkUserId,
    };
    if (clerkPhone && !vendor.phone && (await canClaimPhone(clerkPhone, vendor.id))) {
      updates.phone = clerkPhone;
    }
    if (isPhoneVerified && !vendor.phoneVerifiedAt) {
      updates.phoneVerifiedAt = now;
    }
    if (clerkEmail && !vendor.emailVerifiedAt && vendor.email === clerkEmail) {
      updates.emailVerifiedAt = now;
    }
    if (!vendor.whatsappNumber) {
      const candidateWa = metaWhatsappNumber || hints?.whatsappNumber?.trim() || clerkPhone;
      if (candidateWa) updates.whatsappNumber = candidateWa;
    }
    try {
      vendor = await database.vendor.update({
        where: { id: vendor.id },
        data: updates,
      });
    } catch (error) {
      if ((error as { code?: string })?.code !== "P2002") throw error;
      vendor = await database.vendor.findFirst({ where: { clerkId: clerkUserId, deletedAt: null } });
      if (!vendor) throw error;
    }
    return vendor;
  }

  // 3. Provision a new Vendor from verified Clerk identity + unsafeMetadata
  const fullName =
    [clerkUser?.firstName, clerkUser?.lastName].filter(Boolean).join(" ").trim() ||
    (hints?.name ? hints.name.trim() : "");
  const explicitShopName =
    metaShopName ||
    (hints?.shopName ? hints.shopName.trim() : "");
  const baseName = explicitShopName || "My Shop";
  const slugSource =
    explicitShopName ||
    fullName ||
    (clerkEmail ? clerkEmail.split("@")[0] : "") ||
    "my-shop";
  const baseSlug = slugifyName(slugSource) || "shop";
  let slug = baseSlug;
  let counter = 1;
  while (await database.vendor.findUnique({ where: { shopSlug: slug } })) {
    slug = `${baseSlug}-${counter}`;
    counter++;
  }

  let finalEmail = effectiveEmail;
  let emailCounter = 1;
  while (await database.vendor.findUnique({ where: { email: finalEmail } })) {
    finalEmail = `${ slug }-${emailCounter}@japora.local`;
    emailCounter++;
  }

  const claimablePhone = clerkPhone && (await canClaimPhone(clerkPhone)) ? clerkPhone : null;

  const trialEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const resolvedWhatsapp =
    metaWhatsappNumber ||
    (hints?.whatsappNumber ? hints.whatsappNumber.trim() : "") ||
    clerkPhone ||
    "";
  const resolvedCurrency =
    metaCurrency ||
    (hints?.currency ? hints.currency.trim().toUpperCase() : "") ||
    "XOF";
  const resolvedCategory =
    metaCategory ||
    (hints?.category ? hints.category.trim() : "") ||
    "";

  try {
    vendor = await database.vendor.create({
      data: {
        clerkId: clerkUserId,
        email: finalEmail,
        passwordHash: "clerk_managed_auth",
        shopName: baseName,
        shopSlug: slug,
        phone: claimablePhone,
        phoneVerifiedAt: isPhoneVerified && claimablePhone ? now : null,
        whatsappNumber: resolvedWhatsapp,
        currency: resolvedCurrency,
        category: resolvedCategory,
        subscriptionStatus: "trialing",
        trialEndsAt: trialEnd,
        emailVerifiedAt: clerkEmail ? now : null,
      },
    });
  } catch (error) {
    if ((error as { code?: string })?.code !== "P2002") throw error;
    vendor = await database.vendor.findFirst({ where: { clerkId: clerkUserId } });
    if (!vendor || vendor.deletedAt) throw error;
  }

  return vendor;
}

/**
 * Bind WHATSAPP_PHONE_NUMBER_ID to the vendor only when no vendor has claimed
 * it yet, without overwriting another vendor's binding or reassigning orders.
 */
export async function syncActiveVendorWhatsAppBinding(vendor: Vendor): Promise<Vendor> {
  const envPhoneId = (process.env.WHATSAPP_PHONE_NUMBER_ID || "").trim();
  if (!envPhoneId || vendor.whatsappPhoneNumberId) return vendor;

  try {
    const existingOwner = await prisma.vendor.findFirst({
      where: { whatsappPhoneNumberId: envPhoneId },
      select: { id: true },
    });
    if (!existingOwner) {
      vendor = await prisma.vendor.update({
        where: { id: vendor.id },
        data: {
          whatsappPhoneNumberId: envPhoneId,
        },
      });
    }
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
        let vendor = await prisma.vendor.findFirst({
          where: { clerkId: clerkAuth.userId },
        });
        if (vendor && !vendor.deletedAt) {
          return await syncActiveVendorWhatsAppBinding(vendor);
        }

        // Auto-provision or link Clerk vendor if not yet in database
        const clerkUser = await currentUser().catch(() => null);
        vendor = await resolveOrProvisionClerkVendor(clerkAuth.userId, clerkUser);
        if (vendor && !vendor.deletedAt) {
          const { createSession } = await import("./session");
          await createSession({
            vendorId: vendor.id,
            email: vendor.email,
          }).catch(() => {});
          return await syncActiveVendorWhatsAppBinding(vendor);
        }
      }
    } catch {
      // Fall through to cookie session
    }
  }

  // 2. Fall back to local cookie session
  const session = await getSession();
  if (!session) return null;
  const vendor = await prisma.vendor.findUnique({ where: { id: session.vendorId } });
  if (!vendor || vendor.deletedAt) return null;
  return await syncActiveVendorWhatsAppBinding(vendor);
}

export async function requireVendor(): Promise<Vendor> {
  const vendor = await getCurrentVendor();
  if (!vendor) redirect("/login");
  return vendor;
}
