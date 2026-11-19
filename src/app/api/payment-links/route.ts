import { NextRequest, NextResponse } from "next/server";
import { getCurrentVendor } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatMoney } from "@/lib/utils";
import { sendWhatsApp } from "@/lib/whatsapp";
import { getServerTr } from "@/lib/public-locale";

export async function GET() {
  const tr = await getServerTr();
  const vendor = await getCurrentVendor();
  if (!vendor) return NextResponse.json({ error: tr("Veuillez vous connecter.", "Please sign in.") }, { status: 401 });

  const links = await prisma.paymentLink.findMany({
    where: { vendorId: vendor.id },
    orderBy: { createdAt: "desc" },
  });

  const totalCollectedCents = links
    .filter((l) => l.isPaid)
    .reduce((sum, l) => sum + l.amountCents, 0);

  const pendingCents = links
    .filter((l) => !l.isPaid)
    .reduce((sum, l) => sum + l.amountCents, 0);

  return NextResponse.json({
    links,
    stats: {
      total: links.length,
      paidCount: links.filter((l) => l.isPaid).length,
      totalCollectedCents,
      pendingCents,
    },
  });
}

export async function POST(req: NextRequest) {
  const tr = await getServerTr();
  const vendor = await getCurrentVendor();
  if (!vendor) return NextResponse.json({ error: tr("Veuillez vous connecter.", "Please sign in.") }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: tr("JSON invalide.", "Invalid JSON") }, { status: 400 });

  const amountCents = Number(body.amountCents);
  if (!amountCents || amountCents <= 0 || !Number.isFinite(amountCents)) {
    return NextResponse.json({ error: tr("Montant invalide", "Invalid amount") }, { status: 400 });
  }

  const description = String(body.description || "").trim().slice(0, 300);
  const currency = String(body.currency || vendor.currency || "XOF").toUpperCase().slice(0, 3);
  const customerPhone = String(body.customerPhone || "").trim();
  const customerName = String(body.customerName || "").trim();

  let expiresAt: Date | null = null;
  if (body.expiresAt) {
    const parsed = new Date(body.expiresAt);
    if (!isNaN(parsed.getTime())) {
      expiresAt = parsed;
    }
  }

  const link = await prisma.paymentLink.create({
    data: {
      vendorId: vendor.id,
      amountCents: Math.round(amountCents),
      description,
      currency,
      expiresAt,
    },
  });

  let whatsappSent = false;
  let whatsappStatus: string | undefined;

  if (customerPhone) {
    const appBaseUrl = (process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin || "http://localhost:5174").replace(/\/$/, "");
    const payUrl = `${appBaseUrl}/pay/link/${link.id}`;
    const amountText = formatMoney(link.amountCents, link.currency);

    const waRes = await sendWhatsApp({
      vendorId: vendor.id,
      to: customerPhone,
      body:
        `👋 Bonjour${customerName ? ` *${customerName}*` : ""} !\n\n` +
        `*${vendor.shopName}* vous a envoyé un lien de paiement sécurisé Japora × FedaPay :\n` +
        `💰 Montant : *${amountText}*\n` +
        (description ? `📝 Motif : *${description}*\n` : "") +
        `\n👉 Réglez en 1 clic par T-Money, Flooz, Mobile Money ou Carte :\n${payUrl}`,
    }).catch(() => null);

    if (waRes) {
      whatsappSent = true;
      whatsappStatus = waRes.status;
    }
  }

  return NextResponse.json({ ok: true, link, whatsappSent, whatsappStatus }, { status: 201 });
}
