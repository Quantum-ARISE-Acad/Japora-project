import { NextRequest, NextResponse } from "next/server";
import { getCurrentVendor } from "@/lib/auth";
import { createCooperative, getCooperativeForVendor } from "@/lib/cooperative";
import { logger } from "@/lib/logger";

/** GET /api/cooperative — the vendor's cooperative (with roster), or null. */
export async function GET() {
  const vendor = await getCurrentVendor();
  if (!vendor) return NextResponse.json({ error: "Veuillez vous connecter pour continuer." }, { status: 401 });
  const cooperative = await getCooperativeForVendor(vendor.id);
  return NextResponse.json({ cooperative });
}

/** POST /api/cooperative — create a cooperative (caller becomes admin). */
export async function POST(req: NextRequest) {
  const vendor = await getCurrentVendor();
  if (!vendor) return NextResponse.json({ error: "Veuillez vous connecter pour continuer." }, { status: 401 });

  const b = await req.json().catch(() => null);
  const name = String(b?.name || "").trim();
  if (!name) return NextResponse.json({ error: "Saisissez le nom de votre association ou de votre marché." }, { status: 400 });

  try {
    const coop = await createCooperative(vendor.id, { name, region: String(b?.region || "") });
    return NextResponse.json({ ok: true, cooperative: coop });
  } catch (e) {
    const msg = String((e as Error)?.message || "");
    if (msg === "already_member") {
      return NextResponse.json({ error: "Vous appartenez déjà à une coopérative." }, { status: 409 });
    }
    logger.error("coop.create_failed", { vendorId: vendor.id, error: msg });
    return NextResponse.json({ error: "Impossible de créer la coopérative pour le moment." }, { status: 500 });
  }
}
