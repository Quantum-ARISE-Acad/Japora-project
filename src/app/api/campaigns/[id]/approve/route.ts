import { NextRequest, NextResponse } from "next/server";
import { getCurrentVendor } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  approveRecoveryCampaign,
  dispatchRecoveryCampaign,
  getRecoveryApprovalPreview,
  rejectRecoveryCampaignApproval,
} from "@/lib/campaigns";
import { getServerTr } from "@/lib/public-locale";

function isReviewableStatus(status?: string | null) {
  return !status || ["draft", "approved", "blocked", "failed"].includes(status);
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const tr = await getServerTr();
  const vendor = await getCurrentVendor();
  if (!vendor) return NextResponse.json({ error: tr("Veuillez vous connecter.", "Please sign in.") }, { status: 401 });

  const { id } = await params;
  const campaign = await prisma.campaign.findFirst({
    where: { id, vendorId: vendor.id, deletedAt: null },
    select: {
      id: true,
      kind: true,
      name: true,
      productId: true,
      body: true,
      status: true,
      approvedAt: true,
      approvedForPhone: true,
      approvedBody: true,
      approvalHash: true,
    },
  });
  if (!campaign) return NextResponse.json({ error: tr("Introuvable", "Not found") }, { status: 404 });
  if (!["abandoned_cart", "reactivation"].includes(campaign.kind)) {
    return NextResponse.json({ error: tr("Cette action concerne uniquement une relance client.", "This action only applies to a customer follow-up.") }, { status: 409 });
  }

  const preview = await getRecoveryApprovalPreview(vendor.id, id);
  if (!preview) {
    return NextResponse.json({
      ok: true,
      campaign,
      preview: null,
      status: campaign.status,
      readyForApproval: false,
      reason: "no_pending_recovery_candidate",
    });
  }

  return NextResponse.json({
    ok: true,
    campaign,
    preview,
    status: campaign.status,
    readyForApproval: isReviewableStatus(campaign.status),
  });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const tr = await getServerTr();
  const vendor = await getCurrentVendor();
  if (!vendor) return NextResponse.json({ error: tr("Veuillez vous connecter.", "Please sign in.") }, { status: 401 });

  const { id } = await params;
  const campaign = await prisma.campaign.findFirst({
    where: { id, vendorId: vendor.id, deletedAt: null },
    select: {
      id: true,
      kind: true,
      name: true,
      productId: true,
      body: true,
      status: true,
    },
  });
  if (!campaign) return NextResponse.json({ error: tr("Introuvable", "Not found") }, { status: 404 });
  if (!["abandoned_cart", "reactivation"].includes(campaign.kind)) {
    return NextResponse.json({ error: tr("Cette action concerne uniquement une relance client.", "This action only applies to a customer follow-up.") }, { status: 409 });
  }

  const body = await req.json().catch(() => ({}));
  const action = String(body.action || "approve").trim();
  if (action === "reject") {
    const rejected = await rejectRecoveryCampaignApproval(vendor.id, id);
    if (!rejected) {
      return NextResponse.json({ error: tr("Impossible de refuser une campagne déjà envoyée.", "Cannot reject a sent campaign.") }, { status: 409 });
    }
    return NextResponse.json({ ok: true, rejected: true, campaign: rejected });
  }

  if (!["approve", "approve_and_send"].includes(action)) {
    return NextResponse.json({ error: tr("Action non prise en charge.", "Unsupported action") }, { status: 400 });
  }

  if (["sent", "stubbed", "sending", "archived"].includes(campaign.status)) {
    return NextResponse.json({ error: tr("La campagne est déjà terminée.", "Campaign is already in a terminal state.") }, { status: 409 });
  }

  const preview = await getRecoveryApprovalPreview(vendor.id, id);
  if (!preview) {
    return NextResponse.json({ error: tr("Aucun client en attente ne correspond à cette relance.", "No pending recovery candidate matches this campaign.") }, { status: 409 });
  }

  const approved = await approveRecoveryCampaign(vendor.id, id, {
    sessionId: preview.sessionId || undefined,
    recipientPhone: preview.phone,
    body: preview.renderedBody,
  });
  if (!approved) {
    return NextResponse.json({ error: tr("La campagne n'a pas pu être approuvée.", "Campaign could not be approved.") }, { status: 500 });
  }

  const result = action === "approve_and_send"
    ? await dispatchRecoveryCampaign(vendor.id, id)
    : { status: approved.status, sent: 0, failed: 0 };

  return NextResponse.json({
    ok: true,
    action,
    approved: true,
    approvedAt: Boolean(approved.approvedAt),
    campaign: approved,
    preview,
    result,
  });
}
