import { NextRequest, NextResponse } from "next/server";
import { getCurrentVendor } from "@/lib/auth";
import { joinByCode } from "@/lib/cooperative";
import { logger } from "@/lib/logger";
import { getServerTr } from "@/lib/public-locale";

/** POST /api/cooperative/join { code } — join a cooperative by its join code. */
export async function POST(req: NextRequest) {
  const tr = await getServerTr();
  const vendor = await getCurrentVendor();
  if (!vendor) return NextResponse.json({ error: tr("Veuillez vous connecter pour continuer.", "Please sign in to continue.") }, { status: 401 });

  const b = await req.json().catch(() => null);
  const code = String(b?.code || "").trim();
  if (!code) return NextResponse.json({ error: tr("Saisissez un code d’adhésion.", "Enter a membership code.") }, { status: 400 });

  try {
    const coop = await joinByCode(vendor.id, code);
    if (!coop) return NextResponse.json({ error: tr("Ce code ne correspond à aucune coopérative.", "This code does not match any cooperative.") }, { status: 404 });
    return NextResponse.json({ ok: true, cooperative: { id: coop.id, name: coop.name } });
  } catch (e) {
    const msg = String((e as Error)?.message || "");
    if (msg === "already_member") {
      return NextResponse.json({ error: tr("Vous appartenez déjà à une autre coopérative. Quittez-la avant de rejoindre celle-ci.", "You already belong to another cooperative. Leave it before joining this one.") }, { status: 409 });
    }
    logger.error("coop.join_failed", { vendorId: vendor.id, error: msg });
    return NextResponse.json({ error: tr("Impossible de rejoindre la coopérative pour le moment.", "Could not join the cooperative right now.") }, { status: 500 });
  }
}
