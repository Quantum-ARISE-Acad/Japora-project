import { existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

export const SYNTHETIC_VENDOR_EMAIL = "synthetic-demo@japora.test";
export const SYNTHETIC_VENDOR_PASSWORD = "SyntheticPass123";

export async function getSyntheticVendorPasswordHash(): Promise<string> {
  const { hashPassword } = await import("../src/lib/auth");
  return hashPassword(SYNTHETIC_VENDOR_PASSWORD);
}

const projectRoot = process.cwd();
const databaseFile = join(projectRoot, "prisma", "dev-recovery-synthetic.db");
const databaseUrl = `file:${databaseFile}`;

process.env.DATABASE_URL = databaseUrl;
process.env.SESSION_SECRET ??= "dev-only-synthetic-session-secret";
process.env.NEXT_PUBLIC_APP_URL ??= "http://localhost:5174";

const syntheticEmail = SYNTHETIC_VENDOR_EMAIL;
const syntheticPhone = "+15550000003";
const syntheticSessionId = "synthetic-cart-demo-session";
const staleAt = new Date(Date.now() - 2 * 60 * 60 * 1000);

async function ensureSchema() {
  if (existsSync(databaseFile)) {
    rmSync(databaseFile, { force: true });
  }
  if (existsSync(`${databaseFile}-journal`)) {
    rmSync(`${databaseFile}-journal`, { force: true });
  }

  const { execSync } = await import("node:child_process");
  execSync("npx prisma db push --schema prisma/schema.prisma --skip-generate", {
    cwd: projectRoot,
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: databaseUrl },
  });
}

async function main() {
  await ensureSchema();

  const syntheticPasswordHash = await getSyntheticVendorPasswordHash();

  const { PrismaClient } = await import("@prisma/client");
  const { listCampaigns } = await import("../src/lib/campaigns");
  const prisma = new PrismaClient({ datasourceUrl: databaseUrl });

  const vendor = await prisma.vendor.upsert({
    where: { email: syntheticEmail },
    update: {
      shopName: "Synthetic Recovery Demo",
      shopSlug: "synthetic-recovery-demo",
      passwordHash: syntheticPasswordHash,
      whatsappNumber: syntheticPhone,
      currency: "XOF",
      subscriptionStatus: "trialing",
    },
    create: {
      email: syntheticEmail,
      passwordHash: syntheticPasswordHash,
      shopName: "Synthetic Recovery Demo",
      shopSlug: "synthetic-recovery-demo",
      whatsappNumber: syntheticPhone,
      currency: "XOF",
      subscriptionStatus: "trialing",
    },
  });

  const product = await prisma.product.upsert({
    where: {
      id: "synthetic-recovery-product",
    },
    update: {},
    create: {
      id: "synthetic-recovery-product",
      vendorId: vendor.id,
      name: "Synthetic Recovery Item",
      description: "Synthetic test item used only for local recovery validation.",
      priceCents: 2500,
      stock: 99,
      isActive: true,
    },
  });

  const customer = await prisma.customer.upsert({
    where: {
      vendorId_phone: {
        vendorId: vendor.id,
        phone: syntheticPhone,
      },
    },
    update: {
      name: "Synthetic Buyer",
      marketingConsent: true,
      marketingConsentBasis: "manual",
      marketingConsentAt: new Date(),
      marketingConsentRevokedAt: null,
    },
    create: {
      vendorId: vendor.id,
      name: "Synthetic Buyer",
      phone: syntheticPhone,
      marketingConsent: true,
      marketingConsentBasis: "manual",
      marketingConsentAt: new Date(),
      marketingConsentRevokedAt: null,
    },
  });

  const cart = await prisma.funnelEvent.upsert({
    where: {
      id: "synthetic-cart-event-id",
    },
    update: {
      vendorId: vendor.id,
      customerId: customer.id,
      customerPhone: syntheticPhone,
      shopSlug: vendor.shopSlug,
      stage: "cart",
      sessionId: syntheticSessionId,
      productId: product.id,
      valueCents: 2500,
      createdAt: staleAt,
    },
    create: {
      id: "synthetic-cart-event-id",
      vendorId: vendor.id,
      customerId: customer.id,
      customerPhone: syntheticPhone,
      shopSlug: vendor.shopSlug,
      stage: "cart",
      sessionId: syntheticSessionId,
      productId: product.id,
      valueCents: 2500,
      createdAt: staleAt,
    },
  });

  const campaigns = await listCampaigns(vendor.id);
  console.log(JSON.stringify({
    databaseUrl,
    vendor: { id: vendor.id, email: vendor.email, shopName: vendor.shopName },
    customer: { id: customer.id, phone: customer.phone },
    cart: { id: cart.id, sessionId: cart.sessionId, createdAt: cart.createdAt.toISOString() },
    campaigns: campaigns.map((c) => ({ id: c.id, name: c.name, status: c.status, productId: c.productId, createdAt: c.createdAt.toISOString() })),
  }, null, 2));
}

const isDirectExecution = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectExecution) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
