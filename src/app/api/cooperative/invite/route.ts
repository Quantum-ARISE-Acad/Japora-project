import { NextRequest, NextResponse } from "next/server";
import { getCurrentVendor } from "@/lib/auth";
import { getCooperativeForVendor, parsePhoneList, inviteByPhones } from "@/lib/cooperative";
import { getClientIp, rateLimit, tooManyRequests } from "@/lib/ratelimit";
import { appUrl } from "@/lib/token";
import { logger } from "@/lib/logger";
import { getServerTr } from "@/lib/public-locale";

/**
 * POST /api/cooperative/invite { phones }
 *
 * Bulk WhatsApp invite — paste a list of numbers, we blast each the join link.
 * Members can invite; admins typically run it. Rate-limited per vendor since it
 * fans out messages.
 */
export async function POST(req: NextRequest) {
  const tr = await getServerTr();
  const vendor = await getCurrentVendor();
  if (!vendor) return NextResponse.json({ error: tr("Veuillez vous connecter pour continuer.", "Please sign in to continue.") }, { status: 401 });

  const ip = getClientIp(req);
  const rl = rateLimit({ key: `coop.invite:${vendor.id}:${ip}`, limit: 10, windowMs: 60 * 60_000 });
  if (!rl.allowed) return tooManyRequests(rl, "Trop d’invitations. Réessayez dans quelques minutes.");

  const coop = await getCooperativeForVendor(vendor.id);
  if (!coop) return NextResponse.json({ error: tr("Vous n’appartenez pas encore à une coopérative.", "You don't belong to a cooperative yet.") }, { status: 400 });

  const b = await req.json().catch(() => null);
  const phones = parsePhoneList(String(b?.phones || ""));
  if (phones.length === 0) {
    return NextResponse.json({ error: tr("Ajoutez au moins un numéro de téléphone valide.", "Add at least one valid phone number.") }, { status: 400 });
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
