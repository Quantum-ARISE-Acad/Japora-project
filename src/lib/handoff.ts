/**
 * Hand-off to the vendor: when the customer asks for a person, the WhatsApp
 * assistant warns the vendor and stays silent in that conversation until the
 * vendor hands it back (dashboard), the customer writes "assistant", or the
 * pause expires.
 */
import { prisma } from "./db";
import { logger } from "./logger";
import { digitsOnly } from "./utils";
import { sendWhatsApp } from "./whatsapp";
import { sendEmail } from "./email";

/** How long the assistant stays silent if nobody hands it back. */
export const HANDOFF_HOURS = 12;

/** Button id of "Parler au vendeur". */
export const HANDOFF_BUTTON_ID = "HANDOFF";

function normalize(text: string): string {
  return ` ${(text || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9']+/g, " ")
    .trim()} `;
}

const SELLER_PHRASES = [
  "parler au vendeur",
  "parler a un vendeur",
  "parler avec le vendeur",
  "parler a la vendeuse",
  "parler au proprietaire",
  "parler au patron",
  "parler a la patronne",
  "parler a quelqu'un",
  "parler a une personne",
  "parler a un humain",
  "une vraie personne",
  "un humain",
  "appeler le vendeur",
  "joindre le vendeur",
  "contacter le vendeur",
  "talk to the seller",
  "talk to seller",
  "speak to the seller",
  "talk to a human",
  "real person",
  "human agent",
];

/** The customer asks to talk to the vendor (or tapped "Parler au vendeur"). */
export function wantsHumanSeller(text: string): boolean {
  if ((text || "").trim().toUpperCase() === HANDOFF_BUTTON_ID) return true;
  const t = normalize(text);
  return SELLER_PHRASES.some((p) => t.includes(` ${p} `));
}

/** The customer wants the assistant back: "assistant", "reprendre l'assistant". */
export function wantsAssistantBack(text: string): boolean {
  const t = normalize(text).trim();
  return ["assistant", "l'assistant", "reprendre l'assistant", "retour assistant", "robot", "bot"].includes(t);
}

function contactKeys(contact: string): string[] {
  const clean = digitsOnly(contact);
  return [...new Set([clean, contact].filter(Boolean))];
}

/** The open hand-off of this conversation, if any (expired ones do not count). */
export async function activeHandoff(vendorId: string, contact: string) {
  return prisma.botHandoff.findFirst({
    where: {
      vendorId,
      contact: { in: contactKeys(contact) },
      resolvedAt: null,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
  });
}

/** Keep the customer's latest words on the open hand-off, for the dashboard. */
export async function noteHandoffMessage(id: string, text: string): Promise<void> {
  await prisma.botHandoff
    .update({ where: { id }, data: { lastMessage: text.slice(0, 500) } })
    .catch(() => {});
}

/**
 * Pause the assistant for this customer and warn the vendor (WhatsApp + e-mail,
 * both best-effort). Returns false when a hand-off was already open.
 */
export async function startHandoff(opts: {
  vendorId: string;
  contact: string;
  reason: string;
  lastMessage: string;
}): Promise<boolean> {
  const contact = digitsOnly(opts.contact) || opts.contact;
  const existing = await activeHandoff(opts.vendorId, contact);
  if (existing) {
    await noteHandoffMessage(existing.id, opts.lastMessage);
    return false;
  }
  await prisma.botHandoff.create({
    data: {
      vendorId: opts.vendorId,
      contact,
      reason: opts.reason.slice(0, 200),
      lastMessage: opts.lastMessage.slice(0, 500),
      expiresAt: new Date(Date.now() + HANDOFF_HOURS * 3600_000),
    },
  });
  logger.info("bot.handoff_started", { vendorId: opts.vendorId, contact, reason: opts.reason });
  await notifyVendor(opts.vendorId, contact, opts.lastMessage);
  return true;
}

/** Give the conversation back to the assistant. */
export async function resolveHandoff(vendorId: string, contact: string): Promise<number> {
  const r = await prisma.botHandoff.updateMany({
    where: { vendorId, contact: { in: contactKeys(contact) }, resolvedAt: null },
    data: { resolvedAt: new Date() },
  });
  return r.count;
}

/** Open hand-offs of a vendor, newest first, for the dashboard. */
export async function listOpenHandoffs(vendorId: string) {
  return prisma.botHandoff.findMany({
    where: { vendorId, resolvedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
}

async function notifyVendor(vendorId: string, contact: string, lastMessage: string): Promise<void> {
  const vendor = await prisma.vendor.findUnique({
    where: { id: vendorId },
    select: { shopName: true, whatsappNumber: true, email: true },
  });
  if (!vendor) return;
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:5174").replace(/\/$/, "");
  const inbox = `${appUrl}/dashboard/bot#clients-en-attente`;
  const text =
    `Japora : un client (+${contact}) veut vous parler sur WhatsApp.\n` +
    `Son message : « ${lastMessage.slice(0, 200)} »\n\n` +
    `L'assistant est en pause pour ce client. Répondez-lui depuis votre tableau de bord : ${inbox}`;

  const vendorPhone = digitsOnly(vendor.whatsappNumber);
  if (vendorPhone && vendorPhone !== contact) {
    try {
      await sendWhatsApp({ vendorId, to: vendorPhone, body: text });
    } catch (e) {
      logger.warn("bot.handoff_whatsapp_notify_failed", { vendorId, error: String(e) });
    }
  }
  if (vendor.email && vendor.email.includes("@")) {
    try {
      await sendEmail({
        vendorId,
        to: vendor.email,
        subject: `Un client veut vous parler (${vendor.shopName})`,
        text,
        html: `<p>Un client (<strong>+${contact}</strong>) veut vous parler sur WhatsApp.</p>` +
          `<p>Son message : « ${escapeHtml(lastMessage.slice(0, 200))} »</p>` +
          `<p>L'assistant est en pause pour ce client. <a href="${inbox}">Répondez-lui depuis votre tableau de bord</a>.</p>`,
        template: "bot_handoff",
      });
    } catch (e) {
      logger.warn("bot.handoff_email_notify_failed", { vendorId, error: String(e) });
    }
  }
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);
}
