import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentVendor } from "@/lib/auth";
import {
  isSegment,
  segmentRecipients,
  type BroadcastSegment,
} from "@/lib/broadcast";
import { isLiveMode } from "@/lib/whatsapp";

const MAX_BODY_LEN = 1000;

export async function GET(req: NextRequest) {
  const vendor = await getCurrentVendor();
  if (!vendor) {
    return NextResponse.json({ error: "Veuillez vous connecter pour continuer." }, { status: 401 });
  }

  // Side route: recipient counts for the composer's live segment chips.
  // Living here keeps it discoverable and avoids an extra route file.
  const segment = req.nextUrl.searchParams.get("recipientsFor");
  if (segment) {
    if (!isSegment(segment)) {
      return NextResponse.json({ error: "Ce segment de clients n’est pas valide." }, { status: 400 });
    }
    const recipients = await segmentRecipients(
      vendor.id,
      segment as BroadcastSegment,
    );
    return NextResponse.json({ segment, count: recipients.length });
  }

  const broadcasts = await prisma.broadcast.findMany({
    where: { vendorId: vendor.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return NextResponse.json({ broadcasts });
}

export async function POST(req: NextRequest) {
  const vendor = await getCurrentVendor();
  if (!vendor) {
    return NextResponse.json({ error: "Veuillez vous connecter pour continuer." }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "La demande est invalide." }, { status: 400 });
  }

  const text = String(body.body ?? "").trim();
  const messageMode = body.messageMode === "template" ? "template" : "text";
  if (body.messageMode && body.messageMode !== "text" && body.messageMode !== "template") {
    return NextResponse.json({ error: "Le type de message n’est pas valide." }, { status: 400 });
  }
  if (messageMode === "text" && !text) {
    return NextResponse.json(
      { error: "Saisissez le message à envoyer." },
      { status: 400 },
    );
  }
  if (messageMode === "text" && text.length > MAX_BODY_LEN) {
    return NextResponse.json(
      { error: `Le message ne peut pas dépasser ${MAX_BODY_LEN} caractères.` },
      { status: 400 },
    );
  }

  const segmentRaw = String(body.segment ?? "all");
  if (!isSegment(segmentRaw)) {
    return NextResponse.json({ error: "Ce segment de clients n’est pas valide." }, { status: 400 });
  }
  const segment = segmentRaw as BroadcastSegment;
  const templateName = typeof body.templateName === "string" ? body.templateName.trim() : "";
  const templateLanguage = typeof body.templateLanguage === "string" ? body.templateLanguage.trim() : "";
  const templateParams = Array.isArray(body.templateParams) ? body.templateParams : [];
  if (messageMode === "template") {
    if (!/^[a-z0-9_]{1,64}$/.test(templateName) || !/^[a-z]{2}(?:_[A-Z]{2})?$/.test(templateLanguage)) {
      return NextResponse.json({ error: "Indiquez le nom exact du modèle approuvé et sa langue (ex. fr ou en_US)." }, { status: 400 });
    }
    if (templateParams.length > 5 || templateParams.some((param: unknown) => param !== "name" && param !== "store")) {
      return NextResponse.json({ error: "Les variables du modèle doivent être name ou store, dans l’ordre défini par Meta." }, { status: 400 });
    }
  } else if (isLiveMode()) {
    return NextResponse.json({ error: "Pour un envoi marketing réel, sélectionnez un modèle WhatsApp approuvé par Meta." }, { status: 422 });
  }

  // Snapshot the count at draft time for display — dispatch re-resolves
  // recipients so the live count drives the actual fan-out.
  const recipients = await segmentRecipients(vendor.id, segment);
  if (recipients.length === 0) {
    return NextResponse.json(
      { error: "Aucun client avec un numéro valide et un consentement marketing actif ne correspond à ce segment." },
      { status: 422 },
    );
  }

  const broadcast = await prisma.broadcast.create({
    data: {
      vendorId: vendor.id,
      body: messageMode === "template" ? `[Modèle WhatsApp : ${templateName}]` : text,
      segment,
      targetCount: recipients.length,
      status: "draft",
      messageMode,
      templateName: messageMode === "template" ? templateName : null,
      templateLanguage: messageMode === "template" ? templateLanguage : null,
      templateParams: JSON.stringify(messageMode === "template" ? templateParams : []),
    },
  });

  return NextResponse.json({
    id: broadcast.id,
    targetCount: broadcast.targetCount,
  });
}
