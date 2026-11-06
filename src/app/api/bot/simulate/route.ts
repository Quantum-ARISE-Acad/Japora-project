import { NextRequest, NextResponse } from "next/server";
import { requireVendor } from "@/lib/auth";
import { respondTo, logBotEvent } from "@/lib/bot";
import { recordTouchFromText } from "@/lib/campaigns";
import { logger } from "@/lib/logger";

/**
 * Bot simulator. Lets a logged-in vendor type a message as if it came from a
 * customer and see exactly what their bot would reply — without needing Meta
 * Cloud API credentials. Hits the same respondTo() path the live webhook does.
 *
 * Persists a BotEvent so the conversation surfaces in admin logs alongside
 * real WhatsApp traffic; we tag it with from=simulator so it can be filtered.
 */
export async function POST(req: NextRequest) {
  const vendor = await requireVendor();

  const body = await req.json().catch(() => null);
  const text = String(body?.text || "").trim();
  const fromPhone = String(body?.fromPhone || "simulator").trim() || "simulator";

  if (!text) {
    return NextResponse.json({ error: "Type a message to simulate." }, { status: 400 });
  }
  if (text.length > 1000) {
    return NextResponse.json({ error: "Message too long (1000 char max)." }, { status: 400 });
  }

  try {
    // Mirror the live webhook: record a CTWA touch if the message carries a ref.
    await recordTouchFromText(vendor.id, fromPhone, text).catch(() => null);
    const { reply, intent, buttons } = await respondTo(vendor.id, fromPhone, text);
    await logBotEvent(vendor.id, `sim:${fromPhone}`, intent, text, true);
    logger.info("bot.simulate", { vendorId: vendor.id, intent });
    return NextResponse.json({ ok: true, reply, intent, buttons: buttons ?? [] });
  } catch (e) {
    logger.error("bot.simulate_failed", {
      vendorId: vendor.id,
      error: e instanceof Error ? e.message : String(e),
    });
    return NextResponse.json({ error: "Bot simulation failed." }, { status: 500 });
  }
}
