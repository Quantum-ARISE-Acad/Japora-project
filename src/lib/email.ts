import { prisma } from "./db";
import { logger } from "./logger";

export type OutboundEmail = {
  vendorId?: string | null;
  to: string;
  subject: string;
  html: string;
  text?: string;
  template?: string;
};

export interface EmailProvider {
  name: string;
  send(msg: OutboundEmail): Promise<{ status: string; providerId?: string }>;
}

/**
 * Stub — the default. Logs structured info, persists a record. Lets the
 * whole password-reset / verify-email flow run without any external account.
 */
class StubEmailProvider implements EmailProvider {
  name = "stub";
  async send(msg: OutboundEmail) {
    logger.info("email.stub_send", {
      to: msg.to,
      subject: msg.subject,
      template: msg.template,
      bodyLength: msg.html.length,
    });
    return { status: "stubbed" };
  }
}

/**
 * Resend — auto-activated when RESEND_API_KEY is set. Uses the REST API
 * directly so we don't pull a SDK; the API is two fields and a content blob.
 *
 * EMAIL_FROM must use a domain you've verified in Resend
 * (Resend dashboard → Domains). e.g. "Japora <hello@yourdomain.com>".
 */
class ResendProvider implements EmailProvider {
  name = "resend";
  constructor(
    private apiKey: string,
    private from: string,
  ) {}

  async send(msg: OutboundEmail) {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: this.from,
        to: [msg.to],
        subject: msg.subject,
        html: msg.html,
        text: msg.text ?? stripHtml(msg.html),
      }),
    });
    if (!res.ok) {
      throw new Error(`Resend error ${res.status}: ${await res.text()}`);
    }
    const data = (await res.json()) as { id?: string };
    return { status: "sent", providerId: data.id };
  }
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

let cached: EmailProvider | null = null;

export function getEmailProvider(): EmailProvider {
  if (cached) return cached;
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM || "Japora <noreply@japora.app>";
  cached = apiKey ? new ResendProvider(apiKey, from) : new StubEmailProvider();
  return cached;
}

export function emailMode(): "live" | "stub" {
  return process.env.RESEND_API_KEY ? "live" : "stub";
}

/** Send via the active provider and persist a log row either way. */
export async function sendEmail(msg: OutboundEmail) {
  const provider = getEmailProvider();
  let status = "stubbed";
  let providerId: string | undefined;
  let error: string | undefined;

  try {
    const r = await provider.send(msg);
    status = r.status;
    providerId = r.providerId;
  } catch (e) {
    status = "failed";
    error = e instanceof Error ? e.message : String(e);
    logger.error("email.send_failed", {
      provider: provider.name,
      to: msg.to,
      template: msg.template,
      error,
    });
  }

  const record = await prisma.emailMessage.create({
    data: {
      vendorId: msg.vendorId ?? null,
      to: msg.to,
      subject: msg.subject,
      body: msg.html,
      status,
      providerId: providerId ?? null,
      error: error ?? null,
      template: msg.template ?? null,
    },
  });

  return { record, provider: provider.name, status, providerId, error };
}
