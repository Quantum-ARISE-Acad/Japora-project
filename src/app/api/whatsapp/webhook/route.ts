import { NextRequest } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/db";
import {
  sendWhatsApp,
  sendWhatsAppInteractive,
  applyStatusUpdate,
  recordVendorDiagnostic,
  resolveVendorCloudCredentials,
} from "@/lib/whatsapp";
import { respondTo, logBotEvent, parseIntent } from "@/lib/bot";
import { recordTouchFromText } from "@/lib/campaigns";
import {
  parseWhatsAppAssistantConfig,
  explainWhatsAppOrAiError,
} from "@/lib/whatsapp-config";
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
 * 1) Explicit shopSlug or shopName mention in message text (e.g. from QR code scan)
 * 2) `Vendor.whatsappPhoneNumberId` matching incoming `phone_number_id`
 * 3) Explicit env override (`VENDOR_ID_FOR_PHONE_NUMBER_ID_<id>`)
 * 4) Recent conversation history (`WhatsAppMessage`)
 * 5) Fallback to most recently created active vendor
 */
async function resolveVendorForInbound(
  phoneNumberId: string | undefined,
  fromPhone: string,
  text: string,
): Promise<{
  vendorId: string | null;
  matchedBy: "slug_mention" | "phone_number_id" | "env_map" | "recent_chat" | "latest_vendor" | "none";
  conflictingShopName?: string;
}> {
  const allVendors = await prisma.vendor.findMany({
    where: { deletedAt: null },
    select: {
      id: true,
      shopName: true,
      shopSlug: true,
      whatsappPhoneNumberId: true,
      uiPrefs: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  if (allVendors.length === 0) {
    return { vendorId: null, matchedBy: "none" };
  }

  // 1) If the message explicitly mentions a specific shopSlug or shopName (e.g. from QR code prefill)
  const lowerText = (text || "").toLowerCase();
  if (lowerText.length > 2) {
    const bySlugOrName = allVendors.find(
      (v) =>
        (v.shopSlug &&
          (lowerText.includes(`(${v.shopSlug.toLowerCase()})`) ||
            lowerText.includes(`/c/${v.shopSlug.toLowerCase()}`) ||
            lowerText.includes(`[${v.shopSlug.toLowerCase()}]`))) ||
        (v.shopName &&
          v.shopName.length >= 3 &&
          (lowerText.includes(`[${v.shopName.toLowerCase()}]`) ||
            lowerText.includes(`chez ${v.shopName.toLowerCase()}`))),
    );
    if (bySlugOrName) {
      return { vendorId: bySlugOrName.id, matchedBy: "slug_mention" };
    }
  }

  // 2) Vendor bound to this WhatsApp Phone Number ID
  if (phoneNumberId) {
    const mapped = process.env[`VENDOR_ID_FOR_PHONE_NUMBER_ID_${phoneNumberId}`];
    if (mapped) {
      return { vendorId: mapped, matchedBy: "env_map" };
    }

    const owner = allVendors.find((v) => v.whatsappPhoneNumberId === phoneNumberId);
    if (owner) {
      // Check if a newer shop was created that doesn't have a phoneNumberId set yet
      const newestVendor = allVendors[0];
      const conflictingShopName =
        newestVendor && newestVendor.id !== owner.id && !newestVendor.whatsappPhoneNumberId
          ? owner.shopName
          : undefined;
      return {
        vendorId: owner.id,
        matchedBy: "phone_number_id",
        conflictingShopName,
      };
    }
  }

  // 3) Vendor that has configured a WhatsApp Access Token in their Assistant settings
  const withToken = allVendors.find(
    (v) => Boolean(parseWhatsAppAssistantConfig(v.uiPrefs).whatsappAccessToken),
  );
  if (withToken) {
    return { vendorId: withToken.id, matchedBy: "phone_number_id" };
  }

  // 4) Recent conversation history
  const cleanPhone = digitsOnly(fromPhone);
  if (cleanPhone) {
    const recentMsg = await prisma.whatsAppMessage.findFirst({
      where: {
        OR: [
          { contact: cleanPhone },
          ...(cleanPhone.length >= 8 ? [{ contact: { endsWith: cleanPhone.slice(-8) } }] : []),
        ],
      },
      orderBy: { createdAt: "desc" },
      select: { vendorId: true },
    });
    if (recentMsg?.vendorId) {
      return { vendorId: recentMsg.vendorId, matchedBy: "recent_chat" };
    }
  }

  // 5) Fallback to most recently created active vendor
  return { vendorId: allVendors[0].id, matchedBy: "latest_vendor" };
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
type MetaStatusError = {
  code?: number;
  title?: string;
  message?: string;
  error_data?: { details?: string };
};
type MetaStatus = {
  id?: string;
  status?: string;
  recipient_id?: string;
  errors?: MetaStatusError[];
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
              if (s.status.toLowerCase() === "failed" && Array.isArray(s.errors) && s.errors.length > 0) {
                const errObj = s.errors[0];
                const rawErr = `Code ${errObj.code ?? ""}: ${errObj.title || ""} ${errObj.message || ""} ${errObj.error_data?.details || ""}`.trim();
                const msgRow = await prisma.whatsAppMessage.findFirst({
                  where: { messageId: s.id },
                  select: { vendorId: true, contact: true },
                });
                const targetVendorId =
                  msgRow?.vendorId ||
                  (await resolveVendorForInbound(phoneNumberId, s.recipient_id || "", "")).vendorId;
                if (targetVendorId) {
                  const explained = explainWhatsAppOrAiError(rawErr, "whatsapp_status");
                  await recordVendorDiagnostic(targetVendorId, {
                    stage: "whatsapp_status",
                    severity: "error",
                    title: explained.title,
                    message: explained.message,
                    details: rawErr,
                    fixHint: explained.fixHint,
                    contact: s.recipient_id || msgRow?.contact,
                  });
                }
              }
            } catch (e) {
              logger.warn("whatsapp.webhook.status_update_failed", { error: String(e) });
            }
          }
        }

        for (const m of value?.messages ?? []) {
          const from = m.from || "";
          const text = extractText(m);
          const resolved = await resolveVendorForInbound(phoneNumberId, from, text);
          const vendorId = resolved.vendorId;

          logger.info("whatsapp.webhook.inbound", {
            from,
            type: m.type,
            vendorId,
            matchedBy: resolved.matchedBy,
            phoneNumberId,
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

            // If a newer shop exists without phoneNumberId while an older shop claimed this phoneNumberId, notify both so the colleague sees it!
            if (resolved.conflictingShopName) {
              const newestVendor = await prisma.vendor.findFirst({
                where: { deletedAt: null, whatsappPhoneNumberId: null },
                orderBy: { createdAt: "desc" },
                select: { id: true, shopName: true },
              });
              if (newestVendor && newestVendor.id !== vendorId) {
                await recordVendorDiagnostic(newestVendor.id, {
                  stage: "webhook_routing",
                  severity: "warning",
                  title: `Message WhatsApp reçu mais routé vers « ${resolved.conflictingShopName} »`,
                  message: `Un message de ${from} est arrivé sur le Phone Number ID (${phoneNumberId}), qui est actuellement lié à la boutique « ${resolved.conflictingShopName} ».`,
                  fixHint: `Dans Dashboard → Assistant WhatsApp de « ${newestVendor.shopName} », renseignez le Phone Number ID ${phoneNumberId} et cliquez sur « Enregistrer » (puis confirmez le transfert) pour recevoir les messages sur cette boutique.`,
                  contact: from,
                  markWebhookReceived: true,
                });
              }
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

          // Check credentials before sending so we can warn if the shop is running in Stub mode
          const creds = await resolveVendorCloudCredentials(vendorId);
          if (!creds.token || !(phoneNumberId || creds.phoneNumberId)) {
            const explained = explainWhatsAppOrAiError("MISSING_CREDENTIALS", "whatsapp_send");
            await recordVendorDiagnostic(vendorId, {
              stage: "whatsapp_send",
              severity: "error",
              title: explained.title,
              message: explained.message,
              details: `Message reçu de ${from}: "${text.slice(0, 80)}". Aucun token Meta Cloud API configuré.`,
              fixHint: explained.fixHint,
              contact: from,
              markWebhookReceived: true,
            });
          } else {
            await recordVendorDiagnostic(vendorId, {
              stage: "system",
              severity: "ok",
              title: "Message Webhook WhatsApp reçu",
              message: `Message entrant reçu de ${from} : "${text.slice(0, 80)}"`,
              contact: from,
              markWebhookReceived: true,
            });
          }

          // Use the incoming webhook's phone_number_id if present so replies always exit from the exact Meta test number that received the message
          const outboundPhoneNumberId = phoneNumberId || creds.phoneNumberId;

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
                  overrideToken: creds.token,
                  overridePhoneNumberId: outboundPhoneNumberId,
                });
                if (interactiveRes.status === "failed") {
                  const fallbackRes = await sendWhatsApp({
                    vendorId,
                    to: from,
                    body: result.reply,
                    overrideToken: creds.token,
                    overridePhoneNumberId: outboundPhoneNumberId,
                  });
                  responded = fallbackRes.status === "sent";
                } else {
                  responded = interactiveRes.status === "sent";
                }
              } else {
                const sendRes = await sendWhatsApp({
                  vendorId,
                  to: from,
                  body: result.reply,
                  overrideToken: creds.token,
                  overridePhoneNumberId: outboundPhoneNumberId,
                });
                responded = sendRes.status === "sent";
              }
            }
          } catch (e) {
            const errStr = e instanceof Error ? e.message : String(e);
            logger.error("whatsapp.webhook.respond_failed", {
              vendorId,
              from,
              error: errStr,
            });
            await recordVendorDiagnostic(vendorId, {
              stage: "system",
              severity: "error",
              title: "Erreur interne lors de la génération de la réponse automatique",
              message: errStr.slice(0, 260),
              fixHint: "Vérifiez les journaux dans Dashboard → Assistant WhatsApp.",
              contact: from,
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
