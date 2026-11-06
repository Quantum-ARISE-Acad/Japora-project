/**
 * Per-vendor WhatsApp Cloud API & Gemini AI Assistant configuration.
 *
 * Stored inside `Vendor.uiPrefs.whatsappAssistant` (JSON) alongside the
 * top-level `Vendor.whatsappNumber` and `Vendor.whatsappPhoneNumberId` columns.
 * This keeps schema migrations zero-downtime while allowing each vendor on
 * Japora to customize their AI assistant, QR codes, and Meta Cloud API credentials.
 */

export type WhatsAppAssistantConfig = {
  /** Whether the AI assistant is enabled on the shop & WhatsApp bot */
  aiEnabled: boolean;
  /** Custom name for the assistant (e.g. "Assistant Kofi Shop") */
  assistantName: string;
  /** Custom welcome message shown when a customer opens the assistant or says Hi */
  welcomeMessage: string;
  /** Extra instructions / knowledge base for Gemini (policies, promos, negotiation, etc.) */
  customInstructions: string;
  /** Pre-filled message when a customer scans the WhatsApp QR code */
  whatsappPrefillMessage: string;
  /** Whether to display the WhatsApp Assistant QR code section on the public shop */
  showQrOnShop: boolean;
  /** Automatically send a WhatsApp message when the vendor changes order status */
  autoNotifyOrderStatus: boolean;
  /** Optional per-vendor Meta WhatsApp Cloud API Access Token override */
  whatsappAccessToken: string;
  /** Optional per-vendor Meta WhatsApp Business Account ID (WABA ID) */
  whatsappBusinessAccountId: string;
  /** Optional per-vendor Webhook Verify Token */
  whatsappVerifyToken: string;
  /** Optional per-vendor Gemini API Key override */
  geminiApiKey: string;
};

export const DEFAULT_WHATSAPP_ASSISTANT_CONFIG: WhatsAppAssistantConfig = {
  aiEnabled: true,
  assistantName: "",
  welcomeMessage: "",
  customInstructions: "",
  whatsappPrefillMessage: "Bonjour ! Je viens de scanner votre QR code sur Japora. Quels sont vos articles disponibles ?",
  showQrOnShop: true,
  autoNotifyOrderStatus: true,
  whatsappAccessToken: "",
  whatsappBusinessAccountId: "",
  whatsappVerifyToken: "",
  geminiApiKey: "",
};

/**
 * Extract the vendor's WhatsApp & AI assistant config from `Vendor.uiPrefs`.
 * Never throws; falls back to sane defaults.
 */
export function parseWhatsAppAssistantConfig(uiPrefs: unknown): WhatsAppAssistantConfig {
  const out: WhatsAppAssistantConfig = { ...DEFAULT_WHATSAPP_ASSISTANT_CONFIG };
  if (!uiPrefs || typeof uiPrefs !== "object" || Array.isArray(uiPrefs)) {
    return out;
  }
  const root = uiPrefs as Record<string, unknown>;
  const raw =
    root.whatsappAssistant &&
    typeof root.whatsappAssistant === "object" &&
    !Array.isArray(root.whatsappAssistant)
      ? (root.whatsappAssistant as Record<string, unknown>)
      : {};

  if (typeof raw.aiEnabled === "boolean") out.aiEnabled = raw.aiEnabled;
  if (typeof raw.assistantName === "string") out.assistantName = raw.assistantName.trim().slice(0, 80);
  if (typeof raw.welcomeMessage === "string") out.welcomeMessage = raw.welcomeMessage.trim().slice(0, 500);
  if (typeof raw.customInstructions === "string") out.customInstructions = raw.customInstructions.trim().slice(0, 2000);
  if (typeof raw.whatsappPrefillMessage === "string" && raw.whatsappPrefillMessage.trim()) {
    out.whatsappPrefillMessage = raw.whatsappPrefillMessage.trim().slice(0, 300);
  }
  if (typeof raw.showQrOnShop === "boolean") out.showQrOnShop = raw.showQrOnShop;
  if (typeof raw.autoNotifyOrderStatus === "boolean") out.autoNotifyOrderStatus = raw.autoNotifyOrderStatus;
  if (typeof raw.whatsappAccessToken === "string") out.whatsappAccessToken = raw.whatsappAccessToken.trim();
  if (typeof raw.whatsappBusinessAccountId === "string") out.whatsappBusinessAccountId = raw.whatsappBusinessAccountId.trim();
  if (typeof raw.whatsappVerifyToken === "string") out.whatsappVerifyToken = raw.whatsappVerifyToken.trim();
  if (typeof raw.geminiApiKey === "string") out.geminiApiKey = raw.geminiApiKey.trim();

  return out;
}

/**
 * Sanitize a partial patch for `whatsappAssistant` before merging into `Vendor.uiPrefs`.
 */
export function sanitizeWhatsAppAssistantPatch(
  input: unknown,
  existingUiPrefs?: unknown,
): WhatsAppAssistantConfig {
  const current = parseWhatsAppAssistantConfig(existingUiPrefs);
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return current;
  }
  const obj = input as Record<string, unknown>;
  const next: WhatsAppAssistantConfig = { ...current };

  if (typeof obj.aiEnabled === "boolean") next.aiEnabled = obj.aiEnabled;
  if (typeof obj.assistantName === "string") next.assistantName = obj.assistantName.trim().slice(0, 80);
  if (typeof obj.welcomeMessage === "string") next.welcomeMessage = obj.welcomeMessage.trim().slice(0, 500);
  if (typeof obj.customInstructions === "string") next.customInstructions = obj.customInstructions.trim().slice(0, 2000);
  if (typeof obj.whatsappPrefillMessage === "string") {
    next.whatsappPrefillMessage =
      obj.whatsappPrefillMessage.trim().slice(0, 300) ||
      DEFAULT_WHATSAPP_ASSISTANT_CONFIG.whatsappPrefillMessage;
  }
  if (typeof obj.showQrOnShop === "boolean") next.showQrOnShop = obj.showQrOnShop;
  if (typeof obj.autoNotifyOrderStatus === "boolean") next.autoNotifyOrderStatus = obj.autoNotifyOrderStatus;
  if (typeof obj.whatsappAccessToken === "string") next.whatsappAccessToken = obj.whatsappAccessToken.trim();
  if (typeof obj.whatsappBusinessAccountId === "string") next.whatsappBusinessAccountId = obj.whatsappBusinessAccountId.trim();
  if (typeof obj.whatsappVerifyToken === "string") next.whatsappVerifyToken = obj.whatsappVerifyToken.trim();
  if (typeof obj.geminiApiKey === "string") next.geminiApiKey = obj.geminiApiKey.trim();

  return next;
}

