import { NextRequest, NextResponse } from "next/server";
import { requireVendor } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { respondTo, logBotEvent } from "@/lib/bot";
import { sendWhatsApp } from "@/lib/whatsapp";
import { recordTouchFromText } from "@/lib/campaigns";
import { recordVendorActivity } from "@/lib/clerk-vendor-sync";
import { logger } from "@/lib/logger";

/**
 * Live WhatsApp Cloud API & Gemini AI Console endpoint.
 * Executes the real catalog + Gemini AI assistant against MySQL, records
 * real WhatsAppMessage & BotEvent rows in MySQL, and optionally dispatches
 * the message to the recipient's WhatsApp via Meta Cloud API.
 */
export async function POST(req: NextRequest) {
  const vendor = await requireVendor();

  const body = await req.json().catch(() => null);
  const text = String(body?.text || "").trim();
  const fromPhone =
    String(body?.fromPhone || vendor.whatsappNumber || "").replace(/[^\d+]/g, "") ||
    "22890000000";
  const dispatchWhatsApp = Boolean(body?.dispatchWhatsApp);

  if (!text) {
    return NextResponse.json({ error: "Veuillez saisir un message." }, { status: 400 });
  }
  if (text.length > 1000) {
    return NextResponse.json(
      { error: "Message trop long (1000 caractères max)." },
      { status: 400 },
    );
  }

  try {
    await recordTouchFromText(vendor.id, fromPhone, text).catch(() => null);

    // Record real inbound message in MySQL
    await prisma.whatsAppMessage.create({
      data: {
        vendorId: vendor.id,
        direction: "IN",
        contact: fromPhone,
        body: text,
        status: "received",
      },
    });

    const { reply, intent, buttons } = await respondTo(vendor.id, fromPhone, text);
    await logBotEvent(vendor.id, fromPhone, intent, text, true);

    let whatsappDelivery: Awaited<ReturnType<typeof sendWhatsApp>> | null = null;
    if (dispatchWhatsApp && fromPhone) {
      whatsappDelivery = await sendWhatsApp({
        vendorId: vendor.id,
        to: fromPhone,
        body: reply,
      });
    } else {
      await prisma.whatsAppMessage.create({
        data: {
          vendorId: vendor.id,
          direction: "OUT",
          contact: fromPhone,
          body: reply,
          status: "sent",
        },
      });
    }

    await recordVendorActivity({
      vendorId: vendor.id,
      type: "whatsapp.assistant.interaction",
      subjectType: "whatsapp",
      subjectId: fromPhone,
      data: {
        contact: fromPhone,
        intent,
        dispatchedToCloudApi: dispatchWhatsApp,
      },
    }).catch(() => {});

    logger.info("bot.live_console", { vendorId: vendor.id, intent, fromPhone });
    return NextResponse.json({
      ok: true,
      reply,
      intent,
      buttons: buttons ?? [],
      whatsappDelivery,
    });
  } catch (e) {
    logger.error("bot.live_console_failed", {
      vendorId: vendor.id,
      error: e instanceof Error ? e.message : String(e),
    });
    return NextResponse.json(
      { error: "Erreur lors du traitement par l'assistant WhatsApp." },
      { status: 500 },
    );
  }
}
