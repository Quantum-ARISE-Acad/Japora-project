/**
 * Helper to build RFC 4180 compliant CSV strings with UTF-8 BOM for Excel / Google Sheets.
 */

export interface OrderExportRow {
  id: string;
  createdAt: Date | string;
  customerName: string;
  customerPhone?: string | null;
  status: string;
  totalCents: number;
  paidCents: number;
  note?: string | null;
  source?: string | null;
  items: Array<{
    productName: string;
    size?: string | null;
    quantity: number;
    unitPriceCents: number;
  }>;
  paymentIntents?: Array<{
    provider: string;
    providerRef?: string | null;
    status: string;
  }>;
}

function escapeCsvField(val: unknown): string {
  if (val === null || val === undefined) return "";
  const str = String(val);
  if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function buildOrdersCsv(orders: OrderExportRow[], currency = "XOF"): string {
  const headers = [
    "Date",
    "Référence",
    "Statut",
    "Nom Client",
    "Téléphone",
    "Articles",
    "Quantité Totale",
    "Total (Majeur)",
    "Total (Centimes)",
    "Montant Encaissé (Majeur)",
    "Devise",
    "Mode de Paiement",
    "Source",
    "Réf Paiement Externe",
  ];

  const rows = orders.map((o) => {
    const d = new Date(o.createdAt);
    const dateFormatted = isNaN(d.getTime())
      ? String(o.createdAt)
      : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;

    const ref = o.id.slice(0, 8).toUpperCase();
    const totalQty = o.items.reduce((s, it) => s + (it.quantity || 1), 0);
    const itemsSummary = o.items
      .map((it) => `${it.quantity}x ${it.productName}${it.size ? ` (${it.size})` : ""}`)
      .join(" ; ");

    // Extract payment method from note tag [PAIEMENT: ...] if present
    let paymentMethod = "Standard";
    if (o.note && o.note.includes("[PAIEMENT:")) {
      const match = o.note.match(/\[PAIEMENT:\s*([^\]]+)\]/);
      if (match) paymentMethod = match[1].trim();
    }

    const providerRef = o.paymentIntents?.[0]?.providerRef || o.paymentIntents?.[0]?.provider || "";

    const totalMajor = (o.totalCents / 100).toFixed(2);
    const paidMajor = (o.paidCents / 100).toFixed(2);

    return [
      escapeCsvField(dateFormatted),
      escapeCsvField(ref),
      escapeCsvField(o.status),
      escapeCsvField(o.customerName),
      escapeCsvField(o.customerPhone || ""),
      escapeCsvField(itemsSummary),
      escapeCsvField(totalQty),
      escapeCsvField(totalMajor),
      escapeCsvField(o.totalCents),
      escapeCsvField(paidMajor),
      escapeCsvField(currency),
      escapeCsvField(paymentMethod),
      escapeCsvField(o.source || "catalog"),
      escapeCsvField(providerRef),
    ].join(",");
  });

  return "\uFEFF" + [headers.join(","), ...rows].join("\n");
}
