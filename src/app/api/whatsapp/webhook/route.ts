import { NextRequest } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/db";
import {
  sendWhatsApp,
  sendWhatsAppInteractive,
  sendSharedNumberPicker,
  applyStatusUpdate,
  downloadWhatsAppMedia,
  recordVendorDiagnostic,
  resolveVendorCloudCredentials,
} from "@/lib/whatsapp";
import {
  respondTo,
  respondToPhoto,
  transcribeVoiceNote,
  voiceNotHeardReply,
  logBotEvent,
  parseIntent,
  type BotReply,
} from "@/lib/bot";
import { activeHandoff } from "@/lib/handoff";
import { recordTouchFromText } from "@/lib/campaigns";
import {
  parseWhatsAppAssistantConfig,
  explainWhatsAppOrAiError,
} from "@/lib/whatsapp-config";
import { digitsOnly } from "@/lib/utils";
import { publicOrigin } from "@/lib/public-origin";
import {
  allShopsReply,
  buildShopPicker,
  isSharedBotNumber,
  matchShopsByName,
  parseShopPick,
  shopChosenPreamble,
  wantsShopSwitch,
  type PickerShop,
} from "@/lib/shop-picker";

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

/** Where an inbound message goes: a shop, or the "Quelle boutique ?" list. */
type InboundRoute =
  | { kind: "vendor"; vendorId: string; chosenShopName?: string; qrOpening?: boolean }
  | { kind: "ask"; shops: PickerShop[] }
  | { kind: "all_shops" }
  | { kind: "none" };

/** Public shops offered in the "Quelle boutique ?" list (most recent first). */
async function pickerShops(): Promise<(PickerShop & { id: string })[]> {
  const rows = await prisma.vendor.findMany({
    where: { deletedAt: null, isPublic: true },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: { id: true, shopName: true, shopSlug: true, category: true, tagline: true },
  });
  return rows.map((r) => ({
    id: r.id,
    shopName: r.shopName,
    shopSlug: r.shopSlug,
    description: r.tagline || r.category || "",
  }));
}

/**
 * Route an incoming WhatsApp message:
 * 1) Explicit env override (`VENDOR_ID_FOR_PHONE_NUMBER_ID_<id>`)
 * 2) A choice from the "Quelle boutique ?" list ("japora-shop:<slug>")
 * 3) Shop slug in the message text, e.g. "(ma-boutique)" from a QR code prefill
 * 4) A vendor's own number: `Vendor.whatsappPhoneNumberId` = incoming `phone_number_id`
 *    (skipped on the shared Japora number, which serves every shop)
 * 5) On the shared number, "changer de boutique" shows the list again
 * 6) Recent conversation history (`WhatsAppMessage`): the customer stays with their shop
 * 7) On the shared number: a single shop, or the shop the customer named;
 *    otherwise ask "Avec quelle boutique voulez-vous parler ?"
 * 8) Elsewhere, fallback to the most recent active vendor
 */
async function routeInbound(
  phoneNumberId: string | undefined,
  fromPhone: string,
  text: string,
): Promise<InboundRoute> {
  // 1) Explicit operator mapping always wins.
  if (phoneNumberId) {
    const mapped = process.env[`VENDOR_ID_FOR_PHONE_NUMBER_ID_${phoneNumberId}`];
    if (mapped) return { kind: "vendor", vendorId: mapped };
  }

  // 2) A row of the "Quelle boutique ?" list.
  const pick = parseShopPick(text);
  if (pick === "*") return { kind: "all_shops" };
  if (pick) {
    const chosen = await prisma.vendor.findFirst({
      where: { shopSlug: pick, deletedAt: null },
      select: { id: true, shopName: true },
    });
    if (chosen) return { kind: "vendor", vendorId: chosen.id, chosenShopName: chosen.shopName };
    return { kind: "ask", shops: await pickerShops() };
  }

  // 3) Shop slug from the QR prefill: "(slug)". Look each candidate up directly
  // so every shop can match, not only the first few.
  const candidates = [...new Set(
    Array.from((text || "").toLowerCase().matchAll(/\(([a-z0-9][a-z0-9-]{0,80})\)/g), (m) => m[1]),
  )].slice(0, 5);
  if (candidates.length > 0) {
    const bySlug = await prisma.vendor.findFirst({
      where: { shopSlug: { in: candidates }, deletedAt: null },
      select: { id: true },
    });
    // The QR prefill ("Je viens de scanner votre QR code…") opens the conversation.
    if (bySlug) return { kind: "vendor", vendorId: bySlug.id, qrOpening: /scann/i.test(text) };
  }

  const shared = isSharedBotNumber(phoneNumberId);

  // 4) Vendor bound to this WhatsApp Phone Number ID (their own line).
  if (phoneNumberId && !shared) {
    const owner = await prisma.vendor.findFirst({
      where: { whatsappPhoneNumberId: phoneNumberId, deletedAt: null },
      select: { id: true },
    });
    if (owner) return { kind: "vendor", vendorId: owner.id };
  }

  // 5) "changer de boutique" on the shared number.
  if (shared && wantsShopSwitch(text)) {
    const shops = await pickerShops();
    if (shops.length > 1) return { kind: "ask", shops };
  }

  // 6) Recent conversation history
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
    if (recentMsg?.vendorId) return { kind: "vendor", vendorId: recentMsg.vendorId };
  }

  // 7) Shared number, new customer, no tag: never guess between several shops.
  if (shared) {
    const shops = await pickerShops();
    if (shops.length === 1) return { kind: "vendor", vendorId: shops[0].id };
    const named = matchShopsByName(text, shops);
    if (named.length === 1) {
      return { kind: "vendor", vendorId: named[0].id, chosenShopName: named[0].shopName };
    }
    if (shops.length > 1) return { kind: "ask", shops };
  }

  // 8) Fallback to the most recent active vendor
  const first = await prisma.vendor.findFirst({
    where: { deletedAt: null },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });
  return first ? { kind: "vendor", vendorId: first.id } : { kind: "none" };
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
  audio?: { id?: string; mime_type?: string; voice?: boolean };
  image?: { id?: string; mime_type?: string; caption?: string };
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
  // A photo's caption can carry the "(slug)" tag and the customer's question.
  if (m.image?.caption) return m.image.caption;
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
                // Only the shop that sent the message is alerted: never guess another shop.
                const targetVendorId = msgRow?.vendorId;
                if (targetVendorId) {
                  const explained = explainWhatsAppOrAiError(rawErr, "whatsapp_status");
                  await recordVendorDiagnostic(targetVendorId, {
                    stage: "whatsapp_status",
                    severity: "error",
                    ...explained,
                    details: rawErr,
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
          const rawText = extractText(m);
          const route = await routeInbound(phoneNumberId, from, rawText);

          // No shop chosen yet on the shared number: ask, or send the directory.
          if (route.kind === "ask" || route.kind === "all_shops") {
            const origin = process.env.NEXT_PUBLIC_PUBLIC_TUNNEL_URL || publicOrigin(req);
            let sent: { status: string };
            if (route.kind === "ask") {
              const picker = buildShopPicker(route.shops, { text: rawText, origin });
              sent = await sendSharedNumberPicker({
                to: from,
                phoneNumberId,
                body: picker.body,
                footer: picker.footer,
                listButton: picker.listButton,
                sections: picker.sections,
                textFallback: picker.textFallback,
              });
            } else {
              const reply = allShopsReply(origin);
              sent = await sendSharedNumberPicker({ to: from, phoneNumberId, body: reply, textFallback: reply });
            }
            logger.info("whatsapp.webhook.shop_picker", { from, kind: route.kind, preview: rawText.slice(0, 80) });
            await logBotEvent(null, from, "menu", rawText, sent.status !== "failed");
            continue;
          }

          const vendorId = route.kind === "vendor" ? route.vendorId : null;
          const chosenShopName = route.kind === "vendor" ? route.chosenShopName : undefined;
          const picked = parseShopPick(rawText) !== null;
          // A list choice or a QR scan opens the conversation with the shop's
          // welcome, which does not depend on Gemini being available.
          const opening = picked || (route.kind === "vendor" && route.qrOpening === true);
          let text = opening ? "Bonjour" : rawText;
          let storedBody = picked ? "Bonjour (boutique choisie dans la liste)" : rawText;

          // Voice notes are transcribed and answered like text; photos are
          // searched in the shop's catalog. Both use Gemini.
          let mediaReply: BotReply | null = null;
          let voicePrefix = "";
          if (vendorId && m.type === "audio" && m.audio?.id) {
            const transcript = await transcribeVoiceNote(
              vendorId,
              await downloadWhatsAppMedia(vendorId, m.audio.id),
            );
            if (transcript) {
              text = transcript;
              storedBody = `[vocal] ${transcript}`;
              voicePrefix = `Vous avez dit : « ${transcript.slice(0, 300)} »\n\n`;
            } else {
              storedBody = "[vocal non transcrit]";
              mediaReply = (await activeHandoff(vendorId, from))
                ? { reply: "", intent: "handoff" }
                : voiceNotHeardReply();
            }
          } else if (vendorId && m.type === "image" && m.image?.id) {
            const caption = m.image.caption || "";
            storedBody = caption ? `[photo] ${caption}` : "[photo]";
            mediaReply = await respondToPhoto(
              vendorId,
              from,
              await downloadWhatsAppMedia(vendorId, m.image.id),
              caption,
            );
          }

          logger.info("whatsapp.webhook.inbound", {
            from,
            type: m.type,
            vendorId,
            route: route.kind,
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
                  body: storedBody,
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

          // Check credentials before sending so we can warn if the shop is running in Stub mode
          const creds = await resolveVendorCloudCredentials(vendorId);
          if (!creds.token || !creds.phoneNumberId) {
            const explained = explainWhatsAppOrAiError("MISSING_CREDENTIALS", "whatsapp_send");
            await recordVendorDiagnostic(vendorId, {
              stage: "whatsapp_send",
              severity: "error",
              ...explained,
              details: `Message reçu de ${from}: "${text.slice(0, 80)}". Aucun token Meta Cloud API configuré.`,
              contact: from,
              markWebhookReceived: true,
            });
          } else {
            await recordVendorDiagnostic(vendorId, {
              stage: "system",
              severity: "ok",
              title: "Message WhatsApp reçu par le webhook",
              message: `Message entrant reçu de ${from} : "${text.slice(0, 80)}"`,
              titleEn: "WhatsApp message received by the webhook",
              messageEn: `Incoming message from ${from}: "${text.slice(0, 80)}"`,
              contact: from,
              markWebhookReceived: true,
            });
          }

          // Reply with one consistent pair: the shop's own line (its token + its number),
          // or Japora's shared number (server token + shared number). Never mix the two.
          const outboundPhoneNumberId = creds.phoneNumberId;

          let responded = false;
          let intent = parseIntent(text).intent;
          try {
            const result = mediaReply ?? (await respondTo(vendorId, from, text));
            intent = result.intent;
            if (voicePrefix && result.reply) result.reply = `${voicePrefix}${result.reply}`;
            if (chosenShopName && result.reply) {
              result.reply = `${shopChosenPreamble(chosenShopName)}\n\n${result.reply}`;
            }
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
              title: "Erreur interne pendant la réponse automatique",
              message: errStr.slice(0, 260),
              fixHint: "Consultez les journaux dans Tableau de bord → Assistant WhatsApp.",
              titleEn: "Internal error while generating the automatic reply",
              messageEn: errStr.slice(0, 260),
              fixHintEn: "Check the logs in Dashboard → WhatsApp Assistant.",
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
