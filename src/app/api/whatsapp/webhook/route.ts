import { NextRequest } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/db";
import { sendWhatsApp, sendWhatsAppInteractive, applyStatusUpdate } from "@/lib/whatsapp";
import { respondTo, logBotEvent, parseIntent } from "@/lib/bot";
import { recordTouchFromText } from "@/lib/campaigns";
import { parseWhatsAppAssistantConfig } from "@/lib/whatsapp-config";
import { digitsOnly } from "@/lib/utils";

/**
 * Meta WhatsApp Cloud API webhook verification handshake.
 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const mode = sp.get("hub.mode") || sp.get("hub_mode");
  const token = sp.get("hub.verify_token") || sp.get("hub_verify_token");
  const challenge = sp.get("hub.challenge") || sp.get("hub_challenge");

  const envToken = process.env.WHATSAPP_VERIFY_TOKEN || "japora-verify-token";
  if (mode === "subscribe" && token) {
    if (
      token === envToken ||
      token === "japora-verify-token" ||
      token === "japora_whatsapp_verify_2026"
    ) {
      return new Response(challenge ?? "", { status: 200 });
    }
    const vendors = await prisma.vendor.findMany({
      where: { deletedAt: null },
      select: { uiPrefs: true },
      take: 50,
    });
    const matchedVendor = vendors.some(
      (v) => parseWhatsAppAssistantConfig(v.uiPrefs).whatsappVerifyToken === token,
    );
    if (matchedVendor) {
      return new Response(challenge ?? "", { status: 200 });
    }
  }
  logger.warn("whatsapp.webhook.verify_failed", { mode, hasToken: Boolean(token) });
  return new Response("Forbidden", { status: 403 });
}

function verifyMetaSignature(rawBody: string, signatureHeader: string | null): boolean {
  const appSecret = process.env.WHATSAPP_APP_SECRET;
  if (!appSecret) return true;
  if (!signatureHeader || !signatureHeader.startsWith("sha256=")) return false;
  const expected = createHmac("sha256", appSecret).update(rawBody).digest("hex");
  const provided = signatureHeader.slice(7);
  if (expected.length !== provided.length) return false;
  try {
    return timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(provided, "hex"));
  } catch {
    return false;
  }
}

/**
 * Resolve the target Vendor for an incoming WhatsApp webhook message:
 * 1) Explicit env override (`VENDOR_ID_FOR_PHONE_NUMBER_ID_<id>`)
 * 2) Shop slug in the message text, e.g. "(ma-boutique)" from a QR code prefill.
 *    It comes before the number owner because several shops share one bot number.
 * 3) `Vendor.whatsappPhoneNumberId` matching the incoming `phone_number_id`
 * 4) Recent conversation history (`WhatsAppMessage`)
 * 5) Fallback to the most recent active vendor
 */
async function resolveVendorIdForInbound(
  phoneNumberId: string | undefined,
  fromPhone: string,
  text: string,
): Promise<string | null> {
  // 1) Explicit operator mapping always wins.
  if (phoneNumberId) {
    const mapped = process.env[`VENDOR_ID_FOR_PHONE_NUMBER_ID_${phoneNumberId}`];
    if (mapped) return mapped;
  }

  // 2) Shop slug from the QR prefill: "(slug)". Look each candidate up directly
  // so every shop can match, not only the first few.
  const candidates = [...new Set(
    Array.from((text || "").toLowerCase().matchAll(/\(([a-z0-9][a-z0-9-]{0,80})\)/g), (m) => m[1]),
  )].slice(0, 5);
  if (candidates.length > 0) {
    const bySlug = await prisma.vendor.findFirst({
      where: { shopSlug: { in: candidates }, deletedAt: null },
      select: { id: true },
    });
    if (bySlug) return bySlug.id;
  }

  // 3) Vendor bound to this WhatsApp Phone Number ID.
  if (phoneNumberId) {
    const owner = await prisma.vendor.findFirst({
      where: { whatsappPhoneNumberId: phoneNumberId, deletedAt: null },
      select: { id: true },
    });
    if (owner) return owner.id;
  }

  // 4) Recent conversation history
  const cleanPhone = digitsOnly(fromPhone);
  if (cleanPhone) {
    const recentMsg = await prisma.whatsAppMessage.findFirst({
      where: {
        OR: [
          { contact: cleanPhone },
          { contact: { endsWith: cleanPhone.slice(-8) } },
        ],
      },
      orderBy: { createdAt: "desc" },
      select: { vendorId: true },
    });
    if (recentMsg?.vendorId) return recentMsg.vendorId;
  }

  // 5) Fallback to the most recent active vendor
  const first = await prisma.vendor.findFirst({
    where: { deletedAt: null },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });
  return first?.id ?? null;
}

type MetaText = { body?: string };
type MetaInteractive = {
  button_reply?: { id?: string; title?: string };
  list_reply?: { id?: string; title?: string };
};
type MetaReferral = { source_id?: string; ctwa_clid?: string };
type MetaMessage = {
  from?: string;
  type?: string;
  text?: MetaText;
  interactive?: MetaInteractive;
  button?: { payload?: string; text?: string };
  referral?: MetaReferral;
};
type MetaStatus = {
  id?: string;
  status?: string;
  recipient_id?: string;
};
type MetaValue = {
  metadata?: { phone_number_id?: string };
  messages?: MetaMessage[];
  statuses?: MetaStatus[];
};

function extractText(m: MetaMessage): string {
  if (m.interactive?.button_reply?.id) return m.interactive.button_reply.id;
  if (m.interactive?.list_reply?.id) return m.interactive.list_reply.id;
  if (m.button?.payload) return m.button.payload;
  if (m.interactive?.button_reply?.title) return m.interactive.button_reply.title;
  if (m.interactive?.list_reply?.title) return m.interactive.list_reply.title;
  if (m.button?.text) return m.button.text;
  if (m.text?.body) return m.text.body;
  return "";
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const sig = req.headers.get("x-hub-signature-256");

  if (!verifyMetaSignature(rawBody, sig)) {
    logger.warn("whatsapp.webhook.bad_signature", { hasSignature: Boolean(sig) });
    return new Response("Invalid signature", { status: 401 });
  }

  let body: unknown = null;
  try {
    body = rawBody ? JSON.parse(rawBody) : null;
  } catch {
    return new Response("EVENT_RECEIVED", { status: 200 });
  }

  // Detect public base URL (e.g. ngrok https URL) so links sent in WhatsApp work on mobile phones
  const forwardedHost = req.headers.get("x-forwarded-host");
  const forwardedProto = req.headers.get("x-forwarded-proto") || "https";
  if (forwardedHost && !process.env.NEXT_PUBLIC_PUBLIC_TUNNEL_URL) {
    process.env.NEXT_PUBLIC_PUBLIC_TUNNEL_URL = `${forwardedProto}://${forwardedHost}`;
  }

  try {
    const root = body as {
      entry?: { changes?: { value?: MetaValue }[] }[];
    } | null;

    for (const entry of root?.entry ?? []) {
      for (const change of entry.changes ?? []) {
        const value = change.value;
        const phoneNumberId = value?.metadata?.phone_number_id;

        for (const s of value?.statuses ?? []) {
          if (s.id && s.status) {
            try {
              await applyStatusUpdate(s.id, s.status);
            } catch (e) {
              logger.warn("whatsapp.webhook.status_update_failed", { error: String(e) });
            }
          }
        }

        for (const m of value?.messages ?? []) {
          const from = m.from || "";
          const text = extractText(m);
          const vendorId = await resolveVendorIdForInbound(phoneNumberId, from, text);

          logger.info("whatsapp.webhook.inbound", {
            from,
            type: m.type,
            vendorId,
            preview: text.slice(0, 80),
          });

          if (vendorId) {
            try {
              await prisma.whatsAppMessage.create({
                data: {
                  vendorId,
                  direction: "IN",
                  contact: digitsOnly(from) || from,
                  body: text,
                  status: "received",
                },
              });
            } catch (e) {
              logger.warn("whatsapp.webhook.persist_inbound_failed", {
                error: String(e),
              });
            }
          }

          if (!vendorId) {
            await logBotEvent(null, from, parseIntent(text).intent, text, false);
            continue;
          }

          try {
            await recordTouchFromText(vendorId, from, text, m.referral?.source_id ?? null);
          } catch (e) {
            logger.warn("whatsapp.webhook.touch_failed", { error: String(e) });
          }

          let responded = false;
          let intent = parseIntent(text).intent;
          try {
            const result = await respondTo(vendorId, from, text);
            intent = result.intent;
            if (from && result.reply) {
              if (result.buttons && result.buttons.length > 0) {
                const interactiveRes = await sendWhatsAppInteractive({
                  vendorId,
                  to: from,
                  body: result.reply,
                  buttons: result.buttons.slice(0, 3),
                });
                if (interactiveRes.status === "failed") {
                  await sendWhatsApp({ vendorId, to: from, body: result.reply });
                }
              } else {
                await sendWhatsApp({ vendorId, to: from, body: result.reply });
              }
              responded = true;
            }
          } catch (e) {
            logger.error("whatsapp.webhook.respond_failed", {
              vendorId,
              from,
              error: String(e),
            });
          }

          await logBotEvent(vendorId, from, intent, text, responded);
        }
      }
    }
  } catch (e) {
    logger.warn("whatsapp.webhook.parse_warning", { error: String(e) });
  }
  return new Response("EVENT_RECEIVED", { status: 200 });
}
