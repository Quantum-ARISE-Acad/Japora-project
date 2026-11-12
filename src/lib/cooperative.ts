/**
 * Japora cooperatives — the horizontal-growth play.
 *
 * African markets are organised. A single textile-market association, savings
 * group, or "tontine" can represent dozens of vendors who all already trust one
 * coordinator. Instead of signing them up one at a time, the coordinator
 * creates a Cooperative, gets one join code + link + QR, and onboards the whole
 * market in an afternoon — every member's shop lands under the same banner.
 *
 * A vendor belongs to at most one cooperative (Vendor.cooperativeId). The
 * creator is the admin. Joining is by short code (link / QR / typed).
 */

import { randomBytes } from "node:crypto";
import { prisma } from "./db";
import { logger } from "./logger";
import { normalizePhone, isValidPhone } from "./otp";
import { sendWhatsApp } from "./whatsapp";

const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const CODE_LEN = 6;
const MAX_RETRIES = 6;

function generateCode(): string {
  const buf = randomBytes(CODE_LEN);
  let out = "";
  for (let i = 0; i < CODE_LEN; i++) out += ALPHABET[buf[i] % ALPHABET.length];
  return out;
}

async function mintJoinCode(): Promise<string> {
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const code = generateCode();
    const clash = await prisma.cooperative.findUnique({ where: { joinCode: code }, select: { id: true } });
    if (!clash) return code;
    logger.warn("coop.code_collision_retry", { attempt });
  }
  throw new Error("coop_code_exhausted");
}

export function normalizeJoinCode(code: string): string {
  return String(code || "").trim().toUpperCase();
}

/**
 * Create a cooperative with the given vendor as admin + first member. Throws
 * "already_member" if the vendor already belongs to one.
 */
export async function createCooperative(
  adminVendorId: string,
  input: { name: string; region?: string },
) {
  const vendor = await prisma.vendor.findUnique({
    where: { id: adminVendorId },
    select: { cooperativeId: true },
  });
  if (!vendor) throw new Error("vendor_not_found");
  if (vendor.cooperativeId) throw new Error("already_member");

  const joinCode = await mintJoinCode();
  const coop = await prisma.cooperative.create({
    data: {
      name: input.name.trim().slice(0, 120) || "Cooperative",
      region: (input.region || "").trim().slice(0, 80),
      joinCode,
      adminVendorId,
    },
  });
  await prisma.vendor.update({
    where: { id: adminVendorId },
    data: { cooperativeId: coop.id },
  });
  logger.info("coop.created", { coopId: coop.id, adminVendorId, joinCode });
  return coop;
}

/**
 * Add a vendor to a cooperative by join code. Idempotent if already a member of
 * that same coop. Returns the cooperative, or null for an unknown code.
 * Throws "already_member" if the vendor is in a *different* coop.
 */
export async function joinByCode(vendorId: string, code: string) {
  const joinCode = normalizeJoinCode(code);
  if (!joinCode) return null;

  const coop = await prisma.cooperative.findUnique({ where: { joinCode } });
  if (!coop) {
    logger.warn("coop.unknown_code", { vendorId, joinCode });
    return null;
  }

  const vendor = await prisma.vendor.findUnique({
    where: { id: vendorId },
    select: { cooperativeId: true },
  });
  if (!vendor) throw new Error("vendor_not_found");
  if (vendor.cooperativeId === coop.id) return coop;
  if (vendor.cooperativeId) throw new Error("already_member");

  await prisma.vendor.update({ where: { id: vendorId }, data: { cooperativeId: coop.id } });
  logger.info("coop.joined", { coopId: coop.id, vendorId });
  return coop;
}

export type LeaveCooperativeOutcome = "not_member" | "left" | "admin_transferred" | "dissolved";

/**
 * Remove a vendor safely. If the administrator leaves, transfer ownership to
 * the oldest active member; dissolve the cooperative when its last member leaves.
 */
export async function leaveCooperative(vendorId: string): Promise<LeaveCooperativeOutcome> {
  const outcome = await prisma.$transaction(async (tx) => {
    const vendor = await tx.vendor.findUnique({ where: { id: vendorId }, select: { cooperativeId: true } });
    if (!vendor) throw new Error("vendor_not_found");
    if (!vendor.cooperativeId) return "not_member" as const;

    const cooperative = await tx.cooperative.findUnique({
      where: { id: vendor.cooperativeId },
      select: { id: true, adminVendorId: true },
    });
    if (!cooperative) {
      await tx.vendor.update({ where: { id: vendorId }, data: { cooperativeId: null } });
      return "left" as const;
    }

    if (cooperative.adminVendorId !== vendorId) {
      await tx.vendor.updateMany({
        where: { id: vendorId, cooperativeId: cooperative.id },
        data: { cooperativeId: null },
      });
      return "left" as const;
    }

    const successor = await tx.vendor.findFirst({
      where: { cooperativeId: cooperative.id, deletedAt: null, id: { not: vendorId } },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      select: { id: true },
    });

    if (successor) {
      await tx.cooperative.update({
        where: { id: cooperative.id },
        data: { adminVendorId: successor.id },
      });
      await tx.vendor.update({ where: { id: vendorId }, data: { cooperativeId: null } });
      return "admin_transferred" as const;
    }

    await tx.cooperative.delete({ where: { id: cooperative.id } });
    return "dissolved" as const;
  });

  logger.info("coop.left", { vendorId, outcome });
  return outcome;
}

export type CooperativeView = {
  id: string;
  name: string;
  region: string;
  joinCode: string;
  isAdmin: boolean;
  memberCount: number;
  members: Array<{ id: string; shopName: string; shopSlug: string; createdAt: Date }>;
};

/** Full cooperative view for a vendor, or null if they're not in one. */
export async function getCooperativeForVendor(vendorId: string): Promise<CooperativeView | null> {
  const vendor = await prisma.vendor.findUnique({
    where: { id: vendorId },
    select: { cooperativeId: true },
  });
  if (!vendor?.cooperativeId) return null;

  const coop = await prisma.cooperative.findUnique({
    where: { id: vendor.cooperativeId },
    include: {
      members: {
        where: { deletedAt: null },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        select: { id: true, shopName: true, shopSlug: true, createdAt: true },
      },
    },
  });
  if (!coop) return null;

  return {
    id: coop.id,
    name: coop.name,
    region: coop.region,
    joinCode: coop.joinCode,
    isAdmin: coop.adminVendorId === vendorId,
    memberCount: coop.members.length,
    members: coop.members,
  };
}

/** Public lookup for the /join landing page. */
export async function getCooperativeByCode(code: string) {
  const joinCode = normalizeJoinCode(code);
  if (!joinCode) return null;
  const coop = await prisma.cooperative.findUnique({
    where: { joinCode },
    select: { id: true, name: true, region: true, joinCode: true },
  });
  if (!coop) return null;
  const memberCount = await prisma.vendor.count({
    where: { cooperativeId: coop.id, deletedAt: null },
  });
  return { ...coop, memberCount };
}

/**
 * Parse a free-text blob into valid phone numbers. Splits on newlines, commas,
 * semicolons, and tabs only — NOT spaces — so a formatted number like
 * "+228 90 00 00 00" survives as one entry.
 */
export function parsePhoneList(blob: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of String(blob || "").split(/[\n\r,;\t]+/)) {
    if (!raw) continue;
    const norm = normalizePhone(raw);
    if (isValidPhone(norm) && !seen.has(norm)) {
      seen.add(norm);
      out.push(norm);
    }
  }
  return out;
}

/** Send invitations and report API acceptance separately from demo simulation. */
export type CooperativeInviteSummary = {
  acceptedByApi: number;
  simulated: number;
  failed: number;
  attempted: number;
  notAttempted: number;
  failedPhones: string[];
  notAttemptedPhones: string[];
};

export async function inviteByPhones(opts: {
  vendorId: string;
  cooperative: { id: string; name: string; joinCode: string };
  phones: string[];
  appBaseUrl: string;
  send?: typeof sendWhatsApp;
}): Promise<CooperativeInviteSummary> {
  const joinUrl = `${opts.appBaseUrl.replace(/\/$/, "")}/join/${opts.cooperative.joinCode}`;
  const phones = opts.phones.slice(0, 200);
  const send = opts.send ?? sendWhatsApp;
  let acceptedByApi = 0;
  let simulated = 0;
  const failedPhones: string[] = [];

  for (const to of phones) {
    const body =
      `You're invited to join *${opts.cooperative.name}* on Japora — sell on WhatsApp with the rest of the market.\n\n` +
      `Tap to set up your shop (free, no app to install):\n${joinUrl}\n\n` +
      `Join code: ${opts.cooperative.joinCode}`;
    try {
      const result = await send({ vendorId: opts.vendorId, to, body });
      if (result.status === "sent") acceptedByApi++;
      else if (result.status === "stubbed") simulated++;
      else {
        failedPhones.push(to);
        logger.warn("coop.invite_send_failed", { status: result.status });
      }
    } catch (e) {
      failedPhones.push(to);
      logger.warn("coop.invite_send_failed", { error: String(e) });
    }
  }

  const summary = {
    acceptedByApi,
    simulated,
    failed: failedPhones.length,
    attempted: phones.length,
    notAttempted: opts.phones.length - phones.length,
    failedPhones,
    notAttemptedPhones: opts.phones.slice(phones.length),
  };
  logger.info("coop.invites_processed", {
    coopId: opts.cooperative.id,
    acceptedByApi,
    simulated,
    failed: failedPhones.length,
    attempted: phones.length,
    notAttempted: summary.notAttempted,
  });
  return summary;
}

export const __testing = { generateCode, parsePhoneList };
