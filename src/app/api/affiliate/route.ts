import { NextRequest, NextResponse } from "next/server";
import { getCurrentVendor } from "@/lib/auth";
import { createAffiliate, listForVendor } from "@/lib/affiliate";
import { logger } from "@/lib/logger";

export async function GET() {
  const vendor = await getCurrentVendor();
  if (!vendor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const affiliates = await listForVendor(vendor.id);
  return NextResponse.json({ affiliates });
}

export async function POST(req: NextRequest) {
  const vendor = await getCurrentVendor();
  if (!vendor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const b = await req.json().catch(() => null);
  if (!b) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const code = String(b.code || "");
  const name = String(b.name || "");
  const rawPct = b.commissionPct;
  const commissionPct =
    typeof rawPct === "number"
      ? rawPct
      : parseFloat(String(rawPct ?? "0.1"));

  try {
    const affiliate = await createAffiliate(vendor.id, {
      code,
      name,
      commissionPct: Number.isFinite(commissionPct) ? commissionPct : 0.1,
    });
    return NextResponse.json({ ok: true, affiliate });
  } catch (e) {
    const msg = (e as Error).message;
    if (msg === "code_taken") {
      return NextResponse.json(
        { error: "That code is already taken. Try another." },
        { status: 409 },
      );
    }
    if (msg === "invalid_code") {
      return NextResponse.json(
        { error: "Code must be 3-32 chars, letters/digits/_/- only." },
        { status: 400 },
      );
    }
    if (msg === "invalid_name") {
      return NextResponse.json({ error: "Name is required." }, { status: 400 });
    }
    logger.error("affiliate.create_failed", { vendorId: vendor.id, error: msg });
    return NextResponse.json({ error: "Could not create affiliate." }, { status: 500 });
  }
}
