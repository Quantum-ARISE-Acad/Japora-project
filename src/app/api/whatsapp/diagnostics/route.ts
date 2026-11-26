import { NextRequest, NextResponse } from "next/server";
import { getCurrentVendor } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  parseWhatsAppAssistantConfig,
  explainWhatsAppOrAiError,
  type ExplainedError,
  type WhatsAppDiagnosticAlert,
} from "@/lib/whatsapp-config";
import {
  resolveVendorCloudCredentials,
  recordVendorDiagnostic,
} from "@/lib/whatsapp";
import { callGeminiWithDiagnostics } from "@/lib/llm";
import { getServerTr } from "@/lib/public-locale";

export type SubsystemCheck = {
  id: "webhook" | "whatsapp_meta" | "gemini_ai" | "routing";
  label: string;
  status: "ok" | "warning" | "error";
  summary: string;
  details?: string;
  fixHint?: string;
};

/**
 * GET /api/whatsapp/diagnostics — returns current health status, recent diagnostic alerts,
 * and inbound/outbound webhook logs for the logged-in vendor.
 */
export async function GET() {
  const tr = await getServerTr();
  const vendor = await getCurrentVendor();
  if (!vendor) return NextResponse.json({ error: tr("Non autorisé", "Unauthorized") }, { status: 401 });
  /** The explained error in the vendor's language. */
  const pick = (e: ExplainedError) => ({
    title: tr(e.title, e.titleEn),
    message: tr(e.message, e.messageEn),
    fixHint: tr(e.fixHint, e.fixHintEn),
  });

  const waCfg = parseWhatsAppAssistantConfig(vendor.uiPrefs);
  const creds = await resolveVendorCloudCredentials(vendor.id);

  const recentInbound = await prisma.whatsAppMessage.findFirst({
    where: { vendorId: vendor.id, direction: "IN" },
    orderBy: { createdAt: "desc" },
    select: { id: true, contact: true, body: true, createdAt: true },
  });

  const recentOutbound = await prisma.whatsAppMessage.findFirst({
    where: { vendorId: vendor.id, direction: "OUT" },
    orderBy: { createdAt: "desc" },
    select: { id: true, contact: true, body: true, status: true, createdAt: true },
  });

  const checks: SubsystemCheck[] = [];

  // 1. Routing check
  if (vendor.whatsappPhoneNumberId) {
    checks.push({
      id: "routing",
      label: tr("1. Routage boutique ↔ numéro Meta (Phone Number ID)", "1. Shop ↔ Meta number routing (Phone Number ID)"),
      status: "ok",
      summary: tr(
        `Phone Number ID (${vendor.whatsappPhoneNumberId}) lié à « ${vendor.shopName} ».`,
        `Phone Number ID (${vendor.whatsappPhoneNumberId}) linked to “${vendor.shopName}”.`,
      ),
    });
  } else if (creds.phoneNumberId) {
    checks.push({
      id: "routing",
      label: tr("1. Routage boutique ↔ numéro Meta (Phone Number ID)", "1. Shop ↔ Meta number routing (Phone Number ID)"),
      status: "warning",
      summary: tr(
        `Utilisation du numéro partagé Japora (${creds.phoneNumberId}).`,
        `Using the shared Japora number (${creds.phoneNumberId}).`,
      ),
      fixHint: tr(
        `Pour un numéro dédié à « ${vendor.shopName} », enregistrez votre Phone Number ID ci-dessous.`,
        `For a number dedicated to “${vendor.shopName}”, save your Phone Number ID below.`,
      ),
    });
  } else {
    checks.push({
      id: "routing",
      label: tr("1. Routage boutique ↔ numéro Meta (Phone Number ID)", "1. Shop ↔ Meta number routing (Phone Number ID)"),
      status: "error",
      summary: tr("Aucun WhatsApp Phone Number ID configuré.", "No WhatsApp Phone Number ID configured."),
      fixHint: tr(
        "Copiez le Phone Number ID depuis Meta for Developers → WhatsApp → API Setup et enregistrez-le ci-dessous.",
        "Copy the Phone Number ID from Meta for Developers → WhatsApp → API Setup and save it below.",
      ),
    });
  }

  // 2. Webhook reception check
  if (recentInbound || waCfg.lastWebhookAt) {
    const lastDate = recentInbound?.createdAt
      ? new Date(recentInbound.createdAt).toLocaleString(tr("fr-FR", "en-US"))
      : waCfg.lastWebhookAt
      ? new Date(waCfg.lastWebhookAt).toLocaleString(tr("fr-FR", "en-US"))
      : "";
    checks.push({
      id: "webhook",
      label: tr("2. Réception du webhook Meta (/api/whatsapp/webhook)", "2. Meta webhook reception (/api/whatsapp/webhook)"),
      status: "ok",
      summary: recentInbound
        ? tr(
            `Dernier message reçu de ${recentInbound.contact} (${lastDate}) : "${recentInbound.body.slice(0, 60)}"`,
            `Last message from ${recentInbound.contact} (${lastDate}): "${recentInbound.body.slice(0, 60)}"`,
          )
        : tr(`Dernier événement webhook reçu le ${lastDate}.`, `Last webhook event received on ${lastDate}.`),
    });
  } else {
    checks.push({
      id: "webhook",
      label: tr("2. Réception du webhook Meta (/api/whatsapp/webhook)", "2. Meta webhook reception (/api/whatsapp/webhook)"),
      status: "warning",
      summary: tr("Aucun message reçu sur cette boutique pour le moment.", "No message received for this shop yet."),
      fixHint:
        tr(
          "Dans Meta for Developers → WhatsApp → Configuration, vérifiez que l'URL de rappel pointe vers votre domaine (/api/whatsapp/webhook) et que le champ « messages » est abonné (Subscribed).",
          "In Meta for Developers → WhatsApp → Configuration, check that the callback URL points to your domain (/api/whatsapp/webhook) and that the “messages” field is subscribed.",
        ),
    });
  }

  // 3. Outbound WhatsApp Cloud API check
  if (!creds.token || !creds.phoneNumberId) {
    checks.push({
      id: "whatsapp_meta",
      label: tr("3. Envoi de la réponse automatique (Meta WhatsApp Cloud API)", "3. Automatic reply sending (Meta WhatsApp Cloud API)"),
      status: "error",
      summary: tr("Mode simulation : token ou Phone Number ID manquant.", "Simulation mode: token or Phone Number ID missing."),
      details: tr(
        "Le bot prépare la réponse mais ne peut pas l'envoyer sur WhatsApp sans Access Token Meta.",
        "The bot prepares the reply but cannot send it on WhatsApp without a Meta access token.",
      ),
      fixHint: tr(
        "Renseignez votre Meta Cloud API Access Token et votre Phone Number ID ci-dessous, puis enregistrez.",
        "Enter your Meta Cloud API access token and Phone Number ID below, then save.",
      ),
    });
  } else if (recentOutbound?.status === "failed") {
    const errMatch = recentOutbound.body.match(/\[ERROR:\s*([\s\S]+)\]$/);
    const rawErr = errMatch ? errMatch[1] : recentOutbound.body;
    const explained = explainWhatsAppOrAiError(rawErr, "whatsapp_send");
    checks.push({
      id: "whatsapp_meta",
      label: tr("3. Envoi de la réponse automatique (Meta WhatsApp Cloud API)", "3. Automatic reply sending (Meta WhatsApp Cloud API)"),
      status: "error",
      summary: pick(explained).title,
      details: pick(explained).message,
      fixHint: pick(explained).fixHint,
    });
  } else {
    checks.push({
      id: "whatsapp_meta",
      label: tr("3. Envoi de la réponse automatique (Meta WhatsApp Cloud API)", "3. Automatic reply sending (Meta WhatsApp Cloud API)"),
      status: "ok",
      summary:
        creds.source === "vendor"
          ? tr("Identifiants Meta configurés (numéro de la boutique).", "Meta credentials configured (shop's own number).")
          : tr("Identifiants Meta configurés (numéro partagé Japora).", "Meta credentials configured (shared Japora number)."),
      details: recentOutbound
        ? tr(
            `Dernier envoi vers ${recentOutbound.contact} — statut : ${recentOutbound.status.toUpperCase()}`,
            `Last send to ${recentOutbound.contact} — status: ${recentOutbound.status.toUpperCase()}`,
          )
        : undefined,
    });
  }

  // 4. Gemini AI check
  const geminiKey = (
    waCfg.geminiApiKey ||
    process.env.GEMINI_API_KEY ||
    process.env.NEXT_PUBLIC_GEMINI_API_KEY ||
    ""
  ).trim();
  const lastGeminiAlert = (waCfg.diagnostics || []).find((d) => d.stage === "gemini_ai");

  if (!waCfg.aiEnabled) {
    checks.push({
      id: "gemini_ai",
      label: tr("4. Intelligence artificielle Google Gemini", "4. Google Gemini AI"),
      status: "warning",
      summary: tr("Assistant IA Gemini désactivé (mots-clés uniquement).", "Gemini AI assistant turned off (keywords only)."),
      fixHint: tr(
        "Cochez « Activer l'Assistant IA Gemini » ci-dessous pour des réponses IA libres.",
        "Tick “Enable Gemini AI Assistant” below for open-ended AI replies.",
      ),
    });
  } else if (!geminiKey) {
    checks.push({
      id: "gemini_ai",
      label: tr("4. Intelligence artificielle Google Gemini", "4. Google Gemini AI"),
      status: "warning",
      summary: tr(
        "Aucune clé API Gemini configurée (le bot répond seulement aux mots-clés : Menu, Commander, Suivi, Deal).",
        "No Gemini API key configured (the bot only answers keywords: Menu, Order, Track, Deal).",
      ),
      fixHint: tr(
        "Ajoutez une clé API Google Gemini (AIzaSy…) dans le champ « Clé API Google Gemini » ci-dessous.",
        "Add a Google Gemini API key (AIzaSy…) in the “Google Gemini API key” field below.",
      ),
    });
  } else if (!geminiKey.startsWith("AIza")) {
    checks.push({
      id: "gemini_ai",
      label: tr("4. Intelligence artificielle Google Gemini", "4. Google Gemini AI"),
      status: "error",
      summary: tr(
        `Format de clé Gemini suspect (${geminiKey.slice(0, 6)}…). Une clé Google AI Studio commence par « AIzaSy… ».`,
        `Suspicious Gemini key format (${geminiKey.slice(0, 6)}…). A Google AI Studio key starts with “AIzaSy…”.`,
      ),
      details: tr(
        "L'appel à Gemini échoue et le bot passe aux mots-clés.",
        "The Gemini call fails and the bot falls back to keywords.",
      ),
      fixHint: tr(
        "Créez une clé valide sur https://aistudio.google.com/app/apikey et collez-la dans « Clé API Google Gemini ».",
        "Create a valid key at https://aistudio.google.com/app/apikey and paste it in “Google Gemini API key”.",
      ),
    });
  } else if (lastGeminiAlert && lastGeminiAlert.severity !== "ok") {
    checks.push({
      id: "gemini_ai",
      label: tr("4. Intelligence artificielle Google Gemini", "4. Google Gemini AI"),
      status: "warning",
      summary: tr(lastGeminiAlert.title, lastGeminiAlert.titleEn || lastGeminiAlert.title),
      details: tr(lastGeminiAlert.message, lastGeminiAlert.messageEn || lastGeminiAlert.message),
      fixHint: lastGeminiAlert.fixHint && tr(lastGeminiAlert.fixHint, lastGeminiAlert.fixHintEn || lastGeminiAlert.fixHint),
    });
  } else {
    checks.push({
      id: "gemini_ai",
      label: tr("4. Intelligence artificielle Google Gemini", "4. Google Gemini AI"),
      status: "ok",
      summary: tr(
        "Clé API Gemini configurée et active (gemini-2.5-flash / gemini-2.0-flash).",
        "Gemini API key configured and active (gemini-2.5-flash / gemini-2.0-flash).",
      ),
    });
  }

  return NextResponse.json({
    ok: true,
    shopName: vendor.shopName,
    shopSlug: vendor.shopSlug,
    checks,
    diagnostics: waCfg.diagnostics || [],
    lastWebhookAt: waCfg.lastWebhookAt || recentInbound?.createdAt || null,
    lastOutboundOkAt: waCfg.lastOutboundOkAt || null,
  });
}

/**
 * POST /api/whatsapp/diagnostics — Runs a live end-to-end diagnostic probe:
 * 1) Verifies Meta Graph API Token & Phone Number ID validity against graph.facebook.com
 * 2) Verifies Gemini API Key validity against generativelanguage.googleapis.com
 * 3) Optionally clears old diagnostic alerts if `action === "clear"`
 */
export async function POST(req: NextRequest) {
  const tr = await getServerTr();
  const vendor = await getCurrentVendor();
  if (!vendor) return NextResponse.json({ error: tr("Non autorisé", "Unauthorized") }, { status: 401 });
  const pick = (e: ExplainedError) => ({
    title: tr(e.title, e.titleEn),
    message: tr(e.message, e.messageEn),
    fixHint: tr(e.fixHint, e.fixHintEn),
  });

  const body = await req.json().catch(() => ({}));

  if (body.action === "clear") {
    const prefs =
      vendor.uiPrefs && typeof vendor.uiPrefs === "object" && !Array.isArray(vendor.uiPrefs)
        ? { ...(vendor.uiPrefs as Record<string, unknown>) }
        : {};
    const waCfg = parseWhatsAppAssistantConfig(prefs);
    waCfg.diagnostics = [];
    prefs.whatsappAssistant = waCfg;
    await prisma.vendor.update({
      where: { id: vendor.id },
      data: { uiPrefs: prefs as never },
    });
    return NextResponse.json({ ok: true, cleared: true });
  }

  const waCfg = parseWhatsAppAssistantConfig(vendor.uiPrefs);
  const creds = await resolveVendorCloudCredentials(vendor.id);

  const tokenToTest = (
    typeof body.whatsappAccessToken === "string" && body.whatsappAccessToken.trim()
      ? body.whatsappAccessToken.trim()
      : creds.token || ""
  ).trim();

  const phoneIdToTest = (
    typeof body.whatsappPhoneNumberId === "string" && body.whatsappPhoneNumberId.trim()
      ? body.whatsappPhoneNumberId.trim()
      : creds.phoneNumberId || ""
  ).trim();

  const geminiKeyToTest = (
    typeof body.geminiApiKey === "string" && body.geminiApiKey.trim()
      ? body.geminiApiKey.trim()
      : waCfg.geminiApiKey || process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY || ""
  ).trim();

  const results: {
    metaApi: { ok: boolean; status: string; displayPhone?: string; verifiedName?: string; error?: string; fixHint?: string };
    geminiApi: { ok: boolean; modelUsed?: string; sampleReply?: string; error?: string; fixHint?: string };
  } = {
    metaApi: { ok: false, status: "untested" },
    geminiApi: { ok: false },
  };

  // 1. Live probe of Meta WhatsApp Cloud API Phone Number endpoint
  if (!tokenToTest || !phoneIdToTest) {
    const explained = explainWhatsAppOrAiError("MISSING_CREDENTIALS", "whatsapp_send");
    results.metaApi = {
      ok: false,
      status: "missing_credentials",
      error: pick(explained).title,
      fixHint: pick(explained).fixHint,
    };
  } else {
    try {
      const metaRes = await fetch(
        `https://graph.facebook.com/v21.0/${encodeURIComponent(phoneIdToTest)}?fields=id,display_phone_number,verified_name,quality_rating,code_verification_status`,
        {
          method: "GET",
          headers: { Authorization: `Bearer ${tokenToTest}` },
        },
      );
      const metaJson = (await metaRes.json().catch(() => ({}))) as {
        error?: unknown;
        display_phone_number?: string;
        verified_name?: string;
      };
      if (!metaRes.ok) {
        const rawErr = JSON.stringify(metaJson.error || metaJson);
        const explained = explainWhatsAppOrAiError(
          `HTTP ${metaRes.status}: ${rawErr}`,
          "whatsapp_send",
        );
        results.metaApi = {
          ok: false,
          status: "error",
          error: `${pick(explained).title} — ${pick(explained).message}`,
          fixHint: pick(explained).fixHint,
        };
        await recordVendorDiagnostic(vendor.id, {
          stage: "whatsapp_send",
          severity: "error",
          ...explained,
          details: rawErr.slice(0, 300),
        });
      } else {
        results.metaApi = {
          ok: true,
          status: "connected",
          displayPhone: metaJson.display_phone_number || phoneIdToTest,
          verifiedName: metaJson.verified_name || "Meta Test Number",
        };
      }
    } catch (e) {
      results.metaApi = {
        ok: false,
        status: "network_error",
        error: e instanceof Error ? e.message : String(e),
        fixHint: tr(
          "Vérifiez que le serveur peut joindre graph.facebook.com.",
          "Check that the server can reach graph.facebook.com.",
        ),
      };
    }
  }

  // 2. Live probe of Google Gemini API
  if (!geminiKeyToTest) {
    results.geminiApi = {
      ok: false,
      error: tr("Aucune clé API Gemini renseignée.", "No Gemini API key entered."),
      fixHint: tr(
        "Ajoutez une clé Gemini (AIzaSy…) dans le champ « Clé API Google Gemini ».",
        "Add a Gemini key (AIzaSy…) in the “Google Gemini API key” field.",
      ),
    };
  } else {
    const gProbe = await callGeminiWithDiagnostics(
      `Tu es l'assistant IA de ${vendor.shopName}. Réponds en une phrase courte.`,
      "Dis bonjour pour confirmer que tu fonctionnes.",
      geminiKeyToTest,
    );
    if (gProbe.text) {
      results.geminiApi = {
        ok: true,
        modelUsed: gProbe.modelUsed,
        sampleReply: gProbe.text,
      };
    } else {
      const explained = explainWhatsAppOrAiError(gProbe.error || "Erreur Gemini", "gemini_ai");
      results.geminiApi = {
        ok: false,
        error: `${pick(explained).title} — ${pick(explained).message}`,
        fixHint: pick(explained).fixHint,
      };
      await recordVendorDiagnostic(vendor.id, {
        stage: "gemini_ai",
        severity: "warning",
        ...explained,
        details: gProbe.error,
      });
    }
  }

  const _unused: WhatsAppDiagnosticAlert | null = null;
  void _unused;

  return NextResponse.json({
    ok: true,
    results,
  });
}
