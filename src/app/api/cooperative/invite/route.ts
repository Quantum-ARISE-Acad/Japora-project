import { NextRequest, NextResponse } from "next/server";
import { getCurrentVendor } from "@/lib/auth";
import { getCooperativeForVendor, parsePhoneList, inviteByPhones } from "@/lib/cooperative";
import { getClientIp, rateLimit, tooManyRequests } from "@/lib/ratelimit";
import { appUrl } from "@/lib/token";
import { logger } from "@/lib/logger";

/**
 * POST /api/cooperative/invite { phones }
 *
 * Bulk WhatsApp invite — paste a list of numbers, we blast each the join link.
 * Members can invite; admins typically run it. Rate-limited per vendor since it
 * fans out messages.
 */
export async function POST(req: NextRequest) {
  const vendor = await getCurrentVendor();
  if (!vendor) return NextResponse.json({ error: "Veuillez vous connecter pour continuer." }, { status: 401 });

  const ip = getClientIp(req);
  const rl = rateLimit({ key: `coop.invite:${vendor.id}:${ip}`, limit: 10, windowMs: 60 * 60_000 });
  if (!rl.allowed) return tooManyRequests(rl, "Trop d’invitations. Réessayez dans quelques minutes.");

  const coop = await getCooperativeForVendor(vendor.id);
  if (!coop) return NextResponse.json({ error: "Vous n’appartenez pas encore à une coopérative." }, { status: 400 });

  const b = await req.json().catch(() => null);
  const phones = parsePhoneList(String(b?.phones || ""));
  if (phones.length === 0) {
    return NextResponse.json({ error: "Ajoutez au moins un numéro de téléphone valide." }, { status: 400 });
  }

  const summary = await inviteByPhones({
    vendorId: vendor.id,
    cooperative: { id: coop.id, name: coop.name, joinCode: coop.joinCode },
    phones,
    appBaseUrl: appUrl(""),
  });

  logger.info("coop.invite", {
    vendorId: vendor.id,
    coopId: coop.id,
    acceptedByApi: summary.acceptedByApi,
    simulated: summary.simulated,
    failed: summary.failed,
    attempted: summary.attempted,
  });
  return NextResponse.json({ ok: true, ...summary });
}
