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

/** Remove a vendor from its cooperative. No-op if not in one. */
export async function leaveCooperative(vendorId: string) {
  await prisma.vendor.update({ where: { id: vendorId }, data: { cooperativeId: null } });
  logger.info("coop.left", { vendorId });
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
        orderBy: { createdAt: "asc" },
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

/**
 * Blast a join invite to a list of phones over WhatsApp. Stub-first: in dev the
 * WhatsApp layer logs each message; in prod it sends via the Cloud API (subject
 * to the 24h window / template rules). Returns how many were queued.
 */
export async function inviteByPhones(opts: {
  vendorId: string;
  cooperative: { id: string; name: string; joinCode: string };
  phones: string[];
  appBaseUrl: string;
}): Promise<{ sent: number; phones: string[] }> {
  const joinUrl = `${opts.appBaseUrl.replace(/\/$/, "")}/join/${opts.cooperative.joinCode}`;
  const phones = opts.phones.slice(0, 200); // sane cap per blast
  let sent = 0;
  for (const to of phones) {
    const body =
      `You're invited to join *${opts.cooperative.name}* on Japora — sell on WhatsApp with the rest of the market.\n\n` +
      `Tap to set up your shop (free, no app to install):\n${joinUrl}\n\n` +
      `Join code: ${opts.cooperative.joinCode}`;
    try {
      await sendWhatsApp({ vendorId: opts.vendorId, to, body });
      sent++;
    } catch (e) {
      logger.warn("coop.invite_send_failed", { to, error: String(e) });
    }
  }
  logger.info("coop.invites_sent", { coopId: opts.cooperative.id, count: sent });
  return { sent, phones };
}

export const __testing = { generateCode, parsePhoneList };
