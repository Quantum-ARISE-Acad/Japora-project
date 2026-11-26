import { prisma } from "./db";
import { logger } from "./logger";
import { digitsOnly } from "./utils";
import {
  parseWhatsAppAssistantConfig,
  explainWhatsAppOrAiError,
  type WhatsAppDiagnosticAlert,
} from "./whatsapp-config";

/**
 * Append a diagnostic alert or status timestamp to `Vendor.uiPrefs.whatsappAssistant`
 * so the dashboard can immediately notify the merchant and pinpoint the exact failure stage.
 */
export async function recordVendorDiagnostic(
  vendorId: string,
  alert: Omit<WhatsAppDiagnosticAlert, "id" | "at"> & {
    markWebhookReceived?: boolean;
    markOutboundOk?: boolean;
  },
): Promise<void> {
  if (!vendorId) return;
  try {
    const v = await prisma.vendor.findUnique({
      where: { id: vendorId },
      select: { uiPrefs: true },
    });
    if (!v) return;
    const prefs =
      v.uiPrefs && typeof v.uiPrefs === "object" && !Array.isArray(v.uiPrefs)
        ? { ...(v.uiPrefs as Record<string, unknown>) }
        : {};
    const waCfg = parseWhatsAppAssistantConfig(prefs);
    const nowIso = new Date().toISOString();

    if (alert.markWebhookReceived) {
      waCfg.lastWebhookAt = nowIso;
    }
    if (alert.markOutboundOk) {
      waCfg.lastOutboundOkAt = nowIso;
    }

    const existingList = Array.isArray(waCfg.diagnostics) ? waCfg.diagnostics : [];
    const newEntry: WhatsAppDiagnosticAlert = {
      id: `diag_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      at: nowIso,
      stage: alert.stage,
      severity: alert.severity,
      title: alert.title,
      message: alert.message,
      details: alert.details,
      fixHint: alert.fixHint,
      contact: alert.contact,
    };

    // Keep latest 15 alerts
    waCfg.diagnostics = [newEntry, ...existingList].slice(0, 15);
    prefs.whatsappAssistant = waCfg;

    await prisma.vendor.update({
      where: { id: vendorId },
      data: { uiPrefs: prefs as never },
    });
  } catch (e) {
    logger.warn("whatsapp.record_diagnostic_failed", { vendorId, error: String(e) });
  }
}

export type OutboundMessage = {
  vendorId: string;
  to: string;
  body: string;
  orderId?: string | null;
  broadcastId?: string | null;
  overrideToken?: string;
  overridePhoneNumberId?: string;
};

export interface WhatsAppProvider {
  name: string;
  send(msg: OutboundMessage): Promise<{ status: string; providerId?: string }>;
}

/**
 * Stub provider — the default. Doesn't hit the network; it logs the message so
 * the whole order-notification flow is demoable without WhatsApp credentials.
 */
class StubProvider implements WhatsAppProvider {
  name = "stub";
  async send(msg: OutboundMessage) {
    logger.info("whatsapp.stub_send", {
      vendorId: msg.vendorId,
      to: digitsOnly(msg.to),
      bodyLength: msg.body.length,
      orderId: msg.orderId ?? null,
    });
    return { status: "stubbed" };
  }
}

/**
 * Real Meta WhatsApp Cloud API. Activated when the vendor has configured
 * their Access Token and Phone Number ID in Dashboard → Assistant WhatsApp.
 */
class CloudApiProvider implements WhatsAppProvider {
  name = "cloud-api";
  constructor(
    private token: string,
    private phoneNumberId: string,
  ) {}

  async send(msg: OutboundMessage) {
    const res = await fetch(
      `https://graph.facebook.com/v21.0/${this.phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: digitsOnly(msg.to),
          type: "text",
          text: { preview_url: false, body: msg.body },
        }),
      },
    );
    if (!res.ok) {
      throw new Error(
        `WhatsApp Cloud API error ${res.status}: ${await res.text()}`,
      );
    }
    const data = (await res.json()) as {
      messages?: { id?: string }[];
    };
    return { status: "sent", providerId: data.messages?.[0]?.id };
  }
}

export function getProvider(
  overrideToken?: string,
  overridePhoneNumberId?: string,
): WhatsAppProvider {
  if (process.env.NODE_ENV === "test" || process.env.WATURU_TEST_MODE === "1") {
    return new StubProvider();
  }
  const token = (overrideToken || "").trim();
  const phoneNumberId = (overridePhoneNumberId || "").trim();
  if (token && phoneNumberId) {
    return new CloudApiProvider(token, phoneNumberId);
  }
  return new StubProvider();
}

export function isLiveMode(vendor?: {
  whatsappPhoneNumberId?: string | null;
  uiPrefs?: unknown;
}): boolean {
  if (process.env.NODE_ENV === "test" || process.env.WATURU_TEST_MODE === "1") {
    return false;
  }
  const cfg = vendor ? parseWhatsAppAssistantConfig(vendor.uiPrefs) : null;
  const token = (cfg?.whatsappAccessToken || process.env.WHATSAPP_TOKEN || "").trim();
  const phoneNumberId = (
    vendor?.whatsappPhoneNumberId ||
    process.env.WHATSAPP_PHONE_NUMBER_ID ||
    ""
  ).trim();
  return Boolean(token && phoneNumberId);
}

/**
 * Resolve vendor-specific Cloud API credentials from DB if not in test mode.
 * Falls back to Japora's shared number from the environment (`WHATSAPP_TOKEN` /
 * `WHATSAPP_PHONE_NUMBER_ID`), never to another shop's credentials.
 */
export async function resolveVendorCloudCredentials(
  vendorId: string,
): Promise<{
  token?: string;
  phoneNumberId?: string;
  source: "vendor" | "env" | "none";
}> {
  if (process.env.NODE_ENV === "test" || process.env.WATURU_TEST_MODE === "1") {
    return { source: "none" };
  }
  try {
    const v = await prisma.vendor.findUnique({
      where: { id: vendorId },
      select: { whatsappPhoneNumberId: true, uiPrefs: true },
    });
    const cfg = v ? parseWhatsAppAssistantConfig(v.uiPrefs) : null;
    const token = (cfg?.whatsappAccessToken || "").trim();
    const phoneNumberId = (v?.whatsappPhoneNumberId || "").trim();

    // 1. The shop's own Meta credentials, only when both are set (never half of a pair).
    if (token && phoneNumberId) return { token, phoneNumberId, source: "vendor" };

    // 2. Otherwise Japora's own shared number (server configuration).
    // Never another shop's credentials: that would send this shop's messages from
    // someone else's WhatsApp number and Meta account, without their knowledge.
    const envToken = (process.env.WHATSAPP_TOKEN || "").trim();
    const envPhoneId = (process.env.WHATSAPP_PHONE_NUMBER_ID || "").trim();
    if (envToken && envPhoneId) return { token: envToken, phoneNumberId: envPhoneId, source: "env" };

    return { source: "none" };
  } catch {
    const envToken = (process.env.WHATSAPP_TOKEN || "").trim();
    const envPhoneId = (process.env.WHATSAPP_PHONE_NUMBER_ID || "").trim();
    return {
      token: envToken || undefined,
      phoneNumberId: envPhoneId || undefined,
      source: envToken && envPhoneId ? "env" : "none",
    };
  }
}

/** Largest voice note or photo the assistant downloads (Gemini accepts up to 20 MB inline). */
const MAX_MEDIA_BYTES = 15 * 1024 * 1024;

/**
 * Download a voice note or photo a customer sent (Meta media id) with the
 * credentials of the line that received it. Null in test/stub mode or on error.
 */
export async function downloadWhatsAppMedia(
  vendorId: string,
  mediaId: string,
): Promise<{ data: Buffer; mimeType: string } | null> {
  if (!mediaId || !/^[A-Za-z0-9_.-]{1,200}$/.test(mediaId)) return null;
  const creds = await resolveVendorCloudCredentials(vendorId);
  const token = (creds.token || "").trim();
  if (!token) return null;
  try {
    const meta = await fetch(`https://graph.facebook.com/v21.0/${mediaId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!meta.ok) throw new Error(`media lookup ${meta.status}`);
    const info = (await meta.json()) as { url?: string; mime_type?: string; file_size?: number };
    if (!info.url || !/^https:\/\/[^/]*(fbsbx\.com|fbcdn\.net|facebook\.com|whatsapp\.net)\//.test(info.url)) {
      throw new Error("unexpected media url");
    }
    if (info.file_size && info.file_size > MAX_MEDIA_BYTES) throw new Error("media too large");
    const file = await fetch(info.url, { headers: { Authorization: `Bearer ${token}` } });
    if (!file.ok) throw new Error(`media download ${file.status}`);
    const data = Buffer.from(await file.arrayBuffer());
    if (data.length > MAX_MEDIA_BYTES) throw new Error("media too large");
    return { data, mimeType: info.mime_type || file.headers.get("content-type") || "application/octet-stream" };
  } catch (e) {
    logger.warn("whatsapp.media_download_failed", { vendorId, error: e instanceof Error ? e.message : String(e) });
    return null;
  }
}

/**
 * Japora bot — interactive buttons / list messages. Buttons can be either a
 * short button list (max 3) or sectioned list rows (catalog browse).
 */
export type InteractiveButton = { id: string; title: string };
export type InteractiveListSection = {
  title: string;
  rows: { id: string; title: string; description?: string }[];
};

export type OutboundInteractive = {
  vendorId: string;
  to: string;
  header?: string;
  body: string;
  footer?: string;
  /** Label of the button that opens a list message. */
  listButton?: string;
  buttons: InteractiveButton[] | InteractiveListSection[];
  orderId?: string | null;
  broadcastId?: string | null;
  overrideToken?: string;
  overridePhoneNumberId?: string;
};

export type OutboundTemplate = {
  vendorId: string;
  to: string;
  templateName: string;
  languageCode: string;
  // Meta template components — left as `unknown[]` to avoid coupling to one
  // provider's shape. Stub provider just logs the count.
  components?: unknown[];
  // Optional shorthand for body text parameters (converted into a body component).
  parameters?: string[];
  orderId?: string | null;
  broadcastId?: string | null;
  overrideToken?: string;
  overridePhoneNumberId?: string;
};

function isSectionList(
  b: InteractiveButton[] | InteractiveListSection[],
): b is InteractiveListSection[] {
  return Array.isArray(b) && b.length > 0 && "rows" in (b[0] as object);
}

interface InteractiveCapable {
  name: string;
  sendInteractive(msg: OutboundInteractive): Promise<{ status: string; providerId?: string }>;
  sendTemplate(msg: OutboundTemplate): Promise<{ status: string; providerId?: string }>;
}

class StubInteractive implements InteractiveCapable {
  name = "stub";
  async sendInteractive(msg: OutboundInteractive) {
    logger.info("whatsapp.stub_interactive", {
      vendorId: msg.vendorId,
      to: digitsOnly(msg.to),
      bodyLength: msg.body.length,
      buttonCount: msg.buttons.length,
      kind: isSectionList(msg.buttons) ? "list" : "buttons",
    });
    return { status: "stubbed" };
  }
  async sendTemplate(msg: OutboundTemplate) {
    logger.info("whatsapp.stub_template", {
      vendorId: msg.vendorId,
      to: digitsOnly(msg.to),
      templateName: msg.templateName,
      languageCode: msg.languageCode,
      componentCount: msg.components?.length ?? 0,
    });
    return { status: "stubbed" };
  }
}

class CloudApiInteractive implements InteractiveCapable {
  name = "cloud-api";
  constructor(
    private token: string,
    private phoneNumberId: string,
  ) {}

  private async post(payload: unknown) {
    const res = await fetch(
      `https://graph.facebook.com/v21.0/${this.phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      },
    );
    if (!res.ok) {
      throw new Error(
        `WhatsApp Cloud API error ${res.status}: ${await res.text()}`,
      );
    }
    const data = (await res.json()) as { messages?: { id?: string }[] };
    return { status: "sent", providerId: data.messages?.[0]?.id };
  }

  async sendInteractive(msg: OutboundInteractive) {
    const isList = isSectionList(msg.buttons);
    const interactive: Record<string, unknown> = isList
      ? {
          type: "list",
          ...(msg.header ? { header: { type: "text", text: msg.header } } : {}),
          body: { text: msg.body },
          ...(msg.footer ? { footer: { text: msg.footer } } : {}),
          action: {
            button: msg.listButton || "Voir les options",
            sections: (msg.buttons as InteractiveListSection[]).map((s) => ({
              title: s.title,
              rows: s.rows.map((r) => ({
                id: r.id,
                title: r.title,
                ...(r.description ? { description: r.description } : {}),
              })),
            })),
          },
        }
      : {
          type: "button",
          ...(msg.header ? { header: { type: "text", text: msg.header } } : {}),
          body: { text: msg.body },
          ...(msg.footer ? { footer: { text: msg.footer } } : {}),
          action: {
            buttons: (msg.buttons as InteractiveButton[]).map((b) => ({
              type: "reply",
              reply: { id: b.id, title: b.title },
            })),
          },
        };
    return this.post({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: digitsOnly(msg.to),
      type: "interactive",
      interactive,
    });
  }

  async sendTemplate(msg: OutboundTemplate) {
    const components =
      msg.components ??
      (msg.parameters && msg.parameters.length > 0
        ? [
            {
              type: "body",
              parameters: msg.parameters.map((text) => ({ type: "text", text })),
            },
          ]
        : undefined);
    return this.post({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: digitsOnly(msg.to),
      type: "template",
      template: {
        name: msg.templateName,
        language: { code: msg.languageCode },
        ...(components ? { components } : {}),
      },
    });
  }
}

function getInteractive(
  overrideToken?: string,
  overridePhoneNumberId?: string,
): InteractiveCapable {
  if (process.env.NODE_ENV === "test" || process.env.WATURU_TEST_MODE === "1") {
    return new StubInteractive();
  }
  const token = (overrideToken || "").trim();
  const phoneNumberId = (overridePhoneNumberId || "").trim();
  if (token && phoneNumberId) {
    return new CloudApiInteractive(token, phoneNumberId);
  }
  return new StubInteractive();
}

/** Send a WhatsApp interactive message (buttons or list). Logs + persists. */
export async function sendWhatsAppInteractive(msg: OutboundInteractive) {
  const creds = await resolveVendorCloudCredentials(msg.vendorId);
  const provider = getInteractive(
    msg.overrideToken || creds.token,
    msg.overridePhoneNumberId || creds.phoneNumberId,
  );
  let status = "stubbed";
  let providerId: string | undefined;
  let error: string | undefined;
  try {
    const r = await provider.sendInteractive(msg);
    status = r.status;
    providerId = r.providerId;
  } catch (e) {
    status = "failed";
    error = e instanceof Error ? e.message : String(e);
  }
  const storedBody =
    status === "failed" && error
      ? `[interactive] ${msg.body}\n[ERROR: ${error.slice(0, 500)}]`
      : `[interactive] ${msg.body}`;
  const record = await prisma.whatsAppMessage.create({
    data: {
      vendorId: msg.vendorId,
      direction: "OUT",
      contact: msg.to,
      body: storedBody,
      status,
      messageId: providerId ?? null,
      orderId: msg.orderId ?? null,
      broadcastId: msg.broadcastId ?? null,
    },
  });

  if (status === "failed" && error) {
    const explained = explainWhatsAppOrAiError(error, "whatsapp_send");
    await recordVendorDiagnostic(msg.vendorId, {
      stage: "whatsapp_send",
      severity: "error",
      title: explained.title,
      message: explained.message,
      details: error.slice(0, 400),
      fixHint: explained.fixHint,
      contact: msg.to,
    });
  } else if (status === "sent") {
    await recordVendorDiagnostic(msg.vendorId, {
      stage: "whatsapp_send",
      severity: "ok",
      title: "Réponse interactive envoyée via Meta Cloud API",
      message: `Réponse envoyée avec succès au numéro ${msg.to}.`,
      contact: msg.to,
      markOutboundOk: true,
    });
  }

  return { record, provider: provider.name, status, providerId, error };
}

/**
 * Send the "Quelle boutique ?" list on the shared Japora number. No shop is
 * chosen yet, so the message uses the server's Japora credentials and is not
 * stored in any shop's inbox (it is logged). Falls back to plain text.
 */
export async function sendSharedNumberPicker(msg: {
  to: string;
  phoneNumberId?: string;
  body: string;
  footer?: string;
  listButton?: string;
  sections?: InteractiveListSection[];
  textFallback: string;
}): Promise<{ status: string; kind: "list" | "text" }> {
  if (msg.sections && msg.sections.length > 0) {
    try {
      const r = await getInteractive(undefined, msg.phoneNumberId).sendInteractive({
        vendorId: "",
        to: msg.to,
        body: msg.body,
        footer: msg.footer,
        listButton: msg.listButton,
        buttons: msg.sections,
      });
      logger.info("whatsapp.shared_picker_sent", { to: digitsOnly(msg.to), kind: "list", status: r.status });
      return { status: r.status, kind: "list" };
    } catch (e) {
      logger.warn("whatsapp.shared_picker_list_failed", { error: e instanceof Error ? e.message : String(e) });
    }
  }
  try {
    const r = await getProvider(undefined, msg.phoneNumberId).send({ vendorId: "", to: msg.to, body: msg.textFallback });
    logger.info("whatsapp.shared_picker_sent", { to: digitsOnly(msg.to), kind: "text", status: r.status });
    return { status: r.status, kind: "text" };
  } catch (e) {
    logger.error("whatsapp.shared_picker_failed", { error: e instanceof Error ? e.message : String(e) });
    return { status: "failed", kind: "text" };
  }
}

/** Send a pre-approved WhatsApp template message. Logs + persists. */
export async function sendWhatsAppTemplate(msg: OutboundTemplate) {
  const creds = await resolveVendorCloudCredentials(msg.vendorId);
  const provider = getInteractive(
    msg.overrideToken || creds.token,
    msg.overridePhoneNumberId || creds.phoneNumberId,
  );
  let status = "stubbed";
  let providerId: string | undefined;
  let error: string | undefined;
  try {
    const r = await provider.sendTemplate(msg);
    status = r.status;
    providerId = r.providerId;
  } catch (e) {
    status = "failed";
    error = e instanceof Error ? e.message : String(e);
  }
  const storedBody =
    status === "failed" && error
      ? `[template:${msg.templateName}] [ERROR: ${error.slice(0, 500)}]`
      : `[template:${msg.templateName}]`;
  const record = await prisma.whatsAppMessage.create({
    data: {
      vendorId: msg.vendorId,
      direction: "OUT",
      contact: msg.to,
      body: storedBody,
      status,
      messageId: providerId ?? null,
      orderId: msg.orderId ?? null,
      broadcastId: msg.broadcastId ?? null,
    },
  });

  if (status === "failed" && error) {
    const explained = explainWhatsAppOrAiError(error, "whatsapp_send");
    await recordVendorDiagnostic(msg.vendorId, {
      stage: "whatsapp_send",
      severity: "error",
      title: explained.title,
      message: explained.message,
      details: error.slice(0, 400),
      fixHint: explained.fixHint,
      contact: msg.to,
    });
  }

  return { record, provider: provider.name, status, providerId, error };
}

/** Send a message via the active provider and persist a log row either way. */
export async function sendWhatsApp(msg: OutboundMessage) {
  const creds = await resolveVendorCloudCredentials(msg.vendorId);
  const provider = getProvider(
    msg.overrideToken || creds.token,
    msg.overridePhoneNumberId || creds.phoneNumberId,
  );
  let status = "stubbed";
  let error: string | undefined;
  let providerId: string | undefined;

  try {
    const result = await provider.send(msg);
    status = result.status;
    providerId = result.providerId;
  } catch (e) {
    status = "failed";
    error = e instanceof Error ? e.message : String(e);
  }

  const storedBody =
    status === "failed" && error
      ? `${msg.body}\n[ERROR: ${error.slice(0, 500)}]`
      : msg.body;

  const record = await prisma.whatsAppMessage.create({
    data: {
      vendorId: msg.vendorId,
      direction: "OUT",
      contact: msg.to,
      body: storedBody,
      status,
      messageId: providerId ?? null,
      orderId: msg.orderId ?? null,
      broadcastId: msg.broadcastId ?? null,
    },
  });

  if (status === "failed" && error) {
    const explained = explainWhatsAppOrAiError(error, "whatsapp_send");
    await recordVendorDiagnostic(msg.vendorId, {
      stage: "whatsapp_send",
      severity: "error",
      title: explained.title,
      message: explained.message,
      details: error.slice(0, 400),
      fixHint: explained.fixHint,
      contact: msg.to,
    });
  } else if (status === "sent") {
    await recordVendorDiagnostic(msg.vendorId, {
      stage: "whatsapp_send",
      severity: "ok",
      title: "Message envoyé via Meta Cloud API",
      message: `Message texte envoyé avec succès au numéro ${msg.to}.`,
      contact: msg.to,
      markOutboundOk: true,
    });
  }

  return { record, provider: provider.name, status, providerId, error };
}

/**
 * Apply a delivery-status update from Meta's webhook `statuses[]` to the matching
 * outbound message. status ∈ sent | delivered | read | failed. We never
 * downgrade (read → delivered) since events can arrive out of order.
 */
const STATUS_RANK: Record<string, number> = {
  stubbed: 0,
  sent: 1,
  delivered: 2,
  read: 3,
  failed: 1,
};

export async function applyStatusUpdate(messageId: string, status: string): Promise<boolean> {
  const id = (messageId || "").trim();
  const next = (status || "").trim().toLowerCase();
  if (!id || !next) return false;

  const row = await prisma.whatsAppMessage.findFirst({
    where: { messageId: id },
    select: { id: true, status: true },
  });
  if (!row) return false;

  // Don't move backwards (out-of-order webhooks), but always honour "failed".
  const cur = STATUS_RANK[row.status] ?? 0;
  const nxt = STATUS_RANK[next] ?? 0;
  if (next !== "failed" && nxt <= cur) return false;

  await prisma.whatsAppMessage.update({ where: { id: row.id }, data: { status: next } });
  logger.info("whatsapp.status_update", { messageId: id, status: next });
  return true;
}

/* =====================================================================
 * Cost-aware customer updates — the "free in-window" optimization.
 *
 * WhatsApp charges per template message, but a reply sent INSIDE the customer's
 * open 24-hour service window (they messaged us within the last 24h) is FREE.
 * Most order-status updates happen minutes after the customer ordered, so the
 * window is usually open. `sendCustomerUpdate` checks that and sends a free
 * in-window message when it can, only falling back to a (paid) utility template
 * when the window has closed. See gtm/02-NOTIFICATIONS.md.
 * ===================================================================== */

const SERVICE_WINDOW_MS = 24 * 60 * 60 * 1000;

/** Is the customer's 24h service window with this vendor currently open? */
export async function isWithinServiceWindow(
  vendorId: string,
  contact: string,
  withinMs: number = SERVICE_WINDOW_MS,
): Promise<boolean> {
  const phone = digitsOnly(contact);
  if (!phone) return false;
  const lastInbound = await prisma.whatsAppMessage.findFirst({
    where: { vendorId, direction: "IN", contact: phone },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  if (!lastInbound) return false;
  return Date.now() - lastInbound.createdAt.getTime() < withinMs;
}

/**
 * Send a customer update the cheapest correct way:
 *  - window open  → free in-window text (sendWhatsApp)
 *  - window closed + template provided → paid utility template
 *  - window closed + no template → best-effort text (logged as out-of-window)
 *
 * Returns the send result plus `inWindow` (was it free?) and `billable`.
 */
export async function sendCustomerUpdate(msg: {
  vendorId: string;
  to: string;
  body: string;
  orderId?: string | null;
  templateName?: string;
  languageCode?: string;
  components?: unknown[];
  overrideToken?: string;
  overridePhoneNumberId?: string;
}) {
  const inWindow = await isWithinServiceWindow(msg.vendorId, msg.to);

  if (inWindow) {
    const r = await sendWhatsApp({
      vendorId: msg.vendorId,
      to: msg.to,
      body: msg.body,
      orderId: msg.orderId,
      overrideToken: msg.overrideToken,
      overridePhoneNumberId: msg.overridePhoneNumberId,
    });
    logger.info("whatsapp.customer_update", { vendorId: msg.vendorId, path: "in_window_free", billable: false });
    return { ...r, inWindow: true, billable: false };
  }

  if (msg.templateName) {
    const r = await sendWhatsAppTemplate({
      vendorId: msg.vendorId,
      to: msg.to,
      templateName: msg.templateName,
      languageCode: msg.languageCode || "en",
      components: msg.components,
      orderId: msg.orderId,
      overrideToken: msg.overrideToken,
      overridePhoneNumberId: msg.overridePhoneNumberId,
    });
    logger.info("whatsapp.customer_update", { vendorId: msg.vendorId, path: "template_paid", billable: true });
    return { ...r, inWindow: false, billable: true };
  }

  // No template registered yet — send text best-effort, flagged for visibility.
  const r = await sendWhatsApp({
    vendorId: msg.vendorId,
    to: msg.to,
    body: msg.body,
    orderId: msg.orderId,
    overrideToken: msg.overrideToken,
    overridePhoneNumberId: msg.overridePhoneNumberId,
  });
  logger.warn("whatsapp.customer_update", { vendorId: msg.vendorId, path: "out_of_window_no_template", billable: true });
  return { ...r, inWindow: false, billable: true };
}
