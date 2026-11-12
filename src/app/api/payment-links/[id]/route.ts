import { NextRequest, NextResponse } from "next/server";
import { getCurrentVendor } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatMoney } from "@/lib/utils";
import { sendWhatsApp } from "@/lib/whatsapp";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const link = await prisma.paymentLink.findUnique({
    where: { id },
    include: {
      vendor: {
        select: {
          id: true,
          shopName: true,
          shopSlug: true,
          avatarUrl: true,
          whatsappNumber: true,
          momoNumber: true,
          currency: true,
          verifiedAt: true,
        },
      },
    },
  });

  if (!link) {
    return NextResponse.json({ error: "Lien de paiement introuvable" }, { status: 404 });
  }

  const isExpired = link.expiresAt ? new Date(link.expiresAt).getTime() < Date.now() : false;

  return NextResponse.json({
    link: {
      ...link,
      isExpired,
    },
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const vendor = await getCurrentVendor();

  const link = await prisma.paymentLink.findUnique({
    where: { id },
  });

  if (!link) {
    return NextResponse.json({ error: "Lien de paiement introuvable" }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}));

  if (vendor && vendor.id === link.vendorId) {
    // Action: Send payment link directly via WhatsApp Cloud API
    if (body.action === "send_whatsapp") {
      const customerPhone = String(body.customerPhone || "").trim();
      const customerName = String(body.customerName || "").trim();
      if (!customerPhone) {
        return NextResponse.json(
          { error: "Veuillez saisir le numéro WhatsApp du client." },
          { status: 400 },
        );
      }

      const appBaseUrl = (
        process.env.NEXT_PUBLIC_APP_URL ||
        req.nextUrl.origin ||
        "http://localhost:5174"
      ).replace(/\/$/, "");
      const payUrl = `${appBaseUrl}/pay/link/${link.id}`;
      const amountText = formatMoney(link.amountCents, link.currency || vendor.currency);

      const waRes = await sendWhatsApp({
        vendorId: vendor.id,
        to: customerPhone,
        body:
          `👋 Bonjour${customerName ? ` *${customerName}*` : ""} !\n\n` +
          `*${vendor.shopName}* vous invite à régler votre commande via ce lien sécurisé Japora × FedaPay :\n` +
          `💰 Montant : *${amountText}*\n` +
          (link.description ? `📝 Motif : *${link.description}*\n` : "") +
          `\n👉 Payez en ligne (T-Money, Flooz, Mobile Money ou Carte) :\n${payUrl}`,
      });

      return NextResponse.json({
        ok: true,
        whatsappStatus: waRes.status,
        provider: waRes.provider,
        error: waRes.error,
      });
    }

    // Vendor action: toggle paid
    const isPaid = typeof body.isPaid === "boolean" ? body.isPaid : !link.isPaid;
    const updated = await prisma.paymentLink.update({
      where: { id },
      data: {
        isPaid,
        paidAt: isPaid ? new Date() : null,
      },
    });
    return NextResponse.json({ ok: true, link: updated });
  }

  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const vendor = await getCurrentVendor();
  if (!vendor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const link = await prisma.paymentLink.findUnique({ where: { id } });

  if (!link || link.vendorId !== vendor.id) {
    return NextResponse.json({ error: "Lien de paiement introuvable" }, { status: 404 });
  }

  await prisma.paymentLink.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
