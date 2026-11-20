import { NextRequest, NextResponse } from "next/server";
import { getCurrentVendor } from "@/lib/auth";
import { resolveHandoff } from "@/lib/handoff";
import { getServerTr } from "@/lib/public-locale";

/** The vendor gives a conversation back to the WhatsApp assistant. */
export async function POST(req: NextRequest) {
  const tr = await getServerTr();
  const vendor = await getCurrentVendor();
  if (!vendor) return NextResponse.json({ error: tr("Veuillez vous connecter.", "Please sign in.") }, { status: 401 });

  const b = await req.json().catch(() => ({}));
  const contact = typeof b.contact === "string" ? b.contact.trim() : "";
  if (!contact) return NextResponse.json({ error: tr("Contact manquant.", "Missing contact.") }, { status: 400 });

  const resolved = await resolveHandoff(vendor.id, contact);
  return NextResponse.json({ ok: true, resolved });
}
