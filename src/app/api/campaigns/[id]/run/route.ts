import { NextRequest, NextResponse } from "next/server";
import { getCurrentVendor } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { dispatchRecoveryCampaign } from "@/lib/campaigns";

/** Why a recovery message was not sent, in words the vendor understands. */
const REASONS: Record<string, string> = {
  merchant_approval_required: "Approuvez d'abord le message avant de l'envoyer.",
  no_candidate: "Ce client n'a plus de panier en attente : la relance n'est plus utile.",
  approval_mismatch: "Le message ou le destinataire a changé depuis l'approbation. Approuvez-le à nouveau.",
  dispatch_already_claimed: "Ce message est déjà en cours d'envoi.",
  weekly_message_limit: "Ce client a déjà reçu trop de messages cette semaine. Réessayez plus tard.",
  send_failed: "L'envoi WhatsApp a échoué. Réessayez dans quelques minutes.",
  unsupported_campaign_kind: "Cette action concerne uniquement une relance client.",
};

/**
 * POST /api/campaigns/[id]/run — sends an approved recovery message (abandoned
 * cart or reactivation) once. The approval itself happens in /approve.
 */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const vendor = await getCurrentVendor();
  if (!vendor) return NextResponse.json({ error: "Veuillez vous connecter." }, { status: 401 });

  const { id } = await params;
  const campaign = await prisma.campaign.findFirst({
    where: { id, vendorId: vendor.id, deletedAt: null },
    select: { id: true, kind: true, status: true },
  });
  if (!campaign) return NextResponse.json({ error: "Campagne introuvable." }, { status: 404 });
  if (!["abandoned_cart", "reactivation"].includes(campaign.kind)) {
    return NextResponse.json({ error: REASONS.unsupported_campaign_kind }, { status: 409 });
  }
  if (["sent", "stubbed"].includes(campaign.status)) {
    return NextResponse.json({ error: "Ce message a déjà été envoyé." }, { status: 409 });
  }
  if (campaign.status === "cancelled") {
    return NextResponse.json({ error: "Cette relance a été annulée." }, { status: 409 });
  }

  const result = await dispatchRecoveryCampaign(vendor.id, id);
  if (result.status === "sent" || result.status === "stubbed") {
    return NextResponse.json({ ok: true, ...result });
  }
  const error = (result.reason && REASONS[result.reason]) || "Le message n'a pas pu être envoyé.";
  return NextResponse.json({ ok: false, ...result, error }, { status: result.status === "failed" ? 502 : 409 });
}
