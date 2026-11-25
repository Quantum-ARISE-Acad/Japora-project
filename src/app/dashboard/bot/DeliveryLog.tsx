"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { usePublicLang } from "@/components/PublicLanguageProvider";

type Message = {
  id: string;
  contact: string;
  body: string;
  status: string;
  messageId: string | null;
  orderId: string | null;
  createdAt: string;
};

type StatusFilter = "all" | "sent" | "delivered" | "read" | "failed" | "stubbed";

const PAGE_SIZE = 10;

// Labels are [français, English] pairs, shown with tr(...pair).
type Bi = [string, string];

const STATUS: Record<string, { label: Bi; description: Bi; tone: string }> = {
  sent: {
    label: ["Accepté par l’API", "Accepted by the API"],
    description: ["WhatsApp a accepté la demande d’envoi. La remise au téléphone n’est pas encore confirmée.", "WhatsApp accepted the send request. Delivery to the phone is not confirmed yet."],
    tone: "border-sky-300 bg-sky-50 text-sky-800 dark:border-sky-700 dark:bg-sky-950/50 dark:text-sky-200",
  },
  delivered: {
    label: ["Remis", "Delivered"],
    description: ["WhatsApp a confirmé la remise du message au téléphone du destinataire.", "WhatsApp confirmed the message reached the recipient's phone."],
    tone: "border-emerald-300 bg-arctic-100/60 text-signal-text dark:border-emerald-700  ",
  },
  read: {
    label: ["Lu", "Read"],
    description: ["WhatsApp a confirmé que le destinataire a lu le message.", "WhatsApp confirmed the recipient read the message."],
    tone: "border-indigo-300 bg-indigo-50 text-arctic-800 dark:border-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-200",
  },
  failed: {
    label: ["Échec", "Failed"],
    description: ["WhatsApp n’a pas pu envoyer le message. Vérifiez le numéro et la configuration du compte.", "WhatsApp could not send the message. Check the number and the account settings."],
    tone: "border-red-300 bg-aurora-error-bg text-aurora-error-text dark:border-red-700 dark:bg-red-950/40 dark:text-red-200",
  },
  stubbed: {
    label: ["Simulé — aucun envoi", "Simulated — not sent"],
    description: ["Mode démo : aucun message n’a été transmis à WhatsApp.", "Demo mode: no message was passed to WhatsApp."],
    tone: "border-arctic-400 bg-arctic-100 text-arctic-800 dark:border-arctic-600 dark:bg-arctic-800 dark:text-arctic-100",
  },
};

const FILTERS: { id: StatusFilter; label: Bi }[] = [
  { id: "all", label: ["Tous", "All"] },
  { id: "sent", label: ["Acceptés", "Accepted"] },
  { id: "delivered", label: ["Remis", "Delivered"] },
  { id: "read", label: ["Lus", "Read"] },
  { id: "failed", label: ["Échecs", "Failed"] },
  { id: "stubbed", label: ["Simulés", "Simulated"] },
];

function statusInfo(status: string) {
  return STATUS[status] || {
    label: ["Statut inconnu", "Unknown status"] as Bi,
    description: [`Statut fournisseur non reconnu : ${status}`, `Unrecognised provider status: ${status}`] as Bi,
    tone: "border-aurora-warning/35 bg-aurora-warning-bg text-aurora-warning-text dark:border-amber-700  ",
  };
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date inconnue";
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export default function DeliveryLog({
  messages,
  liveMode,
}: {
  messages: Message[];
  liveMode: boolean;
}) {
  const { tr } = usePublicLang();
  const router = useRouter();
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [refreshing, setRefreshing] = useState(false);

  const counts = useMemo(() => ({
    all: messages.length,
    sent: messages.filter((m) => m.status === "sent").length,
    delivered: messages.filter((m) => m.status === "delivered").length,
    read: messages.filter((m) => m.status === "read").length,
    failed: messages.filter((m) => m.status === "failed").length,
    stubbed: messages.filter((m) => m.status === "stubbed").length,
  }), [messages]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("fr-FR");
    return messages.filter((message) => {
      const statusMatches = filter === "all" || message.status === filter;
      const queryMatches = !needle || [message.contact, message.body, message.orderId || "", message.messageId || ""]
        .some((value) => value.toLocaleLowerCase("fr-FR").includes(needle));
      return statusMatches && queryMatches;
    });
  }, [filter, messages, query]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const visible = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  async function refresh() {
    if (refreshing) return;
    setRefreshing(true);
    router.refresh();
    window.setTimeout(() => setRefreshing(false), 800);
  }

  function changeFilter(next: StatusFilter) {
    setFilter(next);
    setPage(1);
  }

  function changeQuery(next: string) {
    setQuery(next);
    setPage(1);
  }

  return (
    <section className="card overflow-hidden" aria-labelledby="whatsapp-history-title">
      <div className="border-b border-arctic-400/30 px-5 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 id="whatsapp-history-title" className="font-bold text-arctic-900">{tr("Historique WhatsApp", "WhatsApp history")}</h2>
            <p className="mt-1 text-sm text-arctic-700">
              {tr("Suivez les messages réellement envoyés et les accusés reçus de Meta.", "Follow the messages actually sent and the receipts from Meta.")}
            </p>
          </div>
          <button type="button" onClick={refresh} disabled={refreshing} className="btn-ghost !min-h-9 !px-3 !py-1.5 text-xs">
            {refreshing ? tr("Actualisation…", "Refreshing…") : tr("Actualiser", "Refresh")}
          </button>
        </div>

        {!liveMode && (
          <p className="mt-3 rounded-lg border border-aurora-warning/35 bg-aurora-warning-bg px-3 py-2 text-xs font-medium text-aurora-warning-text dark:border-amber-700">
            {tr("Mode démo : les messages marqués « Simulé » ne sont pas partis sur WhatsApp. Configurez WhatsApp Cloud API et son webhook pour recevoir les statuts réels.", "Demo mode: messages marked “Simulated” did not leave on WhatsApp. Set up the WhatsApp Cloud API and its webhook to get real statuses.")}
          </p>
        )}

        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
          <Summary label={tr("Messages affichés", "Messages shown")} value={counts.all} />
          <Summary label={tr("Acceptés", "Accepted")} value={counts.sent} />
          <Summary label={tr("Remis", "Delivered")} value={counts.delivered} />
          <Summary label={tr("Lus", "Read")} value={counts.read} />
          <Summary label={tr("Échecs", "Failed")} value={counts.failed} />
        </div>
      </div>

      <div className="space-y-3 px-5 py-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-1.5" aria-label={tr("Filtrer les messages par statut", "Filter messages by status")}>
            {FILTERS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => changeFilter(item.id)}
                aria-pressed={filter === item.id}
                className={filter === item.id
                  ? "rounded-full bg-arctic-800 px-3 py-1.5 text-xs font-semibold text-arctic-50 dark:bg-slate-200 dark:text-slate-900"
                  : "rounded-full border border-arctic-400/60 px-3 py-1.5 text-xs font-semibold text-arctic-800 hover:bg-arctic-100 dark:border-slate-600  dark:hover:bg-slate-800"}
              >
                {tr(...item.label)} <span className="opacity-75">{counts[item.id]}</span>
              </button>
            ))}
          </div>
          <label className="sr-only" htmlFor="whatsapp-history-search">{tr("Rechercher dans l’historique WhatsApp", "Search the WhatsApp history")}</label>
          <input
            id="whatsapp-history-search"
            className="input w-full lg:max-w-xs"
            type="search"
            aria-label={tr("Rechercher dans le journal", "Search the log")}
            placeholder={tr("Rechercher un numéro ou un message…", "Search a number or a message…")}
            value={query}
            onChange={(event) => changeQuery(event.target.value)}
          />
        </div>

        {messages.length === 0 ? (
          <EmptyState
            title={tr("Aucun message sortant pour le moment", "No outgoing message yet")}
            body={liveMode
              ? tr("Les messages envoyés par le bot et les autres fonctions WhatsApp apparaîtront ici avec leur statut.", "Messages sent by the bot and the other WhatsApp features will appear here with their status.")
              : tr("Le simulateur de conversation n’envoie aucun message. Les envois réels apparaîtront lorsque WhatsApp Cloud API sera configuré.", "The chat simulator sends no message. Real sends will appear once the WhatsApp Cloud API is set up.")}
          />
        ) : filtered.length === 0 ? (
          <EmptyState title={tr("Aucun résultat", "No results")} body={tr("Modifiez le filtre ou la recherche pour retrouver un message.", "Change the filter or the search to find a message.")} />
        ) : (
          <>
            <div className="space-y-2 md:hidden">
              {visible.map((message) => <MessageCard key={message.id} message={message} />)}
            </div>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="text-xs uppercase tracking-wide text-slate-600">
                  <tr>
                    <th className="px-3 py-2 font-semibold">{tr("Destinataire", "Recipient")}</th>
                    <th className="px-3 py-2 font-semibold">{tr("Message", "Message")}</th>
                    <th className="px-3 py-2 font-semibold">{tr("Statut", "Status")}</th>
                    <th className="px-3 py-2 font-semibold">{tr("Enregistré le", "Saved on")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-arctic-400/20">
                  {visible.map((message) => (
                    <tr key={message.id} className="align-top">
                      <td className="whitespace-nowrap px-3 py-3 font-medium text-arctic-900 dark:text-arctic-100">{message.contact || tr("Numéro inconnu", "Unknown number")}</td>
                      <td className="max-w-[28rem] px-3 py-3 text-arctic-800 dark:text-arctic-100">
                        <p className="whitespace-pre-wrap break-words">{message.body}</p>
                        <MessageReferences message={message} />
                      </td>
                      <td className="px-3 py-3"><StatusBadge status={message.status} /></td>
                      <td className="whitespace-nowrap px-3 py-3 text-arctic-700">
                        <time dateTime={message.createdAt}>{formatDate(message.createdAt)}</time>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-arctic-400/20 pt-3 text-xs text-arctic-700">
              <span>
                {filtered.length === 0 ? "0" : `${(currentPage - 1) * PAGE_SIZE + 1}–${Math.min(currentPage * PAGE_SIZE, filtered.length)}`} {tr("sur", "of")} {filtered.length} {tr("résultat(s) · Les", "result(s) · The")} {messages.length} {tr("derniers messages sont chargés.", "latest messages are loaded.")}
              </span>
              <div className="flex items-center gap-2">
                <button type="button" className="btn-ghost !min-h-8 !px-3 !py-1 text-xs" disabled={currentPage <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>{tr("Précédent", "Previous")}</button>
                <span>{tr("Page", "Page")} {currentPage} / {pageCount}</span>
                <button type="button" className="btn-ghost !min-h-8 !px-3 !py-1 text-xs" disabled={currentPage >= pageCount} onClick={() => setPage((value) => Math.min(pageCount, value + 1))}>{tr("Suivant", "Next")}</button>
              </div>
            </div>
          </>
        )}
      </div>
    </section>
  );
}

function Summary({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-arctic-400/25 bg-arctic-100/50 px-3 py-2 dark:border-slate-700 dark:bg-slate-800/80">
      <div className="text-[11px] font-medium text-arctic-700">{label}</div>
      <div className="mt-0.5 text-lg font-bold text-arctic-900">{value}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const { tr } = usePublicLang();
  const info = statusInfo(status);
  return (
    <span title={tr(...info.description)} className={`inline-flex max-w-56 rounded-full border px-2.5 py-1 text-xs font-semibold ${info.tone}`}>
      {tr(...info.label)}
    </span>
  );
}

function MessageReferences({ message }: { message: Message }) {
  const { tr } = usePublicLang();
  return (
    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-600">
      {message.orderId && <span>{tr("Commande ·", "Order ·")} {message.orderId.slice(-8).toUpperCase()}</span>}
      {message.messageId && <span title={message.messageId}>{tr("Référence WhatsApp ·", "WhatsApp reference ·")} {message.messageId.slice(-12)}</span>}
    </div>
  );
}

function MessageCard({ message }: { message: Message }) {
  const { tr } = usePublicLang();
  const info = statusInfo(message.status);
  return (
    <article className="rounded-xl border border-arctic-400/30 p-3 dark:border-arctic-700">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <span className="font-semibold text-arctic-900 dark:text-arctic-100">{message.contact || tr("Numéro inconnu", "Unknown number")}</span>
        <StatusBadge status={message.status} />
      </div>
      <p className="mt-2 whitespace-pre-wrap break-words text-sm text-arctic-800 dark:text-arctic-100">{message.body}</p>
      <p className="mt-2 text-xs text-arctic-700" title={tr(...info.description)}>
        <time dateTime={message.createdAt}>{formatDate(message.createdAt)}</time>
      </p>
      <MessageReferences message={message} />
    </article>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-xl border border-dashed border-arctic-400/50 px-5 py-8 text-center dark:border-slate-600 dark:bg-slate-900/50">
      <h3 className="font-semibold text-arctic-900 dark:text-arctic-100">{title}</h3>
      <p className="mx-auto mt-1 max-w-xl text-sm text-arctic-700">{body}</p>
    </div>
  );
}
