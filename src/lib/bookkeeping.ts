// Monthly bookkeeping summary — printable HTML for vendor tax/loan use.
//
// Aggregates a vendor's confirmed-revenue orders for a calendar month and
// renders a self-contained HTML document (inline CSS, print stylesheet) the
// vendor can print or save as PDF for their accountant, tax filing, or
// micro-loan application. Numbers come straight from the database and we
// keep the shape stable so it doubles as the source for the bookkeeping
// dashboard.

import type { Vendor } from "@prisma/client";
import { prisma } from "./db";
import { CATEGORIES, REGIONS } from "./regions";
import { isZeroDecimal } from "./currency";

export type TopProduct = {
  productId: string | null;
  name: string;
  quantity: number;
  revenueCents: number;
};

export type MonthlySummary = {
  period: {
    year: number;
    month: number; // 1-12
    start: Date;
    end: Date; // exclusive
    label: string; // e.g. "March 2026"
  };
  orderCount: number;
  revenueCents: number;
  avgOrderValueCents: number;
  byCategory: Record<string, number>; // categorySlug -> revenueCents
  topProducts: TopProduct[];
  byPaymentMethod: Record<string, number>; // method -> revenueCents
  openReceivablesCents: number;
  vendorSnapshot: {
    shopName: string;
    region: string;
    currency: string;
    bio: string;
  };
};

/** Default to the most recently *completed* calendar month (last month). */
export function defaultPeriod(now: Date = new Date()): { year: number; month: number } {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  d.setUTCMonth(d.getUTCMonth() - 1);
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1 };
}

function monthLabel(year: number, month: number): string {
  // month is 1-12. Construct in UTC to dodge timezone drift on month names.
  const d = new Date(Date.UTC(year, month - 1, 1));
  return d.toLocaleString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
}

function monthRange(year: number, month: number): { start: Date; end: Date } {
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 1));
  return { start, end };
}

function formatMoney(cents: number, currency: string): string {
  const amount = cents / 100;
  const code = (currency || "XOF").toUpperCase();
  const fractionDigits = isZeroDecimal(code) ? 0 : 2;
  // toLocaleString with currency falls back gracefully for unknown codes.
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: code,
      currencyDisplay: isZeroDecimal(code) ? "code" : "symbol",
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    }).format(amount);
  } catch {
    return `${code} ${amount.toFixed(fractionDigits)}`.trim();
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function regionLabel(slug: string): string {
  const r = REGIONS.find((x) => x.slug === slug);
  return r ? `${r.label}, ${r.country}` : slug || "—";
}

function categoryLabel(slug: string): string {
  const c = CATEGORIES.find((x) => x.slug === slug);
  return c ? c.label : slug;
}

/**
 * Compute the monthly summary for a vendor. "Revenue" = orders with status
 * PAID or DELIVERED whose createdAt sits inside the month window. Soft-deleted
 * orders are excluded so they don't survive in tax reports.
 */
export async function computeMonth(
  vendorId: string,
  year: number,
  month: number,
): Promise<MonthlySummary> {
  const { start, end } = monthRange(year, month);

  const [vendor, orders, openReceivables, paidIntents] = await Promise.all([
    prisma.vendor.findUnique({ where: { id: vendorId } }),
    prisma.order.findMany({
      where: {
        vendorId,
        status: { in: ["PAID", "DELIVERED"] },
        deletedAt: null,
        createdAt: { gte: start, lt: end },
      },
      include: {
        items: true,
      },
    }),
    prisma.receivable.aggregate({
      where: { vendorId, status: { in: ["OPEN", "PARTIAL"] } },
      _sum: { amountCents: true },
    }),
    prisma.paymentIntent.findMany({
      where: {
        vendorId,
        status: "succeeded",
        completedAt: { gte: start, lt: end },
      },
      select: { provider: true, method: true, amountCents: true },
    }),
  ]);

  let revenueCents = 0;
  const byCategory: Record<string, number> = {};
  const productAgg = new Map<string, TopProduct>();

  for (const order of orders) {
    revenueCents += order.totalCents;
    // Roll the order's revenue into the vendor's primary category — keeps
    // the breakdown legible for single-category shops and is a reasonable
    // proxy for multi-category ones (vendors rarely mix categories per shop).
    const cat = vendor?.category || "other";
    byCategory[cat] = (byCategory[cat] ?? 0) + order.totalCents;

    for (const item of order.items) {
      const key = item.productId ?? `name:${item.productName}`;
      const existing = productAgg.get(key);
      const lineRevenue = item.unitPriceCents * item.quantity;
      if (existing) {
        existing.quantity += item.quantity;
        existing.revenueCents += lineRevenue;
      } else {
        productAgg.set(key, {
          productId: item.productId,
          name: item.productName,
          quantity: item.quantity,
          revenueCents: lineRevenue,
        });
      }
    }
  }

  const topProducts = [...productAgg.values()]
    .sort((a, b) => b.revenueCents - a.revenueCents)
    .slice(0, 10);

  const byPaymentMethod: Record<string, number> = {};
  for (const pi of paidIntents) {
    const key = pi.method || pi.provider || "unknown";
    byPaymentMethod[key] = (byPaymentMethod[key] ?? 0) + pi.amountCents;
  }
  // If no payment intents are recorded (vendor takes cash / bank transfer),
  // surface revenue under a generic bucket so the section isn't empty.
  if (Object.keys(byPaymentMethod).length === 0 && revenueCents > 0) {
    byPaymentMethod["other"] = revenueCents;
  }

  const orderCount = orders.length;
  const avgOrderValueCents = orderCount > 0 ? Math.round(revenueCents / orderCount) : 0;

  return {
    period: {
      year,
      month,
      start,
      end,
      label: monthLabel(year, month),
    },
    orderCount,
    revenueCents,
    avgOrderValueCents,
    byCategory,
    topProducts,
    byPaymentMethod,
    openReceivablesCents: openReceivables._sum.amountCents ?? 0,
    vendorSnapshot: {
      shopName: vendor?.shopName ?? "",
      region: vendor?.region ?? "",
      currency: vendor?.currency ?? "XOF",
      bio: vendor?.bio ?? "",
    },
  };
}

/**
 * Render a complete, self-contained HTML document. No external CSS, no
 * scripts — opens cleanly in any browser, prints to PDF via the OS dialog,
 * and survives being emailed around as a single .html file.
 */
export function renderHtml(summary: MonthlySummary, vendor: Vendor): string {
  const currency = summary.vendorSnapshot.currency || vendor.currency || "XOF";
  const money = (c: number) => escapeHtml(formatMoney(c, currency));

  const topProductRows = summary.topProducts.length
    ? summary.topProducts
        .map(
          (p) => `
        <tr>
          <td>${escapeHtml(p.name)}</td>
          <td class="num">${p.quantity}</td>
          <td class="num">${money(p.revenueCents)}</td>
        </tr>`,
        )
        .join("")
    : `<tr><td colspan="3" class="empty">No products sold in this period.</td></tr>`;

  const categoryRows = Object.entries(summary.byCategory).length
    ? Object.entries(summary.byCategory)
        .sort((a, b) => b[1] - a[1])
        .map(
          ([slug, cents]) => `
        <tr>
          <td>${escapeHtml(categoryLabel(slug))}</td>
          <td class="num">${money(cents)}</td>
        </tr>`,
        )
        .join("")
    : `<tr><td colspan="2" class="empty">No revenue recorded.</td></tr>`;

  const paymentRows = Object.entries(summary.byPaymentMethod).length
    ? Object.entries(summary.byPaymentMethod)
        .sort((a, b) => b[1] - a[1])
        .map(
          ([method, cents]) => `
        <tr>
          <td>${escapeHtml(method)}</td>
          <td class="num">${money(cents)}</td>
        </tr>`,
        )
        .join("")
    : `<tr><td colspan="2" class="empty">No payments recorded.</td></tr>`;

  const generatedAt = new Date().toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(summary.vendorSnapshot.shopName)} — ${escapeHtml(summary.period.label)} bookkeeping</title>
  <style>
    :root {
      --japora-green: #16a34a;
      --japora-dark: #14532d;
      --ink: #0f172a;
      --muted: #64748b;
      --line: #e2e8f0;
      --soft: #f8fafc;
    }
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: var(--ink);
      background: #fff;
      line-height: 1.45;
    }
    .page {
      max-width: 820px;
      margin: 0 auto;
      padding: 32px 40px 48px;
    }
    header.brand {
      border-bottom: 3px solid var(--japora-green);
      padding-bottom: 16px;
      margin-bottom: 24px;
      display: flex;
      align-items: flex-end;
      justify-content: space-between;
      gap: 16px;
    }
    .brand-mark {
      font-size: 28px;
      font-weight: 800;
      color: var(--japora-dark);
      letter-spacing: -0.02em;
    }
    .brand-mark .dot { color: var(--japora-green); }
    .brand-tag {
      color: var(--muted);
      font-size: 13px;
      margin-top: 4px;
    }
    .period-block { text-align: right; }
    .period-block .label {
      font-size: 11px;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: var(--muted);
    }
    .period-block .value {
      font-size: 18px;
      font-weight: 700;
      color: var(--ink);
    }
    .vendor-card {
      background: var(--soft);
      border: 1px solid var(--line);
      border-radius: 10px;
      padding: 16px 20px;
      margin-bottom: 24px;
    }
    .vendor-card h2 {
      font-size: 20px;
      margin: 0 0 4px;
      color: var(--ink);
    }
    .vendor-card .meta {
      font-size: 13px;
      color: var(--muted);
    }
    .vendor-card .bio {
      font-size: 13px;
      color: var(--ink);
      margin-top: 8px;
    }
    .kpis {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 12px;
      margin-bottom: 28px;
    }
    .kpi {
      border: 1px solid var(--line);
      border-radius: 10px;
      padding: 14px 16px;
      background: #fff;
    }
    .kpi .label {
      font-size: 11px;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: var(--muted);
    }
    .kpi .value {
      font-size: 22px;
      font-weight: 700;
      color: var(--ink);
      margin-top: 4px;
    }
    section { margin-bottom: 24px; }
    section h3 {
      font-size: 13px;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--japora-dark);
      margin: 0 0 8px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
    }
    th, td {
      text-align: left;
      padding: 8px 10px;
      border-bottom: 1px solid var(--line);
    }
    th {
      background: var(--soft);
      font-weight: 600;
      color: var(--muted);
      font-size: 11px;
      letter-spacing: 0.06em;
      text-transform: uppercase;
    }
    td.num, th.num { text-align: right; font-variant-numeric: tabular-nums; }
    td.empty {
      color: var(--muted);
      font-style: italic;
      text-align: center;
      padding: 16px;
    }
    .two-col {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
    }
    .receivables {
      border-left: 3px solid var(--japora-green);
      background: #f0fdf4;
      padding: 12px 16px;
      border-radius: 6px;
      font-size: 13px;
    }
    .receivables strong {
      display: block;
      font-size: 18px;
      color: var(--japora-dark);
      margin-top: 2px;
    }
    footer {
      margin-top: 36px;
      padding-top: 16px;
      border-top: 1px solid var(--line);
      font-size: 11px;
      color: var(--muted);
      display: flex;
      justify-content: space-between;
    }
    .print-cta {
      position: fixed;
      bottom: 16px;
      right: 16px;
      background: var(--japora-green);
      color: #fff;
      border: none;
      border-radius: 999px;
      padding: 10px 18px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      box-shadow: 0 4px 12px rgba(22, 163, 74, 0.3);
    }
    @media print {
      body { background: #fff; }
      .page { padding: 12mm 14mm; max-width: none; }
      .print-cta { display: none !important; }
      .kpi, .vendor-card, table th { background: #fff !important; }
      header.brand { break-inside: avoid; }
      section, .kpis { break-inside: avoid; }
      footer { position: fixed; bottom: 8mm; left: 14mm; right: 14mm; }
    }
    @media (max-width: 600px) {
      .kpis { grid-template-columns: 1fr; }
      .two-col { grid-template-columns: 1fr; }
      .page { padding: 20px; }
    }
  </style>
</head>
<body>
  <div class="page">
    <header class="brand">
      <div>
        <div class="brand-mark">Japora<span class="dot">.</span></div>
        <div class="brand-tag">Sell on WhatsApp. Get paid. Grow your hustle.</div>
      </div>
      <div class="period-block">
        <div class="label">Bookkeeping period</div>
        <div class="value">${escapeHtml(summary.period.label)}</div>
      </div>
    </header>

    <div class="vendor-card">
      <h2>${escapeHtml(summary.vendorSnapshot.shopName || "(unnamed shop)")}</h2>
      <div class="meta">
        ${escapeHtml(regionLabel(summary.vendorSnapshot.region))}
        &nbsp;·&nbsp; Currency: ${escapeHtml(currency)}
      </div>
      ${summary.vendorSnapshot.bio ? `<div class="bio">${escapeHtml(summary.vendorSnapshot.bio)}</div>` : ""}
    </div>

    <div class="kpis">
      <div class="kpi">
        <div class="label">Confirmed orders</div>
        <div class="value">${summary.orderCount}</div>
      </div>
      <div class="kpi">
        <div class="label">Revenue (paid + delivered)</div>
        <div class="value">${money(summary.revenueCents)}</div>
      </div>
      <div class="kpi">
        <div class="label">Avg. order value</div>
        <div class="value">${money(summary.avgOrderValueCents)}</div>
      </div>
    </div>

    <section>
      <h3>Top products</h3>
      <table>
        <thead>
          <tr>
            <th>Product</th>
            <th class="num">Qty sold</th>
            <th class="num">Revenue</th>
          </tr>
        </thead>
        <tbody>${topProductRows}</tbody>
      </table>
    </section>

    <div class="two-col">
      <section>
        <h3>By category</h3>
        <table>
          <thead><tr><th>Category</th><th class="num">Revenue</th></tr></thead>
          <tbody>${categoryRows}</tbody>
        </table>
      </section>

      <section>
        <h3>By payment method</h3>
        <table>
          <thead><tr><th>Method</th><th class="num">Amount</th></tr></thead>
          <tbody>${paymentRows}</tbody>
        </table>
      </section>
    </div>

    <section>
      <h3>Outstanding receivables (snapshot)</h3>
      <div class="receivables">
        Money still owed to you across all open IOUs:
        <strong>${money(summary.openReceivablesCents)}</strong>
      </div>
    </section>

    <footer>
      <span>Auto-generated by Japora &nbsp;·&nbsp; ${escapeHtml(generatedAt)}</span>
      <span>This document is a vendor self-report, not an audited statement.</span>
    </footer>
  </div>
  <button class="print-cta" onclick="window.print()">Print / Save as PDF</button>
</body>
</html>`;
}
