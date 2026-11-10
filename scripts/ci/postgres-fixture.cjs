// Executed via stdin inside the production image, only against disposable CI DBs.
const assert = require('node:assert/strict');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const mode = process.argv[2];
  assert.ok(['write', 'check'].includes(mode), 'Expected write or check');
  if (mode === 'write') {
    await prisma.$transaction(async (tx) => {
      const vendor = await tx.vendor.create({data: {
        id: 'ci-vendor', email: 'vendor@example.invalid', passwordHash: 'not-a-login-password',
        shopName: 'CI Shop', shopSlug: 'ci-shop', clerkId: 'ci-clerk-id', currency: 'XOF',
        businessHours: {enabled: true, days: [1, 2], open: '08:00', close: '18:00'},
        uiPrefs: {theme: 'light'}, deliveryEnabled: true, deliveryFeeCents: 500,
      }});
      const collection = await tx.collection.create({data: {id: 'ci-collection', vendorId: vendor.id, name: 'CI Collection', slug: 'ci-collection'}});
      const product = await tx.product.create({data: {id: 'ci-product', vendorId: vendor.id, collectionId: collection.id, name: 'CI Product', priceCents: 1500, stock: 3}});
      const customer = await tx.customer.create({data: {id: 'ci-customer', vendorId: vendor.id, name: 'CI Customer', phone: '22890000000', marketingConsent: true}});
      await tx.order.create({data: {
        id: 'ci-order', vendorId: vendor.id, customerId: customer.id, customerName: customer.name,
        totalCents: 1500, sessionId: 'ci-session', items: {create: {productId: product.id, productName: product.name, quantity: 1, unitPriceCents: 1500}},
      }});
      await tx.review.create({data: {vendorId: vendor.id, productId: product.id, customerName: customer.name, comment: 'CI review'}});
      await tx.paymentLink.create({data: {vendorId: vendor.id, amountCents: 1500}});
      await tx.funnelEvent.create({data: {vendorId: vendor.id, customerId: customer.id, shopSlug: vendor.shopSlug, stage: 'visit', sessionId: 'ci-session'}});
      await tx.busEvent.create({data: {vendorId: vendor.id, type: 'ci.fixture', subjectType: 'product', subjectId: product.id, data: {ci: true}}});
    });
  }
  const vendor = await prisma.vendor.findUniqueOrThrow({where: {id: 'ci-vendor'}, include: {products: true, orders: {include: {items: true}}, customers: true, collections: true, reviews: true, paymentLinks: true, funnelEvents: true}});
  assert.equal(vendor.clerkId, 'ci-clerk-id');
  assert.deepEqual(vendor.businessHours.days, [1, 2]);
  assert.equal(vendor.uiPrefs.theme, 'light');
  assert.equal(vendor.deliveryFeeCents, 500);
  assert.equal(vendor.products[0].collectionId, 'ci-collection');
  assert.equal(vendor.products[0].stock, 3);
  assert.equal(vendor.orders[0].items[0].productId, 'ci-product');
  assert.equal(vendor.customers[0].marketingConsent, true);
  for (const relation of ['products', 'orders', 'customers', 'collections', 'reviews', 'paymentLinks', 'funnelEvents']) assert.equal(vendor[relation].length, 1, relation);
  assert.deepEqual((await prisma.busEvent.findFirstOrThrow()).data, {ci: true});
  console.log('PostgreSQL fixture verified: relations, JSON, consent, collection, review, payment link and outbox.');
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
