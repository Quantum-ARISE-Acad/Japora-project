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

/**
 * Bind the configured WHATSAPP_PHONE_NUMBER_ID to the logged-in vendor when no
 * shop owns it yet (single-number demo setup). It never reassigns the number or
 * orders from another shop: that used to leak one shop's orders to another.
 */
export async function syncActiveVendorWhatsAppBinding(vendor: Vendor): Promise<Vendor> {
  const envPhoneId = (process.env.WHATSAPP_PHONE_NUMBER_ID || "").trim();
  if (!envPhoneId) return vendor;

  try {
    if (vendor.whatsappPhoneNumberId === envPhoneId) return vendor;
    // Claim the shared number only while no other shop owns it. Logging in must
    // never take the number — or any order — away from another shop: inbound
    // messages for other shops are routed by the shop slug in the QR prefill.
    const owner = await prisma.vendor.findFirst({
      where: { whatsappPhoneNumberId: envPhoneId, id: { not: vendor.id } },
      select: { id: true },
    });
    if (owner) return vendor;
    vendor = await prisma.vendor.update({
      where: { id: vendor.id },
      data: {
        whatsappPhoneNumberId: envPhoneId,
        ...(vendor.whatsappNumber ? {} : { whatsappNumber: "15556449932" }),
      },
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
        let vendor = await prisma.vendor.findFirst({
          where: { clerkId: clerkAuth.userId },
        });
        if (vendor && !vendor.deletedAt) {
          return await syncActiveVendorWhatsAppBinding(vendor);
        }

        // Auto-provision or link Clerk vendor if not yet in database
        const clerkUser = await currentUser();
        if (clerkUser) {
          const email = clerkUser.emailAddresses?.[0]?.emailAddress?.trim().toLowerCase();
          if (email) {
            vendor = await prisma.vendor.findUnique({ where: { email } });
            if (vendor) {
              vendor = await prisma.vendor.update({
                where: { id: vendor.id },
                data: { clerkId: clerkAuth.userId },
              });
            } else {
              const baseName =
                [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ").trim() ||
                email.split("@")[0];
              const baseSlug =
                baseName
                  .toLowerCase()
                  .replace(/[^a-z0-9]+/g, "-")
                  .replace(/(^-|-$)+/g, "") || "shop";
              let slug = baseSlug;
              let counter = 1;
              while (await prisma.vendor.findUnique({ where: { shopSlug: slug } })) {
                slug = `${baseSlug}-${counter}`;
                counter++;
              }
              const now = new Date();
              const trialEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
              vendor = await prisma.vendor.create({
                data: {
                  clerkId: clerkAuth.userId,
                  email,
                  passwordHash: "clerk_managed_auth",
                  shopName: baseName,
                  shopSlug: slug,
                  whatsappNumber: "15556449932",
                  currency: "XOF",
                  subscriptionStatus: "trialing",
                  trialEndsAt: trialEnd,
                  emailVerifiedAt: now,
                },
              });
            }
            if (vendor && !vendor.deletedAt) {
              const { createSession } = await import("./session");
              await createSession({
                vendorId: vendor.id,
                email: vendor.email,
              }).catch(() => {});
              return await syncActiveVendorWhatsAppBinding(vendor);
            }
          }
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
