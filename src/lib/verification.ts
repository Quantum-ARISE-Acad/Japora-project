import type { Vendor } from "@prisma/client";
import { prisma } from "./db";
import { sendEmail } from "./email";
import { verifyEmailTemplate } from "./email-templates";
import { appUrl, generateToken } from "./token";
import { logger } from "./logger";

/**
 * Create a verification token + send the email. Used by signup and the
 * "resend verification" action.
 */
export async function issueVerificationEmail(vendor: Pick<Vendor, "id" | "email">) {
  const { token, hash } = generateToken();
  await prisma.emailVerificationToken.create({
    data: {
      vendorId: vendor.id,
      tokenHash: hash,
      expiresAt: new Date(Date.now() + 24 * 60 * 60_000), // 24h
    },
  });

  const verifyUrl = appUrl(`/verify-email/${token}`);
  const rendered = verifyEmailTemplate({ verifyUrl });
  await sendEmail({
    vendorId: vendor.id,
    to: vendor.email,
    subject: rendered.subject,
    html: rendered.html,
    text: rendered.text,
    template: "verify_email",
  });

  logger.info("auth.verify.sent", { vendorId: vendor.id, verifyUrl });
  return { token, verifyUrl };
}
