import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getVendorFedaPayConfig } from "@/lib/payments/fedapay";
import FedaPaySandboxClient from "./FedaPaySandboxClient";

type Params = { params: Promise<{ ref: string }> };

export default async function FedaPaySandboxPage({ params }: Params) {
  const { ref } = await params;

  const intent = await prisma.paymentIntent.findFirst({
    where: {
      OR: [
        { providerRef: ref },
        { metadata: { contains: ref } },
      ],
    },
    orderBy: { createdAt: "desc" },
  });

  if (!intent) notFound();

  const [vendor, fedaConfig] = await Promise.all([
    prisma.vendor.findUnique({
      where: { id: intent.vendorId },
      select: {
        id: true,
        shopName: true,
        shopSlug: true,
        currency: true,
        avatarUrl: true,
        whatsappNumber: true,
      },
    }),
    getVendorFedaPayConfig(intent.vendorId),
  ]);

  let orderSummary: {
    id: string;
    customerName: string;
    customerPhone: string;
    itemCount: number;
  } | null = null;

  if (intent.orderId) {
    const order = await prisma.order.findUnique({
      where: { id: intent.orderId },
      include: { items: true },
    });
    if (order) {
      orderSummary = {
        id: order.id,
        customerName: order.customerName,
        customerPhone: order.customerPhone,
        itemCount: order.items.reduce((sum, item) => sum + item.quantity, 0),
      };
    }
  }

  let meta: Record<string, any> = {};
  try {
    meta = intent.metadata ? JSON.parse(intent.metadata) : {};
  } catch {
    meta = {};
  }

  return (
    <FedaPaySandboxClient
      providerRef={intent.providerRef || ref}
      amountCents={intent.amountCents}
      currency={intent.currency || vendor?.currency || "XOF"}
      initialStatus={intent.status}
      fedaPublicKey={fedaConfig.publicKey}
      fedaEnvironment={fedaConfig.environment}
      shopName={vendor?.shopName || "Boutique Japora"}
      shopSlug={vendor?.shopSlug || ""}
      shopLogo={vendor?.avatarUrl || ""}
      title={
        meta.title ||
        (orderSummary
          ? `Commande #${orderSummary.id.slice(-6).toUpperCase()}`
          : "Paiement Japora")
      }
      defaultCustomerName={orderSummary?.customerName || meta.customerName || ""}
      defaultCustomerPhone={orderSummary?.customerPhone || meta.customerPhone || "+22890000001"}
      defaultWallet={meta.network || "T-Money Togo"}
      returnUrl={
        meta.returnUrl ||
        (orderSummary ? `/pay/${orderSummary.id}?paid=1` : "/dashboard/billing?ok=1")
      }
    />
  );
}
