import { NextResponse } from "next/server";
import { getCurrentVendor } from "@/lib/auth";
import { leaveCooperative } from "@/lib/cooperative";
import { getServerTr } from "@/lib/public-locale";

/** POST /api/cooperative/leave — remove the current vendor from its cooperative. */
export async function POST() {
  const tr = await getServerTr();
  const vendor = await getCurrentVendor();
  if (!vendor) return NextResponse.json({ error: tr("Veuillez vous connecter pour continuer.", "Please sign in to continue.") }, { status: 401 });
  try {
    const outcome = await leaveCooperative(vendor.id);
    return NextResponse.json({ ok: true, outcome });
  } catch {
    return NextResponse.json({ error: tr("Impossible de quitter la coopérative pour le moment.", "Could not leave the cooperative right now.") }, { status: 500 });
  }
}
