"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AuroraIsoscout } from "@/components/aurora";
import { usePublicLang } from "@/components/PublicLanguageProvider";

type Segment = "all" | "recent" | "unpaid" | "wholesale" | "vip" | "inactive" | "reactivation";

const SEGMENTS: { id: Segment; labelFr: string; labelEn: string; hintFr: string; hintEn: string }[] = [
  { id: "all", labelFr: "Tous les clients", labelEn: "All customers", hintFr: "Tous les clients de votre CRM", hintEn: "Everyone in your CRM" },
  { id: "recent", labelFr: "Récents (30j)", labelEn: "Recent (30d)", hintFr: "Ont commandé ces 30 derniers jours", hintEn: "Ordered in last 30 days" },
  { id: "vip", labelFr: "VIP (≥3 cmd)", labelEn: "VIP (≥3 orders)", hintFr: "Meilleurs clients récurrents", hintEn: "Top repeat customers" },
  { id: "inactive", labelFr: "Inactifs (30j+)", labelEn: "Inactive (30d+)", hintFr: "Clients sans activité récente", hintEn: "Customers without recent activity" },
  { id: "reactivation", labelFr: "Réactivation", labelEn: "Reactivation eligible", hintFr: "Clients inactifs avec consentement marketing", hintEn: "Inactive customers with current marketing consent" },
  { id: "unpaid", labelFr: "Créances impayées", labelEn: "Unpaid IOUs", hintFr: "Créances ouvertes", hintEn: "Open receivables" },
  { id: "wholesale", labelFr: "Grossistes", labelEn: "Wholesale", hintFr: "Ont déjà acheté en gros", hintEn: "Bought wholesale before" },
];

const MAX_BODY = 1000;
const POLL_INTERVAL_MS = 3000;

type Broadcast = {
  id: string;
  body: string;
  segment: string;
  status: string;
  targetCount: number;
  sentCount: number;
  createdAt: string;
  sentAt: string | null;
};

export default function BroadcastComposer({
  initialBroadcasts,
}: {
  initialBroadcasts: Broadcast[];
}) {
  const { tr } = usePublicLang();
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>(initialBroadcasts);
  const [segment, setSegment] = useState<Segment>("all");
  const [recipientCount, setRecipientCount] = useState<number | null>(null);
  const [counting, setCounting] = useState(false);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  const reloadBroadcasts = useCallback(async () => {
    const res = await fetch("/api/broadcasts");
    if (!res.ok) return;
    const data = (await res.json()) as { broadcasts: Broadcast[] };
    setBroadcasts(data.broadcasts);
  }, []);

  // Live recipient count for the active segment. Re-runs whenever the user
  // flips chips so the button label always matches what they'll actually
  // blast out.
  useEffect(() => {
    let cancelled = false;
    setCounting(true);
    fetch(`/api/broadcasts?recipientsFor=${segment}`)
      .then((res) => (res.ok ? res.json() : { count: 0 }))
      .then((data: { count?: number }) => {
        if (cancelled) return;
        setRecipientCount(data.count ?? 0);
      })
      .catch(() => {
        if (!cancelled) setRecipientCount(0);
      })
      .finally(() => {
        if (!cancelled) setCounting(false);
      });
    return () => {
      cancelled = true;
    };
  }, [segment]);

  // Poll the list while any broadcast is in flight so sentCount ticks up
  // without forcing a full refresh. We stop polling as soon as nothing is
  // "sending" — typical case is no broadcasts in flight, zero overhead.
  const hasInFlight = broadcasts.some((b) => b.status === "sending");
  const hasInFlightRef = useRef(hasInFlight);
  hasInFlightRef.current = hasInFlight;

  useEffect(() => {
    if (!hasInFlight) return;
    const t = setInterval(() => {
      if (hasInFlightRef.current) {
        void reloadBroadcasts();
      }
    }, POLL_INTERVAL_MS);
    return () => clearInterval(t);
  }, [hasInFlight, reloadBroadcasts]);

  async function sendNow() {
    setError("");
    setInfo("");
    if (!body.trim()) {
      setError("Write a message first.");
      return;
    }
    if (body.length > MAX_BODY) {
      setError(`Message must be ${MAX_BODY} characters or fewer.`);
      return;
    }
    setSending(true);
    try {
      const createRes = await fetch("/api/broadcasts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body, segment }),
      });
      const createData = await createRes.json().catch(() => ({}));
      if (!createRes.ok) {
        setError(createData.error || "Could not create broadcast.");
        return;
      }
      const id = createData.id as string;

      const sendRes = await fetch(`/api/broadcasts/${id}/send`, {
        method: "POST",
      });
      if (!sendRes.ok) {
        const sendData = await sendRes.json().catch(() => ({}));
        setError(sendData.error || "Could not start sending.");
        return;
      }
      setBody("");
      setInfo(
        `Queued for ${createData.targetCount} customer${createData.targetCount === 1 ? "" : "s"}.`,
      );
      await reloadBroadcasts();
    } finally {
      setSending(false);
    }
  }

  const remaining = MAX_BODY - body.length;
  const countLabel =
    counting || recipientCount === null
      ? "…"
      : `${recipientCount} ${tr("client(s)", `customer${recipientCount === 1 ? "" : "s"}`)}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="a-headline-md text-arctic-900">
            {tr("Marketing & Acquisition", "Marketing & Acquisition")}
          </h1>
          <p className="text-sm text-arctic-600">
            {tr(
              "Diffusez des campagnes WhatsApp Broadcast à votre CRM ou lancez des publicités sponsorisées (WhatsApp Status, Facebook & Instagram) avec vos produits.",
              "Broadcast WhatsApp campaigns to your CRM or launch sponsored ads (WhatsApp Status, Facebook & Instagram) featuring your products.",
            )}
          </p>
        </div>
        <Link
          href="/dashboard/campaigns"
          className="btn-primary text-xs sm:text-sm"
        >
          {tr(
            "🚀 Studio Publicités Meta API (WhatsApp Status, FB & IG) →",
            "🚀 Meta Ads Studio (WhatsApp Status, FB & IG) →",
          )}
        </Link>
      </div>

      {/* Meta Marketing API Highlight Card inside Marketing */}
      <div className="rounded-2xl border border-emerald-500/30 bg-gradient-to-r from-emerald-50/80 via-white to-arctic-50 p-4 shadow-2xs">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-emerald-600 px-2.5 py-0.5 text-[10px] font-bold text-white">
                {tr("NOUVEAU • Graph API v27.0", "NEW • Graph API v27.0")}
              </span>
              <span className="text-xs font-bold text-arctic-900">
                {tr(
                  "Publicités Produits sur WhatsApp Status, Facebook & Instagram",
                  "Product Ads on WhatsApp Status, Facebook & Instagram",
                )}
              </span>
            </div>
            <p className="text-xs text-arctic-600">
              {tr(
                "Sélectionnez un produit de votre boutique Japora, créez automatiquement la campagne, l'ensemble de publicités (ciblage & budget), le créatif et la publicité avec suivi des clics, discussions WhatsApp, commandes et ROAS.",
                "Pick a product from your Japora store, automatically create the campaign, ad set (targeting & budget), creative, and ad with tracking for clicks, WhatsApp chats, orders, and ROAS.",
              )}
            </p>
          </div>
          <Link
            href="/dashboard/campaigns"
            className="rounded-xl border border-emerald-600/40 bg-white px-4 py-2 text-xs font-bold text-emerald-800 shadow-2xs hover:bg-emerald-50"
          >
            {tr("Ouvrir le Gestionnaire de Publicités Meta →", "Open Meta Ads Manager →")}
          </Link>
        </div>
      </div>

      <div className="card space-y-4 p-5">
        <div>
          <label className="label">{tr("Audience cible", "Audience")}</label>
          <div className="flex flex-wrap gap-2">
            {SEGMENTS.map((s) => {
              const active = s.id === segment;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSegment(s.id)}
                  className={
                    "rounded-full border px-3 py-1.5 text-sm transition " +
                    (active
                      ? "border-brand bg-brand text-white"
                      : "border-arctic-400/30 bg-white text-arctic-800 hover:border-arctic-400/45")
                  }
                  title={tr(s.hintFr, s.hintEn)}
                >
                  {tr(s.labelFr, s.labelEn)}
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-xs text-arctic-600">
            {tr("Touchera", "Will reach")} <span className="font-semibold text-arctic-800">{countLabel}</span>.
          </p>
        </div>

        <div>
          <div className="flex items-center justify-between">
            <label className="label" htmlFor="broadcast-body">
              Message
            </label>
            <span
              className={
                "text-xs " +
                (remaining < 0
                  ? "text-red-600"
                  : remaining < 100
                    ? "text-amber-600"
                    : "text-arctic-500")
              }
            >
              {remaining} {tr("caractères restants", "chars left")}
            </span>
          </div>
          <textarea
            id="broadcast-body"
            className="input min-h-[140px]"
            placeholder={tr(
              "Bonjour {{name}}, de nouveaux articles viennent d'arriver chez {{store}}. Répondez OUI pour les découvrir.",
              "Hi {{name}}, new drops just landed at {{store}}. Reply YES to see them.",
            )}
            value={body}
            maxLength={MAX_BODY}
            onChange={(e) => setBody(e.target.value)}
          />
        </div>

        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
            {error}
          </p>
        )}
        {info && (
          <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            {info}
          </p>
        )}

        <div className="flex justify-end">
          <button
            type="button"
            onClick={sendNow}
            disabled={sending || !body.trim() || recipientCount === 0}
            className="btn-primary"
          >
            {sending
              ? tr("Envoi en file…", "Queueing…")
              : `${tr("Envoyer maintenant", "Send now")}${recipientCount ? ` (${recipientCount})` : ""}`}
          </button>
        </div>
      </div>

      <div>
        <h2 className="mb-3 a-title-lg text-arctic-900">{tr("Historique", "History")}</h2>
        {broadcasts.length === 0 ? (
          <div className="glass glass-edge rounded-shape-lg p-6">
            <AuroraIsoscout
              variant="broadcasts"
              title={tr("Aucune diffusion pour le moment", "No broadcasts yet")}
              body={tr(
                "Rédigez un message ci-dessus et choisissez un segment client pour envoyer votre première campagne. Les diffusions passées s'afficheront ici.",
                "Write a message above and pick a customer segment to send your first one. Past broadcasts (and their delivery stats) will appear here.",
              )}
            />
          </div>
        ) : (
          <ul className="space-y-2">
            {broadcasts.map((b) => (
              <li key={b.id} className="card space-y-2 p-4">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="rounded-full bg-arctic-200/65 px-2 py-0.5 font-medium text-arctic-800">
                    {b.segment}
                  </span>
                  <StatusPill status={b.status} />
                  <span className="text-arctic-500">
                    {b.sentCount} / {b.targetCount} {tr("délivrés", "delivered")}
                  </span>
                  <span className="ml-auto text-arctic-500">
                    {new Date(b.createdAt).toLocaleString()}
                  </span>
                </div>
                <p className="whitespace-pre-wrap text-sm text-arctic-800">{b.body}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const styles: Record<string, string> = {
    draft: "bg-arctic-200/65 text-arctic-700",
    scheduled: "bg-blue-100 text-blue-700",
    sending: "bg-amber-100 text-amber-700",
    sent: "bg-emerald-100 text-emerald-700",
    stubbed: "bg-violet-100 text-violet-700",
    failed: "bg-red-100 text-red-700",
  };
  return (
    <span
      className={
        "rounded-full px-2 py-0.5 font-medium " +
        (styles[status] || "bg-arctic-200/65 text-arctic-700")
      }
    >
      {status === "stubbed" ? "Stubbed (test only)" : status}
    </span>
  );
}
