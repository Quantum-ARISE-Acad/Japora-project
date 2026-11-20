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
export function explainWhatsAppOrAiError(
  rawError: string,
  stage: WhatsAppDiagnosticAlert["stage"],
): { title: string; message: string; fixHint: string } {
  const err = rawError || "";

  if (stage === "gemini_ai") {
    if (err.includes("400") || err.includes("API_KEY_INVALID") || err.includes("API key not valid")) {
      return {
        title: "Clé API Google Gemini invalide (Erreur 400)",
        message: "La clé API Gemini configurée est rejetée par Google Generative AI.",
        fixHint:
          "Vérifiez votre clé Gemini (elle doit commencer par 'AIzaSy...') dans Dashboard → Assistant WhatsApp → Clé API Google Gemini, ou dans les variables d'environnement Vercel (GEMINI_API_KEY).",
      };
    }
    if (err.includes("429") || err.includes("RESOURCE_EXHAUSTED") || err.includes("quota")) {
      return {
        title: "Quota Google Gemini dépassé (Erreur 429)",
        message: "La limite de requêtes gratuites de votre clé API Gemini est atteinte.",
        fixHint:
          "Patientez une minute ou renseignez une nouvelle clé API Google Gemini dans la configuration de l'Assistant WhatsApp.",
      };
    }
    if (err.includes("403") || err.includes("PERMISSION_DENIED")) {
      return {
        title: "Accès Google Gemini refusé (Erreur 403)",
        message: "La clé API Gemini n'a pas l'autorisation d'appeler l'API Generative Language.",
        fixHint: "Générez une clé API depuis Google AI Studio (aistudio.google.com) et collez-la dans Assistant WhatsApp.",
      };
    }
    return {
      title: "Erreur de génération IA Gemini",
      message: `L'appel à Gemini IA a échoué (${err.slice(0, 140)}). Le bot de secours par mots-clés a pris le relais.`,
      fixHint: "Vérifiez votre clé API Gemini dans Dashboard → Assistant WhatsApp.",
    };
  }

  // Meta WhatsApp Cloud API errors
  if (err.includes("190") || err.includes("401") || err.includes("Invalid OAuth") || err.includes("Session has expired")) {
    return {
      title: "Token Meta WhatsApp expiré ou invalide (Code 190 / 401)",
      message: "Le message a bien été reçu par le webhook, mais Meta a refusé l'envoi de la réponse automatique car votre Access Token est expiré ou invalide.",
      fixHint:
        "Allez dans Meta for Developers → WhatsApp → Configuration de l'API (API Setup), générez un nouveau token temporaire (24h) ou un token System User permanent, puis collez-le dans Dashboard → Assistant WhatsApp → Meta Cloud API Access Token.",
    };
  }
  if (err.includes("131030") || err.includes("Recipient phone number not in allowed list")) {
    return {
      title: "Numéro destinataire non autorisé sur le compte de test Meta (Code 131030)",
      message: "Avec un numéro de test Meta WhatsApp, vous ne pouvez envoyer des messages qu'aux numéros vérifiés par code OTP dans votre application Meta.",
      fixHint:
        "Dans Meta for Developers → WhatsApp → API Setup → Étape 'To' (Destinataire) → 'Manage phone number list', ajoutez le numéro WhatsApp qui vous a écrit et validez-le avec le code reçu sur WhatsApp.",
    };
  }
  if (err.includes("131026") || err.includes("Message undeliverable") || err.includes("131047") || err.includes("Re-engagement message")) {
    return {
      title: "Message non distribuable par WhatsApp (Code 131026 / 131047)",
      message: "Meta n'a pas pu délivrer le message (fenêtre de 24h fermée, numéro non inscrit sur WhatsApp, ou conditions non acceptées).",
      fixHint: "Assurez-vous que le client a envoyé un message au numéro de test depuis moins de 24h.",
    };
  }
  if (err.includes("100") || err.includes("Unsupported post request") || err.includes("does not exist")) {
    return {
      title: "WhatsApp Phone Number ID invalide ou incompatible (Code 100)",
      message: "Le Phone Number ID configuré ne correspond pas au compte ou au Token Meta Cloud API.",
      fixHint:
        "Vérifiez que vous avez bien copié le 'Phone number ID' (et non le numéro de téléphone ou l'App ID) dans Meta for Developers → WhatsApp → API Setup.",
    };
  }
  if (err.includes("133010") || err.includes("Account not registered")) {
    return {
      title: "Numéro WhatsApp Cloud API non enregistré (Code 133010)",
      message: "Ce numéro WhatsApp Business n'est pas encore enregistré sur l'API Cloud de Meta.",
      fixHint: "Dans Meta for Developers → WhatsApp → API Setup, cliquez sur 'Send message' une première fois depuis l'interface Meta pour activer le numéro de test.",
    };
  }
  if (err.includes("stubbed") || err.includes("MISSING_CREDENTIALS")) {
    return {
      title: "Identifiants Meta Cloud API manquants sur cette boutique (Mode Simulation / Stub)",
      message: "Le webhook a bien reçu le message client, mais cette boutique n'a pas d'Access Token ou de Phone Number ID actif — la réponse a donc été simulée en base de données au lieu d'être envoyée sur WhatsApp.",
      fixHint:
        "Allez dans Dashboard → Assistant WhatsApp, renseignez votre 'WhatsApp Phone Number ID' et 'Meta Cloud API Access Token', puis cliquez sur Enregistrer.",
    };
  }

  return {
    title: stage === "webhook_routing" ? "Alerte de routage Webhook WhatsApp" : "Erreur d'envoi WhatsApp Cloud API",
    message: err.slice(0, 260) || "Une erreur est survenue lors du traitement automatique WhatsApp.",
    fixHint: "Vérifiez votre Phone Number ID, votre Access Token Meta et votre clé Gemini dans Dashboard → Assistant WhatsApp.",
  };
}


