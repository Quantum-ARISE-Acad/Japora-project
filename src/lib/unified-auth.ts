import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { prisma } from "./db";
import type { Vendor } from "@prisma/client";

export const WATARU_SSO_COOKIE = "wataru_sso";
export const WATARU_SSO_MAX_AGE = 60 * 60 * 24 * 30; // 30 days
export const WATARU_TICKET_MAX_AGE_SEC = 60; // 60 seconds

export interface WataruUnifiedPayload {
  sub: string; // user email
  email: string;
  name?: string;
  phone?: string;
  role?: string; // VENDOR | BUYER | ADMIN
  originApp?: "japora" | "wescrow" | "soko";
  avatarUrl?: string;
}

function getUnifiedSecret(): Uint8Array {
  const secret = process.env.WATARU_UNIFIED_AUTH_SECRET || "wataru_unified_auth_secret_shared_2026_super_secure";
  return new TextEncoder().encode(secret);
}

/**
 * Sign a unified Wataru JWT token.
 */
export async function signUnifiedToken(
  payload: WataruUnifiedPayload,
  expiresIn = `${WATARU_SSO_MAX_AGE}s`
): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.email)
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(getUnifiedSecret());
}

/**
 * Verify and decode a unified Wataru JWT token.
 */
export async function verifyUnifiedToken(token: string): Promise<WataruUnifiedPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getUnifiedSecret());
    if (typeof payload.sub !== "string" && typeof payload.email !== "string") return null;
    return {
      sub: String(payload.sub || payload.email),
      email: String(payload.email || payload.sub),
      name: typeof payload.name === "string" ? payload.name : undefined,
      phone: typeof payload.phone === "string" ? payload.phone : undefined,
      role: typeof payload.role === "string" ? payload.role : undefined,
      originApp: payload.originApp === "japora" || payload.originApp === "wescrow" || payload.originApp === "soko" ? payload.originApp : undefined,
      avatarUrl: typeof payload.avatarUrl === "string" ? payload.avatarUrl : undefined,
    };
  } catch {
    return null;
  }
}

/**
 * Create a short-lived 60-second SSO ticket for seamless inter-platform redirect.
 */
export async function createSsoTicket(payload: WataruUnifiedPayload): Promise<string> {
  return signUnifiedToken(payload, `${WATARU_TICKET_MAX_AGE_SEC}s`);
}

/**
 * Verify an SSO ticket.
 */
export async function verifySsoTicket(ticket: string): Promise<WataruUnifiedPayload | null> {
  return verifyUnifiedToken(ticket);
}

/**
 * Set the shared wataru_sso cookie across all localhost ports / domains.
 */
export async function setUnifiedCookie(payload: WataruUnifiedPayload): Promise<void> {
  const token = await signUnifiedToken(payload);
  const store = await cookies();
  store.set(WATARU_SSO_COOKIE, token, {
    httpOnly: false, // Accessible by client scripts across ports for seamless SSO check
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: WATARU_SSO_MAX_AGE,
  });
}

/**
 * Retrieve and verify the unified cookie.
 */
export async function getUnifiedCookie(): Promise<WataruUnifiedPayload | null> {
  const store = await cookies();
  const token = store.get(WATARU_SSO_COOKIE)?.value;
  if (!token) return null;
  return verifyUnifiedToken(token);
}

/**
 * Clear the unified cookie.
 */
export async function clearUnifiedCookie(): Promise<void> {
  const store = await cookies();
  store.delete(WATARU_SSO_COOKIE);
}

/**
 * Synchronize or Just-In-Time provision a Vendor from unified identity.
 */
export async function syncUnifiedVendor(payload: WataruUnifiedPayload): Promise<Vendor> {
  const cleanEmail = payload.email.trim().toLowerCase();
  let vendor = await prisma.vendor.findUnique({
    where: { email: cleanEmail },
  });

  if (vendor) {
    if ((!vendor.shopName && payload.name) || (!vendor.phone && payload.phone)) {
      vendor = await prisma.vendor.update({
        where: { id: vendor.id },
        data: {
          shopName: vendor.shopName || payload.name || undefined,
          phone: vendor.phone || payload.phone || undefined,
          whatsappNumber: vendor.whatsappNumber || payload.phone || undefined,
        },
      });
    }
    return vendor;
  }

  // Create new vendor account for this unified Wataru user
  const baseName = payload.name || cleanEmail.split("@")[0] || "Boutique Wataru";
  const slug = baseName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "boutique";

  // Ensure unique shopSlug
  let counter = 1;
  let candidateSlug = slug;
  while (await prisma.vendor.findUnique({ where: { shopSlug: candidateSlug } })) {
    candidateSlug = `${slug}-${counter}`;
    counter++;
  }

  vendor = await prisma.vendor.create({
    data: {
      email: cleanEmail,
      shopName: baseName,
      shopSlug: candidateSlug,
      phone: payload.phone || null,
      whatsappNumber: payload.phone || "",
      passwordHash: "wataru_unified_auth",
      emailVerifiedAt: new Date(),
    },
  });

  return vendor;
}
