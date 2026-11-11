/**
 * Japora Daily Hustle Summary — the 6pm WhatsApp + email recap.
 *
 * buildSummary() is pure-ish (DB read only). sendDailySummary() wires it to
 * the existing WA + email providers so the cron route stays trivial.
 *
 * "today" is passed in as a Date by the caller — the cron resolves it once
 * so all vendors share the same window even if the job spans a clock-tick.
 */

import { prisma } from "./db";
import { logger } from "./logger";
import { sendWhatsApp } from "./whatsapp";
import { sendEmail } from "./email";
import { formatMoney } from "./utils";

export type SummaryCounts = {
  orders: number;
  paid: number;
  unpaid: number;
  revenueCents: number;
};

export type Summary = {
  text: string;
  counts: SummaryCounts;
  lines: string[];
};

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function endOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

export async function buildSummary(
  vendorId: string,
  today: Date,
): Promise<Summary> {
  const since = startOfDay(today);
  const until = endOfDay(today);

  const vendor = await prisma.vendor.findUnique({
    where: { id: vendorId },
    select: { shopName: true, currency: true },
  });
  const currency = vendor?.currency || "NGN";
  const shopName = vendor?.shopName || "Your shop";

  const orders = await prisma.order.findMany({
    where: {
      vendorId,
      deletedAt: null,
      createdAt: { gte: since, lte: until },
    },
    include: { items: true },
  });

  const paid = orders.filter((o) => o.status === "PAID" || o.status === "DELIVERED");
  const unpaid = orders.filter(
    (o) => o.status !== "PAID" && o.status !== "DELIVERED" && o.status !== "CANCELLED",
  );
  const revenueCents = paid.reduce((s, o) => s + o.totalCents, 0);

  // Top seller — by qty across paid order items today.
  const tally = new Map<string, number>();
  for (const o of paid) {
    for (const it of o.items) {
      tally.set(it.productName, (tally.get(it.productName) ?? 0) + it.quantity);
    }
  }
  let topSeller: { name: string; qty: number } | null = null;
  for (const [name, qty] of tally) {
    if (!topSeller || qty > topSeller.qty) topSeller = { name, qty };
  }

  // Unpaid customer names (deduped, capped).
  const unpaidNames = Array.from(
    new Set(
      unpaid
        .map((o) => o.customerName || o.customerPhone)
        .filter((s): s is string => Boolean(s)),
    ),
  ).slice(0, 5);

  // Low stock products — active with stock <= 3.
  const lowStock = await prisma.product.findMany({
    where: { vendorId, isActive: true, stock: { lte: 3 } },
    orderBy: { stock: "asc" },
    take: 5,
    select: { name: true, stock: true },
  });

  const dateStr = since.toISOString().slice(0, 10);
  const lines: string[] = [];
  lines.push(`*${shopName} — Daily Hustle (${dateStr})*`);
  lines.push("");
  lines.push(`Orders: ${orders.length} (paid: ${paid.length}, unpaid: ${unpaid.length})`);
  lines.push(`Revenue: ${formatMoney(revenueCents, currency)}`);
  if (topSeller) {
    lines.push(`Top seller: ${topSeller.name} (${topSeller.qty} sold)`);
  }
  if (unpaidNames.length > 0) {
    lines.push("");
    lines.push("Unpaid customers:");
    for (const n of unpaidNames) lines.push(`  • ${n}`);
  }
  if (lowStock.length > 0) {
    lines.push("");
    lines.push("Low stock:");
    for (const p of lowStock) lines.push(`  • ${p.name} — ${p.stock} left`);
  }
  lines.push("");
  lines.push("Keep grinding. — Japora");

  const text = lines.join("\n");

  return {
    text,
    counts: {
      orders: orders.length,
      paid: paid.length,
      unpaid: unpaid.length,
      revenueCents,
    },
    lines,
  };
}

export async function sendDailySummary(vendor: {
  id: string;
  email: string;
  shopName: string;
  whatsappNumber: string;
}) {
  const today = new Date();
  const summary = await buildSummary(vendor.id, today);

  // WhatsApp (only if vendor has a number on file).
  if (vendor.whatsappNumber) {
    try {
      await sendWhatsApp({
        vendorId: vendor.id,
        to: vendor.whatsappNumber,
        body: summary.text,
      });
    } catch (e) {
      logger.error("hustle.wa_send_failed", {
        vendorId: vendor.id,
        error: String(e),
      });
    }
  }

  // Email — plain wrapper so we don't depend on email-templates for cron.
  if (vendor.email) {
    try {
      const dateStr = new Date().toISOString().slice(0, 10);
      const html =
        `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">` +
        `<h2 style="color:#0f172a;">Daily Hustle — ${dateStr}</h2>` +
        `<pre style="background:#f1f5f9;padding:16px;border-radius:8px;white-space:pre-wrap;font-family:inherit;">${summary.text}</pre>` +
        `<p style="color:#94a3b8;font-size:12px;">Japora — Sell on WhatsApp. Get paid. Grow your hustle.</p>` +
        `</div>`;
      await sendEmail({
        vendorId: vendor.id,
        to: vendor.email,
        subject: `Daily Hustle — ${vendor.shopName} (${dateStr})`,
        html,
        text: summary.text,
        template: "daily_hustle",
      });
    } catch (e) {
      logger.error("hustle.email_send_failed", {
        vendorId: vendor.id,
        error: String(e),
      });
    }
  }

  return summary;
}
