"use client";

import { SaasIcon, type SaasIconName } from "@/components/ui/SaasIcons";
import { usePublicLang } from "@/components/PublicLanguageProvider";

/**
 * One order, end to end — the mechanism, drawn.
 *
 * This replaces roughly 330 words of step prose. It is built from real text in
 * flow layout rather than from SVG <text>, which buys three things the drawn
 * version would not: it translates with the rest of the page, it reflows to a
 * vertical stack on a phone instead of shrinking to 6px, and a screen reader
 * reads it as the ordered list it actually is.
 *
 * The connectors are the only drawn parts, and they are hidden from assistive
 * tech — the <ol> already carries the sequence.
 */

type Stage = {
  icon: SaasIconName;
  lane: string;
  title: string;
  detail: string;
};

export default function OrderFlowDiagram() {
  const { tr } = usePublicLang();

  const stages: Stage[] = [
    {
      icon: "message",
      lane: tr("Cliente", "Customer"),
      title: tr("« C'est combien ? »", "“How much?”"),
      detail: tr("Sur WhatsApp, comme toujours.", "On WhatsApp, as always."),
    },
    {
      icon: "bot",
      lane: tr("Bot", "Bot"),
      title: tr("Prix, taille, stock", "Price, size, stock"),
      detail: tr("Lus dans votre catalogue.", "Read from your catalog."),
    },
    {
      icon: "wallet",
      lane: tr("Paiement", "Payment"),
      title: tr("T-Money, Flooz, carte", "T-Money, Flooz, card"),
      detail: tr("Dans le fil, sans redirection.", "In the thread, no redirect."),
    },
    {
      icon: "chart",
      lane: tr("Vous", "You"),
      title: tr("Commande « Payée »", "Order marked “Paid”"),
      detail: tr("Le stock se met à jour seul.", "Stock updates itself."),
    },
    {
      icon: "moon",
      lane: tr("18 h", "6 PM"),
      title: tr("Le bilan du jour", "The day's summary"),
      detail: tr("Envoyé sur votre WhatsApp.", "Sent to your WhatsApp."),
    },
  ];

  return (
    <figure className="m-0">
      <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5 lg:gap-0">
        {stages.map((s, i) => (
          <li key={s.lane} data-reveal="up" className="relative flex lg:block">
            {/* Connector — decorative; the list order carries the sequence. */}
            {i < stages.length - 1 && (
              <span
                aria-hidden
                className="pointer-events-none absolute hidden lg:block"
                style={{
                  left: "calc(50% + 28px)",
                  right: "calc(-50% + 28px)",
                  top: "22px",
                  height: "1px",
                  background:
                    "linear-gradient(90deg, rgb(var(--gold) / 0.55), rgb(var(--gold) / 0.18))",
                }}
              />
            )}

            <div className="flex w-full items-start gap-3 px-1 lg:flex-col lg:items-center lg:gap-0 lg:text-center">
              <span
                aria-hidden
                className="relative z-10 grid h-11 w-11 shrink-0 place-items-center rounded-full border border-brand/40 bg-arctic-50 text-brand-dark shadow-elev-xs"
              >
                <SaasIcon name={s.icon} size={18} />
              </span>
              <div className="min-w-0 lg:mt-3">
                <div className="a-eyebrow">{s.lane}</div>
                <div className="mt-1 text-sm font-bold text-arctic-900">
                  {s.title}
                </div>
                <div className="mt-0.5 text-xs text-arctic-700">{s.detail}</div>
              </div>
            </div>
          </li>
        ))}
      </ol>
      <figcaption className="mt-5 text-center text-xs text-arctic-700">
        {tr(
          "Une commande, de la question au bilan du soir. Vous n'intervenez que si vous le voulez.",
          "One order, from the question to the evening summary. You step in only if you want to."
        )}
      </figcaption>
    </figure>
  );
}
