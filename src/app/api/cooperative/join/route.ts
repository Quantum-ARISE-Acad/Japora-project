import { NextRequest, NextResponse } from "next/server";
import { getCurrentVendor } from "@/lib/auth";
import { joinByCode } from "@/lib/cooperative";
import { logger } from "@/lib/logger";

/** POST /api/cooperative/join { code } — join a cooperative by its join code. */
export async function POST(req: NextRequest) {
  const vendor = await getCurrentVendor();
  if (!vendor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const b = await req.json().catch(() => null);
  const code = String(b?.code || "").trim();
  if (!code) return NextResponse.json({ error: "Enter a join code." }, { status: 400 });

  try {
    const coop = await joinByCode(vendor.id, code);
    if (!coop) return NextResponse.json({ error: "That join code doesn't match any cooperative." }, { status: 404 });
    return NextResponse.json({ ok: true, cooperative: { id: coop.id, name: coop.name } });
  } catch (e) {
    const msg = String((e as Error)?.message || "");
    if (msg === "already_member") {
      return NextResponse.json({ error: "You already belong to a different cooperative. Leave it first." }, { status: 409 });
    }
    logger.error("coop.join_failed", { vendorId: vendor.id, error: msg });
    return NextResponse.json({ error: "Could not join." }, { status: 500 });
  }
}
