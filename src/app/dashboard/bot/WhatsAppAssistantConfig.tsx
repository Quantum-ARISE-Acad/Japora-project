"use client";

import { useEffect, useState } from "react";
import { formatStoredWhatsAppNumber } from "@/lib/whatsapp-number";
import { useRouter } from "next/navigation";
import ShopQrCard from "../ShopQrCard";
import type {
  WhatsAppAssistantConfig as WaConfigType,
  WhatsAppDiagnosticAlert,
} from "@/lib/whatsapp-config";
import type { SubsystemCheck } from "@/app/api/whatsapp/diagnostics/route";
import { usePublicLang } from "@/components/PublicLanguageProvider";

export default function WhatsAppAssistantConfig({
  shopName,
  shopSlug,
  initialWhatsappNumber,
  initialPhoneNumberId,
  initialConfig,
  isCloudLive,
  isGeminiLive,
}: {
  shopName: string;
  shopSlug: string;
  initialWhatsappNumber: string;
  initialPhoneNumberId: string;
  initialConfig: WaConfigType;
  isCloudLive: boolean;
  isGeminiLive: boolean;
}) {
  const { tr } = usePublicLang();
  const router = useRouter();

  const [whatsappNumber, setWhatsappNumber] = useState(formatStoredWhatsAppNumber(initialWhatsappNumber));
  const [whatsappPhoneNumberId, setWhatsappPhoneNumberId] = useState(initialPhoneNumberId || "");
  const [aiEnabled, setAiEnabled] = useState(initialConfig.aiEnabled);
  const [showQrOnShop, setShowQrOnShop] = useState(initialConfig.showQrOnShop);
  const [autoNotifyOrderStatus, setAutoNotifyOrderStatus] = useState(
    initialConfig.autoNotifyOrderStatus,
  );
  const [assistantName, setAssistantName] = useState(initialConfig.assistantName);
  const [welcomeMessage, setWelcomeMessage] = useState(initialConfig.welcomeMessage);
  const [customInstructions, setCustomInstructions] = useState(initialConfig.customInstructions);
  const [whatsappPrefillMessage, setWhatsappPrefillMessage] = useState(
    initialConfig.whatsappPrefillMessage,
  );
  const [whatsappAccessToken, setWhatsappAccessToken] = useState(
    initialConfig.whatsappAccessToken,
  );
  const [whatsappBusinessAccountId, setWhatsappBusinessAccountId] = useState(
    initialConfig.whatsappBusinessAccountId,
  );
  const [whatsappVerifyToken, setWhatsappVerifyToken] = useState(
    initialConfig.whatsappVerifyToken || "japora-verify-token",
  );
  const [geminiApiKey, setGeminiApiKey] = useState(initialConfig.geminiApiKey);

  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [claimPrompt, setClaimPrompt] = useState<{
    existingShopName: string;
    existingShopSlug: string;
    phoneNumberId: string;
  } | null>(null);

  // Test message sender state
  const [testToPhone, setTestToPhone] = useState(
    initialWhatsappNumber === "15556449932" ? "22893730817" : initialWhatsappNumber || "22893730817",
  );
  const [testingSend, setTestingSend] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [copiedWebhook, setCopiedWebhook] = useState(false);

  // Live Diagnostic & Alert System State
  const [diagChecks, setDiagChecks] = useState<SubsystemCheck[]>([]);
  const [diagAlerts, setDiagAlerts] = useState<WhatsAppDiagnosticAlert[]>(
    initialConfig.diagnostics || [],
  );
  const [probing, setProbing] = useState(false);
  const [probeResult, setProbeResult] = useState<{
    metaApi?: { ok: boolean; status: string; displayPhone?: string; verifiedName?: string; error?: string; fixHint?: string };
    geminiApi?: { ok: boolean; modelUsed?: string; sampleReply?: string; error?: string; fixHint?: string };
  } | null>(null);

  async function loadDiagnostics() {
    try {
      const res = await fetch("/api/whatsapp/diagnostics");
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data.checks)) setDiagChecks(data.checks);
      if (Array.isArray(data.diagnostics)) setDiagAlerts(data.diagnostics);
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    loadDiagnostics();
    const interval = setInterval(loadDiagnostics, 10000);
    return () => clearInterval(interval);
  }, []);

  async function handleRunLiveProbe() {
    if (probing) return;
    setProbing(true);
    setProbeResult(null);
    try {
      const res = await fetch("/api/whatsapp/diagnostics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          whatsappAccessToken: whatsappAccessToken.trim() || undefined,
          whatsappPhoneNumberId: whatsappPhoneNumberId.trim() || undefined,
          geminiApiKey: geminiApiKey.trim() || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (data.results) {
        setProbeResult(data.results);
      }
      await loadDiagnostics();
    } catch {
      // ignore
    } finally {
      setProbing(false);
    }
  }

  async function handleClearAlerts() {
    try {
      await fetch("/api/whatsapp/diagnostics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "clear" }),
      });
      setDiagAlerts([]);
      await loadDiagnostics();
    } catch {
      // ignore
    }
  }

  const origin =
    typeof window !== "undefined"
      ? window.location.origin
      : process.env.NEXT_PUBLIC_APP_URL || "http://localhost:5174";
  const webhookUrl = `${origin}/api/whatsapp/webhook`;

  async function submitSettings(forceClaim = false) {
    setSaving(true);
    setSaveError("");
    setSaveSuccess(false);
    if (!forceClaim) {
      setClaimPrompt(null);
    }

    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          whatsappNumber,
          whatsappPhoneNumberId,
          forceClaimPhoneNumberId: forceClaim,
          whatsappAssistant: {
            aiEnabled,
            showQrOnShop,
            autoNotifyOrderStatus,
            assistantName,
            welcomeMessage,
            customInstructions,
            whatsappPrefillMessage,
            whatsappAccessToken,
            whatsappBusinessAccountId,
            whatsappVerifyToken,
            geminiApiKey,
          },
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 409 && data?.conflictCode === "WHATSAPP_PHONE_ID_TAKEN") {
        setClaimPrompt({
          existingShopName: data.existingShopName || "une autre boutique",
          existingShopSlug: data.existingShopSlug || "",
          phoneNumberId: data.phoneNumberId || whatsappPhoneNumberId,
        });
      } else if (!res.ok) {
        setSaveError(data.error || "Erreur lors de l'enregistrement.");
      } else {
        setClaimPrompt(null);
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3500);
        router.refresh();
      }
    } catch {
      setSaveError("Erreur réseau lors de la sauvegarde.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    await submitSettings(false);
  }

  async function handleTestWhatsAppSend() {
    if (!testToPhone.trim() || testingSend) return;
    setTestingSend(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/whatsapp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: testToPhone.trim(),
          body: `🤖 Test de connexion Japora WhatsApp Cloud API + Gemini IA pour la boutique "${shopName}" ! Répondez "Menu" pour voir nos articles.`,
          whatsappAccessToken: whatsappAccessToken.trim() || undefined,
          whatsappPhoneNumberId: whatsappPhoneNumberId.trim() || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ok) {
        setTestResult({
          ok: true,
          text:
            data.provider === "cloud-api"
              ? `✅ Message envoyé en direct via Meta WhatsApp Cloud API (Statut : ${data.status}) !`
              : `✅ Message simulé et enregistré (Mode Stub — ajoutez votre Access Token & Phone Number ID pour un envoi réel sur WhatsApp).`,
        });
        router.refresh();
      } else {
        setTestResult({
          ok: false,
          text: `❌ Échec de l'envoi : ${data.error || "Vérifiez vos identifiants Meta Cloud API."}`,
        });
      }
    } catch {
      setTestResult({
        ok: false,
        text: "❌ Erreur réseau lors du test d'envoi.",
      });
    } finally {
      setTestingSend(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* 0. Centre de Diagnostic en Direct (Webhook Meta + Envoi Cloud API + IA Gemini + Routage Boutique) */}
      <div className="card border-2 border-arctic-300/80 p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-arctic-300/40 pb-3">
          <div>
            <h2 className="text-base font-bold text-arctic-900 flex items-center gap-2">
              <span>🩺</span>
              <span>
                {tr(
                  "Diagnostic en Direct : Pourquoi la réponse automatique bloque ou fonctionne ?",
                  "Live Diagnostics: Why is the auto-reply failing or working?",
                )}
              </span>
            </h2>
            <p className="text-xs text-arctic-600 mt-0.5">
              {tr(
                "Vérifie chaque étape exacte : 1) Routage Boutique, 2) Réception Webhook Meta, 3) Envoi Réponse WhatsApp Cloud API, et 4) IA Google Gemini.",
                "Checks every exact stage: 1) Store Routing, 2) Meta Webhook Reception, 3) WhatsApp Cloud API Outbound Send, and 4) Google Gemini AI.",
              )}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleRunLiveProbe}
              disabled={probing}
              className="btn-primary text-xs py-1.5 px-3"
            >
              {probing
                ? tr("Vérification en cours…", "Testing…")
                : tr("🔍 Lancer le test complet (Meta + Gemini)", "🔍 Run Full Diagnostic (Meta + Gemini)")}
            </button>
            {diagAlerts.length > 0 && (
              <button
                type="button"
                onClick={handleClearAlerts}
                className="btn-ghost text-xs py-1.5 px-2.5 border border-arctic-300"
              >
                {tr("Effacer les alertes", "Clear alerts")}
              </button>
            )}
          </div>
        </div>

        {/* Résultat du test actif en 1 clic */}
        {probeResult && (
          <div className="grid gap-3 sm:grid-cols-2">
            <div
              className={`rounded-xl border p-3.5 text-xs space-y-1.5 ${
                probeResult.metaApi?.ok
                  ? "border-emerald-400 bg-emerald-50 text-emerald-950"
                  : "border-red-400 bg-red-50 text-red-950"
              }`}
            >
              <div className="font-bold flex items-center gap-1.5 text-sm">
                <span>{tr("Test de connexion Meta WhatsApp Cloud API", "Meta WhatsApp Cloud API connection test")}</span>
              </div>
              {probeResult.metaApi?.ok ? (
                <p>
                  {tr("Connecté au numéro Meta", "Connected to Meta number")} <strong>{probeResult.metaApi.displayPhone}</strong> (
                  {probeResult.metaApi.verifiedName}).{" "}
                  {tr("Le token et le Phone Number ID sont valides.", "The token and Phone Number ID are valid.")}
                </p>
              ) : (
                <>
                  <p className="font-semibold">{probeResult.metaApi?.error}</p>
                  {probeResult.metaApi?.fixHint && (
                    <p className="rounded bg-white/80 p-2 text-[11px] text-arctic-900 border border-black/10">
                      <strong>{tr("Comment régler :", "How to fix:")}</strong> {probeResult.metaApi.fixHint}
                    </p>
                  )}
                </>
              )}
            </div>

            <div
              className={`rounded-xl border p-3.5 text-xs space-y-1.5 ${
                probeResult.geminiApi?.ok
                  ? "border-emerald-400 bg-emerald-50 text-emerald-950"
                  : "border-amber-400 bg-amber-50 text-amber-950"
              }`}
            >
              <div className="font-bold flex items-center gap-1.5 text-sm">
                <span>{tr("Test de l'IA Google Gemini", "Google Gemini AI test")}</span>
              </div>
              {probeResult.geminiApi?.ok ? (
                <p>
                  {tr("Modèle actif :", "Active model:")} <strong>{probeResult.geminiApi.modelUsed}</strong> —{" "}
                  {tr("réponse test :", "test reply:")} <em>“{probeResult.geminiApi.sampleReply}”</em>
                </p>
              ) : (
                <>
                  <p className="font-semibold">{probeResult.geminiApi?.error}</p>
                  {probeResult.geminiApi?.fixHint && (
                    <p className="rounded bg-white/80 p-2 text-[11px] text-arctic-900 border border-black/10">
                      <strong>{tr("Comment régler :", "How to fix:")}</strong> {probeResult.geminiApi.fixHint}
                    </p>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {/* État des 4 sous-systèmes */}
        {diagChecks.length > 0 && (
          <div className="grid gap-3 sm:grid-cols-2">
            {diagChecks.map((chk) => {
              const badgeCls =
                chk.status === "ok"
                  ? "border-emerald-300 bg-emerald-50/70 text-emerald-950"
                  : chk.status === "error"
                  ? "border-red-300 bg-red-50/80 text-red-950"
                  : "border-amber-300 bg-amber-50/80 text-amber-950";
              return (
                <div key={chk.id} className={`rounded-xl border p-3 text-xs space-y-1 ${badgeCls}`}>
                  <div className="font-bold flex items-center justify-between gap-2">
                    <span>{chk.label}</span>
                    <span className="uppercase text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-white/80">
                      {chk.status === "ok" ? "OK" : chk.status === "error" ? tr("Bloqué", "Blocked") : tr("Attention", "Warning")}
                    </span>
                  </div>
                  <p className="font-medium leading-snug">{chk.summary}</p>
                  {chk.details && <p className="opacity-85 text-[11px]">{chk.details}</p>}
                  {chk.fixHint && chk.status !== "ok" && (
                    <p className="mt-1 rounded bg-white/85 p-2 text-[11px] text-arctic-900 border border-black/10">
                      <strong>{tr("Action :", "Action:")}</strong> {chk.fixHint}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Alertes récentes capturées lors des appels Webhook / Envoi / Gemini */}
        {diagAlerts.filter((a) => a.severity !== "ok").length > 0 && (
          <div className="space-y-2 pt-1">
            <div className="text-xs font-bold text-red-800 uppercase tracking-wider">
              {tr("Dernières erreurs du webhook et de l'envoi automatique", "Latest webhook and auto-reply errors")}
            </div>
            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {diagAlerts
                .filter((a) => a.severity !== "ok")
                .slice(0, 6)
                .map((alert) => (
                  <div
                    key={alert.id}
                    className={`rounded-lg border p-3 text-xs space-y-1 ${
                      alert.severity === "error"
                        ? "border-red-400 bg-red-50 text-red-950"
                        : "border-amber-400 bg-amber-50 text-amber-950"
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 font-bold">
                      <span>
                        [{alert.stage.toUpperCase()}]{" "}
                        {alert.title}
                      </span>
                      <span className="text-[11px] font-normal opacity-75">
                        {new Date(alert.at).toLocaleString(tr("fr-FR", "en-US"))}
                        {alert.contact ? ` • ${tr("Client", "Customer")} : ${alert.contact}` : ""}
                      </span>
                    </div>
                    <p>{alert.message}</p>
                    {alert.details && (
                      <pre className="whitespace-pre-wrap rounded bg-black/5 p-1.5 font-mono text-[10px] opacity-85">
                        {alert.details}
                      </pre>
                    )}
                    {alert.fixHint && (
                      <p className="rounded bg-white/90 p-2 text-[11px] font-medium text-arctic-900 border border-black/10">
                        <strong>{tr("Solution :", "Fix:")}</strong> {alert.fixHint}
                      </p>
                    )}
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>

      {/* 1. QR Codes de l'Assistant IA (Boutique + WhatsApp) */}
      <ShopQrCard
        slug={shopSlug}
        shopName={shopName}
        whatsappNumber={whatsappNumber}
        whatsappPrefillMessage={whatsappPrefillMessage}
      />

      {/* 2. Formulaire de Configuration Assistant IA Gemini & WhatsApp Cloud API */}
      <form onSubmit={handleSave} className="card p-5 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-arctic-300/40 pb-3">
          <div>
            <h2 className="text-base font-bold text-arctic-900">
              {tr(
                "⚙️ Configuration de l'Assistant WhatsApp & IA Gemini",
                "⚙️ WhatsApp Assistant & Gemini AI Configuration",
              )}
            </h2>
            <p className="text-xs text-arctic-600">
              {tr(
                "Personnalisez le comportement de votre assistant IA sur votre boutique et sur WhatsApp, et reliez votre compte Meta WhatsApp Cloud API.",
                "Customize your AI assistant behavior on your storefront and WhatsApp, and connect your Meta WhatsApp Cloud API account.",
              )}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                isCloudLive
                  ? "bg-emerald-100 text-emerald-800"
                  : "bg-amber-100 text-amber-800"
              }`}
            >
              {isCloudLive
                ? tr("● WhatsApp Cloud API Connecté", "● WhatsApp Cloud API Connected")
                : tr("● WhatsApp Mode Simulation (Stub)", "● WhatsApp Simulation Mode (Stub)")}
            </span>
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                isGeminiLive ? "bg-sky-100 text-sky-800" : "bg-arctic-200 text-arctic-700"
              }`}
            >
              {isGeminiLive ? tr("✨ Gemini IA Actif", "✨ Gemini AI Active") : tr("IA locale", "Local AI")}
            </span>
          </div>
        </div>

        {/* Interrupteurs principaux */}
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="flex items-start gap-2.5 rounded-xl border border-arctic-300/60 bg-arctic-50/50 p-3 cursor-pointer">
            <input
              type="checkbox"
              checked={aiEnabled}
              onChange={(e) => setAiEnabled(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-arctic-400 text-brand focus:ring-brand"
            />
            <div className="text-xs">
              <span className="font-bold text-arctic-900 block">
                {tr("Activer l'Assistant IA Gemini", "Enable Gemini AI Assistant")}
              </span>
              <span className="text-arctic-600">
                {tr(
                  "Répond aux questions des clients sur la boutique et sur WhatsApp avec des boutons d'action directe.",
                  "Answers customer questions on your storefront and WhatsApp with direct action buttons.",
                )}
              </span>
            </div>
          </label>

          <label className="flex items-start gap-2.5 rounded-xl border border-arctic-300/60 bg-arctic-50/50 p-3 cursor-pointer">
            <input
              type="checkbox"
              checked={showQrOnShop}
              onChange={(e) => setShowQrOnShop(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-arctic-400 text-brand focus:ring-brand"
            />
            <div className="text-xs">
              <span className="font-bold text-arctic-900 block">
                {tr("Afficher le QR Code sur la boutique", "Show QR Code on storefront")}
              </span>
              <span className="text-arctic-600">
                {tr(
                  "Affiche la bannière et le QR Code de votre Assistant WhatsApp directement sur",
                  "Displays the banner and QR Code of your WhatsApp Assistant directly on",
                )}{" "}
                <code className="font-mono">/c/{shopSlug}</code>.
              </span>
            </div>
          </label>

          <label className="flex items-start gap-2.5 rounded-xl border border-arctic-300/60 bg-arctic-50/50 p-3 cursor-pointer">
            <input
              type="checkbox"
              checked={autoNotifyOrderStatus}
              onChange={(e) => setAutoNotifyOrderStatus(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-arctic-400 text-brand focus:ring-brand"
            />
            <div className="text-xs">
              <span className="font-bold text-arctic-900 block">
                {tr("Suivi WhatsApp automatique", "Automatic WhatsApp tracking")}
              </span>
              <span className="text-arctic-600">
                {tr(
                  "Notifie automatiquement le client sur WhatsApp quand sa commande passe à Confirmée, Payée ou Livrée.",
                  "Automatically notifies the customer on WhatsApp when their order becomes Confirmed, Paid, or Delivered.",
                )}
              </span>
            </div>
          </label>
        </div>

        {/* Personnalisation de l'Assistant IA */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">{tr("Nom de votre Assistant IA", "Your AI Assistant Name")}</label>
            <input
              className="input"
              placeholder={tr(`Assistant ${shopName}`, `${shopName} assistant`)}
              value={assistantName}
              onChange={(e) => setAssistantName(e.target.value)}
            />
            <p className="mt-1 text-xs text-arctic-500">
              {tr(
                "Affiché en haut du chat IA sur la boutique et dans les réponses Gemini.",
                "Displayed at the top of the storefront AI chat and in Gemini replies.",
              )}
            </p>
          </div>

          <div>
            <label className="label">
              {tr(
                "Numéro WhatsApp de la boutique (avec indicatif pays)",
                "Store WhatsApp Number (with country code)",
              )}
            </label>
            <input
              className="input"
              inputMode="tel"
              placeholder={tr("Ex : +228 90 12 34 56 (avec + et l’indicatif)", "e.g. +228 90 12 34 56 (with + and country code)")}
              value={whatsappNumber}
              onChange={(e) => setWhatsappNumber(e.target.value)}
            />
            <p className="mt-1 text-xs text-arctic-500">
              {tr(
                "Utilisé pour générer le QR Code WhatsApp et rediriger les clients vers votre WhatsApp.",
                "Used to generate the WhatsApp QR Code and redirect customers to your WhatsApp.",
              )}
            </p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">
              {tr("Message d'accueil de l'Assistant (optionnel)", "Assistant Welcome Message (optional)")}
            </label>
            <textarea
              className="input min-h-[76px] text-xs"
              placeholder={tr(
                `Bonjour ! Bienvenue chez ${shopName}. Posez-moi vos questions sur nos produits, tailles ou tarifs !`,
                `Hello! Welcome to ${shopName}. Ask me about our products, sizes, or prices!`,
              )}
              value={welcomeMessage}
              onChange={(e) => setWelcomeMessage(e.target.value)}
            />
          </div>

          <div>
            <label className="label">
              {tr("Message pré-rempli du QR Code WhatsApp", "WhatsApp QR Code Prefilled Message")}
            </label>
            <textarea
              className="input min-h-[76px] text-xs"
              placeholder={tr(
                "Bonjour ! Je viens de scanner votre QR code sur Japora. Quels sont vos articles disponibles ?",
                "Hello! I just scanned your QR code on Japora. What items do you have available?",
              )}
              value={whatsappPrefillMessage}
              onChange={(e) => setWhatsappPrefillMessage(e.target.value)}
            />
          </div>
        </div>

        <div>
          <label className="label">
            {tr(
              "Instructions personnalisées pour Gemini IA (horaires, livraison, conditions, promotions…)",
              "Custom instructions for Gemini AI (hours, delivery, terms, promos…)",
            )}
          </label>
          <textarea
            className="input min-h-[84px] text-xs"
            placeholder={tr(
              "Ex: Livraison gratuite à Lomé à partir de 25 000 FCFA. Ouvert du lundi au samedi de 8h à 20h. Paiement accepté par T-Money, Flooz et espèces à la livraison.",
              "Ex: Free delivery in Lomé over 25,000 FCFA. Open Monday to Saturday 8am–8pm. Payments accepted via T-Money, Flooz, and cash on delivery.",
            )}
            value={customInstructions}
            onChange={(e) => setCustomInstructions(e.target.value)}
          />
          <p className="mt-1 text-xs text-arctic-500">
            {tr(
              "Gemini utilisera ces consignes en plus de votre catalogue de produits pour répondre aux clients sur le site et sur WhatsApp.",
              "Gemini will use these instructions alongside your product catalog to answer customers on the website and WhatsApp.",
            )}
          </p>
        </div>

        {/* Section Identifiants Meta WhatsApp Cloud API & Clé Gemini */}
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-50/40 p-4 space-y-4">
          <div>
            <h3 className="text-sm font-bold text-arctic-900 flex items-center gap-2">
              <span>🔑</span>{" "}
              {tr(
                "Identifiants de connexion WhatsApp Cloud API (Meta) & Gemini",
                "WhatsApp Cloud API (Meta) & Gemini Credentials",
              )}
            </h3>
            <p className="mt-0.5 text-xs text-arctic-600">
              {tr(
                "Renseignez ici les identifiants de votre application Meta (developers.facebook.com → WhatsApp → API Setup) pour connecter directement cette boutique sur Japora.",
                "Enter your Meta app credentials (developers.facebook.com → WhatsApp → API Setup) to connect this store directly on Japora.",
              )}
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label text-xs">
                WhatsApp Phone Number ID
              </label>
              <input
                className="input text-xs font-mono"
                placeholder={tr("Ex: 105928374650192", "e.g. 105928374650192")}
                value={whatsappPhoneNumberId}
                onChange={(e) => setWhatsappPhoneNumberId(e.target.value)}
              />
              <span className="text-[11px] text-arctic-500">
                {tr(
                  "Identifiant numérique du numéro d'envoi dans Meta App Dashboard.",
                  "Numeric ID of the sending phone number in Meta App Dashboard.",
                )}
              </span>
            </div>

            <div>
              <label className="label text-xs">
                WhatsApp Business Account ID (<code className="font-mono">WABA ID</code> - {tr("optionnel", "optional")})
              </label>
              <input
                className="input text-xs font-mono"
                placeholder={tr("Ex: 109283746519283", "e.g. 109283746519283")}
                value={whatsappBusinessAccountId}
                onChange={(e) => setWhatsappBusinessAccountId(e.target.value)}
              />
            </div>

            <div>
              <label className="label text-xs">
                Meta Cloud API Access Token
              </label>
              <input
                type="password"
                className="input text-xs font-mono"
                placeholder="EAAGm0PX4ZCps..."
                value={whatsappAccessToken}
                onChange={(e) => setWhatsappAccessToken(e.target.value)}
              />
              <span className="text-[11px] text-arctic-500">
                {tr(
                  "Token permanent (System User) ou temporaire fourni par Meta for Developers.",
                  "Permanent (System User) or temporary token from Meta for Developers.",
                )}
              </span>
            </div>

            <div>
              <label className="label text-xs">
                {tr("Clé API Google Gemini (optionnelle)", "Google Gemini API Key (optional)")}
              </label>
              <input
                type="password"
                className="input text-xs font-mono"
                placeholder="AIzaSy..."
                value={geminiApiKey}
                onChange={(e) => setGeminiApiKey(e.target.value)}
              />
              <span className="text-[11px] text-arctic-500">
                {tr(
                  "Permet d'utiliser votre propre clé Gemini pour l'assistant IA de votre boutique.",
                  "Allows using your own Gemini key for your store's AI assistant.",
                )}
              </span>
            </div>
          </div>

          {/* Informations Webhook à copier dans Meta */}
          <div className="rounded-lg border border-arctic-300/70 bg-white p-3 space-y-2 text-xs">
            <div className="font-bold text-arctic-900">
              {tr(
                "🔗 Configuration du Webhook dans Meta for Developers (WhatsApp → Configuration) :",
                "🔗 Webhook setup in Meta for Developers (WhatsApp → Configuration):",
              )}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <span className="font-semibold text-arctic-700">{tr("Callback URL :", "Callback URL:")} </span>
                <code className="rounded bg-arctic-100 px-2 py-0.5 font-mono text-arctic-900">
                  {webhookUrl}
                </code>
              </div>
              <button
                type="button"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(webhookUrl);
                    setCopiedWebhook(true);
                    setTimeout(() => setCopiedWebhook(false), 1800);
                  } catch {}
                }}
                className="btn-ghost text-xs py-1 px-2.5 border border-arctic-300"
              >
                {copiedWebhook ? tr("Copié ✓", "Copied ✓") : tr("Copier l'URL", "Copy URL")}
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-arctic-700">{tr("Verify Token :", "Verify token:")} </span>
              <input
                className="input !w-auto text-xs font-mono py-1 px-2"
                value={whatsappVerifyToken}
                onChange={(e) => setWhatsappVerifyToken(e.target.value)}
              />
              <span className="text-[11px] text-arctic-500">
                {tr("Champs Webhook à abonner sur Meta :", "Webhook fields to subscribe on Meta:")}{" "}
                <code className="font-mono font-bold">messages</code>
              </span>
            </div>
          </div>

          {/* Test d'envoi WhatsApp Cloud API */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 pt-1">
            <input
              type="text"
              value={testToPhone}
              onChange={(e) => setTestToPhone(e.target.value)}
              placeholder={tr("N° destinataire test (ex: 22890123456)", "Test recipient phone (e.g. 22890123456)")}
              className="input text-xs py-1.5 sm:max-w-xs"
            />
            <button
              type="button"
              onClick={handleTestWhatsAppSend}
              disabled={testingSend || !testToPhone.trim()}
              className="btn-ghost text-xs py-1.5 px-3 border border-emerald-600 text-emerald-800 hover:bg-emerald-100"
            >
              {testingSend
                ? tr("Envoi du test…", "Sending test…")
                : tr("📤 Tester l'envoi d'un message WhatsApp", "📤 Send a test WhatsApp message")}
            </button>
          </div>
          {testResult && (
            <p
              className={`rounded-lg px-3 py-2 text-xs font-medium ${
                testResult.ok ? "bg-emerald-100 text-emerald-900" : "bg-red-100 text-red-800"
              }`}
            >
              {testResult.text}
            </p>
          )}
        </div>

        {claimPrompt && (
          <div className="rounded-xl border-2 border-amber-400 bg-amber-50 p-4 space-y-3 text-xs">
            <div className="flex items-start gap-2.5">
              <span className="text-lg">⚠️</span>
              <div className="space-y-1">
                <p className="font-bold text-amber-900 text-sm">
                  {tr(
                    `Ce Phone Number ID (${claimPrompt.phoneNumberId}) est déjà utilisé ailleurs`,
                    `This Phone Number ID (${claimPrompt.phoneNumberId}) is already used elsewhere`,
                  )}
                </p>
                <p className="text-amber-800 leading-relaxed">
                  {tr(
                    "Ces informations WhatsApp Cloud API sont actuellement associées à la boutique",
                    "These WhatsApp Cloud API credentials are currently linked to the store",
                  )}{" "}
                  <strong>« {claimPrompt.existingShopName} »</strong>
                  {claimPrompt.existingShopSlug ? ` (/c/${claimPrompt.existingShopSlug})` : ""}.{" "}
                  {tr(
                    "Voulez-vous transférer cette configuration WhatsApp vers votre boutique actuelle",
                    "Do you want to transfer this WhatsApp configuration to your current store",
                  )}{" "}
                  <strong>« {shopName} »</strong> ?
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setClaimPrompt(null)}
                className="btn-ghost text-xs py-1.5 px-3"
                disabled={saving}
              >
                {tr("Annuler", "Cancel")}
              </button>
              <button
                type="button"
                onClick={() => submitSettings(true)}
                disabled={saving}
                className="btn-primary text-xs py-1.5 px-4"
              >
                {saving
                  ? tr("Transfert en cours…", "Transferring…")
                  : tr("✓ Oui, ramener et configurer sur cette boutique", "✓ Yes, transfer and configure on this store")}
              </button>
            </div>
          </div>
        )}

        {saveError && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{saveError}</p>
        )}

        <div className="flex items-center justify-end gap-3">
          {saveSuccess && (
            <span className="text-xs font-semibold text-emerald-700">
              {tr("✅ Configuration enregistrée avec succès !", "✅ Configuration saved successfully!")}
            </span>
          )}
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving
              ? tr("Enregistrement…", "Saving…")
              : tr("Enregistrer la configuration WhatsApp & IA", "Save WhatsApp & AI Configuration")}
          </button>
        </div>
      </form>
    </div>
  );
}

