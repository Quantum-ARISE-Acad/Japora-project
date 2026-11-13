import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * Production database initialization check.
 * Simulated/demo shops and synthetic data have been removed so only real
 * Clerk-authenticated vendors, real products, real orders, and real API
 * transactions exist in MySQL.
 */
async function main() {
  const vendorCount = await prisma.vendor.count();
  console.log(`✅ Base de données MySQL Japora prête (${vendorCount} boutique(s) réelle(s) active(s)).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
