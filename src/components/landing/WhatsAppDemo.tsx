"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { SaasIcon } from "@/components/ui/SaasIcons";
import { usePublicLang } from "@/components/PublicLanguageProvider";

/**
 * The product, in ten seconds, without a signup.
 *
 * Japora's whole claim is that the shop lives inside the conversation — so the
 * landing page lets a visitor *have* that conversation rather than read about
 * it. Three taps walk the real bot flow: price check, order, payment. Each tap
 * is the same payload the live bot sends (MENU / ORDER:<id> / pay link), so the
 * demo cannot drift from the product without the script drifting too.
 *
 * It is a toy, and it says so: nothing is sent, nothing is charged.
 *
 * Accessibility: the taps are real buttons at the 44px target, the thread is a
 * polite live region so a screen reader hears each new message, and the typing
 * beat is skipped entirely under prefers-reduced-motion (the information is in
 * the message, not in the delay).
 */

type Turn = {
  /** What the customer taps — and therefore what they "say". */
  ask: string;
  /** The bot's reply. */
  reply: string;
  /** Optional ledger line attached to the reply (price, total, receipt). */
  figure?: string;
  figureLabel?: string;
  /** Marks the reply that closes the sale. */
  settled?: boolean;
};

const TYPING_MS = 620;

export default function WhatsAppDemo() {
  const { tr } = usePublicLang();
  const [step, setStep] = useState(0);
  const [typing, setTyping] = useState(false);
  const timer = useRef<number | null>(null);

  const turns: Turn[] = [
    {
      ask: tr("C'est combien la robe wax ?", "How much is the wax dress?"),
      reply: tr(
        "Robe Wax Ananas — tailles S, M, L en stock. Livraison Lomé le jour même.",
        "Pineapple Wax Dress — sizes S, M, L in stock. Same-day delivery in Lomé."
      ),
      figure: "12 500 FCFA",
      figureLabel: tr("Prix catalogue", "Catalog price"),
    },
    {
      ask: tr("Je prends la taille M", "I'll take size M"),
      reply: tr(
        "C'est noté. Commande #A1B2 réservée 30 minutes, livraison comprise.",
        "Got it. Order #A1B2 held for 30 minutes, delivery included."
      ),
      figure: "13 500 FCFA",
      figureLabel: tr("Total avec livraison", "Total with delivery"),
    },
    {
      ask: tr("Payer avec T-Money", "Pay with T-Money"),
      reply: tr(
        "Paiement reçu. Afiwa prépare votre colis — vous recevrez le suivi ici.",
        "Payment received. Afiwa is packing your parcel — tracking lands here."
      ),
      figure: "13 500 FCFA",
      figureLabel: tr("Payé · T-Money", "Paid · T-Money"),
      settled: true,
    },
  ];

  const done = step >= turns.length;

  useEffect(() => {
    return () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    };
  }, []);

  const advance = useCallback(() => {
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      setStep((s) => s + 1);
      return;
    }
    setTyping(true);
    timer.current = window.setTimeout(() => {
      setTyping(false);
      setStep((s) => s + 1);
    }, TYPING_MS);
  }, []);

  const replay = useCallback(() => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    setTyping(false);
    setStep(0);
  }, []);

  return (
    <div className="glass glass-edge overflow-hidden rounded-shape-xl">
      {/* Thread header — the shop, not the software. */}
      <div className="flex items-center gap-3 border-b border-arctic-300/50 px-4 py-3">
        <span
          aria-hidden
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-arctic-800 text-xs font-bold text-arctic-50"
        >
          AF
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-bold text-arctic-900">
            Afiwa Couture
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-arctic-600">
            <span
              aria-hidden
              className="h-1.5 w-1.5 rounded-full"
              style={{ background: "var(--signal-live)" }}
            />
            <span>{tr("Répond en quelques secondes", "Replies in seconds")}</span>
          </div>
        </div>
        <SaasIcon name="message" size={18} className="shrink-0 text-arctic-600" />
      </div>

      {/* The conversation. */}
      <div
        className="flex min-h-[286px] flex-col gap-2.5 px-4 py-4"
        aria-live="polite"
        aria-atomic="false"
      >
        {turns.slice(0, step).map((t, i) => (
          <div key={t.ask} className="flex flex-col gap-2.5">
            {/* Customer */}
            <div className="flex justify-end">
              <p className="max-w-[80%] rounded-shape-md rounded-br-sm bg-arctic-800 px-3.5 py-2 text-[13px] leading-snug text-arctic-50">
                {t.ask}
              </p>
            </div>
            {/* Bot */}
            <div className="flex justify-start">
              <div
                className="max-w-[86%] rounded-shape-md rounded-bl-sm border border-arctic-300/55 px-3.5 py-2.5"
                style={{ background: "var(--aurora-surface-strong)" }}
              >
                <p className="text-[13px] leading-snug text-arctic-800">{t.reply}</p>
                {t.figure && (
                  <div className="mt-2 border-t border-brand/30 pt-1.5">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-arctic-600">
                      {t.figureLabel}
                    </div>
                    <div className="a-num mt-0.5 flex items-center gap-1.5 font-display text-base font-bold text-brand-dark">
                      {t.settled && (
                        <SaasIcon name="check" size={14} className="text-brand-dark" />
                      )}
                      <span>{t.figure}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
            {i === turns.length - 1 && t.settled && (
              <p className="mt-1 text-center text-[11px] text-arctic-600">
                {tr(
                  "Afiwa reçoit la commande payée dans son tableau de bord, et le bilan du soir à 18h.",
                  "Afiwa gets the paid order in her dashboard, and the 6 PM summary tonight."
                )}
              </p>
            )}
          </div>
        ))}

        {typing && (
          <div className="flex justify-start">
            <div
              className="rounded-shape-md rounded-bl-sm border border-arctic-300/55 px-4 py-3"
              style={{ background: "var(--aurora-surface-strong)" }}
            >
              <span className="sr-only">
                {tr("Le bot écrit…", "The bot is typing…")}
              </span>
              <span aria-hidden className="flex items-center gap-1">
                {[0, 1, 2].map((d) => (
                  <span
                    key={d}
                    className="h-1.5 w-1.5 rounded-full bg-arctic-500"
                    style={{
                      animation: "a-fade-in 900ms var(--ease-effect) infinite alternate",
                      animationDelay: `${d * 160}ms`,
                    }}
                  />
                ))}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* The tap bar — the real quick replies the bot sends. */}
      <div className="border-t border-arctic-300/50 px-4 py-3">
        {!done ? (
          <button
            type="button"
            onClick={advance}
            disabled={typing}
            className="a-btn a-btn--filled sheen w-full justify-between gap-3 text-left disabled:opacity-60"
          >
            <span className="truncate text-[13px]">{turns[step].ask}</span>
            <SaasIcon name="arrow-right" size={16} />
          </button>
        ) : (
          <button
            type="button"
            onClick={replay}
            className="btn-ghost w-full justify-center gap-2"
          >
            <SaasIcon name="zap" size={15} className="text-brand-dark" />
            <span>{tr("Rejouer la conversation", "Replay the conversation")}</span>
          </button>
        )}
        <p className="mt-2 text-center text-[11px] text-arctic-600">
          {done
            ? tr(
                "Démonstration — aucun message envoyé, aucun paiement prélevé.",
                "A demo — no message sent, no payment taken."
              )
            : tr(
                "Touchez pour répondre comme un client. Rien n'est envoyé.",
                "Tap to reply as a customer would. Nothing is sent."
              )}
        </p>
      </div>
    </div>
  );
}
