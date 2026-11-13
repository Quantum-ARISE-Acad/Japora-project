import type { Vendor } from "@prisma/client";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import { slugify, digitsOnly } from "@/lib/utils";
import { ensureReferralCode } from "@/lib/referral";

export interface SyncClerkVendorInput {
  clerkId?: string | null;
  email: string;
  name?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  avatarUrl?: string | null;
  shopName?: string | null;
  shopSlug?: string | null;
  whatsappNumber?: string | null;
  momoNumber?: string | null;
  currency?: string | null;
  language?: string | null;
  region?: string | null;
  category?: string | null;
  tagline?: string | null;
  bio?: string | null;
  password?: string | null;
  authProvider?: "google" | "clerk_email" | "local";
  completeOnboarding?: boolean;
  isGoogleOneClick?: boolean;
}

export interface VendorAccountProfile {
  ownerName: string;
  firstName?: string;
  lastName?: string;
  email: string;
  clerkId?: string;
  authProvider: string;
  googleAvatarUrl?: string;
  lastLoginAt: string;
  loginCount: number;
  createdAt: string;
}

function readPrefsObject(raw: unknown): Record<string, unknown> {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    return { ...(raw as Record<string, unknown>) };
  }
  return {};
}

/**
 * Records any user or vendor action in the MySQL database (`BusEvent` table)
 * so every account, shop, catalog, or order action is audited and persisted.
 */
export async function recordVendorActivity(params: {
  vendorId: string;
  type: string;
  subjectType: string;
  subjectId?: string;
  actorId?: string;
  data?: Record<string, unknown>;
}): Promise<void> {
  try {
    await prisma.busEvent.create({
      data: {
        type: params.type,
        vendorId: params.vendorId,
        subjectType: params.subjectType,
        subjectId: params.subjectId || params.vendorId,
        actorType: "vendor",
        actorId: params.actorId || params.vendorId,
        status: "sent",
        sentAt: new Date(),
        data: (params.data ?? {}) as never,
      },
    });
  } catch (err) {
    console.warn("[recordVendorActivity] non-fatal error:", err);
  }
}

/**
 * Generates a unique `shopSlug` in MySQL from a desired name or slug.
 */
export async function generateUniqueShopSlug(
  rawNameOrSlug: string,
  excludeVendorId?: string,
): Promise<string> {
  const base = slugify(rawNameOrSlug) || "boutique-japora";
  let candidate = base;
  let counter = 1;

  while (true) {
    const existing = await prisma.vendor.findUnique({
      where: { shopSlug: candidate },
      select: { id: true },
    });
    if (!existing || (excludeVendorId && existing.id === excludeVendorId)) {
      return candidate;
    }
    candidate = `${base}-${counter++}`;
  }
}

/**
 * Synchronizes a Clerk user (Google OAuth or Email/Password) or local user
 * with the MySQL `Vendor` table, preserving all user profile metadata and shop settings.
 */
export async function syncClerkUserToVendor(
  input: SyncClerkVendorInput,
): Promise<{ vendor: Vendor; isNewAccount: boolean; needsOnboarding: boolean }> {
  const cleanEmail = input.email.trim().toLowerCase();
  const cleanClerkId = input.clerkId?.trim() || null;

  // 1. Look up existing vendor by clerkId OR email
  let vendor: Vendor | null = null;
  if (cleanClerkId) {
    vendor = await prisma.vendor.findFirst({
      where: {
        OR: [{ clerkId: cleanClerkId }, { email: cleanEmail }],
      },
    });
  } else {
    vendor = await prisma.vendor.findUnique({
      where: { email: cleanEmail },
    });
  }

  const fullName =
    input.name?.trim() ||
    [input.firstName, input.lastName].filter(Boolean).join(" ").trim() ||
    cleanEmail.split("@")[0];

  const now = new Date();
  const nowIso = now.toISOString();

  // 2. Create new Vendor if none exists
  if (!vendor) {
    const explicitShopName = input.shopName?.trim() || "";
    const resolvedShopName = explicitShopName || fullName || "Ma Boutique Japora";
    const resolvedSlug = await generateUniqueShopSlug(
      input.shopSlug?.trim() || explicitShopName || fullName,
    );

    const passwordHash = input.password
      ? await hashPassword(input.password)
      : "clerk_managed_auth";

    const cleanWhatsapp = input.whatsappNumber
      ? digitsOnly(input.whatsappNumber)
      : "";
    const cleanMomo = input.momoNumber
      ? digitsOnly(input.momoNumber)
      : cleanWhatsapp;

    // If the user explicitly filled out a shopName on the signup form (and it's not a 1-click Google auth),
    // mark onboardedAt; otherwise leave onboardedAt = null so ShopOnboardingModal opens immediately!
    const hasCompleteShopDetails =
      Boolean(explicitShopName) &&
      !input.isGoogleOneClick &&
      input.completeOnboarding !== false;

    const trialEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const envPhoneId = (process.env.WHATSAPP_PHONE_NUMBER_ID || "").trim();

    if (envPhoneId) {
      await prisma.vendor
        .updateMany({
          where: { whatsappPhoneNumberId: envPhoneId },
          data: { whatsappPhoneNumberId: null },
        })
        .catch(() => {});
    }

    const initialProfile: VendorAccountProfile = {
      ownerName: fullName,
      firstName: input.firstName?.trim() || undefined,
      lastName: input.lastName?.trim() || undefined,
      email: cleanEmail,
      clerkId: cleanClerkId || undefined,
      authProvider: input.authProvider || (cleanClerkId ? "clerk" : "local"),
      googleAvatarUrl: input.avatarUrl?.trim() || undefined,
      lastLoginAt: nowIso,
      loginCount: 1,
      createdAt: nowIso,
    };

    vendor = await prisma.vendor.create({
      data: {
        ...(cleanClerkId ? { clerkId: cleanClerkId } : {}),
        email: cleanEmail,
        passwordHash,
        shopName: resolvedShopName,
        shopSlug: resolvedSlug,
        whatsappNumber: cleanWhatsapp || "15556449932",
        momoNumber: cleanMomo,
        ...(envPhoneId ? { whatsappPhoneNumberId: envPhoneId } : {}),
        currency: (input.currency || "XOF").trim().toUpperCase().slice(0, 3),
        language: (input.language || "fr").trim() || "fr",
        region: (input.region || "lome").trim(),
        category: (input.category || "fashion").trim(),
        tagline: (input.tagline || "").trim().slice(0, 450),
        bio: (input.bio || "").trim().slice(0, 1000),
        avatarUrl: (input.avatarUrl || "").trim(),
        subscriptionStatus: "trialing",
        trialEndsAt: trialEnd,
        emailVerifiedAt: now,
        onboardedAt: hasCompleteShopDetails ? now : null,
        uiPrefs: {
          accountProfile: initialProfile,
          shopTheme: "arctic",
        } as never,
      },
    });

    await ensureReferralCode(vendor.id).catch(() => {});

    await recordVendorActivity({
      vendorId: vendor.id,
      type: "auth.account.created",
      subjectType: "vendor",
      subjectId: vendor.id,
      data: {
        email: vendor.email,
        clerkId: cleanClerkId,
        shopName: vendor.shopName,
        shopSlug: vendor.shopSlug,
        currency: vendor.currency,
        language: vendor.language,
        authProvider: initialProfile.authProvider,
        needsOnboarding: !vendor.onboardedAt,
      },
    });

    return {
      vendor,
      isNewAccount: true,
      needsOnboarding: !vendor.onboardedAt,
    };
  }

  // 3. Existing Vendor: merge any new Clerk ID, password, shop info, or profile fields
  const prefs = readPrefsObject(vendor.uiPrefs);
  const existingProfile =
    prefs.accountProfile && typeof prefs.accountProfile === "object"
      ? (prefs.accountProfile as Partial<VendorAccountProfile>)
      : {};

  const updatedProfile: VendorAccountProfile = {
    ownerName: fullName || existingProfile.ownerName || vendor.shopName,
    firstName: input.firstName?.trim() || existingProfile.firstName,
    lastName: input.lastName?.trim() || existingProfile.lastName,
    email: cleanEmail,
    clerkId: cleanClerkId || vendor.clerkId || existingProfile.clerkId,
    authProvider:
      input.authProvider ||
      existingProfile.authProvider ||
      (cleanClerkId ? "clerk" : "local"),
    googleAvatarUrl:
      input.avatarUrl?.trim() || existingProfile.googleAvatarUrl,
    lastLoginAt: nowIso,
    loginCount: (Number(existingProfile.loginCount) || 0) + 1,
    createdAt: existingProfile.createdAt || vendor.createdAt.toISOString(),
  };

  prefs.accountProfile = updatedProfile;

  const updateData: Record<string, unknown> = {
    uiPrefs: prefs,
    deletedAt: null, // Reactivate if previously soft-deleted
  };

  if (cleanClerkId && vendor.clerkId !== cleanClerkId) {
    updateData.clerkId = cleanClerkId;
  }
  if (!vendor.emailVerifiedAt) {
    updateData.emailVerifiedAt = now;
  }
  if (input.password && vendor.passwordHash === "clerk_managed_auth") {
    updateData.passwordHash = await hashPassword(input.password);
  }
  if (input.avatarUrl && !vendor.avatarUrl) {
    updateData.avatarUrl = input.avatarUrl.trim();
  }
  if (input.shopName && input.shopName.trim() && input.completeOnboarding) {
    updateData.shopName = input.shopName.trim();
  }
  if (input.whatsappNumber && input.whatsappNumber.trim()) {
    const cleanWa = digitsOnly(input.whatsappNumber);
    if (cleanWa && (!vendor.whatsappNumber || vendor.whatsappNumber === "15556449932")) {
      updateData.whatsappNumber = cleanWa;
    }
  }
  if (input.currency && input.currency.trim() && input.completeOnboarding) {
    updateData.currency = input.currency.trim().toUpperCase().slice(0, 3);
  }
  if (input.language && input.language.trim() && input.completeOnboarding) {
    updateData.language = input.language.trim();
  }
  if (input.category && input.category.trim() && !vendor.category) {
    updateData.category = input.category.trim();
  }
  if (input.region && input.region.trim() && !vendor.region) {
    updateData.region = input.region.trim();
  }
  if (input.completeOnboarding && !vendor.onboardedAt) {
    updateData.onboardedAt = now;
  }

  vendor = await prisma.vendor.update({
    where: { id: vendor.id },
    data: updateData as never,
  });

  await recordVendorActivity({
    vendorId: vendor.id,
    type: "auth.session.login",
    subjectType: "vendor",
    subjectId: vendor.id,
    data: {
      email: vendor.email,
      clerkId: vendor.clerkId,
      authProvider: updatedProfile.authProvider,
      loginCount: updatedProfile.loginCount,
    },
  });

  return {
    vendor,
    isNewAccount: false,
    needsOnboarding: !vendor.onboardedAt,
  };
}

