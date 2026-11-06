import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const vendor = await prisma.vendor.findUnique({ where: { email: 'demo@wcatalog.app' } });
  if (!vendor) {
    console.error('FAIL: Vendor demo@wcatalog.app not found!');
    process.exit(1);
  }
  const valid = await bcrypt.compare('demo1234', vendor.passwordHash);
  if (!valid) {
    console.error('FAIL: Password demo1234 does not match hash!');
    process.exit(1);
  }
  const count = await prisma.product.count({ where: { vendorId: vendor.id } });
  console.log('SUCCESS: demo@wcatalog.app login verified!');
  console.log(`Shop: "${vendor.shopName}" (${vendor.shopSlug}), Products count: ${count}`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
