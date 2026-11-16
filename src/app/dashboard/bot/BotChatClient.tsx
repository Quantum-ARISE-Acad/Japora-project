"use client";

import { useEffect, useRef, useState } from "react";
import { usePublicLang } from "@/components/PublicLanguageProvider";

type Btn = { id: string; title: string };
type Msg =
  | { role: "customer"; text: string; at: number }
  | { role: "bot"; text: string; intent: string; buttons?: Btn[]; at: number }
  | { role: "system"; text: string; at: number };

const QUICK_TRIES = [
  "Bonjour",
  "Menu",
  "Cherche-moi un produit disponible en stock",
  "Proposer un deal",
  "Suivre ma commande",
  "Livrez-vous à domicile ?",
  "Je veux commander",
  "Mon solde",
];

export default function BotChatClient({ shopName }: { shopName: string }) {
  const { tr } = usePublicLang();
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: "system",
      text: `Console en direct connectée au catalogue MySQL et à l'Assistant IA Gemini de ${shopName}.`,
      at: 0,
    },
  ]);
  const [draft, setDraft] = useState("");
  const [fromPhone, setFromPhone] = useState("22893730817");
  const [dispatchWhatsApp, setDispatchWhatsApp] = useState(false);
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  async function send(text: string, display?: string) {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    const stamp = messages.length + 1;
    // Button taps send the id (e.g. ORDER:abc or TRACK:abc) but show the friendly label.
    setMessages((m) => [...m, { role: "customer", text: display ?? trimmed, at: stamp }]);
    setDraft("");
    setSending(true);
    try {
      const res = await fetch("/api/bot/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: trimmed, fromPhone, dispatchWhatsApp }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessages((m) => [
          ...m,
          { role: "system", text: data.error || "Erreur de connexion à l'assistant.", at: stamp + 1 },
        ]);
        return;
      }
      setMessages((m) => [
        ...m,
        {
          role: "bot",
          text: data.reply,
          intent: data.intent,
          buttons: Array.isArray(data.buttons) ? data.buttons : [],
          at: stamp + 1,
        },
      ]);
    } finally {
      setSending(false);
    }
  }

  function reset() {
    setMessages([
      {
        role: "system",
        text: `Conversation réinitialisée. Console en direct connectée à ${shopName}.`,
        at: 0,
      },
    ]);
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr,280px]">
      <div className="card flex h-[640px] flex-col overflow-hidden">
        <div className="flex items-center justify-between border-b border-arctic-400/30 bg-arctic-100/55 px-4 py-2 text-sm">
          <div className="flex items-center gap-2">
            <span className="grid h-7 w-7 place-items-center rounded-full bg-emerald-600 text-xs font-black text-white">
              🤖
            </span>
            <div className="leading-tight">
              <div className="font-semibold text-arctic-900">{shopName}</div>
              <div className="text-xs text-arctic-600">
                {tr("Assistant WhatsApp IA (Gemini)", "WhatsApp AI Assistant (Gemini)")}
              </div>
            </div>
          </div>
          <button onClick={reset} className="text-xs font-medium text-arctic-600 hover:text-arctic-800">
            {tr("Réinitialiser", "Reset")}
          </button>
        </div>

        <div
          ref={scrollRef}
          className="flex-1 space-y-2 overflow-y-auto bg-[#e7f1ee] p-4"
          style={{
            backgroundImage:
              "radial-gradient(rgba(255,255,255,0.4) 1px, transparent 1px)",
            backgroundSize: "16px 16px",
          }}
        >
          {messages.map((m) => {
            if (m.role === "system") {
              return (
                <div key={m.at} className="my-1 text-center">
                  <span className="rounded bg-white/80 px-2 py-1 text-[11px] text-arctic-600">
                    {m.text}
                  </span>
                </div>
              );
            }
            const isCustomer = m.role === "customer";
            const btns = m.role === "bot" ? m.buttons ?? [] : [];
            return (
              <div
                key={m.at}
                className={isCustomer ? "flex justify-end" : "flex flex-col items-start"}
              >
                <div
                  className={
                    "max-w-[78%] whitespace-pre-wrap rounded-lg px-3 py-2 text-sm shadow " +
                    (isCustomer ? "self-end bg-[#dcf8c6]" : "bg-white")
                  }
                >
                  {m.text}
                  {m.role === "bot" && (
                    <div className="mt-1 text-right text-[10px] uppercase tracking-wide text-arctic-500">
                      {m.intent}
                    </div>
                  )}
                </div>
                {btns.length > 0 && (
                  <div className="mt-1.5 flex max-w-[78%] flex-wrap gap-1.5">
                    {btns.map((b) => (
                      <button
                        key={b.id}
                        onClick={() => send(b.id, b.title)}
                        disabled={sending}
                        className="rounded-full border border-emerald-600/45 bg-white px-3 py-1 text-xs font-semibold text-emerald-800 shadow-sm hover:bg-emerald-50 disabled:opacity-60"
                      >
                        {b.title}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
          {sending && (
            <div className="flex justify-start">
              <div className="rounded-lg bg-white px-3 py-2 text-sm text-arctic-500 shadow">
                L&apos;assistant écrit…
              </div>
            </div>
          )}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(draft);
          }}
          className="flex items-center gap-2 border-t border-arctic-400/30 bg-white p-3"
        >
          <input
            className="input flex-1"
            placeholder={tr(
              "Écrivez un message client (ex: Menu, Suivre ma commande, prix…)",
              "Type a customer message (e.g. Menu, Track my order, price…)",
            )}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            disabled={sending}
          />
          <button className="btn-primary" disabled={sending || !draft.trim()}>
            {tr("Envoyer", "Send")}
          </button>
        </form>
      </div>

      <aside className="space-y-4">
        <div className="card p-4 space-y-3">
          <div>
            <h2 className="text-sm font-semibold text-arctic-900">
              {tr("Numéro WhatsApp Client", "Customer WhatsApp Number")}
            </h2>
            <p className="mb-2 mt-1 text-xs text-arctic-600">
              {tr(
                "Utilisé pour enregistrer les commandes dans MySQL et retrouver les commandes lors du suivi (« Suivre ma commande »).",
                "Used to record orders in MySQL and look up orders when tracking ('Track my order').",
              )}
            </p>
            <input
              className="input"
              inputMode="tel"
              value={fromPhone}
              onChange={(e) => setFromPhone(e.target.value)}
            />
          </div>

          <label className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50/70 p-2.5 text-xs text-emerald-950 cursor-pointer">
            <input
              type="checkbox"
              checked={dispatchWhatsApp}
              onChange={(e) => setDispatchWhatsApp(e.target.checked)}
              className="mt-0.5 rounded border-emerald-400 text-emerald-600"
            />
            <span>
              <strong>
                {tr("Envoyer aussi sur WhatsApp Cloud API", "Also send via WhatsApp Cloud API")}
              </strong>{" "}
              {tr(
                "(envoie réellement la réponse sur le WhatsApp de ce numéro)",
                "(actually sends the reply to this number's WhatsApp)",
              )}
            </span>
          </label>
        </div>

        <div className="card p-4">
          <h2 className="text-sm font-semibold text-arctic-900">
            {tr("Messages rapides à tester", "Quick test messages")}
          </h2>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {QUICK_TRIES.map((t) => (
              <button
                key={t}
                onClick={() => send(t)}
                disabled={sending}
                className="rounded-full bg-arctic-200/65 px-2.5 py-1 text-xs font-medium text-arctic-800 hover:bg-arctic-300 disabled:opacity-60"
              >
                {t}
              </button>
            ))}
          </div>
          <p className="mt-3 text-xs text-arctic-600">
            {tr(
              "Astuce : Cliquez sur Menu puis sur un bouton de produit pour passer une commande en 1 clic, puis cliquez sur 📦 Suivre commande !",
              "Tip: Click Menu then tap a product button to place a 1-click order, then tap 📦 Track order!",
            )}
          </p>
        </div>
      </aside>
    </div>
  );
}
