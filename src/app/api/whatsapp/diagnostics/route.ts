import { NextRequest, NextResponse } from "next/server";
import { getCurrentVendor } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  parseWhatsAppAssistantConfig,
  explainWhatsAppOrAiError,
  type WhatsAppDiagnosticAlert,
} from "@/lib/whatsapp-config";
import {
  resolveVendorCloudCredentials,
  recordVendorDiagnostic,
} from "@/lib/whatsapp";
import { callGeminiWithDiagnostics } from "@/lib/llm";

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
  const vendor = await getCurrentVendor();
  if (!vendor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const waCfg = parseWhatsAppAssistantConfig(vendor.uiPrefs);
  const creds = await resolveVendorCloudCredentials(vendor.id);

  // Check if any other vendor holds a whatsappPhoneNumberId while this vendor does not
  const otherWithPhoneId = !vendor.whatsappPhoneNumberId
    ? await prisma.vendor.findFirst({
        where: {
          deletedAt: null,
          NOT: { id: vendor.id },
          whatsappPhoneNumberId: { not: null },
        },
        select: { shopName: true, shopSlug: true, whatsappPhoneNumberId: true },
      })
    : null;

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
      label: "1. Routage Boutique ↔ Numéro Meta (Phone Number ID)",
      status: "ok",
      summary: `Phone Number ID (${vendor.whatsappPhoneNumberId}) lié à « ${vendor.shopName} ».`,
    });
  } else if (otherWithPhoneId) {
    checks.push({
      id: "routing",
      label: "1. Routage Boutique ↔ Numéro Meta (Phone Number ID)",
      status: "warning",
      summary: `Le Phone Number ID (${otherWithPhoneId.whatsappPhoneNumberId}) est lié à l'ancienne boutique « ${otherWithPhoneId.shopName} ».`,
      details: `Les messages entrants sans mention de votre boutique risquent d'être routés vers « ${otherWithPhoneId.shopName} ».`,
      fixHint: `Renseignez le Phone Number ID (${otherWithPhoneId.whatsappPhoneNumberId}) dans le champ ci-dessous et cliquez sur Enregistrer pour le transférer sur « ${vendor.shopName} ».`,
    });
  } else if (creds.phoneNumberId) {
    checks.push({
      id: "routing",
      label: "1. Routage Boutique ↔ Numéro Meta (Phone Number ID)",
      status: "warning",
      summary: `Utilisation du Phone Number ID global (${creds.phoneNumberId}).`,
      fixHint: `Pour un routage dédié à « ${vendor.shopName} », enregistrez votre Phone Number ID dans la configuration ci-dessous.`,
    });
  } else {
    checks.push({
      id: "routing",
      label: "1. Routage Boutique ↔ Numéro Meta (Phone Number ID)",
      status: "error",
      summary: "Aucun WhatsApp Phone Number ID configuré.",
      fixHint: "Copiez le Phone Number ID depuis Meta for Developers → WhatsApp → API Setup et enregistrez-le ci-dessous.",
    });
  }

  // 2. Webhook reception check
  if (recentInbound || waCfg.lastWebhookAt) {
    const lastDate = recentInbound?.createdAt
      ? new Date(recentInbound.createdAt).toLocaleString("fr-FR")
      : waCfg.lastWebhookAt
      ? new Date(waCfg.lastWebhookAt).toLocaleString("fr-FR")
      : "";
    checks.push({
      id: "webhook",
      label: "2. Réception Webhook Meta (/api/whatsapp/webhook)",
      status: "ok",
      summary: recentInbound
        ? `Dernier message reçu de ${recentInbound.contact} (${lastDate}) : "${recentInbound.body.slice(0, 60)}"`
        : `Dernier événement webhook reçu le ${lastDate}.`,
    });
  } else {
    checks.push({
      id: "webhook",
      label: "2. Réception Webhook Meta (/api/whatsapp/webhook)",
      status: "warning",
      summary: "Aucun message entrant reçu sur cette boutique pour le moment.",
      fixHint:
        "Vérifiez dans Meta for Developers → WhatsApp → Configuration que l'URL de Callback pointe vers votre domaine Vercel (/api/whatsapp/webhook) et que le champ 'messages' est bien abonné (Subscribed).",
    });
  }

  // 3. Outbound WhatsApp Cloud API check
  if (!creds.token || !creds.phoneNumberId) {
    checks.push({
      id: "whatsapp_meta",
      label: "3. Envoi Réponse Automatique (Meta WhatsApp Cloud API)",
      status: "error",
      summary: "Mode Simulation (Stub) actif : Token ou Phone Number ID manquant.",
      details: "Le bot génère la réponse en base de données mais ne peut pas l'envoyer sur WhatsApp sans Access Token Meta.",
      fixHint: "Renseignez votre Meta Cloud API Access Token et Phone Number ID ci-dessous puis enregistrez.",
    });
  } else if (recentOutbound?.status === "failed") {
    const errMatch = recentOutbound.body.match(/\[ERROR:\s*([\s\S]+)\]$/);
    const rawErr = errMatch ? errMatch[1] : recentOutbound.body;
    const explained = explainWhatsAppOrAiError(rawErr, "whatsapp_send");
    checks.push({
      id: "whatsapp_meta",
      label: "3. Envoi Réponse Automatique (Meta WhatsApp Cloud API)",
      status: "error",
      summary: explained.title,
      details: explained.message,
      fixHint: explained.fixHint,
    });
  } else {
    checks.push({
      id: "whatsapp_meta",
      label: "3. Envoi Réponse Automatique (Meta WhatsApp Cloud API)",
      status: "ok",
      summary: `Identifiants Meta configurés (Source : ${
        creds.source === "vendor"
          ? "Boutique"
          : creds.source === "shared_vendor"
          ? "Partagé depuis une autre boutique"
          : "Variables Vercel"
      }).`,
      details: recentOutbound
        ? `Dernier envoi vers ${recentOutbound.contact} — Statut : ${recentOutbound.status.toUpperCase()}`
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
      label: "4. Intelligence Artificielle Google Gemini",
      status: "warning",
      summary: "Assistant IA Gemini désactivé (mode mots-clés uniquement).",
      fixHint: "Cochez « Activer l'Assistant IA Gemini » ci-dessous si vous souhaitez des réponses IA ouvertes.",
    });
  } else if (!geminiKey) {
    checks.push({
      id: "gemini_ai",
      label: "4. Intelligence Artificielle Google Gemini",
      status: "warning",
      summary: "Aucune clé API Gemini configurée (le bot répond uniquement par mots-clés : Menu, Commander, Suivi, Deal).",
      fixHint: "Ajoutez une clé API Google Gemini (AIzaSy...) dans le champ « Clé API Google Gemini » ci-dessous.",
    });
  } else if (!geminiKey.startsWith("AIza")) {
    checks.push({
      id: "gemini_ai",
      label: "4. Intelligence Artificielle Google Gemini",
      status: "error",
      summary: `Format de clé Gemini suspect (${geminiKey.slice(0, 6)}...). Une clé Google AI Studio commence par "AIzaSy...".`,
      details: "L'appel à Gemini échoue et le bot bascule sur le mode mots-clés.",
      fixHint: "Créez une clé API valide sur https://aistudio.google.com/app/apikey et collez-la dans « Clé API Google Gemini ».",
    });
  } else if (lastGeminiAlert && lastGeminiAlert.severity !== "ok") {
    checks.push({
      id: "gemini_ai",
      label: "4. Intelligence Artificielle Google Gemini",
      status: "warning",
      summary: lastGeminiAlert.title,
      details: lastGeminiAlert.message,
      fixHint: lastGeminiAlert.fixHint,
    });
  } else {
    checks.push({
      id: "gemini_ai",
      label: "4. Intelligence Artificielle Google Gemini",
      status: "ok",
      summary: "Clé API Gemini configurée et active (gemini-2.5-flash / gemini-2.0-flash).",
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
  const vendor = await getCurrentVendor();
  if (!vendor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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
      error: explained.title,
      fixHint: explained.fixHint,
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
      const metaJson = (await metaRes.json().catch(() => ({}))) as Record<string, any>;
      if (!metaRes.ok) {
        const rawErr = JSON.stringify(metaJson.error || metaJson);
        const explained = explainWhatsAppOrAiError(
          `HTTP ${metaRes.status}: ${rawErr}`,
          "whatsapp_send",
        );
        results.metaApi = {
          ok: false,
          status: "error",
          error: `${explained.title} — ${explained.message}`,
          fixHint: explained.fixHint,
        };
        await recordVendorDiagnostic(vendor.id, {
          stage: "whatsapp_send",
          severity: "error",
          title: explained.title,
          message: explained.message,
          details: rawErr.slice(0, 300),
          fixHint: explained.fixHint,
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
        fixHint: "Vérifiez la connexion réseau du serveur vers graph.facebook.com.",
      };
    }
  }

  // 2. Live probe of Google Gemini API
  if (!geminiKeyToTest) {
    results.geminiApi = {
      ok: false,
      error: "Aucune clé API Gemini renseignée.",
      fixHint: "Ajoutez une clé Gemini (AIzaSy...) dans le champ « Clé API Google Gemini ».",
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
        error: `${explained.title} — ${explained.message}`,
        fixHint: explained.fixHint,
      };
      await recordVendorDiagnostic(vendor.id, {
        stage: "gemini_ai",
        severity: "warning",
        title: explained.title,
        message: explained.message,
        details: gProbe.error,
        fixHint: explained.fixHint,
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
