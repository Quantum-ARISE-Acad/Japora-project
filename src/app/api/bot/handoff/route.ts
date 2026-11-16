import { NextRequest, NextResponse } from "next/server";
import { getCurrentVendor } from "@/lib/auth";
import { resolveHandoff } from "@/lib/handoff";

/** The vendor gives a conversation back to the WhatsApp assistant. */
export async function POST(req: NextRequest) {
  const vendor = await getCurrentVendor();
  if (!vendor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const b = await req.json().catch(() => ({}));
  const contact = typeof b.contact === "string" ? b.contact.trim() : "";
  if (!contact) return NextResponse.json({ error: "Contact manquant." }, { status: 400 });

  const resolved = await resolveHandoff(vendor.id, contact);
  return NextResponse.json({ ok: true, resolved });
}
