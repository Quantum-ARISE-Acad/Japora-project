import { NextResponse } from "next/server";
import { getCurrentVendor } from "@/lib/auth";
import { leaveCooperative } from "@/lib/cooperative";

/** POST /api/cooperative/leave — remove the current vendor from its cooperative. */
export async function POST() {
  const vendor = await getCurrentVendor();
  if (!vendor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await leaveCooperative(vendor.id);
  return NextResponse.json({ ok: true });
}
