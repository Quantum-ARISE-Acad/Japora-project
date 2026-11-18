import { NextRequest, NextResponse } from "next/server";
import { getCurrentVendor } from "@/lib/auth";
import { softDeleteCampaign, getCampaign } from "@/lib/campaigns";
import {
  getVendorMetaCampaignMap,
  saveVendorMetaCampaignDetails,
  syncOrSimulateMetaInsights,
  updateMetaCampaignLifecycle,
} from "@/lib/meta-marketing";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const vendor = await getCurrentVendor();
  if (!vendor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const [campaign, metaMap] = await Promise.all([
    getCampaign(vendor.id, id),
    getVendorMetaCampaignMap(vendor.id),
  ]);
  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({
    campaign: {
      ...campaign,
      metaDetails: metaMap[id] ?? null,
    },
  });
}

/**
 * PATCH /api/campaigns/:id — control campaign lifecycle (ACTIVE / PAUSED / ARCHIVED),
 * update daily budget, or sync/simulate Meta Marketing API insights.
 */
export async function PATCH(req: NextRequest, { params }: Params) {
  const vendor = await getCurrentVendor();
  if (!vendor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const existing = await getCampaign(vendor.id, id);
  if (!existing) {
    return NextResponse.json({ error: "Campagne introuvable." }, { status: 404 });
  }

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const action = String(body.action || "");

  if (action === "set_status") {
    const requested = String(body.status || "PAUSED").toUpperCase();
    const nextMetaStatus: "ACTIVE" | "PAUSED" | "ARCHIVED" =
      requested === "ACTIVE"
        ? "ACTIVE"
        : requested === "ARCHIVED"
          ? "ARCHIVED"
          : "PAUSED";

    const updatedMeta = await updateMetaCampaignLifecycle(
      vendor.id,
      id,
      nextMetaStatus,
    );
    const updatedCampaign = await getCampaign(vendor.id, id);
    return NextResponse.json({
      ok: true,
      campaign: updatedCampaign
        ? {
            ...updatedCampaign,
            metaDetails: updatedMeta,
          }
        : null,
    });
  }

  if (action === "sync_insights") {
    const simulateBoost = body.simulateBoost !== false;
    const updatedMeta = await syncOrSimulateMetaInsights(vendor.id, id, {
      simulateTrafficBoost: simulateBoost,
    });
    const updatedCampaign = await getCampaign(vendor.id, id);
    return NextResponse.json({
      ok: true,
      campaign: updatedCampaign
        ? {
            ...updatedCampaign,
            metaDetails: updatedMeta,
          }
        : null,
    });
  }

  if (action === "update_budget") {
    const dailyBudgetMajor = Number(body.dailyBudget);
    if (!Number.isFinite(dailyBudgetMajor) || dailyBudgetMajor <= 0) {
      return NextResponse.json(
        { error: "Budget quotidien invalide." },
        { status: 400 },
      );
    }
    const dailyBudgetCents = Math.round(dailyBudgetMajor * 100);
    const map = await getVendorMetaCampaignMap(vendor.id);
    const meta = map[id];
    if (meta) {
      meta.dailyBudgetCents = dailyBudgetCents;
      meta.updatedAt = new Date().toISOString();
      await saveVendorMetaCampaignDetails(vendor.id, id, meta);
    }
    const updatedCampaign = await getCampaign(vendor.id, id);
    return NextResponse.json({
      ok: true,
      campaign: updatedCampaign
        ? {
            ...updatedCampaign,
            metaDetails: meta ?? null,
          }
        : null,
    });
  }

  return NextResponse.json({ error: "Action non reconnue." }, { status: 400 });
}

/** DELETE /api/campaigns/:id — archive (soft-delete). Stops new attribution. */
export async function DELETE(_req: NextRequest, { params }: Params) {
  const vendor = await getCurrentVendor();
  if (!vendor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  await updateMetaCampaignLifecycle(vendor.id, id, "ARCHIVED").catch(() => null);
  const ok = await softDeleteCampaign(vendor.id, id);
  if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
