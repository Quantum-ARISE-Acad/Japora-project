import { NextResponse } from "next/server";
import { getCurrentVendor } from "@/lib/auth";
import { leaveCooperative } from "@/lib/cooperative";

/** POST /api/cooperative/leave — remove the current vendor from its cooperative. */
export async function POST() {
  const vendor = await getCurrentVendor();
  if (!vendor) return NextResponse.json({ error: "Veuillez vous connecter pour continuer." }, { status: 401 });
  try {
    const outcome = await leaveCooperative(vendor.id);
    return NextResponse.json({ ok: true, outcome });
  } catch {
    return NextResponse.json({ error: "Impossible de quitter la coopérative pour le moment." }, { status: 500 });
  }
}
