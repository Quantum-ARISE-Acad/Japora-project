import { NextRequest, NextResponse } from "next/server";
import { issueOtp, isValidPhone, normalizePhone } from "@/lib/otp";
import { checkWhatsAppNumber } from "@/lib/whatsapp-number";
import { getProvider } from "@/lib/whatsapp";
import { getClientIp, rateLimit, tooManyRequests } from "@/lib/ratelimit";
import { logger } from "@/lib/logger";
import { phoneSignupEnabled } from "@/lib/otp";
import { getServerTr } from "@/lib/public-locale";

/**
 * POST /api/auth/otp/request  { phone }
 *
 * Issues a 6-digit WhatsApp code. Rate-limited per IP and per phone so it
 * can't be used to spam someone's WhatsApp. In dev/stub mode the code is
 * returned as `devCode` so the flow is testable without live credentials.
 */
export async function POST(req: NextRequest) {
  const tr = await getServerTr();
  if (!phoneSignupEnabled()) {
    return NextResponse.json(
      { error: tr("L'inscription par téléphone n'est pas encore disponible. Inscrivez-vous avec votre e-mail.", "Phone sign-up is not available yet. Please sign up with your email.") },
      { status: 503 },
    );
  }
  const ip = getClientIp(req);
  const ipRl = rateLimit({ key: `otp.req.ip:${ip}`, limit: 10, windowMs: 15 * 60_000 });
  if (!ipRl.allowed) return tooManyRequests(ipRl, "Too many code requests. Try again later.");

  const body = await req.json().catch(() => null);
  // The number becomes the shop's WhatsApp number: its country code is required.
  const waCheck = checkWhatsAppNumber(String(body?.phone || ""));
  const phone = waCheck.ok ? waCheck.digits : normalizePhone(String(body?.phone || ""));
  if (!waCheck.ok || !isValidPhone(phone)) {
    return NextResponse.json(
      { error: waCheck.ok ? tr("Numéro invalide.", "Invalid number.") : tr(waCheck.error, waCheck.errorEn) },
      { status: 400 },
    );
  }

  const phoneRl = rateLimit({ key: `otp.req.phone:${phone}`, limit: 4, windowMs: 15 * 60_000 });
  if (!phoneRl.allowed) {
    return tooManyRequests(phoneRl, "A code was just sent. Wait a moment before retrying.");
  }

  const code = await issueOtp(phone, "login");

  // Deliver via the active WhatsApp provider (stub logs; live sends a text /
  // — in production wire this to an Authentication-category template).
  try {
    await getProvider().send({
      vendorId: "otp",
      to: phone,
      body: `Your Japora code is ${code}. It expires in 10 minutes. Don't share it.`,
    });
  } catch (e) {
    logger.error("otp.send_failed", { error: e instanceof Error ? e.message : String(e) });
  }
  logger.info("otp.requested", { phone });

  const res: Record<string, unknown> = { ok: true };
  if (process.env.NODE_ENV !== "production") res.devCode = code;
  return NextResponse.json(res);
}
