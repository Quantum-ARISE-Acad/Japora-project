import { prisma } from "./db";
import { normalizePhone } from "./otp";

const OPT_OUT_COMMANDS = new Set(["stop", "stop all", "unsubscribe", "cancel", "end", "quit", "arret", "desabonne", "desabonner"]);

export function isMarketingOptOutCommand(text: string): boolean {
  const normalized = text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
  return OPT_OUT_COMMANDS.has(normalized);
}

/** Revoke consent only for this sender on the WhatsApp line that received the command. */
export async function optOutMarketingContact(vendorId: string, phone: string) {
  const normalized = normalizePhone(phone);
  if (!normalized) return { customers: 0, followers: 0 };
  const now = new Date();

  const customers = await prisma.customer.findMany({
    where: { vendorId, deletedAt: null, marketingConsent: true },
    select: { id: true, phone: true },
  });
  const customerIds = customers.filter((customer) => normalizePhone(customer.phone) === normalized).map((customer) => customer.id);
  const followers = await prisma.follower.findMany({
    where: { vendorId, unsubscribedAt: null },
    select: { id: true, phone: true },
  });
  const followerIds = followers.filter((follower) => normalizePhone(follower.phone) === normalized).map((follower) => follower.id);

  const [customerResult, followerResult] = await Promise.all([
    customerIds.length
      ? prisma.customer.updateMany({
          where: { vendorId, id: { in: customerIds }, marketingConsent: true },
          data: { marketingConsent: false, marketingConsentRevokedAt: now },
        })
      : Promise.resolve({ count: 0 }),
    followerIds.length
      ? prisma.follower.updateMany({
          where: { vendorId, id: { in: followerIds }, unsubscribedAt: null },
          data: { unsubscribedAt: now },
        })
      : Promise.resolve({ count: 0 }),
  ]);
  return { customers: customerResult.count, followers: followerResult.count };
}
