"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { formatMoney } from "@/lib/utils";
import { AuroraIsoscout } from "@/components/aurora";
import {
  MetaIcon,
  TikTokIcon,
  LinkedInIcon,
  SparklesIcon,
  RocketIcon,
} from "@/components/Icons";

type Campaign = {
  id: string;
  name: string;
  refCode: string;
  productId: string | null;
  headline: string;
  body: string;
  cta: string;
  status: string;
  clicks: number;
  orders: number;
  revenueCents: number;
  spendCents: number;
  cvr: number;
  roas: number | null;
  createdAt: string;
};

type ApprovalPreview = {
  campaignId: string;
  sessionId: string | null;
  productId: string | null;
  productName: string | null;
  customerId: string | null;
  recipientName: string | null;
  phone: string;
  marketingConsent: boolean | null;
  marketingConsentRevokedAt: string | null;
  renderedBody: string;
  approvalRequired: boolean;
  alreadyApproved: boolean;
  status: string;
};

function humanizeStatus(status?: string | null) {
  switch (status) {
    case "draft": return "Draft";
    case "approved": return "Approved";
    case "sending": return "Sending";
    case "sent": return "Sent";
    case "stubbed": return "Stubbed (test only)";
    case "blocked": return "Blocked";
    case "failed": return "Failed";
    case "archived": return "Archived";
    default: return status || "Draft";
  }
}

type Product = { id: string; name: string; priceCents: number };

type PlatformKey = "meta" | "tiktok" | "linkedin";

type FormState = {
  name: string;
  platform: PlatformKey;
  productId: string;
  headline: string;
  body: string;
  cta: string;
  spend: string;
  targetRegion: string;
};

const EMPTY: FormState = {
  name: "",
  platform: "meta",
  productId: "",
  headline: "",
  body: "",
  cta: "Commander sur WhatsApp",
  spend: "10000",
  targetRegion: "Togo & Bénin",
};

function NetworkIcon({ platform }: { platform: PlatformKey }) {
  switch (platform) {
    case "meta":
      return <MetaIcon size={18} className="text-[#0866FF]" />;
    case "tiktok":
      return <TikTokIcon size={18} className="text-[#000000] dark:text-white" />;
    case "linkedin":
      return <LinkedInIcon size={18} className="text-[#0A66C2]" />;
  }
}

const NETWORKS: Array<{ key: PlatformKey; label: string; color: string; desc: string }> = [
  { key: "meta", label: "Meta Ads (Facebook & Instagram)", color: "border-blue-500 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300", desc: "Campagnes Click-to-WhatsApp (CTWA) & Feed IG/FB" },
  { key: "tiktok", label: "TikTok For Business", color: "border-pink-500 bg-pink-50 dark:bg-pink-950/40 text-pink-700 dark:text-pink-300", desc: "Vidéos In-Feed & Spark Ads pour toucher les acheteurs mobiles" },
  { key: "linkedin", label: "LinkedIn Marketing", color: "border-indigo-500 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300", desc: "Contenu sponsorisé & opportunités grossistes / B2B" },
];

export default function CampaignsClient({
  initialCampaigns,
  products,
  currency,
}: {
  initialCampaigns: Campaign[];
  products: Product[];
  currency: string;
}) {
  const router = useRouter();
  const [campaigns, setCampaigns] = useState<Campaign[]>(initialCampaigns);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [generatingCopy, setGeneratingCopy] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const [approvalModal, setApprovalModal] = useState<{ campaign: Campaign; preview: ApprovalPreview | null } | null>(null);
  const [approvalBusy, setApprovalBusy] = useState(false);

  const flash = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  async function generateAiCopy() {
    setGeneratingCopy(true);
    setError("");
    try {
      const prod = products.find((p) => p.id === form.productId);
      const res = await fetch("/api/ai/ad-copy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platform: form.platform,
          productName: prod?.name || "",
          productPrice: prod ? formatMoney(prod.priceCents, currency) : "",
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setForm((prev) => ({
          ...prev,
          name: prev.name || `Campagne ${form.platform.toUpperCase()} - ${prod?.name || "Boutique"}`,
          headline: data.headline || prev.headline,
          body: data.body ? `${data.body} ${data.hashtags || ""}` : prev.body,
          cta: data.cta || prev.cta,
        }));
        flash(`Texte publicitaire généré avec Gemini pour ${form.platform.toUpperCase()} ✓`);
      }
    } catch {
      setError("Échec de génération IA");
    } finally {
      setGeneratingCopy(false);
    }
  }

  const base = typeof window !== "undefined" ? window.location.origin : "";

  async function reload() {
    const res = await fetch("/api/campaigns");
    if (res.ok) setCampaigns((await res.json()).campaigns);
    router.refresh();
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    const res = await fetch("/api/campaigns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      setError(data.error || "Could not create campaign.");
      return;
    }
    setOpen(false);
    setForm(EMPTY);
    await reload();
  }

  async function remove(c: Campaign) {
    if (!confirm(`Archive "${c.name}"? Its link stops attributing new orders.`)) return;
    const res = await fetch(`/api/campaigns/${c.id}`, { method: "DELETE" });
    if (res.ok) await reload();
  }

  async function openApproval(c: Campaign) {
    const res = await fetch(`/api/campaigns/${c.id}/approve`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error || "Unable to load approval preview.");
      return;
    }
    setError("");
    setApprovalModal({ campaign: c, preview: data.preview });
  }

  async function submitApproval(action: "approve" | "approve_and_send" | "reject") {
    if (!approvalModal) return;
    setApprovalBusy(true);
    setError("");
    const res = await fetch(`/api/campaigns/${approvalModal.campaign.id}/approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action,
        recipientPhone: approvalModal.preview?.phone,
        body: approvalModal.preview?.renderedBody,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setApprovalBusy(false);
    if (!res.ok) {
      setError(data.error || "Could not update the campaign approval.");
      return;
    }
    setApprovalModal(null);
    await reload();
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="a-headline-md text-arctic-900">Ads &amp; campaigns</h1>
          <p className="text-sm text-arctic-600">
            One trackable link per campaign. Run it as a Click-to-WhatsApp ad, a Status post, or a
            flyer QR — every click and order traces back here.
          </p>
        </div>
        <button onClick={() => { setForm(EMPTY); setError(""); setOpen(true); }} className="btn-primary shrink-0">
          + New campaign
        </button>
      </div>

      {campaigns.length === 0 ? (
        <div className="glass glass-edge rounded-shape-lg p-6">
          <AuroraIsoscout
            variant="broadcasts"
            title="No campaign yet"
            body="Eligible abandoned-cart recovery candidates appear here after a shopper leaves a cart stale for long enough to qualify. The dashboard only lists persisted campaigns for the logged-in vendor, and no recovery campaign is created for carts that do not meet the existing eligibility rules."
            action={
              <button onClick={() => { setForm(EMPTY); setOpen(true); }} className="btn-primary">
                + New campaign
              </button>
            }
          />
        </div>
      ) : (
        <div className="space-y-4">
          {campaigns.map((c) => (
            <CampaignCard
              key={c.id}
              c={c}
              currency={currency}
              base={base}
              onDelete={() => remove(c)}
              onReview={() => openApproval(c)}
            />
          ))}
        </div>
      )}

      {approvalModal && (
        <div className="fixed inset-0 z-30 grid place-items-center bg-arctic-900/40 p-4">
          <div className="card w-full max-w-2xl overflow-hidden">
            <div className="flex items-center justify-between border-b border-arctic-400/30 px-5 py-3">
              <h2 className="font-bold text-arctic-900">Review recovery approval</h2>
              <button onClick={() => setApprovalModal(null)} className="text-arctic-500 hover:text-arctic-800">✕</button>
            </div>
            <div className="space-y-4 p-5">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg bg-arctic-100/55 p-3">
                  <div className="a-label-md text-arctic-500">Campaign</div>
                  <div className="font-semibold text-arctic-900">{approvalModal.campaign.name}</div>
                </div>
                <div className="rounded-lg bg-arctic-100/55 p-3">
                  <div className="a-label-md text-arctic-500">Status</div>
                  <div className="font-semibold text-arctic-900">{humanizeStatus(approvalModal.campaign.status)}</div>
                </div>
              </div>

              <div className="rounded-lg bg-arctic-100/55 p-3">
                <div className="a-label-md text-arctic-500">Recipient</div>
                <div className="font-semibold text-arctic-900">
                  {approvalModal.preview?.recipientName || "Customer"} — {approvalModal.preview?.phone || "Unknown phone"}
                </div>
              </div>

              <div className="rounded-lg bg-arctic-100/55 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="a-label-md text-arctic-500">Exact WhatsApp message</div>
                  <CopyButton text={approvalModal.preview?.renderedBody || ""} label="Copy message" />
                </div>
                <pre className="mt-2 whitespace-pre-wrap break-words text-sm text-arctic-700">{approvalModal.preview?.renderedBody || "No message available."}</pre>
              </div>

              <div className="rounded-lg border border-arctic-400/30 bg-white/60 p-3 text-sm text-arctic-600">
                {approvalModal.preview?.marketingConsent === false ? "Consent is not active for this recipient." : "Consent is present for the recipient."}
              </div>

              {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

              <div className="flex flex-col-reverse justify-end gap-2 pt-1 sm:flex-row">
                <button type="button" onClick={() => setApprovalModal(null)} className="btn-ghost">Close</button>
                <button type="button" onClick={() => submitApproval("reject")} disabled={approvalBusy} className="btn-ghost">Reject</button>
                <button type="button" onClick={() => submitApproval("approve")} disabled={approvalBusy} className="btn-primary">Approve</button>
                <button type="button" onClick={() => submitApproval("approve_and_send")} disabled={approvalBusy} className="btn-primary">Approve &amp; send</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed top-5 right-5 z-50 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white shadow-xl animate-bounce">
          {toast}
        </div>
      )}

      {open && (
        <div className="fixed inset-0 z-30 grid place-items-center bg-arctic-900/50 p-4 backdrop-blur-sm">
          <div className="card w-full max-w-2xl overflow-hidden shadow-2xl border border-arctic-200">
            <div className="flex items-center justify-between border-b border-arctic-200 px-6 py-4 bg-arctic-50/50">
              <div>
                <h2 className="font-bold text-lg text-arctic-900">Nouvelle Campagne Publicitaire Multi-Réseaux</h2>
                <p className="text-xs text-arctic-500">Diffusez sur Meta (Facebook/Instagram), TikTok Ads et LinkedIn</p>
              </div>
              <button onClick={() => setOpen(false)} className="text-arctic-500 hover:text-arctic-800 text-lg">✕</button>
            </div>

            <form onSubmit={create} className="max-h-[80vh] space-y-4 overflow-y-auto p-6">
              {/* Network Selector */}
              <div>
                <label className="label mb-2">Canal publicitaire cible</label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {NETWORKS.map((net) => {
                    const isSelected = form.platform === net.key;
                    return (
                      <button
                        key={net.key}
                        type="button"
                        onClick={() => setForm((prev) => ({ ...prev, platform: net.key }))}
                        className={`text-left p-3 rounded-xl border-2 transition-all ${
                          isSelected
                            ? net.color + " ring-2 ring-emerald-500/30 font-semibold"
                            : "border-arctic-200 hover:border-arctic-300 bg-white"
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <NetworkIcon platform={net.key} />
                          <span className="text-xs font-bold">{net.label.split(" ")[0]}</span>
                        </div>
                        <p className="text-[11px] leading-tight text-arctic-600 line-clamp-2">
                          {net.desc}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Product and AI Assist */}
              <div className="p-3.5 rounded-xl bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-sky-500/10 border border-emerald-500/20">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-2">
                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider text-emerald-800">
                      1. Produit vedette du catalogue
                    </label>
                    <p className="text-xs text-emerald-600">Sélectionnez le produit pour extraire les visuels et prix réels</p>
                  </div>
                  <button
                    type="button"
                    onClick={generateAiCopy}
                    disabled={generatingCopy}
                    className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-sm transition-all disabled:opacity-50"
                  >
                    <SparklesIcon size={14} />
                    <span>{generatingCopy ? "Génération…" : "Rédiger avec Gemini IA"}</span>
                  </button>
                </div>
                <select
                  className="input bg-white text-sm"
                  value={form.productId}
                  onChange={(e) => setForm({ ...form, productId: e.target.value })}
                >
                  <option value="">— Tous les produits ou Boutique générale —</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({formatMoney(p.priceCents, currency)})
                    </option>
                  ))}
                </select>
              </div>

              {/* Campaign Details */}
              <div>
                <label className="label">Nom interne de la campagne</label>
                <input
                  className="input"
                  placeholder="Ex: Promo Ankara Tabaski - TikTok"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                />
              </div>

              <div>
                <label className="label">Titre accrocheur (Headline)</label>
                <input
                  className="input"
                  placeholder="Ex: -20% sur la nouvelle collection Wax à Lomé !"
                  value={form.headline}
                  onChange={(e) => setForm({ ...form, headline: e.target.value })}
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="label mb-0">Texte publicitaire (Copywriting)</label>
                  <span className="text-[11px] text-arctic-500">Optimisé pour {form.platform.toUpperCase()}</span>
                </div>
                <textarea
                  className="input min-h-[90px] text-sm leading-relaxed"
                  placeholder="Texte complet avec proposition de valeur, détails de livraison et hashtags..."
                  value={form.body}
                  onChange={(e) => setForm({ ...form, body: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="label">Call to action (Bouton)</label>
                  <input
                    className="input text-sm"
                    value={form.cta}
                    onChange={(e) => setForm({ ...form, cta: e.target.value })}
                  />
                </div>
                <div>
                  <label className="label">Budget ({currency})</label>
                  <input
                    className="input text-sm"
                    inputMode="decimal"
                    placeholder="10000"
                    value={form.spend}
                    onChange={(e) => setForm({ ...form, spend: e.target.value })}
                  />
                </div>
                <div>
                  <label className="label">Ciblage Géographique</label>
                  <input
                    className="input text-sm"
                    placeholder="Togo, Bénin, Côte d'Ivoire"
                    value={form.targetRegion}
                    onChange={(e) => setForm({ ...form, targetRegion: e.target.value })}
                  />
                </div>
              </div>

              {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-600 font-medium">{error}</p>}

              <div className="flex justify-end gap-2.5 pt-2 border-t border-arctic-200">
                <button type="button" onClick={() => setOpen(false)} className="btn-ghost">
                  Annuler
                </button>
                <button className="btn-primary flex items-center gap-2" disabled={saving}>
                  <RocketIcon size={15} />
                  <span>{saving ? "Lancement en cours…" : "Lancer sur " + form.platform.toUpperCase()}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function CopyButton({ text, label = "Copy", copiedLabel = "Copied ✓", className }: {
  text: string; label?: string; copiedLabel?: string; className?: string;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch { /* clipboard blocked */ }
      }}
      className={className || "rounded-full border border-arctic-400/45 bg-white/70 px-2.5 py-1 text-xs font-semibold text-arctic-800 hover:bg-arctic-100/70"}
    >
      {copied ? copiedLabel : label}
    </button>
  );
}

const CREATIVES = [
  { key: "status", label: "WhatsApp Status / Story", hint: "9:16" },
  { key: "ig", label: "Instagram / Facebook Ads (Feed)", hint: "1:1" },
  { key: "tiktok", label: "TikTok Vertical Video Ad", hint: "9:16" },
];

function CampaignCard({
  c, currency, base, onDelete, onReview,
}: {
  c: Campaign; currency: string; base: string; onDelete: () => void; onReview: () => void;
}) {
  const link = `${base}/go/${c.refCode}`;
  const adCopy = useMemo(
    () => [c.headline, c.body, `${c.cta}: ${link}`].filter(Boolean).join("\n\n"),
    [c.headline, c.body, c.cta, link],
  );
  const archived = c.status === "archived";

  return (
    <div className={"card p-4 " + (archived ? "opacity-60" : "")}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-arctic-900">{c.name}</h3>
            <span className="rounded bg-arctic-200/70 px-1.5 py-0.5 text-[10px] font-semibold text-arctic-600">
              {humanizeStatus(c.status)}
            </span>
            {archived && (
              <span className="rounded bg-arctic-200/70 px-1.5 py-0.5 text-[10px] font-semibold text-arctic-600">
                Archived
              </span>
            )}
          </div>
          <code className="text-xs text-arctic-500">ref {c.refCode}</code>
        </div>
        <div className="flex items-center gap-2">
          {!["archived", "sent"].includes(c.status) && (
            <button type="button" onClick={onReview} className="btn-ghost !py-1 text-xs">
              {c.status === "draft" || c.status === "approved" ? "Review approval" : "View status"}
            </button>
          )}
          {!archived && (
            <button onClick={onDelete} className="btn-ghost !py-1 text-xs">Archive</button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
        <Stat label="Clicks" value={c.clicks.toLocaleString()} />
        <Stat label="Orders" value={c.orders.toLocaleString()} />
        <Stat label="Revenue" value={formatMoney(c.revenueCents, currency)} />
        <Stat label="Click→order" value={`${(c.cvr * 100).toFixed(c.cvr > 0 ? 1 : 0)}%`} />
        <Stat label="ROAS" value={c.roas == null ? "—" : `${c.roas.toFixed(2)}×`} />
      </div>

      {/* Trackable link */}
      <div className="mt-3">
        <span className="a-label-md text-arctic-600">Trackable link</span>
        <div className="mt-1 flex flex-col gap-2 sm:flex-row sm:items-center">
          <code className="flex-1 truncate rounded-lg bg-arctic-200/65 px-3 py-2 text-sm text-arctic-800">{link}</code>
          <div className="flex gap-2">
            <CopyButton text={link} label="Copy link" className="btn-primary whitespace-nowrap !py-2" />
            <a href={link} target="_blank" rel="noreferrer" className="btn-ghost whitespace-nowrap">Test ↗</a>
          </div>
        </div>
      </div>

      {/* Ad copy */}
      {(c.headline || c.body) && (
        <div className="mt-3">
          <div className="flex items-center justify-between">
            <span className="a-label-md text-arctic-600">Ad copy</span>
            <CopyButton text={adCopy} label="Copy ad copy" />
          </div>
          <pre className="mt-1 whitespace-pre-wrap rounded-lg bg-arctic-100/55 px-3 py-2 text-sm text-arctic-700">{adCopy}</pre>
        </div>
      )}

      {/* Creatives */}
      <div className="mt-3">
        <span className="a-label-md text-arctic-600">Auto-built ad creative</span>
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          {CREATIVES.map((f) => (
            <a
              key={f.key}
              href={`/api/campaigns/${c.id}/asset/${f.key}`}
              download={`japora-ad-${c.refCode}-${f.key}.svg`}
              className="inline-flex items-center gap-1 rounded-full border border-arctic-400/45 bg-white/70 px-2.5 py-1 text-xs font-semibold text-arctic-800 hover:bg-arctic-100/70"
            >
              {f.label}
              <span className="text-[10px] font-normal opacity-70">{f.hint}</span>
            </a>
          ))}
        </div>
        <p className="mt-1 a-label-md text-arctic-500">
          Download → set up a Facebook/Instagram “Ads that Click to WhatsApp” campaign → use this
          image and paste the trackable link as the destination.
        </p>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-arctic-100/55 px-3 py-2">
      <div className="a-label-md text-arctic-500">{label}</div>
      <div className="font-bold text-arctic-900">{value}</div>
    </div>
  );
}
