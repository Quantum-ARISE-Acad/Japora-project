import { PrismaClient } from "@prisma/client";
import { loadDotEnv, resolveDatabaseUrl } from "../src/lib/db-url";
import bcrypt from "bcryptjs";

loadDotEnv();
// Same SQLite file as the site (see src/lib/db-url.ts).
const prisma = new PrismaClient({ datasourceUrl: resolveDatabaseUrl(process.env.DATABASE_URL) });

/** Inline SVG placeholder so the demo has images without any external files. */
function placeholder(label: string, c1: string, c2: string): string {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='640' height='640'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='${c1}'/><stop offset='1' stop-color='${c2}'/></linearGradient></defs><rect width='640' height='640' fill='url(#g)'/><text x='50%' y='50%' font-family='Helvetica,Arial,sans-serif' font-size='40' font-weight='700' fill='rgba(255,255,255,0.95)' text-anchor='middle' dominant-baseline='middle'>${label}</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

async function main() {
  const email = "demo@wcatalog.app";
  const password = "demo1234";

  // Idempotent: clear any previous demo vendor (cascades to products/orders).
  await prisma.vendor.deleteMany({ where: { email } });

  const vendor = await prisma.vendor.create({
    data: {
      email,
      passwordHash: await bcrypt.hash(password, 10),
      shopName: "Ada's Fashion House",
      shopSlug: "adas-fashion",
      whatsappNumber: "2348012345678",
      currency: "NGN",
      tagline: "Trendy ready-to-wear, delivered across Lagos.",
      emailVerifiedAt: new Date(),
      onboardedAt: new Date(),
      // Soko pivot — public regional profile + referral + wholesale on.
      region: "lagos-mainland",
      category: "fashion",
      language: "en",
      bio: "Lagos-based womenswear studio. Ankara, senator sets, and gele — made to order, delivered Lagos-wide.",
      referralCode: "ADA2024",
      wholesaleEnabled: true,
      isPublic: true,
    },
  });

  const productData = [
    {
      name: "Ankara Maxi Gown",
      description: "Flowing floor-length gown in premium wax print. Fully lined.",
      priceCents: 1850000,
      sizes: "S,M,L,XL",
      stock: 8,
      imageUrl: placeholder("Ankara Gown", "#16a34a", "#065f46"),
    },
    {
      name: "Two-Piece Senator Set",
      description: "Tailored kaftan top and trouser. Classic event wear.",
      priceCents: 2500000,
      sizes: "M,L,XL,XXL",
      stock: 5,
      imageUrl: placeholder("Senator Set", "#0ea5e9", "#1e3a8a"),
      // Wholesale: 3+ units drops price to ₦22,000 per unit.
      wholesalePriceCents: 2200000,
      wholesaleMinQty: 3,
    },
    {
      name: "Beaded Statement Necklace",
      description: "Handmade coral-style beads. One size, adjustable clasp.",
      priceCents: 650000,
      sizes: "",
      stock: 20,
      imageUrl: placeholder("Necklace", "#f59e0b", "#b45309"),
    },
    {
      name: "Aso-Oke Headwrap (Gele)",
      description: "Stiff woven gele, holds its shape. Multiple colours available.",
      priceCents: 900000,
      sizes: "",
      stock: 14,
      imageUrl: placeholder("Gele", "#db2777", "#831843"),
      // Pre-order with 50% deposit — woven to order.
      preOrderAllowed: true,
      depositPercent: 50,
    },
    {
      name: "Leather Slide Sandals",
      description: "Soft genuine-leather slides. Cushioned footbed.",
      priceCents: 1200000,
      sizes: "38,39,40,41,42",
      stock: 3,
      imageUrl: placeholder("Sandals", "#7c3aed", "#4c1d95"),
    },
    {
      name: "Kids Ankara Shirt",
      description: "Bright cotton-wax shirt for little ones. Ages 2-8.",
      priceCents: 550000,
      sizes: "2-3y,4-5y,6-7y,8y",
      stock: 0,
      imageUrl: placeholder("Kids Shirt", "#ef4444", "#7f1d1d"),
    },
  ];

  const products = await Promise.all(
    productData.map((p) =>
      prisma.product.create({ data: { ...p, vendorId: vendor.id } }),
    ),
  );

  const [gown, senator, necklace, gele, sandals] = products;

  // A spread of orders across the kanban columns.
  async function makeOrder(opts: {
    customerName: string;
    customerPhone: string;
    status: string;
    note?: string;
    source?: string;
    items: { product: (typeof products)[number]; size?: string; qty: number }[];
  }) {
    const totalCents = opts.items.reduce(
      (sum, it) => sum + it.product.priceCents * it.qty,
      0,
    );
    return prisma.order.create({
      data: {
        vendorId: vendor.id,
        customerName: opts.customerName,
        customerPhone: opts.customerPhone,
        status: opts.status,
        note: opts.note ?? "",
        source: opts.source ?? "catalog",
        totalCents,
        items: {
          create: opts.items.map((it) => ({
            productId: it.product.id,
            productName: it.product.name,
            size: it.size ?? "",
            quantity: it.qty,
            unitPriceCents: it.product.priceCents,
          })),
        },
      },
    });
  }

  const orders = [] as Awaited<ReturnType<typeof makeOrder>>[];
  orders.push(
    await makeOrder({
      customerName: "Chioma Okeke",
      customerPhone: "2348023456789",
      status: "NEW",
      note: "Wants delivery before Saturday.",
      items: [
        { product: gown, size: "M", qty: 1 },
        { product: necklace, qty: 1 },
      ],
    }),
  );

  orders.push(
    await makeOrder({
      customerName: "Tunde Bakare",
      customerPhone: "2348034567890",
      status: "NEW",
      source: "whatsapp",
      items: [{ product: senator, size: "XL", qty: 1 }],
    }),
  );

  orders.push(
    await makeOrder({
      customerName: "Amaka Eze",
      customerPhone: "2348045678901",
      status: "CONFIRMED",
      note: "Confirmed colour: royal blue.",
      items: [
        { product: gele, qty: 2 },
        { product: necklace, qty: 1 },
      ],
    }),
  );

  orders.push(
    await makeOrder({
      customerName: "Bola Adewale",
      customerPhone: "2348056789012",
      status: "PAID",
      note: "Paid via transfer. Awaiting dispatch.",
      items: [{ product: sandals, size: "40", qty: 1 }],
    }),
  );

  orders.push(
    await makeOrder({
      customerName: "Ngozi Nwosu",
      customerPhone: "2348067890123",
      status: "DELIVERED",
      items: [
        { product: gown, size: "L", qty: 1 },
        { product: gele, qty: 1 },
      ],
    }),
  );

  // Soko CRM: upsert one Customer per unique phone, then link each order back
  // to its customer. Denormalised totalSpentCents / orderCount keep the
  // dashboard cheap.
  const customerByPhone = new Map<string, string>();
  for (const o of orders) {
    let customerId = customerByPhone.get(o.customerPhone);
    if (!customerId) {
      const c = await prisma.customer.upsert({
        where: { vendorId_phone: { vendorId: vendor.id, phone: o.customerPhone } },
        update: {},
        create: {
          vendorId: vendor.id,
          name: o.customerName,
          phone: o.customerPhone,
        },
      });
      customerId = c.id;
      customerByPhone.set(o.customerPhone, customerId);
    }
    await prisma.customer.update({
      where: { id: customerId },
      data: {
        totalSpentCents: { increment: o.totalCents },
        orderCount: { increment: 1 },
        lastOrderAt: o.createdAt,
      },
    });
    await prisma.order.update({ where: { id: o.id }, data: { customerId } });
  }

  // One open receivable on the second new order (Tunde — pay later).
  const tundeOrder = orders[1];
  if (tundeOrder) {
    const due = new Date(tundeOrder.createdAt.getTime() + 14 * 24 * 60 * 60 * 1000);
    await prisma.receivable.create({
      data: {
        vendorId: vendor.id,
        customerId: customerByPhone.get(tundeOrder.customerPhone) ?? null,
        orderId: tundeOrder.id,
        amountCents: 900000,
        status: "OPEN",
        dueDate: due,
        note: "Pay on delivery — to clear within 14 days.",
      },
    });
  }

  // One affiliate (reseller code) so the dashboard has a row to show.
  await prisma.affiliate.create({
    data: {
      vendorId: vendor.id,
      code: "STYLEBYAMA",
      name: "Style by Ama",
      commissionPct: 0.15,
    },
  });

  // ── Togo launch shop ────────────────────────────────────────────────────
  // A public XOF (CFA franc) vendor in Lomé. Proves the zero-decimal money
  // path end-to-end: prices store as cents (×100), display as whole francs,
  // and pay out via PayGate (T-Money/Flooz) or CinetPay. No login needed —
  // it's a public marketplace shop you can browse + check out as a buyer.
  const togoEmail = "ameyo@soko.app";
  await prisma.vendor.deleteMany({ where: { email: togoEmail } });
  const togo = await prisma.vendor.create({
    data: {
      email: togoEmail,
      passwordHash: await bcrypt.hash("demo1234", 10),
      shopName: "Chez Améyo",
      shopSlug: "chez-ameyo",
      whatsappNumber: "22890112233",
      currency: "XOF",
      tagline: "Pagne, savon noir & karité — livraison à Lomé.",
      emailVerifiedAt: new Date(),
      onboardedAt: new Date(),
      region: "lome",
      category: "beauty",
      language: "fr",
      bio: "Boutique loméenne : pagne wax, savon noir, beurre de karité pur. Commande sur WhatsApp, paie en T-Money ou Flooz.",
      isPublic: true,
    },
  });

  // Prices in whole CFA, stored ×100 (e.g. 25 000 CFA → 2500000).
  const togoProductData = [
    { name: "Pagne Wax Hollandais (6 yards)", description: "Wax véritable, 6 yards. Plusieurs motifs.", priceCents: 2500000, sizes: "", stock: 12, imageUrl: placeholder("Pagne Wax", "#1f3535", "#2f4f4f") },
    { name: "Savon noir authentique", description: "Savon noir traditionnel, 250g. Peau nette.", priceCents: 150000, sizes: "", stock: 40, imageUrl: placeholder("Savon Noir", "#4a6171", "#1f3535") },
    { name: "Beurre de karité pur (500ml)", description: "Karité brut non raffiné. Visage, corps, cheveux.", priceCents: 300000, sizes: "", stock: 25, imageUrl: placeholder("Karité", "#b0c4de", "#4a6171") },
    { name: "Sandales en cuir cousu main", description: "Cuir véritable, fait main à Lomé.", priceCents: 800000, sizes: "39,40,41,42,43", stock: 6, imageUrl: placeholder("Sandales", "#2f4f4f", "#1f3535") },
  ];
  const togoProducts = await Promise.all(
    togoProductData.map((p) => prisma.product.create({ data: { ...p, vendorId: togo.id } })),
  );

  // One catalog order (NEW) to prove XOF totals + the checkout flow.
  const togoTotal = togoProducts[0].priceCents + togoProducts[2].priceCents; // pagne + karité
  await prisma.order.create({
    data: {
      vendorId: togo.id,
      customerName: "Koffi Adjété",
      customerPhone: "22899887766",
      status: "NEW",
      source: "catalog",
      totalCents: togoTotal,
      items: {
        create: [
          { productId: togoProducts[0].id, productName: togoProducts[0].name, size: "", quantity: 1, unitPriceCents: togoProducts[0].priceCents },
          { productId: togoProducts[2].id, productName: togoProducts[2].name, size: "", quantity: 1, unitPriceCents: togoProducts[2].priceCents },
        ],
      },
    },
  });

  console.log(`Seeded vendor "${vendor.shopName}" (${vendor.shopSlug})`);
  console.log(`  Login:   ${email} / ${password}`);
  console.log(`  Catalog: /c/${vendor.shopSlug}`);
  console.log(`  ${products.length} products, 5 orders`);
  console.log(`Seeded Togo shop "${togo.shopName}" (${togo.shopSlug}) — XOF`);
  console.log(`  Catalog: /c/${togo.shopSlug}  ·  ${togoProducts.length} products`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
