"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { usePublicLang } from "@/components/PublicLanguageProvider";

export type WaitingCustomer = {
  id: string;
  contact: string;
  lastMessage: string;
  createdAt: string;
  expiresAt: string;
  messages: { id: string; direction: string; body: string; createdAt: string }[];
};

function time(iso: string): string {
  return new Date(iso).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

/**
 * Customers who asked for the vendor: the assistant is paused for them. The
 * vendor answers here (sent on WhatsApp) and hands the conversation back.
 */
export default function HandoffInbox({ waiting }: { waiting: WaitingCustomer[] }) {
  const { tr } = usePublicLang();
  return (
    <section id="clients-en-attente" className="card p-5" aria-labelledby="handoff-title">
      <h2 id="handoff-title" className="text-base font-semibold text-arctic-900">
        {tr("Clients qui attendent une réponse", "Customers waiting for a reply")}
      </h2>
      <p className="mt-1 text-sm text-arctic-600">
        {tr("Ces clients ont demandé à parler au vendeur. L’assistant reste en pause pour eux pendant 12 heures, ou jusqu’à ce que vous lui rendiez la main.", "These customers asked to talk to the vendor. The assistant stays paused for them for 12 hours, or until you hand it back.")}
      </p>
      {waiting.length === 0 ? (
        <p className="mt-4 rounded-lg border border-arctic-300/60 px-4 py-3 text-sm text-arctic-600">
          {tr("Aucun client n’attend. L’assistant répond à tout le monde.", "Nobody is waiting. The assistant answers everyone.")}
        </p>
      ) : (
        <ul className="mt-4 space-y-4">
          {waiting.map((w) => (
            <WaitingRow key={w.id} item={w} />
          ))}
        </ul>
      )}
    </section>
  );
}

function WaitingRow({ item }: { item: WaitingCustomer }) {
  const { tr } = usePublicLang();
  const router = useRouter();
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState<"" | "send" | "resume">("");
  const [status, setStatus] = useState("");

  async function send() {
    if (!reply.trim()) return;
    setBusy("send");
    setStatus("");
    const res = await fetch("/api/whatsapp/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to: item.contact, body: reply.trim() }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy("");
    if (res.ok && data.ok !== false) {
      setReply("");
      setStatus(tr("Message envoyé.", "Message sent."));
      router.refresh();
    } else {
      setStatus(data.error || tr("L’envoi a échoué.", "Sending failed."));
    }
  }

  async function resume() {
    setBusy("resume");
    await fetch("/api/bot/handoff", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contact: item.contact }),
    });
    setBusy("");
    router.refresh();
  }

  const inputId = `handoff-reply-${item.id}`;
  return (
    <li className="rounded-xl border border-arctic-300/60 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="a-num font-semibold text-arctic-900">+{item.contact}</span>
        <span className="text-xs text-arctic-600">
          {tr("Depuis", "Since")} {time(item.createdAt)} {tr("· pause jusqu’à", "· paused until")} {time(item.expiresAt)}
        </span>
      </div>
      {item.messages.length > 0 && (
        <ol className="mt-3 space-y-1.5 text-sm" aria-label={tr("Derniers messages", "Latest messages")}>
          {item.messages.map((m) => (
            <li key={m.id} className={m.direction === "IN" ? "text-arctic-900" : "text-arctic-600"}>
              <span className="font-semibold">{m.direction === "IN" ? tr("Client", "Customer") : tr("Boutique", "Shop")} :</span>{" "}
              {m.body.replace(/^\[interactive\]\s*/, "")}
            </li>
          ))}
        </ol>
      )}
      <label htmlFor={inputId} className="label mt-3">
        {tr("Votre réponse", "Your reply")}
      </label>
      <textarea
        id={inputId}
        className="input min-h-[72px]"
        value={reply}
        onChange={(e) => setReply(e.target.value)}
        placeholder={tr("Écrivez votre message, il part sur WhatsApp.", "Write your message, it goes out on WhatsApp.")}
      />
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button type="button" className="btn-primary min-h-[44px]" onClick={send} disabled={busy !== "" || !reply.trim()}>
          {busy === "send" ? tr("Envoi…", "Sending…") : tr("Envoyer", "Send")}
        </button>
        <button type="button" className="btn-ghost min-h-[44px]" onClick={resume} disabled={busy !== ""}>
          {busy === "resume" ? "…" : tr("Rendre la main à l’assistant", "Hand back to the assistant")}
        </button>
        {status && (
          <span role="status" className="text-sm text-arctic-600">
            {status}
          </span>
        )}
      </div>
    </li>
  );
}
