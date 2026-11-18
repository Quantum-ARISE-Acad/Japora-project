"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AuroraIsoscout } from "@/components/aurora";

type Segment = "all" | "recent" | "unpaid" | "wholesale" | "vip" | "inactive" | "reactivation";

const SEGMENTS: { id: Segment; label: string; hint: string }[] = [
  { id: "all", label: "Tous les clients consentants", hint: "Clients ayant accepté les messages marketing" },
  { id: "recent", label: "Récents (30 j)", hint: "Commande au cours des 30 derniers jours" },
  { id: "vip", label: "VIP (≥ 3 commandes)", hint: "Clients qui commandent régulièrement" },
  { id: "inactive", label: "Inactifs (30–89 j)", hint: "Clients consentants sans commande ni panier récent depuis 30 à 89 jours" },
  { id: "reactivation", label: "À réactiver (90 j+)", hint: "Clients consentants sans commande ni panier depuis au moins 90 jours" },
  { id: "unpaid", label: "Créances ouvertes", hint: "Clients ayant un solde à régler" },
  { id: "wholesale", label: "Gros", hint: "Clients ayant déjà acheté en gros" },
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
  failedCount: number;
  skippedCount: number;
  uncertainCount: number;
  messageMode: string;
  templateName: string | null;
  createdAt: string;
  sentAt: string | null;
};

export default function BroadcastComposer({
  initialBroadcasts,
  whatsappLive,
  shopName,
}: {
  initialBroadcasts: Broadcast[];
  whatsappLive: boolean;
  shopName: string;
}) {
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>(initialBroadcasts);
  const [segment, setSegment] = useState<Segment>("all");
  const [recipientCount, setRecipientCount] = useState<number | null>(null);
  const [counting, setCounting] = useState(false);
  const [body, setBody] = useState("");
  const [messageMode, setMessageMode] = useState<"text" | "template">(() => whatsappLive ? "template" : "text");
  const [templateName, setTemplateName] = useState("");
  const [templateLanguage, setTemplateLanguage] = useState("fr");
  const [templateParams, setTemplateParams] = useState("name, store");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [countError, setCountError] = useState(false);
  const [demoPreview, setDemoPreview] = useState("");

  const reloadBroadcasts = useCallback(async () => {
    try {
      const res = await fetch("/api/broadcasts");
      if (!res.ok) return;
      const data = (await res.json()) as { broadcasts: Broadcast[] };
      setBroadcasts(data.broadcasts);
    } catch {
      setError("Impossible d’actualiser l’historique pour le moment.");
    }
  }, []);

  // Live recipient count for the active segment. Re-runs whenever the user
  // flips chips so the button label always matches what they'll actually
  // blast out.
  useEffect(() => {
    let cancelled = false;
    setCounting(true);
    setCountError(false);
    fetch(`/api/broadcasts?recipientsFor=${segment}`)
      .then((res) => {
        if (!res.ok) throw new Error("count_failed");
        return res.json();
      })
      .then((data: { count?: number }) => {
        if (cancelled) return;
        setRecipientCount(data.count ?? 0);
      })
      .catch(() => {
        if (!cancelled) {
          setRecipientCount(0);
          setCountError(true);
        }
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
  const hasInFlight = broadcasts.some((b) => b.status === "queued" || b.status === "sending");
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
    if (messageMode === "text" && !body.trim()) {
      setError("Écrivez un message avant de continuer.");
      return;
    }
    if (messageMode === "text" && body.length > MAX_BODY) {
      setError(`Le message ne peut pas dépasser ${MAX_BODY} caractères.`);
      return;
    }
    if (countError) {
      setError("Impossible de calculer le nombre de destinataires. Réessayez.");
      return;
    }
    if (!recipientCount) {
      if (!whatsappLive && messageMode === "text") {
        const rendered = body
          .replace(/\{\{\s*name\s*\}\}/gi, "Client de démonstration")
          .replace(/\{\{\s*store\s*\}\}/gi, shopName);
        setDemoPreview(rendered);
        setInfo("Aperçu local uniquement : aucun destinataire réel, aucune campagne créée et aucun message envoyé.");
        return;
      }
      setError("Aucun client consentant ne correspond à ce segment.");
      return;
    }
    if (whatsappLive && messageMode !== "template") {
      setError("Un envoi Marketing réel nécessite un modèle WhatsApp approuvé par Meta.");
      return;
    }
    const params = templateParams.split(",").map((param) => param.trim()).filter(Boolean);
    if (messageMode === "template" && (!templateName.trim() || !templateLanguage.trim() || params.some((param) => param !== "name" && param !== "store") || params.length > 5)) {
      setError("Vérifiez le nom du modèle, sa langue et ses variables (name ou store).");
      return;
    }
    setSending(true);
    try {
      const createRes = await fetch("/api/broadcasts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body, segment, messageMode, templateName, templateLanguage, templateParams: params }),
      });
      const createData = await createRes.json().catch(() => ({}));
      if (!createRes.ok) {
        setError(createData.error || "Impossible de préparer l’envoi.");
        return;
      }
      const id = createData.id as string;

      const sendRes = await fetch(`/api/broadcasts/${id}/send`, {
        method: "POST",
      });
      if (!sendRes.ok) {
        const sendData = await sendRes.json().catch(() => ({}));
        setError(sendData.error || "Impossible de lancer l’envoi.");
        await reloadBroadcasts();
        return;
      }
      setBody("");
      setInfo(whatsappLive
        ? `Campagne mise en file pour ${createData.targetCount} client${createData.targetCount > 1 ? "s" : ""} consentant${createData.targetCount > 1 ? "s" : ""}. Le traitement se poursuit en arrière-plan.`
        : `Simulation mise en file pour ${createData.targetCount} client${createData.targetCount > 1 ? "s" : ""}. Aucun message réel ne sera envoyé.`);
      await reloadBroadcasts();
    } catch {
      setError("Erreur réseau : l’envoi n’a pas pu être lancé. Vérifiez l’historique avant de réessayer.");
    } finally {
      setSending(false);
    }
  }

  const remaining = MAX_BODY - body.length;
  const countLabel =
    counting || recipientCount === null
      ? "…"
      : `${recipientCount} client${recipientCount > 1 ? "s" : ""}`;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="a-headline-md text-arctic-900">Marketing WhatsApp</h1>
        <p className="text-sm text-arctic-600">
          Envoyez un message à vos clients qui ont accepté de recevoir vos communications.
        </p>
      </div>

      {!whatsappLive && (
        <div role="status" className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Mode démo : les envois sont simulés. Aucun message ne sera transmis aux clients sans configuration de WhatsApp Cloud API.
        </div>
      )}

      <div className="card space-y-4 p-5">
        <div>
          <label className="label">Destinataires</label>
          <div className="flex flex-wrap gap-2">
            {SEGMENTS.map((s) => {
              const active = s.id === segment;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => { setSegment(s.id); setDemoPreview(""); }}
                  className={
                    "rounded-full border px-3 py-1.5 text-sm transition " +
                    (active
                      ? "border-brand bg-brand text-white"
                      : "border-arctic-400/30 bg-white text-arctic-800 hover:border-arctic-400/45")
                  }
                  title={s.hint}
                >
                  {s.label}
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-xs text-arctic-600">
            Cet envoi concernera <span className="font-semibold text-arctic-800">{countLabel}</span>.
          </p>
          {countError && <p role="alert" className="mt-1 text-xs text-red-700">Impossible de charger le nombre de destinataires. L’envoi est désactivé jusqu’à la prochaine vérification.</p>}
        </div>

        <div>
          <div className="flex items-center justify-between">
            <label className="label" htmlFor="broadcast-body">
              Votre message
            </label>
            {messageMode === "text" && <span
              className={
                "text-xs " +
                (remaining < 0
                  ? "text-red-600"
                  : remaining < 100
                    ? "text-amber-600"
                    : "text-arctic-500")
              }
            >
              {remaining} caractères restants
            </span>}
          </div>
          <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label="Type de message">
            <button type="button" onClick={() => { setMessageMode("template"); setDemoPreview(""); }} aria-pressed={messageMode === "template"} className={`rounded-full border px-3 py-1.5 text-sm ${messageMode === "template" ? "border-brand bg-brand text-white" : "border-arctic-400/40"}`}>Modèle approuvé</button>
            <button type="button" onClick={() => { setMessageMode("text"); setDemoPreview(""); }} aria-pressed={messageMode === "text"} className={`rounded-full border px-3 py-1.5 text-sm ${messageMode === "text" ? "border-brand bg-brand text-white" : "border-arctic-400/40"}`}>Texte libre</button>
          </div>
          {messageMode === "template" ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <div><label className="label" htmlFor="broadcast-template-name">Nom exact du modèle Meta</label><input id="broadcast-template-name" className="input" value={templateName} onChange={(event) => setTemplateName(event.target.value)} placeholder="ex. nouvelle_collection" /></div>
              <div><label className="label" htmlFor="broadcast-template-language">Langue du modèle</label><input id="broadcast-template-language" className="input" value={templateLanguage} onChange={(event) => setTemplateLanguage(event.target.value)} placeholder="fr ou en_US" /></div>
              <div className="sm:col-span-2"><label className="label" htmlFor="broadcast-template-params">Variables du corps, dans l’ordre du modèle</label><input id="broadcast-template-params" className="input" value={templateParams} onChange={(event) => setTemplateParams(event.target.value)} placeholder="name, store" /><p className="mt-1 text-xs text-arctic-600">Utilisez name ou store, séparés par des virgules. Laissez vide si le modèle n’a aucune variable.</p></div>
              <p className="sm:col-span-2 text-sm text-arctic-600">Le contenu du message est défini et approuvé dans WhatsApp Manager. Saisissez son nom et sa langue exactement comme dans Meta.</p>
            </div>
          ) : (
            <>
              {whatsappLive && <p role="alert" className="mb-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">Le texte libre est bloqué pour les campagnes réelles, car l’application ne vérifie pas si chaque client a récemment écrit à la boutique.</p>}
              <textarea id="broadcast-body" className="input min-h-[140px]" placeholder="Bonjour {{name}}, découvrez les nouveautés de {{store}}. Répondez à ce message pour en savoir plus." value={body} maxLength={MAX_BODY} onChange={(e) => { setBody(e.target.value); setDemoPreview(""); }} />
            </>
          )}
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

        {demoPreview && (
          <section aria-live="polite" className="broadcast-simulation-preview rounded-xl border border-violet-300 bg-violet-50 p-4 text-violet-950">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold">Aperçu de la simulation</h2>
              <span className="broadcast-simulation-badge rounded-full bg-violet-200 px-2 py-1 text-xs font-medium">Client fictif · aucun envoi</span>
            </div>
            <p className="broadcast-simulation-message mt-3 whitespace-pre-wrap rounded-lg border border-violet-200 bg-white p-3 text-sm">{demoPreview}</p>
          </section>
        )}

        {!whatsappLive && recipientCount === 0 && !countError && (
          <p className="text-xs text-arctic-600">
            Aucun client consentant ne correspond au segment. En mode démo, vous pouvez quand même prévisualiser un texte libre ; pour simuler une campagne, ajoutez des clients avec un numéro valide et un consentement marketing enregistré.
          </p>
        )}

        <div className="flex justify-end">
          <button
            type="button"
            onClick={sendNow}
            disabled={sending || counting || recipientCount === null || (messageMode === "text" && (!body.trim() || whatsappLive)) || (recipientCount === 0 && (whatsappLive || messageMode !== "text" || !body.trim())) || countError}
            className="btn-primary"
          >
            {sending
              ? "Envoi en cours…"
              : recipientCount === 0
                ? !whatsappLive && messageMode === "text" && body.trim()
                  ? "Prévisualiser la simulation"
                  : "Aucun destinataire éligible"
                : `${whatsappLive ? "Envoyer maintenant" : "Simuler l’envoi"}${recipientCount ? ` (${recipientCount})` : ""}`}
          </button>
        </div>
      </div>

      <div>
        <h2 className="mb-3 a-title-lg text-arctic-900">Historique</h2>
        {broadcasts.length === 0 ? (
          <div className="glass glass-edge rounded-shape-lg p-6">
            <AuroraIsoscout
              variant="broadcasts"
              title="Aucun envoi pour le moment"
              body="Rédigez un message et choisissez un segment de clients consentants. Les envois et leur état apparaîtront ici."
            />
          </div>
        ) : (
          <ul className="space-y-2">
            {broadcasts.map((b) => (
              <li key={b.id} className="card space-y-2 p-4">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="rounded-full bg-arctic-200/65 px-2 py-0.5 font-medium text-arctic-800">
                    {SEGMENTS.find((s) => s.id === b.segment)?.label ?? b.segment}
                  </span>
                  <StatusPill status={b.status} />
                  <span
                    className="text-arctic-500"
                    title={b.status === "stubbed" ? "La simulation n’a envoyé aucun message réel." : "Ce nombre indique les messages acceptés par l’API WhatsApp. Il ne confirme pas leur livraison au téléphone."}
                  >
                    {b.sentCount} / {b.targetCount} {b.status === "stubbed" ? "simulés" : "acceptés par WhatsApp"}
                  </span>
                  <span className="ml-auto text-arctic-500">
                    {new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short" }).format(new Date(b.createdAt))}
                  </span>
                </div>
                {(b.failedCount > 0 || b.skippedCount > 0 || b.uncertainCount > 0) && (
                  <p className={`text-xs ${b.uncertainCount > 0 ? "text-red-700" : "text-amber-800"}`} role={b.uncertainCount > 0 ? "alert" : "status"}>
                    {b.failedCount > 0 && `${b.failedCount} échec${b.failedCount > 1 ? "s" : ""}`}
                    {b.failedCount > 0 && b.skippedCount > 0 ? " · " : ""}
                    {b.skippedCount > 0 && `${b.skippedCount} ignoré${b.skippedCount > 1 ? "s" : ""} (consentement retiré ou numéro invalide)`}
                    {(b.failedCount > 0 || b.skippedCount > 0) && b.uncertainCount > 0 ? " · " : ""}
                    {b.uncertainCount > 0 && `${b.uncertainCount} envoi${b.uncertainCount > 1 ? "s" : ""} interrompu${b.uncertainCount > 1 ? "s" : ""} à vérifier dans WhatsApp avant toute relance`}
                  </p>
                )}
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
  const statuses: Record<string, { label: string; style: string }> = {
    draft: { label: "Brouillon", style: "bg-arctic-200/65 text-arctic-700" },
    queued: { label: "En file d’attente", style: "bg-blue-100 text-blue-700" },
    scheduled: { label: "Programmé", style: "bg-blue-100 text-blue-700" },
    sending: { label: "En cours", style: "bg-amber-100 text-amber-700" },
    sent: { label: "Transmis à WhatsApp", style: "bg-emerald-100 text-emerald-700" },
    stubbed: { label: "Simulation — aucun envoi", style: "bg-violet-100 text-violet-700" },
    failed: { label: "Échec", style: "bg-red-100 text-red-700" },
    skipped: { label: "Aucun envoi — consentement retiré", style: "bg-arctic-200 text-arctic-700" },
    partial: { label: "Partiel", style: "bg-amber-100 text-amber-800" },
    attention: { label: "Vérification requise", style: "bg-red-100 text-red-800" },
  };
  const current = statuses[status] || { label: status, style: "bg-arctic-200/65 text-arctic-700" };
  return (
    <span
      className={`rounded-full px-2 py-0.5 font-medium ${current.style}`}
      title={status === "sent" ? "WhatsApp a accepté les demandes d’envoi, mais cet écran ne reçoit pas les accusés de livraison par campagne." : undefined}
    >
      {current.label}
    </span>
  );
}
