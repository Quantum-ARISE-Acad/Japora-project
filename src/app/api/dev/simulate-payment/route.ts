import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { evaluateAndGrant } from "@/lib/trust";
import { notifyOrderPaid } from "@/lib/order-notifications";
import { getServerTr } from "@/lib/public-locale";

/**
 * Simulated dev payment endpoint has been disabled.
 * All payments use the real FedaPay API (`/api/payments/checkout`, `/api/payments/fedapay/callback`, `/api/payments/webhook/fedapay`).
 */
export async function POST(req: NextRequest) {
  const tr = await getServerTr();
  const enabled =
    process.env.NODE_ENV !== "production" ||
    process.env.JAPORA_ENABLE_DEV_PAY_STUB === "1";
  if (!enabled) return NextResponse.json({ error: tr("Introuvable", "Not Found") }, { status: 404 });

  const body = await req.json().catch(() => null);
  const providerRef = String(body?.providerRef || "").trim();
  const action = String(body?.action || "");

  if (!providerRef) {
    return NextResponse.json({ error: tr("providerRef est obligatoire.", "providerRef required") }, { status: 400 });
  }
  if (!["success", "failure", "pending"].includes(action)) {
    return NextResponse.json(
      { error: tr("Action non reconnue : success, failure ou pending.", "action must be success | failure | pending") },
      { status: 400 },
    );
  }

  const intent = await prisma.paymentIntent.findFirst({
    where: { providerRef },
  });
  if (!intent) {
    return NextResponse.json({ error: tr("Paiement introuvable", "Payment intent not found") }, { status: 404 });
  }

  // Same idempotency guard the real webhook uses.
  if (intent.status === "succeeded" || intent.status === "failed" || intent.status === "refunded") {
    return NextResponse.json({
      ok: true,
      already: true,
      status: intent.status,
    });
  }

  const finalStatus =
    action === "success" ? "succeeded" : action === "failure" ? "failed" : "pending";
  const terminal = action !== "pending";

  await prisma.paymentIntent.update({
    where: { id: intent.id },
    data: {
      status: finalStatus,
      completedAt: terminal ? new Date() : null,
    },
  });

  // On success, mirror the webhook's order + receivable settlement.
  if (action === "success" && intent.orderId) {
    const order = await prisma.order.findUnique({ where: { id: intent.orderId } });
    if (order) {
      const newPaid = Math.min(order.totalCents, order.paidCents + intent.amountCents);
      const fullyPaid = newPaid >= order.totalCents;
      await prisma.order.update({
        where: { id: order.id },
        data: {
          paidCents: newPaid,
          status: fullyPaid ? "PAID" : order.status,
        },
      });
      if (fullyPaid) {
        const linked = await prisma.receivable.findMany({
          where: { orderId: order.id, status: { not: "PAID" } },
        });
        for (const r of linked) {
          await prisma.receivable.update({
            where: { id: r.id },
            data: { status: "PAID", paidAt: new Date() },
          });
        }
        await evaluateAndGrant(order.vendorId).catch(() => {});
        await notifyOrderPaid(order.id, "mode démo");
      }
      logger.info("payments.dev_simulate", {
        provider: intent.provider,
        intentId: intent.id,
        orderId: order.id,
        fullyPaid,
        amountCents: intent.amountCents,
      });
    }
  } else {
    logger.info("payments.dev_simulate", {
      provider: intent.provider,
      intentId: intent.id,
      action,
    });
  }

  return NextResponse.json({ ok: true, status: finalStatus });
}
