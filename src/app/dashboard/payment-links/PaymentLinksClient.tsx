"use client";

import React, { useState } from "react";
import Link from "next/link";
import { formatMoney } from "@/lib/utils";

export interface PaymentLinkItem {
  id: string;
  amountCents: number;
  currency: string;
  description: string;
  isPaid: boolean;
  paidAt: string | null;
  expiresAt: string | null;
  createdAt: string;
}

interface PaymentLinksClientProps {
  initialLinks: PaymentLinkItem[];
  currency: string;
  shopName: string;
}

export default function PaymentLinksClient({
  initialLinks,
  currency,
  shopName,
}: PaymentLinksClientProps) {
  const [links, setLinks] = useState<PaymentLinkItem[]>(initialLinks);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [filter, setFilter] = useState<"all" | "pending" | "paid">("all");

  // Create Form states
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [expiresInDays, setExpiresInDays] = useState("7");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");

  // WhatsApp Cloud API modal state
  const [waModalLink, setWaModalLink] = useState<PaymentLinkItem | null>(null);
  const [waPhone, setWaPhone] = useState("");
  const [waName, setWaName] = useState("");
  const [waSending, setWaSending] = useState(false);

  // Notification states
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const totalCollectedCents = links
    .filter((l) => l.isPaid)
    .reduce((sum, l) => sum + l.amountCents, 0);

  const pendingCents = links
    .filter((l) => !l.isPaid)
    .reduce((sum, l) => sum + l.amountCents, 0);

  const filteredLinks = links.filter((l) => {
    if (filter === "paid") return l.isPaid;
    if (filter === "pending") return !l.isPaid;
    return true;
  });

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 4000);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const numAmount = parseFloat(amount.replace(/\s+/g, "").replace(",", "."));
    if (isNaN(numAmount) || numAmount <= 0) {
      setError("Veuillez saisir un montant valide supérieur à 0.");
      return;
    }

    setCreating(true);

    try {
      let expiresAt: string | null = null;
      if (expiresInDays !== "never") {
        const days = parseInt(expiresInDays, 10) || 7;
        const d = new Date();
        d.setDate(d.getDate() + days);
        expiresAt = d.toISOString();
      }

      // All Japora amounts are stored in cents (major * 100) for all currencies
      const res = await fetch("/api/payment-links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amountCents: Math.round(numAmount * 100),
          description: description.trim(),
          currency,
          expiresAt,
          customerName: customerName.trim() || undefined,
          customerPhone: customerPhone.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Erreur lors de la création.");
      } else {
        setLinks([data.link, ...links]);
        setShowCreateModal(false);
        setAmount("");
        setDescription("");
        setCustomerName("");
        setCustomerPhone("");
        if (data.whatsappSent) {
          showToast("✓ Lien créé et envoyé au client via WhatsApp Cloud API !");
        } else {
          showToast("✓ Lien de paiement FedaPay créé avec succès !");
        }
      }
    } catch {
      setError("Erreur réseau. Veuillez réessayer.");
    } finally {
      setCreating(false);
    }
  }

  async function handleSendCloudWhatsApp(e: React.FormEvent) {
    e.preventDefault();
    if (!waModalLink || !waPhone.trim()) return;
    setWaSending(true);
    try {
      const res = await fetch(`/api/payment-links/${waModalLink.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "send_whatsapp",
          customerPhone: waPhone.trim(),
          customerName: waName.trim(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      setWaSending(false);
      if (res.ok) {
        setWaModalLink(null);
        setWaPhone("");
        setWaName("");
        showToast(
          `✓ Lien envoyé sur WhatsApp (${waPhone.trim()}) via ${data.provider === "cloud-api" ? "Meta Cloud API" : "WhatsApp Bot"} !`,
        );
      } else {
        alert(data.error || "Erreur lors de l'envoi WhatsApp.");
      }
    } catch {
      setWaSending(false);
      alert("Erreur réseau lors de l'envoi WhatsApp.");
    }
  }

  async function togglePaid(id: string, currentPaid: boolean) {
    try {
      const res = await fetch(`/api/payment-links/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPaid: !currentPaid }),
      });
      if (res.ok) {
        const data = await res.json();
        setLinks(links.map((l) => (l.id === id ? data.link : l)));
      }
    } catch {
      // ignore
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Voulez-vous vraiment supprimer ce lien de paiement ?")) return;
    try {
      const res = await fetch(`/api/payment-links/${id}`, { method: "DELETE" });
      if (res.ok) {
        setLinks(links.filter((l) => l.id !== id));
      }
    } catch {
      // ignore
    }
  }

  function getLinkUrl(id: string) {
    if (typeof window !== "undefined") {
      return `${window.location.origin}/pay/link/${id}`;
    }
    return `/pay/link/${id}`;
  }

  async function copyLink(id: string) {
    const url = getLinkUrl(id);
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // fallback
    }
  }

  function getWaShareUrl(l: PaymentLinkItem) {
    const url = getLinkUrl(l.id);
    const text = `Bonjour ! Voici le lien sécurisé FedaPay pour régler ${formatMoney(
      l.amountCents,
      l.currency || currency,
    )}${l.description ? ` (${l.description})` : ""} pour ${shopName} :\n👉 ${url}`;
    return `https://wa.me/?text=${encodeURIComponent(text)}`;
  }

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            Liens de Paiement × FedaPay
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Générez des liens de paiement instantanés avec FedaPay (T-Money, Flooz, Mobile Money & Carte) et envoyez-les directement via WhatsApp Cloud API.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Link
            href="/dashboard/billing"
            className="btn-ghost text-xs px-3 py-2.5 rounded-xl"
          >
            ⚙️ Config FedaPay Money
          </Link>
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="btn-primary flex items-center gap-2 text-sm px-4 py-2.5 rounded-xl shadow-md"
          >
            <span>➕</span>
            <span>Créer un lien de paiement</span>
          </button>
        </div>
      </div>

      {toast && (
        <div className="rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-xs font-semibold text-emerald-900 shadow-sm">
          {toast}
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <span className="text-xs uppercase tracking-wider text-slate-400 font-semibold">
            Total Encaissé
          </span>
          <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
            {formatMoney(totalCollectedCents, currency)}
          </div>
          <span className="text-xs text-slate-400 mt-1 block">
            {links.filter((l) => l.isPaid).length} paiement(s) confirmé(s)
          </span>
        </div>

        <div className="card p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <span className="text-xs uppercase tracking-wider text-slate-400 font-semibold">
            En Attente
          </span>
          <div className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1">
            {formatMoney(pendingCents, currency)}
          </div>
          <span className="text-xs text-slate-400 mt-1 block">
            {links.filter((l) => !l.isPaid).length} lien(s) non réglé(s)
          </span>
        </div>

        <div className="card p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <span className="text-xs uppercase tracking-wider text-slate-400 font-semibold">
            Total Liens Générés
          </span>
          <div className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
            {links.length}
          </div>
          <span className="text-xs text-slate-400 mt-1 block">
            FedaPay Sandbox & WhatsApp Cloud API
          </span>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
        {(["all", "pending", "paid"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-colors ${
              filter === f
                ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            }`}
          >
            {f === "all" ? "Tous les liens" : f === "pending" ? "En attente" : "Payés"}
          </button>
        ))}
      </div>

      {/* Links List */}
      {filteredLinks.length === 0 ? (
        <div className="card p-12 text-center rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <span className="text-4xl">🔗</span>
          <h3 className="text-base font-bold text-slate-800 dark:text-slate-200 mt-2">
            Aucun lien de paiement trouvé
          </h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
            Générez un lien direct pour demander un acompte ou faire payer un client à distance via FedaPay (T-Money, Flooz, Mobile Money).
          </p>
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="btn-primary mt-4 text-xs px-4 py-2"
          >
            Créer mon premier lien
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {filteredLinks.map((l) => {
            const isExpired = l.expiresAt ? new Date(l.expiresAt).getTime() < Date.now() : false;
            return (
              <div
                key={l.id}
                className="card p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:border-slate-300 dark:hover:border-slate-700 transition-colors"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-extrabold text-slate-900 dark:text-white">
                      {formatMoney(l.amountCents, l.currency || currency)}
                    </span>
                    {l.isPaid ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300">
                        ✓ Payé
                      </span>
                    ) : isExpired ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300">
                        Expiré
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300">
                        En attente
                      </span>
                    )}
                  </div>

                  {l.description ? (
                    <p className="text-xs text-slate-700 dark:text-slate-300 font-medium">
                      {l.description}
                    </p>
                  ) : (
                    <p className="text-xs text-slate-400 italic">Sans description</p>
                  )}

                  <div className="text-[11px] text-slate-400 flex items-center gap-3">
                    <span>Créé le {new Date(l.createdAt).toLocaleDateString()}</span>
                    {l.paidAt && (
                      <span>• Réglé le {new Date(l.paidAt).toLocaleDateString()}</span>
                    )}
                    {l.expiresAt && !l.isPaid && (
                      <span>• Expire le {new Date(l.expiresAt).toLocaleDateString()}</span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center flex-wrap gap-2 pt-2 md:pt-0 border-t md:border-t-0 border-slate-100 dark:border-slate-800">
                  <Link
                    href={`/pay/link/${l.id}`}
                    target="_blank"
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-brand-light/40 text-brand-dark hover:bg-brand-light transition-colors"
                  >
                    💳 Ouvrir & Payer ↗
                  </Link>

                  <button
                    type="button"
                    onClick={() => copyLink(l.id)}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-800 dark:text-slate-200 transition-colors"
                  >
                    {copiedId === l.id ? "✓ Copié !" : "📋 Copier"}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setWaModalLink(l);
                      setWaPhone("");
                      setWaName("");
                    }}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700 flex items-center gap-1 transition-colors"
                    title="Envoyer directement au numéro du client via Meta WhatsApp Cloud API"
                  >
                    <span>📲</span>
                    <span>Cloud API WhatsApp</span>
                  </button>

                  <a
                    href={getWaShareUrl(l)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 text-emerald-700 dark:text-emerald-300 flex items-center gap-1 transition-colors"
                  >
                    <span>💬</span>
                    <span>Partager</span>
                  </a>

                  <button
                    type="button"
                    onClick={() => togglePaid(l.id, l.isPaid)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      l.isPaid
                        ? "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 hover:bg-amber-100"
                        : "bg-slate-900 text-white hover:bg-slate-800"
                    }`}
                  >
                    {l.isPaid ? "Marquer impayé" : "Marquer payé"}
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDelete(l.id)}
                    className="p-1.5 text-xs text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors"
                    title="Supprimer"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Nouveau Lien de Paiement (FedaPay)
              </h2>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-slate-600 text-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Montant ({currency}) *
                </label>
                <input
                  type="text"
                  required
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder={currency === "XOF" ? "Ex: 10000" : "Ex: 25.00"}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Description / Motif *
                </label>
                <input
                  type="text"
                  required
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Ex: Acompte commande robe de soirée"
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-3 space-y-3">
                <div className="text-xs font-bold text-emerald-900">
                  📲 Envoi direct par WhatsApp Cloud API (Optionnel)
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <input
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Nom du client"
                    className="w-full px-3 py-1.5 text-xs rounded-lg border border-emerald-300 bg-white text-slate-900 focus:outline-none"
                  />
                  <input
                    type="tel"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="Ex: +22890123456"
                    className="w-full px-3 py-1.5 text-xs font-mono rounded-lg border border-emerald-300 bg-white text-slate-900 focus:outline-none"
                  />
                </div>
                <p className="text-[11px] text-emerald-700">
                  Si renseigné, Japora envoie automatiquement le lien de paiement FedaPay sur le WhatsApp du client dès la création.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Validité du lien
                </label>
                <select
                  value={expiresInDays}
                  onChange={(e) => setExpiresInDays(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                >
                  <option value="1">24 heures</option>
                  <option value="3">3 jours</option>
                  <option value="7">7 jours</option>
                  <option value="30">30 jours</option>
                  <option value="never">Sans expiration</option>
                </select>
              </div>

              {error && (
                <p className="text-xs text-rose-600 dark:text-rose-400">{error}</p>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="btn-primary text-xs px-4 py-2 rounded-xl"
                >
                  {creating ? "Génération..." : "Créer le lien"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Send via WhatsApp Cloud API Modal */}
      {waModalLink && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">
                📲 Envoyer via WhatsApp Cloud API
              </h3>
              <button
                type="button"
                onClick={() => setWaModalLink(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>
            <p className="text-xs text-slate-600">
              Envoyer le lien de paiement de{" "}
              <strong>{formatMoney(waModalLink.amountCents, waModalLink.currency || currency)}</strong>{" "}
              directement sur le WhatsApp de votre client via l&apos;API WhatsApp Cloud de Japora.
            </p>
            <form onSubmit={handleSendCloudWhatsApp} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nom du client (optionnel)
                </label>
                <input
                  type="text"
                  className="input text-sm"
                  placeholder="Ex: Kossi Mensah"
                  value={waName}
                  onChange={(e) => setWaName(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Numéro WhatsApp du client *
                </label>
                <input
                  type="tel"
                  required
                  className="input text-sm font-mono"
                  placeholder="Ex: +22890123456"
                  value={waPhone}
                  onChange={(e) => setWaPhone(e.target.value)}
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setWaModalLink(null)}
                  className="btn-ghost text-xs"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={waSending}
                  className="btn-primary text-xs"
                >
                  {waSending ? "Envoi en cours…" : "Envoyer maintenant"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
