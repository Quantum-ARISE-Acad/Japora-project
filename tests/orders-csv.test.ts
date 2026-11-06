import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { buildOrdersCsv } from "../src/lib/orders-csv";

describe("buildOrdersCsv", () => {
  test("prepends UTF-8 BOM and outputs expected French column headers", () => {
    const csv = buildOrdersCsv([], "XOF");
    assert.equal(csv.startsWith("\uFEFF"), true);
    const lines = csv.slice(1).split("\n");
    assert.equal(lines.length, 1);
    assert.match(lines[0], /^Date,Référence,Statut,Nom Client,Téléphone,Articles,Quantité Totale/);
  });

  test("formats order items, extracts [PAIEMENT: ...] tag, and resolves paymentIntent ref", () => {
    const csv = buildOrdersCsv(
      [
        {
          id: "cm9abc1234567890",
          createdAt: new Date(2026, 4, 15, 14, 30),
          customerName: "Afi Mensah",
          customerPhone: "22890112233",
          status: "PAID",
          totalCents: 1250000,
          paidCents: 1250000,
          note: "Livraison rapide [PAIEMENT: T-Money]",
          source: "whatsapp",
          items: [
            { productName: "Pagne Wax", size: "XL", quantity: 2, unitPriceCents: 500000 },
            { productName: "Foulard", size: null, quantity: 1, unitPriceCents: 250000 },
          ],
          paymentIntents: [
            { provider: "cinetpay", providerRef: "CP-998877", status: "succeeded" },
          ],
        },
      ],
      "XOF",
    );

    const lines = csv.slice(1).split("\n");
    assert.equal(lines.length, 2);
    const row = lines[1];
    assert.match(row, /2026-05-15 14:30/);
    assert.match(row, /CM9ABC12/);
    assert.match(row, /PAID/);
    assert.match(row, /Afi Mensah/);
    assert.match(row, /2x Pagne Wax \(XL\) ; 1x Foulard/);
    assert.match(row, /,3,12500\.00,1250000,12500\.00,XOF,T-Money,whatsapp,CP-998877$/);
  });

  test("escapes commas, double quotes, and newlines according to RFC 4180", () => {
    const csv = buildOrdersCsv([
      {
        id: "ord_quote_test",
        createdAt: "invalid-date-fallback",
        customerName: 'Koffi "Le Boss", Lomé',
        customerPhone: null,
        status: "NEW",
        totalCents: 50000,
        paidCents: 0,
        note: null,
        source: null,
        items: [{ productName: "Sac, Cuir\nNoir", quantity: 1, unitPriceCents: 50000 }],
      },
    ]);

    assert.match(csv, /"Koffi ""Le Boss"", Lomé"/);
    assert.match(csv, /"1x Sac, Cuir\nNoir"/);
    assert.match(csv, /invalid-date-fallback/);
  });
});

