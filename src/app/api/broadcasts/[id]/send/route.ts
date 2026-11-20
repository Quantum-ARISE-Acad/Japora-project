import { NextRequest, NextResponse } from "next/server";
import { getCurrentVendor } from "@/lib/auth";
import { processBroadcastQueue, queueBroadcast } from "@/lib/broadcast";
import { logger } from "@/lib/logger";
import { getServerTr } from "@/lib/public-locale";

type Params = { params: Promise<{ id: string }> };

/** Validate vendor ownership and persist a recipient snapshot for the cron worker. */
export async function POST(_req: NextRequest, { params }: Params) {
  const tr = await getServerTr();
  const vendor = await getCurrentVendor();
  if (!vendor) {
    return NextResponse.json({ error: tr("Veuillez vous connecter pour continuer.", "Please sign in to continue.") }, { status: 401 });
  }

  const { id } = await params;
  const result = await queueBroadcast(vendor.id, id);
  if (!result.ok) {
    const status = result.reason === "not_found" ? 404 : result.reason === "already_started" ? 409 : 422;
    const message = {
      not_found: "Cet envoi est introuvable.",
      already_started: "Cet envoi a déjà été mis en file ou terminé.",
      no_recipients: "Aucun destinataire consentant ne correspond à ce segment.",
      quota_exceeded: "Le quota mensuel de messages marketing est dépassé.",
      invalid_template: "Le modèle WhatsApp doit être valide et approuvé avant l’envoi.",
    }[result.reason];
    return NextResponse.json({ error: message }, { status });
  }
  // Run one bounded item in the request so local development has visible
  // progress without a scheduler. Remaining rows stay durable for the cron.
  try {
    await processBroadcastQueue(1);
  } catch (error) {
    logger.error("broadcast.initial_batch_failed", { broadcastId: id, error: String(error) });
  }
  return NextResponse.json({ ok: true, status: "queued", targetCount: result.targetCount });
}
