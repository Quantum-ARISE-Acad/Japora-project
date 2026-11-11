import { NextRequest, NextResponse } from "next/server";
import { getCurrentVendor } from "@/lib/auth";
import { joinByCode } from "@/lib/cooperative";
import { logger } from "@/lib/logger";

/** POST /api/cooperative/join { code } — join a cooperative by its join code. */
export async function POST(req: NextRequest) {
  const vendor = await getCurrentVendor();
  if (!vendor) return NextResponse.json({ error: "Veuillez vous connecter pour continuer." }, { status: 401 });

  const b = await req.json().catch(() => null);
  const code = String(b?.code || "").trim();
  if (!code) return NextResponse.json({ error: "Saisissez un code d’adhésion." }, { status: 400 });

  try {
    const coop = await joinByCode(vendor.id, code);
    if (!coop) return NextResponse.json({ error: "Ce code ne correspond à aucune coopérative." }, { status: 404 });
    return NextResponse.json({ ok: true, cooperative: { id: coop.id, name: coop.name } });
  } catch (e) {
    const msg = String((e as Error)?.message || "");
    if (msg === "already_member") {
      return NextResponse.json({ error: "Vous appartenez déjà à une autre coopérative. Quittez-la avant de rejoindre celle-ci." }, { status: 409 });
    }
    logger.error("coop.join_failed", { vendorId: vendor.id, error: msg });
    return NextResponse.json({ error: "Impossible de rejoindre la coopérative pour le moment." }, { status: 500 });
  }
}
