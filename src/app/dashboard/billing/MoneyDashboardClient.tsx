"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatMoney } from "@/lib/utils";

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
  const router = useRouter();
  const [fedaConfig, setFedaConfig] = useState<FedaPayConfigState>(initialFedaConfig);
  const [savingConfig, setSavingConfig] = useState(false);
  const [configMsg, setConfigMsg] = useState("");

  // Sandbox Test Payment State
  const [testAmount, setTestAmount] = useState(
    currency === "XOF" || currency === "XAF" ? "2500" : "15",
  );
  const [testTitle, setTestTitle] = useState("Test Encaissement FedaPay Sandbox");
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

    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fedapayConfig: fedaConfig,
        }),
      });
      const data = await res.json().catch(() => ({}));
      setSavingConfig(false);
      if (res.ok) {
        setConfigMsg("✓ Configuration API FedaPay enregistrée avec succès !");
        router.refresh();
      } else {
        setConfigMsg(`⚠️ ${data.error || "Erreur lors de la sauvegarde."}`);
      }
    } catch {
      setSavingConfig(false);
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
              ● {fedaConfig.environment === "live" ? "FedaPay Live" : "FedaPay Sandbox Actif"}
            </span>
          </div>
          <p className="text-sm text-arctic-600 mt-1">
            Gérez vos encaissements Mobile Money & Carte via FedaPay, vos liens de paiement WhatsApp Cloud API et votre portefeuille marchand.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link href="/dashboard/payment-links" className="btn-ghost text-xs">
            🔗 Liens de paiement WhatsApp
          </Link>
          <Link href="/dashboard/receivables" className="btn-ghost text-xs">
            📒 Créances & Relances
          </Link>
          <Link href={`/c/${shopSlug}`} target="_blank" className="btn-primary text-xs">
            🛍️ Tester le panier boutique ↗
          </Link>
        </div>
      </div>

      {/* Status banners after checkout redirect */}
      {queryStatus?.ok === "1" && (
        <div className="rounded-2xl border border-emerald-300 bg-emerald-50 px-5 py-4 text-sm text-emerald-950 flex items-center justify-between gap-3 shadow-sm">
          <div>
            <strong className="font-bold">✅ Paiement FedaPay Sandbox confirmé !</strong>
            <p className="text-xs text-emerald-800 mt-0.5">
              La transaction {queryStatus.ref ? `(${queryStatus.ref})` : ""} a été réglée et ajoutée à votre journal financier.
            </p>
          </div>
          <Link href="/dashboard/billing" className="text-xs font-semibold text-emerald-900 underline">
            Fermer
          </Link>
        </div>
      )}

      {queryStatus?.canceled === "1" && (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 px-5 py-3.5 text-sm text-amber-900">
          ⚠️ La transaction de test a été annulée ou refusée en mode Sandbox.
        </div>
      )}

      {/* Financial KPIs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="card p-5 border-l-4 border-l-emerald-500">
          <div className="text-xs font-semibold uppercase tracking-wider text-arctic-500">
            Total Encaissé
          </div>
          <div className="mt-2 text-2xl font-extrabold text-emerald-700">
            {formatMoney(stats.totalCollectedCents, currency)}
          </div>
          <div className="mt-1 text-xs text-arctic-500">
            {stats.paidOrdersCount} commande(s) + {stats.paidLinksCount} lien(s) payé(s)
          </div>
        </div>

        <div className="card p-5 border-l-4 border-l-amber-500">
          <div className="text-xs font-semibold uppercase tracking-wider text-arctic-500">
            En Attente d&apos;Encaissement
          </div>
          <div className="mt-2 text-2xl font-extrabold text-amber-700">
            {formatMoney(stats.pendingCents, currency)}
          </div>
          <div className="mt-1 text-xs text-arctic-500">
            Commandes & liens non réglés
          </div>
        </div>

        <div className="card p-5 border-l-4 border-l-brand">
          <div className="text-xs font-semibold uppercase tracking-wider text-arctic-500">
            Transactions FedaPay
          </div>
          <div className="mt-2 text-2xl font-extrabold text-arctic-900">
            {stats.fedaSuccessCount} réussie{stats.fedaSuccessCount > 1 ? "s" : ""}
          </div>
          <div className="mt-1 text-xs text-arctic-500">
            T-Money, Flooz, MoMo & Carte
          </div>
        </div>

        <div className="card p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-arctic-500">
              Commission ce mois
            </span>
            <span className="rounded-full bg-arctic-200/70 px-2 py-0.5 text-[10px] font-bold text-arctic-700">
              {(stats.commissionPct * 100).toFixed(1)}%
            </span>
          </div>
          <div className="mt-2 text-2xl font-extrabold text-brand-dark">
            {formatMoney(stats.commissionCents, currency)}
          </div>
          <div className="mt-1 text-xs text-arctic-500">
            Prélevée uniquement sur ventes encaissées
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
                <span>⚡</span> Configuration API FedaPay (Sandbox / Live)
              </h2>
              <p className="text-xs text-arctic-600 mt-0.5">
                Connectez vos clés API FedaPay ou utilisez directement le simulateur Sandbox intégré pour vos tests de bout en bout.
              </p>
            </div>
            <div className="flex rounded-lg border border-arctic-300/60 bg-arctic-100 p-0.5 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setFedaConfig({ ...fedaConfig, environment: "sandbox" })}
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
                onClick={() => setFedaConfig({ ...fedaConfig, environment: "live" })}
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
                <label className="label">Clé Publique FedaPay (Public Key)</label>
                <input
                  type="text"
                  className="input font-mono text-xs"
                  placeholder={
                    fedaConfig.environment === "sandbox"
                      ? "pk_sandbox_..."
                      : "pk_live_..."
                  }
                  value={fedaConfig.publicKey}
                  onChange={(e) => setFedaConfig({ ...fedaConfig, publicKey: e.target.value })}
                />
              </div>

              <div>
                <label className="label">Clé Secrète FedaPay (Secret Key)</label>
                <input
                  type="password"
                  className="input font-mono text-xs"
                  placeholder={
                    fedaConfig.environment === "sandbox"
                      ? "sk_sandbox_... (optionnel en démo)"
                      : "sk_live_..."
                  }
                  value={fedaConfig.secretKey}
                  onChange={(e) => setFedaConfig({ ...fedaConfig, secretKey: e.target.value })}
                />
              </div>
            </div>

            <div className="rounded-xl border border-arctic-300/60 bg-arctic-50 p-3 text-xs space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-arctic-800">
                  URL de Webhook FedaPay (Notifications instantanées) :
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
                  {copiedWebhook ? "✓ Copié !" : "📋 Copier"}
                </button>
              </div>
              <div className="font-mono text-[11px] text-arctic-600 truncate bg-white px-2.5 py-1.5 rounded border border-arctic-200">
                {webhookUrl}
              </div>
              <p className="text-[11px] text-arctic-500">
                Intégré sur votre boutique <strong>{shopName}</strong> (panier, validation de commande et liens de paiement WhatsApp). Numéro de reversement :{" "}
                <strong>{momoNumber || whatsappNumber || "Non renseigné"}</strong>.
              </p>
            </div>

            {configMsg && (
              <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2 text-xs font-medium text-emerald-900">
                {configMsg}
              </div>
            )}

            <div className="flex items-center justify-between pt-1">
              <span className="text-xs text-arctic-500">
                Mode actif :{" "}
                <strong className="text-emerald-700 uppercase">{fedaConfig.environment}</strong>
              </span>
              <button type="submit" disabled={savingConfig} className="btn-primary text-xs">
                {savingConfig ? "Enregistrement…" : "Enregistrer la configuration FedaPay"}
              </button>
            </div>
          </form>
        </div>

        {/* Right: Interactive Sandbox Payment Tester */}
        <div className="card p-6 lg:col-span-5 flex flex-col justify-between bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-950 text-white">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/20 border border-emerald-400/30 px-3 py-1 text-xs font-bold text-emerald-300">
                🧪 Simulateur FedaPay Sandbox
              </span>
              <span className="text-xs font-mono text-slate-400">API v1</span>
            </div>

            <div>
              <h3 className="text-lg font-bold text-white">
                Tester un encaissement maintenant
              </h3>
              <p className="text-xs text-slate-300 mt-1">
                Lancez une transaction de test pour vérifier le tunnel complet FedaPay (T-Money, Flooz, MTN MoMo, Carte) et la réception de notification WhatsApp Cloud API.
              </p>
            </div>

            <div className="space-y-3 pt-1">
              <div>
                <label className="block text-xs font-semibold text-emerald-200 mb-1">
                  Montant du test ({currency})
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
                  Motif de la transaction
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
                ? "Ouverture de FedaPay Sandbox…"
                : "💳 Lancer le paiement test FedaPay →"}
            </button>
            <p className="text-[11px] text-center text-slate-400">
              Aucun débit réel en mode Sandbox · Confirmation instantanée
            </p>
          </div>
        </div>
      </div>

      {/* Transaction Ledger (PaymentIntent) */}
      <div className="card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-arctic-200 px-6 py-4">
          <div>
            <h2 className="text-base font-bold text-arctic-900">
              Journal des Transactions (FedaPay & Mobile Money)
            </h2>
            <p className="text-xs text-arctic-500">
              Historique en temps réel des paiements du panier boutique, des liens WhatsApp et des tests Sandbox.
            </p>
          </div>
          <span className="rounded-full bg-arctic-100 px-3 py-1 text-xs font-semibold text-arctic-700">
            {transactions.length} transaction{transactions.length > 1 ? "s" : ""}
          </span>
        </div>

        {transactions.length === 0 ? (
          <div className="p-10 text-center text-arctic-500 space-y-2">
            <div className="text-3xl">💳</div>
            <p className="text-sm font-semibold text-arctic-800">
              Aucune transaction enregistrée pour le moment
            </p>
            <p className="text-xs max-w-md mx-auto">
              Utilisez le bouton &laquo; Lancer le paiement test FedaPay &raquo; ci-dessus ou passez une commande sur votre boutique pour voir les transactions apparaître ici.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-arctic-50 text-arctic-600 uppercase tracking-wider border-b border-arctic-200">
                <tr>
                  <th className="px-5 py-3 font-semibold">Référence</th>
                  <th className="px-5 py-3 font-semibold">Objet / Client</th>
                  <th className="px-5 py-3 font-semibold">Moyen (Rail)</th>
                  <th className="px-5 py-3 font-semibold">Montant</th>
                  <th className="px-5 py-3 font-semibold">Statut</th>
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
                          ✓ Payé
                        </span>
                      ) : tx.status === "failed" ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-0.5 text-[11px] font-bold text-red-700">
                          ✕ Échoué
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-bold text-amber-800">
                          ⏳ En attente
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
                          Payer (Sandbox) →
                        </Link>
                      ) : tx.orderId ? (
                        <Link
                          href={`/pay/${tx.orderId}`}
                          className="font-medium text-arctic-600 hover:underline"
                        >
                          Reçu commande ↗
                        </Link>
                      ) : (
                        <span className="text-arctic-400">Réglé</span>
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
            <h2 className="text-sm font-bold text-arctic-900">Abonnement Japora Pro</h2>
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
            ? "Ouverture FedaPay…"
            : entitlement.status === "active"
              ? "Renouveler via FedaPay Sandbox"
              : "Activer Japora Pro avec FedaPay Sandbox"}
        </button>
      </div>
    </div>
  );
}

