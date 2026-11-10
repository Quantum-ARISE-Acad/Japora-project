/**
 * WhatsApp OTP — one-time codes for passwordless onboarding/login.
 *
 * The Togo unlock: a vendor signs up by entering their phone and tapping a
 * 6-digit code we send to their WhatsApp. No email, no password. We store only
 * the SHA-256 hash of the code (salted by phone), expire in 10 minutes, cap
 * attempts, and single-use it.
 *
 * Production note: to send the code *outside* the 24-hour service window you
 * must use a registered Authentication-category template. In dev / stub mode
 * the code is delivered via the WhatsApp stub (logged) and also returned to
 * the caller as `devCode` (NODE_ENV !== production) so the flow is testable.
 */
import { createHash, randomInt, timingSafeEqual } from "node:crypto";
import { prisma } from "./db";
import { digitsOnly } from "./utils";

const CODE_TTL_MS = 10 * 60_000;
const MAX_ATTEMPTS = 5;

export function normalizePhone(phone: string): string {
  return digitsOnly(phone);
}

export function isValidPhone(phone: string): boolean {
  const d = normalizePhone(phone);
  return d.length >= 8 && d.length <= 15;
}

function generateCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

function hashCode(phone: string, code: string): string {
  return createHash("sha256").update(`${normalizePhone(phone)}:${code}`).digest("hex");
}

/** Create a code row and return the plaintext (caller delivers it). */
export async function issueOtp(phone: string, purpose = "login"): Promise<string> {
  const norm = normalizePhone(phone);
  const code = generateCode();
  await prisma.otpCode.create({
    data: {
      phone: norm,
      codeHash: hashCode(norm, code),
      purpose,
      expiresAt: new Date(Date.now() + CODE_TTL_MS),
    },
  });
  return code;
}

export type OtpVerifyResult = { ok: true } | { ok: false; reason: string };

/** Check the latest unconsumed code for a phone; consume it on success. */
export async function verifyOtp(phone: string, code: string): Promise<OtpVerifyResult> {
  const norm = normalizePhone(phone);
  const rec = await prisma.otpCode.findFirst({
    where: { phone: norm, consumedAt: null },
    orderBy: { createdAt: "desc" },
  });
  if (!rec) return { ok: false, reason: "Request a new code." };
  if (rec.expiresAt < new Date()) return { ok: false, reason: "That code expired. Request a new one." };
  if (rec.attempts >= MAX_ATTEMPTS) return { ok: false, reason: "Too many tries. Request a new code." };

  const expected = rec.codeHash;
  const given = hashCode(norm, String(code).trim());
  let match = false;
  try {
    match =
      expected.length === given.length &&
      timingSafeEqual(Buffer.from(expected), Buffer.from(given));
  } catch {
    match = false;
  }

  if (!match) {
    await prisma.otpCode.update({
      where: { id: rec.id },
      data: { attempts: { increment: 1 } },
    });
    return { ok: false, reason: "Wrong code. Try again." };
  }

  await prisma.otpCode.update({ where: { id: rec.id }, data: { consumedAt: new Date() } });
  return { ok: true };
}

/**
 * Phone (WhatsApp OTP) sign-up is off by default: the WhatsApp line that
 * delivers the code is not connected yet. Set JAPORA_ENABLE_PHONE_SIGNUP=1
 * once it is.
 */
export function phoneSignupEnabled(): boolean {
  return process.env.JAPORA_ENABLE_PHONE_SIGNUP === "1";
}
