"use client";

import { useEffect, useRef, useState } from "react";

type Btn = { id: string; title: string };
type Msg =
  | { role: "customer"; text: string; at: number }
  | { role: "bot"; text: string; intent: string; buttons?: Btn[]; at: number }
  | { role: "system"; text: string; at: number };

const QUICK_TRIES = [
  "Hi",
  "Menu",
  "How much for the Ankara gown?",
  "I want the blue one",
  "Order Aso-Oke",
  "Wetin you get?",
  "Bei gani?",
  "Je veux le senateur",
  "What's my balance?",
];

export default function BotChatClient({ shopName }: { shopName: string }) {
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: "system",
      text: `Simulation d’une conversation WhatsApp avec ${shopName}. Aucun message n’est envoyé.`,
      at: 0,
    },
  ]);
  const [draft, setDraft] = useState("");
  const [fromPhone, setFromPhone] = useState("");
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
    // Button taps send the id (e.g. ORDER:abc) but show the friendly label.
    setMessages((m) => [...m, { role: "customer", text: display ?? trimmed, at: stamp }]);
    setDraft("");
    setSending(true);
    try {
      const res = await fetch("/api/bot/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: trimmed, fromPhone }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessages((m) => [
          ...m,
          { role: "system", text: data.error || "La simulation a échoué.", at: stamp + 1 },
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
    } catch {
      setMessages((m) => [
        ...m,
        { role: "system", text: "Impossible de joindre le simulateur. Réessayez.", at: stamp + 1 },
      ]);
    } finally {
      setSending(false);
    }
  }

  function reset() {
    setMessages([
      {
        role: "system",
        text: `Simulation réinitialisée. Aucun message WhatsApp n’est envoyé.`,
        at: 0,
      },
    ]);
  }

  return (
    <div className="bot-chat-screen grid gap-4 lg:grid-cols-[1fr,260px]">
      <div className="card flex h-[640px] flex-col overflow-hidden">
        <div className="flex items-center justify-between border-b border-arctic-400/30 bg-arctic-100/55 px-4 py-2 text-sm dark:border-arctic-700 dark:bg-arctic-900/80">
          <div className="flex items-center gap-2">
            <span className="grid h-7 w-7 place-items-center rounded-full bg-brand text-xs font-black text-white">J</span>
            <div className="leading-tight">
              <div className="font-semibold text-arctic-900">{shopName}</div>
              <div className="text-xs text-arctic-700 dark:text-arctic-300">Aperçu du bot Japora</div>
            </div>
          </div>
          <button onClick={reset} className="bot-chat-control text-xs font-semibold text-arctic-700 hover:text-arctic-900 dark:text-arctic-200 dark:hover:text-white">
            Réinitialiser
          </button>
        </div>

        <div
          ref={scrollRef}
          className="bot-chat-transcript flex-1 space-y-2 overflow-y-auto bg-[#e7f1ee] p-4 dark:bg-[#17211f]"
          style={{
            backgroundImage:
              "radial-gradient(rgba(15,23,42,0.07) 1px, transparent 1px)",
            backgroundSize: "18px 18px",
          }}
        >
          {messages.map((m) => {
            if (m.role === "system") {
              return (
                <div key={m.at} className="my-1 text-center">
                  <span className="bot-chat-system rounded border border-arctic-300 bg-arctic-100 px-2 py-1 text-[11px] font-medium text-arctic-800 shadow-sm dark:border-arctic-600 dark:bg-[#26312e] dark:text-arctic-100">
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
                    "bot-chat-message max-w-[78%] whitespace-pre-wrap rounded-lg px-3 py-2 text-[15px] leading-relaxed shadow " +
                    (isCustomer
                      ? "bot-chat-message-customer self-end bg-[#dcf8c6] text-arctic-900 dark:border dark:border-emerald-700 dark:bg-[#174b3a] dark:text-white"
                      : "bot-chat-message-bot border border-arctic-300 bg-white text-arctic-900 dark:border-arctic-600 dark:bg-[#293330] dark:text-arctic-50")
                  }
                >
                  {m.text}
                  {m.role === "bot" && (
                    <div className="bot-chat-message-meta mt-1 text-right text-[10px] uppercase tracking-wide text-arctic-600 dark:text-arctic-300">
                      {({ greeting: "salutation", price_check: "prix", order: "commande", menu: "catalogue", unpaid: "solde", unknown: "non classé" } as Record<string, string>)[m.intent] || m.intent}
                    </div>
                  )}
                </div>
                {btns.length > 0 && (
                  <div className="mt-1 flex max-w-[78%] flex-wrap gap-1.5">
                    {btns.map((b) => (
                      <button
                        key={b.id}
                        onClick={() => send(b.id, b.title)}
                        disabled={sending}
                        className="bot-chat-action rounded-full border border-arctic-400/60 bg-white px-3 py-1 text-xs font-semibold text-arctic-900 shadow-sm hover:bg-arctic-100 disabled:opacity-60 dark:border-arctic-600 dark:bg-[#303b37] dark:text-white dark:hover:bg-[#3b4843]"
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
              <div className="rounded-lg border border-arctic-300 bg-white px-3 py-2 text-sm text-arctic-700 shadow dark:border-arctic-600 dark:bg-[#293330] dark:text-arctic-200">
                Le bot répond…
              </div>
            </div>
          )}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(draft);
          }}
          className="bot-chat-input-bar flex items-center gap-2 border-t border-arctic-400/30 bg-white p-3 dark:border-arctic-700 dark:bg-arctic-900/90"
        >
          <input
            className="input flex-1"
            placeholder="Écrivez un message client à tester…"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            disabled={sending}
          />
          <button className="btn-primary" disabled={sending || !draft.trim()}>
            Envoyer au simulateur
          </button>
        </form>
      </div>

      <aside className="space-y-4">
        <div className="card p-4">
          <h2 className="text-sm font-semibold text-arctic-900">Téléphone du client simulé</h2>
          <p className="bot-chat-help mb-2 mt-1 text-xs text-arctic-700 dark:text-arctic-300">
            Sert à rechercher les soldes impayés déjà enregistrés pour ce numéro lorsque vous testez « balance / solde ». Ce champ ne déclenche aucun envoi WhatsApp.
          </p>
          <input
            className="input"
            inputMode="tel"
            placeholder="Ex. +228 90 00 00 00"
            value={fromPhone}
            onChange={(e) => setFromPhone(e.target.value)}
          />
        </div>

        <div className="card p-4">
          <h2 className="text-sm font-semibold text-arctic-900">Exemples à tester</h2>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {QUICK_TRIES.map((t) => (
              <button
                key={t}
                onClick={() => send(t)}
                disabled={sending}
                className="bot-chat-example rounded-full bg-arctic-200/65 px-2.5 py-1 text-xs font-semibold text-arctic-900 hover:bg-arctic-300 disabled:opacity-60 dark:border dark:border-arctic-600 dark:bg-[#303b37] dark:text-arctic-100 dark:hover:bg-[#3b4843]"
              >
                {t}
              </button>
            ))}
          </div>
          <p className="bot-chat-help mt-3 text-xs text-arctic-700 dark:text-arctic-300">
            Testez les fautes (&quot;ankra&quot;), le pidgin (&quot;wetin you get&quot;), le swahili
            (&quot;bei gani&quot;) et le français (&quot;je veux&quot;) pour vérifier la recherche tolérante.
          </p>
        </div>
      </aside>
    </div>
  );
}
