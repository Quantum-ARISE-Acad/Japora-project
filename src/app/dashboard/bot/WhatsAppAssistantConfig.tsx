"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ShopQrCard from "../ShopQrCard";
import type { WhatsAppAssistantConfig as WaConfigType } from "@/lib/whatsapp-config";

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
  const router = useRouter();

  const [whatsappNumber, setWhatsappNumber] = useState(initialWhatsappNumber || "");
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

  // Test message sender state
  const [testToPhone, setTestToPhone] = useState(
    initialWhatsappNumber === "15556449932" ? "22893730817" : initialWhatsappNumber || "22893730817",
  );
  const [testingSend, setTestingSend] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [copiedWebhook, setCopiedWebhook] = useState(false);

  const origin =
    typeof window !== "undefined"
      ? window.location.origin
      : process.env.NEXT_PUBLIC_APP_URL || "http://localhost:5174";
  const webhookUrl = `${origin}/api/whatsapp/webhook`;

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaveError("");
    setSaveSuccess(false);

    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          whatsappNumber,
          whatsappPhoneNumberId,
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
      if (!res.ok) {
        setSaveError(data.error || "Erreur lors de l'enregistrement.");
      } else {
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
              ⚙️ Configuration de l&apos;Assistant WhatsApp & IA Gemini
            </h2>
            <p className="text-xs text-arctic-600">
              Personnalisez le comportement de votre assistant IA sur votre boutique et sur WhatsApp, et reliez votre compte Meta WhatsApp Cloud API.
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
              {isCloudLive ? "● WhatsApp Cloud API Connecté" : "● WhatsApp Mode Simulation (Stub)"}
            </span>
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                isGeminiLive ? "bg-sky-100 text-sky-800" : "bg-arctic-200 text-arctic-700"
              }`}
            >
              {isGeminiLive ? "✨ Gemini IA Actif" : "IA locale"}
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
              <span className="font-bold text-arctic-900 block">Activer l&apos;Assistant IA Gemini</span>
              <span className="text-arctic-600">
                Répond aux questions des clients sur la boutique et sur WhatsApp avec des boutons d&apos;action directe.
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
              <span className="font-bold text-arctic-900 block">Afficher le QR Code sur la boutique</span>
              <span className="text-arctic-600">
                Affiche la bannière et le QR Code de votre Assistant WhatsApp directement sur <code className="font-mono">/c/{shopSlug}</code>.
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
              <span className="font-bold text-arctic-900 block">Suivi WhatsApp automatique</span>
              <span className="text-arctic-600">
                Notifie automatiquement le client sur WhatsApp quand sa commande passe à Confirmée, Payée ou Livrée.
              </span>
            </div>
          </label>
        </div>

        {/* Personnalisation de l'Assistant IA */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Nom de votre Assistant IA</label>
            <input
              className="input"
              placeholder={`Assistant ${shopName}`}
              value={assistantName}
              onChange={(e) => setAssistantName(e.target.value)}
            />
            <p className="mt-1 text-xs text-arctic-500">
              Affiché en haut du chat IA sur la boutique et dans les réponses Gemini.
            </p>
          </div>

          <div>
            <label className="label">Numéro WhatsApp de la boutique (avec indicatif pays)</label>
            <input
              className="input"
              inputMode="tel"
              placeholder="Ex: 22890123456 (sans + ni espaces)"
              value={whatsappNumber}
              onChange={(e) => setWhatsappNumber(e.target.value)}
            />
            <p className="mt-1 text-xs text-arctic-500">
              Utilisé pour générer le QR Code WhatsApp et rediriger les clients vers votre WhatsApp.
            </p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Message d&apos;accueil de l&apos;Assistant (optionnel)</label>
            <textarea
              className="input min-h-[76px] text-xs"
              placeholder={`Bonjour ! Bienvenue chez ${shopName}. Posez-moi vos questions sur nos produits, tailles ou tarifs !`}
              value={welcomeMessage}
              onChange={(e) => setWelcomeMessage(e.target.value)}
            />
          </div>

          <div>
            <label className="label">Message pré-rempli du QR Code WhatsApp</label>
            <textarea
              className="input min-h-[76px] text-xs"
              placeholder="Bonjour ! Je viens de scanner votre QR code sur Japora. Quels sont vos articles disponibles ?"
              value={whatsappPrefillMessage}
              onChange={(e) => setWhatsappPrefillMessage(e.target.value)}
            />
          </div>
        </div>

        <div>
          <label className="label">
            Instructions personnalisées pour Gemini IA (horaires, livraison, conditions, promotions…)
          </label>
          <textarea
            className="input min-h-[84px] text-xs"
            placeholder="Ex: Livraison gratuite à Lomé à partir de 25 000 FCFA. Ouvert du lundi au samedi de 8h à 20h. Paiement accepté par T-Money, Flooz et espèces à la livraison."
            value={customInstructions}
            onChange={(e) => setCustomInstructions(e.target.value)}
          />
          <p className="mt-1 text-xs text-arctic-500">
            Gemini utilisera ces consignes en plus de votre catalogue de produits pour répondre aux clients sur le site et sur WhatsApp.
          </p>
        </div>

        {/* Section Identifiants Meta WhatsApp Cloud API & Clé Gemini */}
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-50/40 p-4 space-y-4">
          <div>
            <h3 className="text-sm font-bold text-arctic-900 flex items-center gap-2">
              <span>🔑</span> Identifiants de connexion WhatsApp Cloud API (Meta) & Gemini
            </h3>
            <p className="mt-0.5 text-xs text-arctic-600">
              Fournissez ici les identifiants de votre application Meta (developers.facebook.com → WhatsApp → API Setup) pour connecter cette boutique en direct, ou configurez-les globalement dans le fichier <code className="font-mono">.env</code>.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label text-xs">
                WhatsApp Phone Number ID (<code className="font-mono">WHATSAPP_PHONE_NUMBER_ID</code>)
              </label>
              <input
                className="input text-xs font-mono"
                placeholder="Ex: 105928374650192"
                value={whatsappPhoneNumberId}
                onChange={(e) => setWhatsappPhoneNumberId(e.target.value)}
              />
              <span className="text-[11px] text-arctic-500">
                Identifiant numérique du numéro d&apos;envoi dans Meta App Dashboard.
              </span>
            </div>

            <div>
              <label className="label text-xs">
                WhatsApp Business Account ID (<code className="font-mono">WABA ID</code> - optionnel)
              </label>
              <input
                className="input text-xs font-mono"
                placeholder="Ex: 109283746519283"
                value={whatsappBusinessAccountId}
                onChange={(e) => setWhatsappBusinessAccountId(e.target.value)}
              />
            </div>

            <div>
              <label className="label text-xs">
                Meta Cloud API Access Token (<code className="font-mono">WHATSAPP_TOKEN</code>)
              </label>
              <input
                type="password"
                className="input text-xs font-mono"
                placeholder="EAAGm0PX4ZCps... (Laisser vide si déjà dans .env)"
                value={whatsappAccessToken}
                onChange={(e) => setWhatsappAccessToken(e.target.value)}
              />
              <span className="text-[11px] text-arctic-500">
                Token permanent (System User) ou temporaire fourni par Meta for Developers.
              </span>
            </div>

            <div>
              <label className="label text-xs">
                Clé API Google Gemini (<code className="font-mono">GEMINI_API_KEY</code> - optionnelle)
              </label>
              <input
                type="password"
                className="input text-xs font-mono"
                placeholder="AIzaSy... (Laisser vide pour utiliser la clé globale du .env)"
                value={geminiApiKey}
                onChange={(e) => setGeminiApiKey(e.target.value)}
              />
              <span className="text-[11px] text-arctic-500">
                Déjà configurée par défaut sur la plateforme si <code className="font-mono">GEMINI_API_KEY</code> est présent dans <code className="font-mono">.env</code>.
              </span>
            </div>
          </div>

          {/* Informations Webhook à copier dans Meta */}
          <div className="rounded-lg border border-arctic-300/70 bg-white p-3 space-y-2 text-xs">
            <div className="font-bold text-arctic-900">
              🔗 Configuration du Webhook dans Meta for Developers (WhatsApp → Configuration) :
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <span className="font-semibold text-arctic-700">Callback URL : </span>
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
                {copiedWebhook ? "Copié ✓" : "Copier l'URL"}
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-arctic-700">Verify Token : </span>
              <input
                className="input !w-auto text-xs font-mono py-1 px-2"
                value={whatsappVerifyToken}
                onChange={(e) => setWhatsappVerifyToken(e.target.value)}
              />
              <span className="text-[11px] text-arctic-500">
                Champs Webhook à abonner sur Meta : <code className="font-mono font-bold">messages</code>
              </span>
            </div>
          </div>

          {/* Test d'envoi WhatsApp Cloud API */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 pt-1">
            <input
              type="text"
              value={testToPhone}
              onChange={(e) => setTestToPhone(e.target.value)}
              placeholder="N° destinataire test (ex: 22890123456)"
              className="input text-xs py-1.5 sm:max-w-xs"
            />
            <button
              type="button"
              onClick={handleTestWhatsAppSend}
              disabled={testingSend || !testToPhone.trim()}
              className="btn-ghost text-xs py-1.5 px-3 border border-emerald-600 text-emerald-800 hover:bg-emerald-100"
            >
              {testingSend ? "Envoi du test…" : "📤 Tester l'envoi d'un message WhatsApp"}
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

        {saveError && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{saveError}</p>
        )}

        <div className="flex items-center justify-end gap-3">
          {saveSuccess && (
            <span className="text-xs font-semibold text-emerald-700">
              ✅ Configuration enregistrée avec succès !
            </span>
          )}
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? "Enregistrement…" : "Enregistrer la configuration WhatsApp & IA"}
          </button>
        </div>
      </form>
    </div>
  );
}

