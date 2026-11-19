import { NextRequest, NextResponse } from "next/server";
import { getCurrentVendor } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getServerTr } from "@/lib/public-locale";

/**
 * POST /api/campaigns/[id]/cancel — the vendor decides not to send a recovery
 * message (abandoned cart or reactivation). The campaign stays "cancelled": the
 * same cart or customer does not create a new draft (one recoveryKey per vendor).
 */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const tr = await getServerTr();
  const vendor = await getCurrentVendor();
  if (!vendor) return NextResponse.json({ error: tr("Veuillez vous connecter.", "Please sign in.") }, { status: 401 });

  const { id } = await params;
  const campaign = await prisma.campaign.findFirst({
    where: { id, vendorId: vendor.id, deletedAt: null },
    select: { id: true, kind: true, status: true },
  });
  if (!campaign) return NextResponse.json({ error: tr("Campagne introuvable.", "Campaign not found.") }, { status: 404 });
  if (!["abandoned_cart", "reactivation"].includes(campaign.kind)) {
    return NextResponse.json({ error: tr("Cette action concerne uniquement une relance client.", "This action only applies to a customer follow-up.") }, { status: 409 });
  }

  // Only a message not yet sent can be cancelled; the update is conditional so a
  // send that starts at the same moment cannot be overwritten.
  const updated = await prisma.campaign.updateMany({
    where: { id, vendorId: vendor.id, status: { in: ["draft", "approved", "blocked", "failed"] } },
    data: {
      status: "cancelled",
      approvedAt: null,
      approvedForPhone: null,
      approvedBody: null,
      approvalHash: null,
    },
  });
  if (updated.count !== 1) {
    const already = campaign.status === "cancelled";
    return NextResponse.json(
      { error: already ? "Cette relance est déjà annulée." : "Ce message est déjà envoyé : il ne peut plus être annulé." },
      { status: 409 },
    );
  }
  return NextResponse.json({ ok: true, status: "cancelled" });
}
