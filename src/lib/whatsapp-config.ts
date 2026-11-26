/**
 * Per-vendor WhatsApp Cloud API & Gemini AI Assistant configuration.
 *
 * Stored inside `Vendor.uiPrefs.whatsappAssistant` (JSON) alongside the
 * top-level `Vendor.whatsappNumber` and `Vendor.whatsappPhoneNumberId` columns.
 * This keeps schema migrations zero-downtime while allowing each vendor on
 * Japora to customize their AI assistant, QR codes, and Meta Cloud API credentials.
 */

export type WhatsAppDiagnosticAlert = {
  id: string;
  at: string;
  stage: "webhook_routing" | "webhook_signature" | "gemini_ai" | "whatsapp_send" | "whatsapp_status" | "system";
  severity: "error" | "warning" | "ok";
  title: string;
  message: string;
  details?: string;
  fixHint?: string;
  /** English versions; older alerts only have the French text. */
  titleEn?: string;
  messageEn?: string;
  fixHintEn?: string;
  contact?: string;
};

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
  /** Latest diagnostic alerts recorded from live webhook / Gemini / Cloud API calls */
  diagnostics?: WhatsAppDiagnosticAlert[];
  /** Timestamp of last successful inbound webhook event */
  lastWebhookAt?: string;
  /** Timestamp of last successful outbound WhatsApp reply */
  lastOutboundOkAt?: string;
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
  if (typeof raw.lastWebhookAt === "string") out.lastWebhookAt = raw.lastWebhookAt;
  if (typeof raw.lastOutboundOkAt === "string") out.lastOutboundOkAt = raw.lastOutboundOkAt;
  if (Array.isArray(raw.diagnostics)) {
    out.diagnostics = (raw.diagnostics as WhatsAppDiagnosticAlert[]).slice(0, 15);
  } else {
    out.diagnostics = [];
  }

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
  if (typeof obj.lastWebhookAt === "string") next.lastWebhookAt = obj.lastWebhookAt;
  if (typeof obj.lastOutboundOkAt === "string") next.lastOutboundOkAt = obj.lastOutboundOkAt;
  if (Array.isArray(obj.diagnostics)) {
    next.diagnostics = (obj.diagnostics as WhatsAppDiagnosticAlert[]).slice(0, 15);
  }

  return next;
}

/**
 * Translate a raw Meta WhatsApp Cloud API or Gemini error string into an actionable French/English explanation.
 */
/** An error explained to the vendor, in French and English. */
export type ExplainedError = {
  title: string;
  message: string;
  fixHint: string;
  titleEn: string;
  messageEn: string;
  fixHintEn: string;
};

function explained(
  fr: [title: string, message: string, fixHint: string],
  en: [title: string, message: string, fixHint: string],
): ExplainedError {
  return {
    title: fr[0], message: fr[1], fixHint: fr[2],
    titleEn: en[0], messageEn: en[1], fixHintEn: en[2],
  };
}

export function explainWhatsAppOrAiError(
  rawError: string,
  stage: WhatsAppDiagnosticAlert["stage"],
): ExplainedError {
  const err = rawError || "";

  if (stage === "gemini_ai") {
    if (err.includes("400") || err.includes("API_KEY_INVALID") || err.includes("API key not valid")) {
      return explained(
        [
          "Clé API Google Gemini invalide (erreur 400)",
          "Google refuse la clé API Gemini configurée.",
          "Vérifiez votre clé Gemini (elle commence par « AIzaSy… ») dans Tableau de bord → Assistant WhatsApp → Clé API Google Gemini, ou la variable GEMINI_API_KEY du serveur.",
        ],
        [
          "Invalid Google Gemini API key (error 400)",
          "Google rejects the configured Gemini API key.",
          "Check your Gemini key (it starts with “AIzaSy…”) in Dashboard → WhatsApp Assistant → Google Gemini API key, or the server's GEMINI_API_KEY variable.",
        ],
      );
    }
    if (err.includes("429") || err.includes("RESOURCE_EXHAUSTED") || err.includes("quota")) {
      return explained(
        [
          "Quota Google Gemini dépassé (erreur 429)",
          "La limite de requêtes gratuites de votre clé Gemini est atteinte.",
          "Patientez une minute, ou renseignez une autre clé Gemini dans la configuration de l'Assistant WhatsApp.",
        ],
        [
          "Google Gemini quota exceeded (error 429)",
          "Your Gemini key has reached its free request limit.",
          "Wait a minute, or enter another Gemini key in the WhatsApp Assistant settings.",
        ],
      );
    }
    if (err.includes("403") || err.includes("PERMISSION_DENIED")) {
      return explained(
        [
          "Accès Google Gemini refusé (erreur 403)",
          "La clé Gemini n'a pas le droit d'appeler l'API Generative Language.",
          "Créez une clé sur Google AI Studio (aistudio.google.com) et collez-la dans Assistant WhatsApp.",
        ],
        [
          "Google Gemini access denied (error 403)",
          "The Gemini key is not allowed to call the Generative Language API.",
          "Create a key in Google AI Studio (aistudio.google.com) and paste it in WhatsApp Assistant.",
        ],
      );
    }
    return explained(
      [
        "Erreur de l'IA Gemini",
        `L'appel à Gemini a échoué (${err.slice(0, 140)}). Le bot par mots-clés a pris le relais.`,
        "Vérifiez votre clé API Gemini dans Tableau de bord → Assistant WhatsApp.",
      ],
      [
        "Gemini AI error",
        `The Gemini call failed (${err.slice(0, 140)}). The keyword bot answered instead.`,
        "Check your Gemini API key in Dashboard → WhatsApp Assistant.",
      ],
    );
  }

  // Meta WhatsApp Cloud API errors
  if (err.includes("190") || err.includes("401") || err.includes("Invalid OAuth") || err.includes("Session has expired")) {
    return explained(
      [
        "Token Meta WhatsApp expiré ou invalide (code 190 / 401)",
        "Le message a bien été reçu, mais Meta a refusé d'envoyer la réponse : l'Access Token est expiré ou invalide.",
        "Dans Meta for Developers → WhatsApp → API Setup, créez un nouveau token (temporaire 24 h, ou permanent via un System User), puis collez-le dans Tableau de bord → Assistant WhatsApp → Meta Cloud API Access Token.",
      ],
      [
        "Meta WhatsApp token expired or invalid (code 190 / 401)",
        "The message was received, but Meta refused to send the reply: the access token is expired or invalid.",
        "In Meta for Developers → WhatsApp → API Setup, create a new token (temporary 24 h, or permanent through a System User), then paste it in Dashboard → WhatsApp Assistant → Meta Cloud API Access Token.",
      ],
    );
  }
  if (err.includes("131030") || err.includes("Recipient phone number not in allowed list")) {
    return explained(
      [
        "Numéro destinataire non autorisé sur le compte de test Meta (code 131030)",
        "Avec un numéro de test Meta, on ne peut écrire qu'aux numéros vérifiés par code dans votre application Meta.",
        "Dans Meta for Developers → WhatsApp → API Setup → « To » → « Manage phone number list », ajoutez le numéro qui vous a écrit et validez-le avec le code reçu sur WhatsApp.",
      ],
      [
        "Recipient number not allowed on the Meta test account (code 131030)",
        "With a Meta test number, you can only message numbers verified by code in your Meta app.",
        "In Meta for Developers → WhatsApp → API Setup → “To” → “Manage phone number list”, add the number that wrote to you and confirm it with the code received on WhatsApp.",
      ],
    );
  }
  if (err.includes("131026") || err.includes("Message undeliverable") || err.includes("131047") || err.includes("Re-engagement message")) {
    return explained(
      [
        "Message non distribuable par WhatsApp (code 131026 / 131047)",
        "Meta n'a pas pu délivrer le message : fenêtre de 24 h fermée, numéro absent de WhatsApp, ou conditions non acceptées.",
        "Vérifiez que le client a écrit à ce numéro il y a moins de 24 h.",
      ],
      [
        "Message undeliverable by WhatsApp (code 131026 / 131047)",
        "Meta could not deliver the message: the 24-hour window is closed, the number is not on WhatsApp, or terms were not accepted.",
        "Check that the customer wrote to this number less than 24 hours ago.",
      ],
    );
  }
  if (err.includes("100") || err.includes("Unsupported post request") || err.includes("does not exist")) {
    return explained(
      [
        "WhatsApp Phone Number ID invalide (code 100)",
        "Le Phone Number ID configuré ne correspond pas au compte ou au token Meta.",
        "Copiez bien le « Phone number ID » (pas le numéro de téléphone ni l'App ID) depuis Meta for Developers → WhatsApp → API Setup.",
      ],
      [
        "Invalid WhatsApp Phone Number ID (code 100)",
        "The configured Phone Number ID does not match the Meta account or token.",
        "Copy the “Phone number ID” (not the phone number or the App ID) from Meta for Developers → WhatsApp → API Setup.",
      ],
    );
  }
  if (err.includes("133010") || err.includes("Account not registered")) {
    return explained(
      [
        "Numéro WhatsApp non enregistré sur l'API Cloud (code 133010)",
        "Ce numéro WhatsApp Business n'est pas encore enregistré sur l'API Cloud de Meta.",
        "Dans Meta for Developers → WhatsApp → API Setup, cliquez une première fois sur « Send message » pour activer le numéro.",
      ],
      [
        "WhatsApp number not registered on the Cloud API (code 133010)",
        "This WhatsApp Business number is not registered on Meta's Cloud API yet.",
        "In Meta for Developers → WhatsApp → API Setup, click “Send message” once to activate the number.",
      ],
    );
  }
  if (err.includes("stubbed") || err.includes("MISSING_CREDENTIALS")) {
    return explained(
      [
        "Identifiants Meta manquants (mode simulation)",
        "Le message du client a bien été reçu, mais aucun Access Token ou Phone Number ID n'est actif : la réponse a été simulée au lieu d'être envoyée sur WhatsApp.",
        "Dans Tableau de bord → Assistant WhatsApp, renseignez le « WhatsApp Phone Number ID » et le « Meta Cloud API Access Token », puis enregistrez.",
      ],
      [
        "Meta credentials missing (simulation mode)",
        "The customer's message was received, but no access token or Phone Number ID is active: the reply was simulated instead of being sent on WhatsApp.",
        "In Dashboard → WhatsApp Assistant, enter the “WhatsApp Phone Number ID” and the “Meta Cloud API Access Token”, then save.",
      ],
    );
  }

  const routing = stage === "webhook_routing";
  return explained(
    [
      routing ? "Alerte de routage du webhook WhatsApp" : "Erreur d'envoi WhatsApp Cloud API",
      err.slice(0, 260) || "Une erreur est survenue pendant le traitement WhatsApp automatique.",
      "Vérifiez le Phone Number ID, l'Access Token Meta et la clé Gemini dans Tableau de bord → Assistant WhatsApp.",
    ],
    [
      routing ? "WhatsApp webhook routing alert" : "WhatsApp Cloud API send error",
      err.slice(0, 260) || "Something went wrong during automatic WhatsApp processing.",
      "Check the Phone Number ID, the Meta access token and the Gemini key in Dashboard → WhatsApp Assistant.",
    ],
  );
}


