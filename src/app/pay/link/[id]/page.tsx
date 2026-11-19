import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getServerTr } from "@/lib/public-locale";
import { prisma } from "@/lib/db";
import { formatMoney } from "@/lib/utils";
import PaymentLinkClient from "./PaymentLinkClient";

type Params = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { id } = await params;
  const link = await prisma.paymentLink.findUnique({
    where: { id },
    include: { vendor: { select: { shopName: true, currency: true } } },
  });

  const tr = await getServerTr();
  if (!link) return { title: tr("Lien de paiement", "Payment link") };

  return {
    title: tr(
      `Paiement ${formatMoney(link.amountCents, link.currency || link.vendor.currency)} — ${link.vendor.shopName}`,
      `Payment ${formatMoney(link.amountCents, link.currency || link.vendor.currency)} — ${link.vendor.shopName}`,
    ),
    description: link.description || tr(`Lien de paiement pour ${link.vendor.shopName}`, `Payment link for ${link.vendor.shopName}`),
  };
}

export default async function PaymentLinkPage({ params }: Params) {
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

  if (!link) notFound();

  const isExpired = link.expiresAt ? new Date(link.expiresAt).getTime() < Date.now() : false;

  return (
    <PaymentLinkClient
      id={link.id}
      amountCents={link.amountCents}
      currency={link.currency || link.vendor.currency}
      description={link.description}
      isPaid={link.isPaid}
      isExpired={isExpired}
      createdAt={link.createdAt.toISOString()}
      vendor={{
        id: link.vendor.id,
        shopName: link.vendor.shopName,
        shopSlug: link.vendor.shopSlug,
        avatarUrl: link.vendor.avatarUrl,
        whatsappNumber: link.vendor.whatsappNumber,
        momoNumber: link.vendor.momoNumber || "",
        currency: link.vendor.currency,
        verifiedAt: link.vendor.verifiedAt ? link.vendor.verifiedAt.toISOString() : null,
      }}
    />
  );
}
