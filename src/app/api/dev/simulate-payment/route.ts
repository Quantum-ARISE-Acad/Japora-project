import { NextResponse } from "next/server";

/**
 * Simulated dev payment endpoint has been disabled.
 * All payments use the real FedaPay API (`/api/payments/checkout`, `/api/payments/fedapay/callback`, `/api/payments/webhook/fedapay`).
 */
export async function POST() {
  return NextResponse.json(
    { error: "Les paiements simulés sont désactivés. Utilisez l'API réelle FedaPay." },
    { status: 410 },
  );
}
