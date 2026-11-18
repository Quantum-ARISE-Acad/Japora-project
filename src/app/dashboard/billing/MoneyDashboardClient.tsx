"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatMoney } from "@/lib/utils";
import { usePublicLang } from "@/components/PublicLanguageProvider";

type TransactionRow = {
  id: string;
  orderId: string | null;
  provider: string;
  providerRef: string;
  amountCents: number;
  currency: string;
  status: string;
  wallet: string;
  title: string;
  customerName: string;
  createdAt: string;
};

type FedaPayConfigState = {
  environment: "sandbox" | "live";
  publicKey: string;
  secretKey: string;
  sandboxPublicKey?: string;
  sandboxSecretKey?: string;
  livePublicKey?: string;
  liveSecretKey?: string;
  webhookSecret: string;
  enabled: boolean;
};

export default function MoneyDashboardClient({
  currency,
  shopName,
  shopSlug,
  momoNumber,
  whatsappNumber,
  initialFedaConfig,
  stats,
  entitlement,
  transactions,
  queryStatus,
}: {
  currency: string;
  shopName: string;
  shopSlug: string;
  momoNumber: string;
  whatsappNumber: string;
  initialFedaConfig: FedaPayConfigState;
  stats: {
    totalCollectedCents: number;
    pendingCents: number;
    commissionCents: number;
    commissionPct: number;
    paidOrdersCount: number;
    paidLinksCount: number;
    fedaSuccessCount: number;
  };
  entitlement: {
    active: boolean;
    status: string;
    summary: string;
    trialDaysRemaining: number | null;
  };
  transactions: TransactionRow[];
  queryStatus?: { ok?: string; canceled?: string; ref?: string };
}) {
  const { tr } = usePublicLang();
  const router = useRouter();
  const [fedaConfig, setFedaConfig] = useState<FedaPayConfigState>({
    ...initialFedaConfig,
    sandboxPublicKey: initialFedaConfig.sandboxPublicKey ?? (initialFedaConfig.environment === "sandbox" ? initialFedaConfig.publicKey : ""),
    sandboxSecretKey: initialFedaConfig.sandboxSecretKey ?? (initialFedaConfig.environment === "sandbox" ? initialFedaConfig.secretKey : ""),
    livePublicKey: initialFedaConfig.livePublicKey ?? (initialFedaConfig.environment === "live" ? initialFedaConfig.publicKey : ""),
    liveSecretKey: initialFedaConfig.liveSecretKey ?? (initialFedaConfig.environment === "live" ? initialFedaConfig.secretKey : ""),
  });
  const [savingConfig, setSavingConfig] = useState(false);
  const [testingConn, setTestingConn] = useState(false);
  const [configMsg, setConfigMsg] = useState("");
  const [configIsError, setConfigIsError] = useState(false);

  const activePublicKey =
    fedaConfig.environment === "live"
      ? (fedaConfig.livePublicKey ?? "")
      : (fedaConfig.sandboxPublicKey ?? "");
  const activeSecretKey =
    fedaConfig.environment === "live"
      ? (fedaConfig.liveSecretKey ?? "")
      : (fedaConfig.sandboxSecretKey ?? "");

  function updateActiveKey(field: "publicKey" | "secretKey", value: string) {
    if (fedaConfig.environment === "live") {
      setFedaConfig((prev) => ({
        ...prev,
        [field]: value,
        ...(field === "publicKey" ? { livePublicKey: value } : { liveSecretKey: value }),
      }));
    } else {
      setFedaConfig((prev) => ({
        ...prev,
        [field]: value,
        ...(field === "publicKey" ? { sandboxPublicKey: value } : { sandboxSecretKey: value }),
      }));
    }
  }

  function switchEnvironment(nextEnv: "sandbox" | "live") {
    setFedaConfig((prev) => ({
      ...prev,
      environment: nextEnv,
      publicKey: nextEnv === "live" ? (prev.livePublicKey ?? "") : (prev.sandboxPublicKey ?? ""),
      secretKey: nextEnv === "live" ? (prev.liveSecretKey ?? "") : (prev.sandboxSecretKey ?? ""),
    }));
    setConfigMsg("");
    setConfigIsError(false);
  }

  async function handleTestConnection() {
    setTestingConn(true);
    setConfigMsg("");
    setConfigIsError(false);
    try {
      const res = await fetch("/api/payments/fedapay/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "test_connection",
          environment: fedaConfig.environment,
          secretKey: activeSecretKey,
        }),
      });
      const data = await res.json().catch(() => ({}));
      setConfigIsError(!data.ok);
      setConfigMsg(data.message || (data.ok ? "✅ Connexion FedaPay réussie !" : "⚠️ Échec de la vérification."));
    } catch {
      setConfigIsError(true);
      setConfigMsg("⚠️ Erreur réseau lors du test de connexion FedaPay.");
    } finally {
      setTestingConn(false);
    }
  }

  // Direct Payment State
  const [testAmount, setTestAmount] = useState(
    currency === "XOF" || currency === "XAF" ? "2500" : "15",
  );
  const [testTitle, setTestTitle] = useState("Encaissement Direct FedaPay");
  const [launchingTest, setLaunchingTest] = useState(false);
  const [launchingSub, setLaunchingSub] = useState(false);
  const [copiedWebhook, setCopiedWebhook] = useState(false);

  const webhookUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/api/payments/webhook/fedapay`
      : "http://localhost:5174/api/payments/webhook/fedapay";

  async function handleSaveFedaConfig(e: React.FormEvent) {
    e.preventDefault();
    setSavingConfig(true);
    setConfigMsg("");
    setConfigIsError(false);

    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fedapayConfig: {
            environment: fedaConfig.environment,
            publicKey: activePublicKey,
            secretKey: activeSecretKey,
            sandboxPublicKey: fedaConfig.sandboxPublicKey ?? "",
            sandboxSecretKey: fedaConfig.sandboxSecretKey ?? "",
            livePublicKey: fedaConfig.livePublicKey ?? "",
            liveSecretKey: fedaConfig.liveSecretKey ?? "",
            webhookSecret: fedaConfig.webhookSecret ?? "",
            enabled: true,
          },
        }),
      });
      const data = await res.json().catch(() => ({}));
      setSavingConfig(false);
      if (res.ok) {
        setConfigIsError(false);
        setConfigMsg(
          tr(
            `✓ Configuration FedaPay (${fedaConfig.environment.toUpperCase()}) enregistrée avec succès !`,
            `✓ FedaPay (${fedaConfig.environment.toUpperCase()}) configuration saved!`,
          ),
        );
        router.refresh();
      } else {
        setConfigIsError(true);
        setConfigMsg(`⚠️ ${data.error || "Erreur lors de la sauvegarde."}`);
      }
    } catch {
      setSavingConfig(false);
      setConfigIsError(true);
      setConfigMsg("⚠️ Erreur réseau lors de la sauvegarde.");
    }
  }

  async function handleLaunchSandboxTest() {
    const num = parseFloat(testAmount.replace(/\s+/g, "").replace(",", "."));
    if (isNaN(num) || num <= 0) return;
    setLaunchingTest(true);

    try {
      const res = await fetch("/api/payments/fedapay/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "initiate_test",
          amountCents: Math.round(num * 100),
          title: testTitle.trim() || "Test FedaPay Sandbox",
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
        return;
      }
      setLaunchingTest(false);
      alert(data.error || "Impossible de lancer le test FedaPay.");
    } catch {
      setLaunchingTest(false);
      alert("Erreur réseau.");
    }
  }

  async function handleSubscribePro() {
    setLaunchingSub(true);
    try {
      const res = await fetch("/api/payments/fedapay/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "initiate_subscription",
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
        return;
      }
      setLaunchingSub(false);
    } catch {
      setLaunchingSub(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="a-headline-md text-arctic-900">Japora Money × FedaPay</h1>
            <span className="rounded-full bg-emerald-100 border border-emerald-300 px-2.5 py-0.5 text-xs font-bold text-emerald-800">
              ● {fedaConfig.environment === "live" ? "FedaPay Live" : tr("FedaPay Sandbox Actif", "FedaPay Sandbox Active")}
            </span>
          </div>
          <p className="text-sm text-arctic-600 mt-1">
            {tr(
              "Gérez vos encaissements Mobile Money & Carte via FedaPay, vos liens de paiement WhatsApp Cloud API et votre portefeuille marchand.",
              "Manage your Mobile Money & Card collections via FedaPay, your WhatsApp Cloud API payment links, and your merchant wallet.",
            )}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link href="/dashboard/payment-links" className="btn-ghost text-xs">
            {tr("🔗 Liens de paiement WhatsApp", "🔗 WhatsApp Payment Links")}
          </Link>
          <Link href="/dashboard/receivables" className="btn-ghost text-xs">
            {tr("📒 Créances & Relances", "📒 Receivables & Reminders")}
          </Link>
          <Link href={`/c/${shopSlug}`} target="_blank" className="btn-primary text-xs">
            {tr("🛍️ Tester le panier boutique ↗", "🛍️ Test storefront cart ↗")}
          </Link>
        </div>
      </div>

      {/* Status banners after checkout redirect */}
      {queryStatus?.ok === "1" && (
        <div className="rounded-2xl border border-emerald-300 bg-emerald-50 px-5 py-4 text-sm text-emerald-950 flex items-center justify-between gap-3 shadow-sm">
          <div>
            <strong className="font-bold">
              {tr("✅ Paiement FedaPay confirmé !", "✅ FedaPay payment confirmed!")}
            </strong>
            <p className="text-xs text-emerald-800 mt-0.5">
              {tr(
                `La transaction ${queryStatus.ref ? `(${queryStatus.ref})` : ""} a été réglée et ajoutée à votre journal financier MySQL.`,
                `Transaction ${queryStatus.ref ? `(${queryStatus.ref})` : ""} was paid and added to your MySQL financial ledger.`,
              )}
            </p>
          </div>
          <Link href="/dashboard/billing" className="text-xs font-semibold text-emerald-900 underline">
            {tr("Fermer", "Close")}
          </Link>
        </div>
      )}

      {queryStatus?.canceled === "1" && (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 px-5 py-3.5 text-sm text-amber-900">
          {tr(
            "⚠️ La transaction FedaPay a été annulée ou refusée.",
            "⚠️ The FedaPay transaction was cancelled or declined.",
          )}
        </div>
      )}

      {/* Financial KPIs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="card p-5 border-l-4 border-l-emerald-500">
          <div className="text-xs font-semibold uppercase tracking-wider text-arctic-500">
            {tr("Total Encaissé", "Total Collected")}
          </div>
          <div className="mt-2 text-2xl font-extrabold text-emerald-700">
            {formatMoney(stats.totalCollectedCents, currency)}
          </div>
          <div className="mt-1 text-xs text-arctic-500">
            {stats.paidOrdersCount} {tr("commande(s)", "order(s)")} + {stats.paidLinksCount} {tr("lien(s) payé(s)", "paid link(s)")}
          </div>
        </div>

        <div className="card p-5 border-l-4 border-l-amber-500">
          <div className="text-xs font-semibold uppercase tracking-wider text-arctic-500">
            {tr("En Attente d'Encaissement", "Pending Collection")}
          </div>
          <div className="mt-2 text-2xl font-extrabold text-amber-700">
            {formatMoney(stats.pendingCents, currency)}
          </div>
          <div className="mt-1 text-xs text-arctic-500">
            {tr("Commandes & liens non réglés", "Unpaid orders & links")}
          </div>
        </div>

        <div className="card p-5 border-l-4 border-l-brand">
          <div className="text-xs font-semibold uppercase tracking-wider text-arctic-500">
            {tr("Transactions FedaPay", "FedaPay Transactions")}
          </div>
          <div className="mt-2 text-2xl font-extrabold text-arctic-900">
            {stats.fedaSuccessCount} {tr("réussie(s)", "successful")}
          </div>
          <div className="mt-1 text-xs text-arctic-500">
            {tr("T-Money, Flooz, MoMo & Carte", "T-Money, Flooz, MoMo & Card")}
          </div>
        </div>

        <div className="card p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-arctic-500">
              {tr("Commission ce mois", "Commission this month")}
            </span>
            <span className="rounded-full bg-arctic-200/70 px-2 py-0.5 text-[10px] font-bold text-arctic-700">
              {(stats.commissionPct * 100).toFixed(1)}%
            </span>
          </div>
          <div className="mt-2 text-2xl font-extrabold text-brand-dark">
            {formatMoney(stats.commissionCents, currency)}
          </div>
          <div className="mt-1 text-xs text-arctic-500">
            {tr("Prélevée uniquement sur ventes encaissées", "Charged only on collected sales")}
          </div>
        </div>
      </div>

      {/* FedaPay Sandbox Configuration + Live Sandbox Tester */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Left: API Configuration */}
        <div className="card p-6 lg:col-span-7 space-y-4">
          <div className="flex items-start justify-between gap-3 border-b border-arctic-200 pb-3">
            <div>
              <h2 className="text-base font-bold text-arctic-900 flex items-center gap-2">
                <span>⚡</span> {tr("Configuration API FedaPay (Live / Sandbox)", "FedaPay API Configuration (Live / Sandbox)")}
              </h2>
              <p className="text-xs text-arctic-600 mt-0.5">
                {tr(
                  "Connectez vos clés API FedaPay officielles (`pk_live_...` / `sk_live_...`) enregistrées en base de données MySQL.",
                  "Connect your official FedaPay API keys (`pk_live_...` / `sk_live_...`) stored in your MySQL database.",
                )}
              </p>
            </div>
            <div className="flex rounded-lg border border-arctic-300/60 bg-arctic-100 p-0.5 text-xs font-semibold">
              <button
                type="button"
                onClick={() => switchEnvironment("sandbox")}
                className={`rounded-md px-3 py-1 transition ${
                  fedaConfig.environment === "sandbox"
                    ? "bg-emerald-600 text-white shadow-2xs"
                    : "text-arctic-600 hover:text-arctic-900"
                }`}
              >
                Sandbox
              </button>
              <button
                type="button"
                onClick={() => switchEnvironment("live")}
                className={`rounded-md px-3 py-1 transition ${
                  fedaConfig.environment === "live"
                    ? "bg-slate-900 text-white shadow-2xs"
                    : "text-arctic-600 hover:text-arctic-900"
                }`}
              >
                Live
              </button>
            </div>
          </div>

          <form onSubmit={handleSaveFedaConfig} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label">
                  {fedaConfig.environment === "sandbox"
                    ? tr("Clé Publique Sandbox (pk_sandbox_...)", "Sandbox Public Key (pk_sandbox_...)")
                    : tr("Clé Publique Live (pk_live_...)", "Live Public Key (pk_live_...)")}
                </label>
                <input
                  type="text"
                  className="input font-mono text-xs"
                  placeholder={
                    fedaConfig.environment === "sandbox"
                      ? "pk_sandbox_..."
                      : "pk_live_..."
                  }
                  value={activePublicKey}
                  onChange={(e) => updateActiveKey("publicKey", e.target.value)}
                />
              </div>

              <div>
                <label className="label">
                  {fedaConfig.environment === "sandbox"
                    ? tr("Clé Secrète Sandbox (sk_sandbox_...)", "Sandbox Secret Key (sk_sandbox_...)")
                    : tr("Clé Secrète Live (sk_live_...)", "Live Secret Key (sk_live_...)")}
                </label>
                <input
                  type="password"
                  className="input font-mono text-xs"
                  placeholder={
                    fedaConfig.environment === "sandbox"
                      ? "sk_sandbox_..."
                      : "sk_live_..."
                  }
                  value={activeSecretKey}
                  onChange={(e) => updateActiveKey("secretKey", e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="label">
                {tr("Secret Webhook FedaPay (optionnel)", "FedaPay Webhook Secret (optional)")}
              </label>
              <input
                type="password"
                className="input font-mono text-xs"
                placeholder="wh_sandbox_... / wh_live_..."
                value={fedaConfig.webhookSecret || ""}
                onChange={(e) => setFedaConfig({ ...fedaConfig, webhookSecret: e.target.value })}
              />
            </div>

            {fedaConfig.environment === "sandbox" && (
              <div className="rounded-xl border border-amber-300/70 bg-amber-50/70 p-3 text-xs text-amber-900">
                <strong>🧪 {tr("Mode Test Sandbox actif :", "Sandbox Test Mode active:")}</strong>{" "}
                {activeSecretKey.startsWith("sk_sandbox_")
                  ? tr(
                      "Les paiements utiliseront l'API officielle FedaPay Sandbox (sandbox-api.fedapay.com).",
                      "Payments will use the official FedaPay Sandbox API (sandbox-api.fedapay.com).",
                    )
                  : tr(
                      "Ajoutez vos clés Sandbox FedaPay (sk_sandbox_...) pour tester l'API officielle sandbox-api.fedapay.com, ou laissez vide pour utiliser le guichet Sandbox intégré.",
                      "Add your FedaPay Sandbox keys (sk_sandbox_...) to test the official sandbox-api.fedapay.com API, or leave empty to use the built-in Sandbox checkout.",
                    )}
              </div>
            )}

            <div className="rounded-xl border border-arctic-300/60 bg-arctic-50 p-3 text-xs space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-arctic-800">
                  {tr("URL de Webhook FedaPay (Notifications instantanées) :", "FedaPay Webhook URL (Instant notifications):")}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(webhookUrl);
                    setCopiedWebhook(true);
                    setTimeout(() => setCopiedWebhook(false), 2000);
                  }}
                  className="font-semibold text-brand-dark hover:underline"
                >
                  {copiedWebhook ? tr("✓ Copié !", "✓ Copied!") : tr("📋 Copier", "📋 Copy")}
                </button>
              </div>
              <div className="font-mono text-[11px] text-arctic-600 truncate bg-white px-2.5 py-1.5 rounded border border-arctic-200">
                {webhookUrl}
              </div>
              <p className="text-[11px] text-arctic-500">
                {tr("Intégré sur votre boutique", "Integrated on your store")} <strong>{shopName}</strong>.{" "}
                {tr("Numéro de reversement :", "Payout number:")}{" "}
                <strong>{momoNumber || whatsappNumber || tr("Non renseigné", "Not set")}</strong>.
              </p>
            </div>

            {configMsg && (
              <div
                className={`rounded-lg border px-3 py-2 text-xs font-medium ${
                  configIsError
                    ? "bg-red-50 border-red-200 text-red-800"
                    : "bg-emerald-50 border-emerald-200 text-emerald-900"
                }`}
              >
                {configMsg}
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <span className="text-xs text-arctic-500">
                {tr("Mode actif :", "Active mode:")}{" "}
                <strong className="text-emerald-700 uppercase">{fedaConfig.environment}</strong>
              </span>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={testingConn}
                  onClick={handleTestConnection}
                  className="btn-ghost text-xs border border-arctic-300"
                >
                  {testingConn
                    ? tr("Vérification…", "Testing…")
                    : tr("🔌 Tester l'API FedaPay", "🔌 Test FedaPay API")}
                </button>
                <button type="submit" disabled={savingConfig} className="btn-primary text-xs">
                  {savingConfig
                    ? tr("Enregistrement…", "Saving…")
                    : tr("Enregistrer la configuration FedaPay", "Save FedaPay configuration")}
                </button>
              </div>
            </div>
          </form>
        </div>

        {/* Right: Interactive FedaPay Payment Tester */}
        <div className="card p-6 lg:col-span-5 flex flex-col justify-between bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-950 text-white">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/20 border border-emerald-400/30 px-3 py-1 text-xs font-bold text-emerald-300">
                ⚡ Terminal FedaPay ({fedaConfig.environment === "live" ? "Live API v1" : "Sandbox API v1"})
              </span>
              <span className="text-xs font-mono text-slate-400">API v1</span>
            </div>

            <div>
              <h3 className="text-lg font-bold text-white">
                {tr("Encaissement Direct FedaPay API v1", "Direct FedaPay API v1 Checkout")}
              </h3>
              <p className="text-xs text-slate-300 mt-1">
                {tr(
                  "Créez une transaction réelle sur l'API FedaPay v1 (T-Money, Flooz, MTN MoMo, Carte) enregistrée dans MySQL avec notification WhatsApp Cloud API.",
                  "Create a real transaction on FedaPay API v1 (T-Money, Flooz, MTN MoMo, Card) recorded in MySQL with WhatsApp Cloud API notification.",
                )}
              </p>
            </div>

            <div className="space-y-3 pt-1">
              <div>
                <label className="block text-xs font-semibold text-emerald-200 mb-1">
                  {tr("Montant à encaisser", "Amount to collect")} ({currency})
                </label>
                <input
                  type="text"
                  value={testAmount}
                  onChange={(e) => setTestAmount(e.target.value)}
                  className="w-full rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-sm font-bold text-white placeholder-slate-400 focus:border-emerald-400 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-emerald-200 mb-1">
                  {tr("Motif de la transaction", "Transaction description")}
                </label>
                <input
                  type="text"
                  value={testTitle}
                  onChange={(e) => setTestTitle(e.target.value)}
                  className="w-full rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-xs text-white placeholder-slate-400 focus:border-emerald-400 focus:outline-none"
                />
              </div>
            </div>
          </div>

          <div className="pt-5 space-y-2">
            <button
              type="button"
              disabled={launchingTest}
              onClick={handleLaunchSandboxTest}
              className="w-full rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-sm py-3 px-4 shadow-lg transition disabled:opacity-50"
            >
              {launchingTest
                ? tr("Connexion à l'API FedaPay v1…", "Connecting to FedaPay API v1…")
                : tr("💳 Ouvrir le Guichet FedaPay →", "💳 Open FedaPay Checkout →")}
            </button>
            <p className="text-[11px] text-center text-slate-400">
              {tr(
                "Transaction réelle enregistrée dans MySQL · Confirmation instantanée",
                "Real transaction recorded in MySQL · Instant confirmation",
              )}
            </p>
          </div>
        </div>
      </div>

      {/* Transaction Ledger (PaymentIntent) */}
      <div className="card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-arctic-200 px-6 py-4">
          <div>
            <h2 className="text-base font-bold text-arctic-900">
              {tr(
                "Journal des Transactions (FedaPay & Mobile Money)",
                "Transaction Ledger (FedaPay & Mobile Money)",
              )}
            </h2>
            <p className="text-xs text-arctic-500">
              {tr(
                "Historique en temps réel des paiements du panier boutique, des liens WhatsApp et des tests Sandbox.",
                "Real-time history of storefront cart payments, WhatsApp payment links, and Sandbox tests.",
              )}
            </p>
          </div>
          <span className="rounded-full bg-arctic-100 px-3 py-1 text-xs font-semibold text-arctic-700">
            {transactions.length} {tr("transaction(s)", "transaction(s)")}
          </span>
        </div>

        {transactions.length === 0 ? (
          <div className="p-10 text-center text-arctic-500 space-y-2">
            <div className="text-3xl">💳</div>
            <p className="text-sm font-semibold text-arctic-800">
              {tr("Aucune transaction enregistrée pour le moment", "No transactions recorded yet")}
            </p>
            <p className="text-xs max-w-md mx-auto">
              {tr(
                "Utilisez le terminal FedaPay ci-dessus ou passez une commande sur votre boutique pour voir les transactions apparaître ici.",
                "Use the FedaPay terminal above or place an order on your store to see transactions appear here.",
              )}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-arctic-50 text-arctic-600 uppercase tracking-wider border-b border-arctic-200">
                <tr>
                  <th className="px-5 py-3 font-semibold">{tr("Référence", "Reference")}</th>
                  <th className="px-5 py-3 font-semibold">{tr("Objet / Client", "Title / Customer")}</th>
                  <th className="px-5 py-3 font-semibold">{tr("Moyen (Rail)", "Method (Rail)")}</th>
                  <th className="px-5 py-3 font-semibold">{tr("Montant", "Amount")}</th>
                  <th className="px-5 py-3 font-semibold">{tr("Statut", "Status")}</th>
                  <th className="px-5 py-3 font-semibold">Date</th>
                  <th className="px-5 py-3 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-arctic-200/60">
                {transactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-arctic-50/60">
                    <td className="px-5 py-3.5 font-mono text-[11px] font-semibold text-arctic-800">
                      {tx.providerRef}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="font-semibold text-arctic-900">{tx.title}</div>
                      {tx.customerName && (
                        <div className="text-[11px] text-arctic-500">{tx.customerName}</div>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="inline-flex items-center gap-1 rounded-md bg-arctic-100 px-2 py-0.5 font-semibold text-arctic-800 uppercase text-[10px]">
                        {tx.provider}
                      </span>
                      {tx.wallet && (
                        <span className="ml-1.5 text-[11px] text-arctic-600">{tx.wallet}</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 font-bold text-arctic-900">
                      {formatMoney(tx.amountCents, tx.currency || currency)}
                    </td>
                    <td className="px-5 py-3.5">
                      {tx.status === "succeeded" ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-bold text-emerald-800">
                          {tr("✓ Payé", "✓ Paid")}
                        </span>
                      ) : tx.status === "failed" ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-0.5 text-[11px] font-bold text-red-700">
                          {tr("✕ Échoué", "✕ Failed")}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-bold text-amber-800">
                          {tr("⏳ En attente", "⏳ Pending")}
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-arctic-500">
                      {new Date(tx.createdAt).toLocaleString("fr-FR", {
                        day: "2-digit",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      {tx.status !== "succeeded" && tx.provider === "fedapay" ? (
                        <Link
                          href={`/pay/fedapay-sandbox/${tx.providerRef}`}
                          className="font-semibold text-brand-dark hover:underline"
                        >
                          {tr("Payer (Sandbox) →", "Pay (Sandbox) →")}
                        </Link>
                      ) : tx.orderId ? (
                        <Link
                          href={`/pay/${tx.orderId}`}
                          className="font-medium text-arctic-600 hover:underline"
                        >
                          {tr("Reçu commande ↗", "Order receipt ↗")}
                        </Link>
                      ) : (
                        <span className="text-arctic-400">{tr("Réglé", "Settled")}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Japora Pro Subscription Section */}
      <div className="card p-5 flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-arctic-900">
              {tr("Abonnement Japora Pro", "Japora Pro Subscription")}
            </h2>
            <span
              className={
                "rounded-full px-2.5 py-0.5 text-xs font-semibold " +
                (entitlement.active
                  ? "bg-emerald-100 text-emerald-800"
                  : "bg-amber-100 text-amber-800")
              }
            >
              ● {entitlement.status.replace("_", " ")}
            </span>
          </div>
          <p className="text-xs text-arctic-600">{entitlement.summary}</p>
        </div>

        <button
          type="button"
          disabled={launchingSub}
          onClick={handleSubscribePro}
          className="btn-primary text-xs"
        >
          {launchingSub
            ? tr("Ouverture FedaPay…", "Opening FedaPay…")
            : entitlement.status === "active"
              ? tr("Renouveler via FedaPay Sandbox", "Renew via FedaPay Sandbox")
              : tr("Activer Japora Pro avec FedaPay Sandbox", "Activate Japora Pro with FedaPay Sandbox")}
        </button>
      </div>
    </div>
  );
}

