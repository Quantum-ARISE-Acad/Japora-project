import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getServerTr } from "@/lib/public-locale";
import { getCurrentVendor } from "@/lib/auth";
import { prisma } from "@/lib/db";
import PaymentLinksClient from "./PaymentLinksClient";

export async function generateMetadata(): Promise<Metadata> {
  const tr = await getServerTr();
  return { title: tr("Liens de paiement — Tableau de bord", "Payment links — Dashboard") };
}

export default async function PaymentLinksPage() {
  const vendor = await getCurrentVendor();
  if (!vendor) redirect("/login");

  const links = await prisma.paymentLink.findMany({
    where: { vendorId: vendor.id },
    orderBy: { createdAt: "desc" },
  });

  return (
    <PaymentLinksClient
      currency={vendor.currency}
      shopName={vendor.shopName}
      initialLinks={links.map((l) => ({
        id: l.id,
        amountCents: l.amountCents,
        currency: l.currency,
        description: l.description,
        isPaid: l.isPaid,
        paidAt: l.paidAt ? l.paidAt.toISOString() : null,
        expiresAt: l.expiresAt ? l.expiresAt.toISOString() : null,
        createdAt: l.createdAt.toISOString(),
      }))}
    />
  );
}
